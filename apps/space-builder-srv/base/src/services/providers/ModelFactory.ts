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

export async function callProvider(args: CallArgs): Promise<string> {
  const provider = String(args.provider || '').toLowerCase()
  const testMode = String(process.env.SPACE_BUILDER_TEST_MODE || '').toLowerCase() === 'true'
  if (testMode) {
    // Prefer test provider without credentials dependency
    return callGroqTest({ provider: 'groq_test', model: args.model || 'llama-3-8b-8192', prompt: args.prompt })
  }
  if (provider === 'openai' || provider === 'azureopenai') return callOpenAI(args)
  if (provider === 'groq') return callOpenAICompatible(args)
  if (provider === 'groq_test') return callGroqTest(args)
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

// Test provider for direct key usage (temporary diagnostic)
async function callGroqTest({ model, prompt }: CallArgs): Promise<string> {
  const apiKey = process.env.GROQ_TEST_API_KEY || ''
  if (!apiKey) throw new Error('GROQ_TEST_API_KEY is not set on server')
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

