import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { getGrokClient, clearGrokClientCache } from '../client.js'

describe('getGrokClient', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    clearGrokClientCache()
    process.env.GROK_API_KEY = 'test-key'
    delete process.env.GROK_BASE_URL
  })

  afterEach(() => {
    clearGrokClientCache()
    process.env = { ...originalEnv }
  })

  test('creates client with default base URL', async () => {
    let requestedUrl = ''
    const client = getGrokClient({
      fetchOverride: async input => {
        requestedUrl = String(input)
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })
    expect(client).toBeDefined()

    await client.models.list()
    expect(requestedUrl).toStartWith('https://api.x.ai/v1/models')
  })

  test('uses GROK_BASE_URL when set', async () => {
    process.env.GROK_BASE_URL = 'https://custom.grok.api/v1'
    let requestedUrl = ''
    const client = getGrokClient({
      fetchOverride: async input => {
        requestedUrl = String(input)
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await client.models.list()
    expect(requestedUrl).toStartWith('https://custom.grok.api/v1/models')
  })

  test('returns cached client on second call', () => {
    const client1 = getGrokClient()
    const client2 = getGrokClient()
    expect(client1).toBe(client2)
  })

  test('clearGrokClientCache resets cache', () => {
    const client1 = getGrokClient()
    clearGrokClientCache()
    process.env.GROK_BASE_URL = 'https://other.api/v1'
    const client2 = getGrokClient()
    expect(client1).not.toBe(client2)
  })
})
