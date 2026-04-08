import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mock } from "bun:test";

let mockedModelType: "gemini" | undefined;
let providersModule: typeof import("../providers") | null = null;

function installSettingsMock() {
  mock.module("../../settings/settings.js", () => ({
    getInitialSettings: () =>
      mockedModelType ? { modelType: mockedModelType } : {},
  }));
}

async function getProvidersModule() {
  if (providersModule === null) {
    installSettingsMock();
    providersModule = await import("../providers");
  }
  return providersModule;
}

describe("getAPIProvider", () => {
  const envKeys = [
    "CLAUDE_CODE_USE_GEMINI",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_USE_OPENAI",
    "CLAUDE_CODE_USE_GROK",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    mockedModelType = undefined;
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    mockedModelType = undefined;
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  afterAll(() => {
    mock.restore();
  });

  test('returns "firstParty" by default', async () => {
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("firstParty");
  });

  test('returns "gemini" when modelType is gemini', async () => {
    mockedModelType = "gemini";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("gemini");
  });

  test("modelType takes precedence over environment variables", async () => {
    mockedModelType = "gemini";
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("gemini");
  });

  test('returns "gemini" when CLAUDE_CODE_USE_GEMINI is set', async () => {
    process.env.CLAUDE_CODE_USE_GEMINI = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("gemini");
  });

  test('returns "bedrock" when CLAUDE_CODE_USE_BEDROCK is set', async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("bedrock");
  });

  test('returns "vertex" when CLAUDE_CODE_USE_VERTEX is set', async () => {
    process.env.CLAUDE_CODE_USE_VERTEX = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("vertex");
  });

  test('returns "foundry" when CLAUDE_CODE_USE_FOUNDRY is set', async () => {
    process.env.CLAUDE_CODE_USE_FOUNDRY = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("foundry");
  });

  test("bedrock takes precedence over gemini", async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    process.env.CLAUDE_CODE_USE_GEMINI = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("bedrock");
  });

  test("bedrock takes precedence over vertex", async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    process.env.CLAUDE_CODE_USE_VERTEX = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("bedrock");
  });

  test("bedrock wins when all three env vars are set", async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    process.env.CLAUDE_CODE_USE_VERTEX = "1";
    process.env.CLAUDE_CODE_USE_FOUNDRY = "1";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("bedrock");
  });

  test('"true" is truthy', async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "true";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("bedrock");
  });

  test('"0" is not truthy', async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "0";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("firstParty");
  });

  test('empty string is not truthy', async () => {
    process.env.CLAUDE_CODE_USE_BEDROCK = "";
    const { getAPIProvider } = await getProvidersModule();
    expect(getAPIProvider()).toBe("firstParty");
  });
});

describe("isFirstPartyAnthropicBaseUrl", () => {
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalUserType = process.env.USER_TYPE;

  afterEach(() => {
    if (originalBaseUrl !== undefined) {
      process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.ANTHROPIC_BASE_URL;
    }
    if (originalUserType !== undefined) {
      process.env.USER_TYPE = originalUserType;
    } else {
      delete process.env.USER_TYPE;
    }
  });

  afterAll(() => {
    mock.restore();
  });

  test("returns true when ANTHROPIC_BASE_URL is not set", async () => {
    delete process.env.ANTHROPIC_BASE_URL;
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns true for api.anthropic.com", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns false for custom URL", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://my-proxy.com";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false);
  });

  test("returns false for invalid URL", async () => {
    process.env.ANTHROPIC_BASE_URL = "not-a-url";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false);
  });

  test("returns true for staging URL when USER_TYPE is ant", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://api-staging.anthropic.com";
    process.env.USER_TYPE = "ant";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns true for URL with path", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns true for trailing slash", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com/";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns false for subdomain attack", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://evil-api.anthropic.com";
    const { isFirstPartyAnthropicBaseUrl } = await getProvidersModule();
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false);
  });
});
