import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  connectVoiceStream,
  getVoiceSttProvider,
  isVoiceStreamAvailable,
  voiceStreamSttInternals,
} from '../voiceStreamSTT.js'

let mockedOpenAICalls: Array<Record<string, unknown>> = []

describe('voiceStreamSTT', () => {
  const originalInternals = {
    getAPIProvider: voiceStreamSttInternals.getAPIProvider,
    isAnthropicAuthEnabled: voiceStreamSttInternals.isAnthropicAuthEnabled,
    getClaudeAIOAuthTokens: voiceStreamSttInternals.getClaudeAIOAuthTokens,
    getOpenAIApiKey: voiceStreamSttInternals.getOpenAIApiKey,
    getOpenAIBaseURL: voiceStreamSttInternals.getOpenAIBaseURL,
    getOpenAITranscriptionModel: voiceStreamSttInternals.getOpenAITranscriptionModel,
    createOpenAIClient: voiceStreamSttInternals.createOpenAIClient,
    toUploadFile: voiceStreamSttInternals.toUploadFile,
  }

  beforeEach(() => {
    mockedOpenAICalls = []
    voiceStreamSttInternals.getAPIProvider = () => 'firstParty'
    voiceStreamSttInternals.isAnthropicAuthEnabled = () => false
    voiceStreamSttInternals.getClaudeAIOAuthTokens = () => null
    voiceStreamSttInternals.getOpenAIApiKey = () => ''
    voiceStreamSttInternals.getOpenAIBaseURL = () => undefined
    voiceStreamSttInternals.getOpenAITranscriptionModel = () =>
      'gpt-4o-mini-transcribe'
    voiceStreamSttInternals.createOpenAIClient = () =>
      ({
        audio: {
          transcriptions: {
            create: async (params: Record<string, unknown>) => {
              mockedOpenAICalls.push(params)
              return { text: 'hello world' }
            },
          },
        },
      }) as never
    voiceStreamSttInternals.toUploadFile = async (
      data: Buffer,
      name: string,
      options?: Record<string, unknown>,
    ) => ({
      data,
      name,
      options,
    }) as never
  })

  afterEach(() => {
    voiceStreamSttInternals.getAPIProvider = originalInternals.getAPIProvider
    voiceStreamSttInternals.isAnthropicAuthEnabled =
      originalInternals.isAnthropicAuthEnabled
    voiceStreamSttInternals.getClaudeAIOAuthTokens =
      originalInternals.getClaudeAIOAuthTokens
    voiceStreamSttInternals.getOpenAIApiKey = originalInternals.getOpenAIApiKey
    voiceStreamSttInternals.getOpenAIBaseURL =
      originalInternals.getOpenAIBaseURL
    voiceStreamSttInternals.getOpenAITranscriptionModel =
      originalInternals.getOpenAITranscriptionModel
    voiceStreamSttInternals.createOpenAIClient =
      originalInternals.createOpenAIClient
    voiceStreamSttInternals.toUploadFile = originalInternals.toUploadFile
  })

  test.serial('returns openai when OPENAI_API_KEY is configured', () => {
    voiceStreamSttInternals.getAPIProvider = () => 'openai'
    voiceStreamSttInternals.getOpenAIApiKey = () => 'sk-test'

    expect(getVoiceSttProvider()).toBe('openai')
    expect(isVoiceStreamAvailable()).toBe(true)
  })

  test.serial('returns null when no supported provider is configured', () => {
    voiceStreamSttInternals.getAPIProvider = () => 'firstParty'
    voiceStreamSttInternals.getOpenAIApiKey = () => ''
    voiceStreamSttInternals.isAnthropicAuthEnabled = () => false
    voiceStreamSttInternals.getClaudeAIOAuthTokens = () => null

    expect(getVoiceSttProvider()).toBeNull()
    expect(isVoiceStreamAvailable()).toBe(false)
  })

  test.serial('creates transcription from buffered audio for api key provider', async () => {
    voiceStreamSttInternals.getAPIProvider = () => 'openai'
    voiceStreamSttInternals.getOpenAIApiKey = () => 'sk-test'
    voiceStreamSttInternals.getOpenAITranscriptionModel = () =>
      'gpt-4o-mini-transcribe'

    const transcripts: string[] = []
    let readyCalled = false
    const connection = await connectVoiceStream(
      {
        onTranscript: (text, isFinal) => {
          if (isFinal) transcripts.push(text)
        },
        onError: message => {
          throw new Error(message)
        },
        onClose: () => {},
        onReady: () => {
          readyCalled = true
        },
      },
      { language: 'en', keyterms: ['claude'] },
    )

    expect(connection).not.toBeNull()
    expect(readyCalled).toBe(true)

    connection!.send(Buffer.from('pcm-audio'))
    const source = await connection!.finalize()

    expect(source).toBe('post_closestream_endpoint')
    expect(transcripts).toEqual(['hello world'])
    expect(mockedOpenAICalls).toHaveLength(1)
    expect(mockedOpenAICalls[0]?.model).toBe('gpt-4o-mini-transcribe')
    expect(mockedOpenAICalls[0]?.language).toBe('en')
    expect(mockedOpenAICalls[0]?.prompt).toContain('claude')
    const uploadedFile = mockedOpenAICalls[0]?.file as {
      data: Buffer
      name: string
      options?: { type?: string }
    }
    expect(uploadedFile.name).toBe('voice-input.wav')
    expect(uploadedFile.options?.type).toBe('audio/wav')
    expect(uploadedFile.data.subarray(0, 4).toString()).toBe('RIFF')
    expect(uploadedFile.data.subarray(8, 12).toString()).toBe('WAVE')
  })
})
