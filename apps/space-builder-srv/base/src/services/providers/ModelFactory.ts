import OpenAI from 'openai'

let resolveCredentialFn: ((credentialId: string) => Promise<string>) | null = null

export function setCredentialResolver(fn: (credentialId: string) => Promise<string>) {
  resolveCredentialFn = fn
}

async function resolveCredential(credentialId: string): Promise<string> {
  if (!resolveCredentialFn) throw new Error('Credential resolver is not configured')
  const key = await resolveCredentialFn(credentialId)
  if (!key) throw new Error('Credential key not found')
  return key
}

type CallArgs = { provider: string; model: string; credentialId?: string; prompt: string }

type TestEntry = {
  id: string
  provider: string
  model: string
  apiKey: string
  baseURL?: string
  extraHeaders?: Record<string, string>
}

function bool(name: string): boolean {
  return String(process.env[name] || '').toLowerCase() === 'true'
}
function str(name: string): string {
  return String(process.env[name] || '').trim()
}
function parseJsonSafe(s: string): Record<string, string> | undefined {
  try {
    return s ? (JSON.parse(s) as Record<string, string>) : undefined
  } catch (_) {
    return undefined
  }
}

function collectTestEntries(): TestEntry[] {
  const entries: TestEntry[] = []
  const add = (id: string, provider: string, mEnv: string, kEnv: string, bEnv?: string, extra?: Record<string, string>) => {
    const model = str(mEnv)
    const apiKey = str(kEnv)
    const baseURL = bEnv ? str(bEnv) : ''
    // For OpenAI native baseURL can be empty; otherwise require baseURL
    const requireBaseUrl = provider !== 'openai'
    if (!model || !apiKey || (requireBaseUrl && !baseURL)) return
    entries.push({ id, provider, model, apiKey, baseURL: baseURL || undefined, extraHeaders: extra })
  }

  if (bool('SPACE_BUILDER_TEST_ENABLE_GROQ')) add('groq', 'groq', 'GROQ_TEST_MODEL', 'GROQ_TEST_API_KEY', 'GROQ_TEST_BASE_URL')
  if (bool('SPACE_BUILDER_TEST_ENABLE_OPENAI')) add('openai', 'openai', 'OPENAI_TEST_MODEL', 'OPENAI_TEST_API_KEY')
  if (bool('SPACE_BUILDER_TEST_ENABLE_CEREBRAS')) add('cerebras', 'cerebras', 'CEREBRAS_TEST_MODEL', 'CEREBRAS_TEST_API_KEY', 'CEREBRAS_TEST_BASE_URL')
  if (bool('SPACE_BUILDER_TEST_ENABLE_OPENROUTER')) {
    const extra = {
      ...(str('OPENROUTER_TEST_REFERER') ? { 'HTTP-Referer': str('OPENROUTER_TEST_REFERER') } : {}),
      ...(str('OPENROUTER_TEST_TITLE') ? { 'X-Title': str('OPENROUTER_TEST_TITLE') } : {})
    }
    const model = str('OPENROUTER_TEST_MODEL')
    const apiKey = str('OPENROUTER_TEST_API_KEY')
    const baseURL = str('OPENROUTER_TEST_BASE_URL')
    if (model && apiKey && baseURL) entries.push({ id: 'openrouter', provider: 'openrouter', model, apiKey, baseURL, extraHeaders: extra })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_GIGACHAT')) add('gigachat', 'gigachat', 'GIGACHAT_TEST_MODEL', 'GIGACHAT_TEST_API_KEY', 'GIGACHAT_TEST_BASE_URL')
  if (bool('SPACE_BUILDER_TEST_ENABLE_YANDEXGPT')) add('yandexgpt', 'yandexgpt', 'YANDEXGPT_TEST_MODEL', 'YANDEXGPT_TEST_API_KEY', 'YANDEXGPT_TEST_BASE_URL')
  if (bool('SPACE_BUILDER_TEST_ENABLE_GOOGLE')) add('google', 'google', 'GOOGLE_TEST_MODEL', 'GOOGLE_TEST_API_KEY', 'GOOGLE_TEST_BASE_URL')
  if (bool('SPACE_BUILDER_TEST_ENABLE_CUSTOM')) add('custom', 'custom', 'CUSTOM_TEST_MODEL', 'CUSTOM_TEST_API_KEY', 'CUSTOM_TEST_BASE_URL', parseJsonSafe(str('CUSTOM_TEST_EXTRA_HEADERS_JSON') || ''))

  return entries
}

async function callOpenAIBase({ model, apiKey, baseURL, prompt, extraHeaders }: { model: string; apiKey: string; baseURL?: string; prompt: string; extraHeaders?: Record<string, string> }): Promise<string> {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}), ...(extraHeaders ? ({ defaultHeaders: extraHeaders } as any) : {}) })
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You must output raw JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  })
  return resp.choices?.[0]?.message?.content || ''
}

export async function callProvider(args: CallArgs): Promise<string> {
  const testMode = bool('SPACE_BUILDER_TEST_MODE')
  const disableUserCreds = bool('SPACE_BUILDER_DISABLE_USER_CREDENTIALS')

  if (testMode && (disableUserCreds || String(args.provider || '').startsWith('test:'))) {
    const entries = collectTestEntries()
    if (!entries.length) throw new Error('[SpaceBuilder] No test providers enabled or misconfigured in .env')
    const requestedId = String(args.provider || '').split(':')[1]
    const picked = entries.find((e) => e.id === requestedId) || entries[0]
    return callOpenAIBase({ model: picked.model, apiKey: picked.apiKey, baseURL: picked.baseURL, prompt: args.prompt, extraHeaders: picked.extraHeaders })
  }

  const provider = String(args.provider || '').toLowerCase()
  if (provider === 'openai' || provider === 'azureopenai') return callOpenAI(args)
  if (provider === 'groq') return callOpenAICompatible(args)
  if (provider === 'groq_test') {
    // Backward-compatible only if env is fully configured; no defaults
    const model = str('GROQ_TEST_MODEL')
    const apiKey = str('GROQ_TEST_API_KEY')
    const baseURL = str('GROQ_TEST_BASE_URL')
    if (!model || !apiKey || !baseURL) throw new Error('groq_test is not configured. Set GROQ_TEST_MODEL, GROQ_TEST_API_KEY and GROQ_TEST_BASE_URL')
    return callOpenAIBase({ model, apiKey, baseURL, prompt: args.prompt })
  }
  throw new Error(`Unsupported provider: ${args.provider}`)
}

async function callOpenAI({ model, credentialId, prompt }: CallArgs): Promise<string> {
  const apiKey = await resolveCredential(String(credentialId))
  const client = new OpenAI({ apiKey })
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You must output raw JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  })
  return resp.choices?.[0]?.message?.content || ''
}

// OpenAI-compatible providers (e.g., Groq) with custom baseURL
async function callOpenAICompatible({ model, credentialId, prompt }: CallArgs): Promise<string> {
  const apiKey = await resolveCredential(String(credentialId))
  const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You must output raw JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  })
  return resp.choices?.[0]?.message?.content || ''
}

