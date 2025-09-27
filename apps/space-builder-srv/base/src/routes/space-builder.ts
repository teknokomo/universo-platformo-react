import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { generateController, manualController, prepareController, reviseController } from '../controllers/space-builder'

const router: ExpressRouter = Router()

// Providers dependencies are injected from the host server to avoid cross-package imports
type ProvidersDeps = {
  listChatModelNodes: () => Promise<any[]>
  listComponentCredentials: () => Promise<any[]>
  listUserCredentials: (unikId?: string, names?: string | string[]) => Promise<any[]>
}
let providersDeps: ProvidersDeps | null = null
export function configureProviders(deps: ProvidersDeps) {
  providersDeps = deps
}

// Helpers to read environment in a safe, explicit way
function bool(name: string): boolean {
  return String(process.env[name] || '').toLowerCase() === 'true'
}
function str(name: string): string {
  return String(process.env[name] || '').trim()
}

function buildTestItems(): Array<{ id: string; label: string; provider: string; model: string }> {
  const items: Array<{ id: string; label: string; provider: string; model: string }> = []

  // Add only when enabled AND required params are present
  if (bool('SPACE_BUILDER_TEST_ENABLE_GROQ')) {
    const model = str('GROQ_TEST_MODEL')
    const apiKey = str('GROQ_TEST_API_KEY')
    const baseURL = str('GROQ_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'groq', provider: 'groq', model, label: `groq • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_OPENAI')) {
    const model = str('OPENAI_TEST_MODEL')
    const apiKey = str('OPENAI_TEST_API_KEY')
    // baseURL optional for native OpenAI
    if (model && apiKey) items.push({ id: 'openai', provider: 'openai', model, label: `openai • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_OPENROUTER')) {
    const model = str('OPENROUTER_TEST_MODEL')
    const apiKey = str('OPENROUTER_TEST_API_KEY')
    const baseURL = str('OPENROUTER_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'openrouter', provider: 'openrouter', model, label: `openrouter • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_CEREBRAS')) {
    const model = str('CEREBRAS_TEST_MODEL')
    const apiKey = str('CEREBRAS_TEST_API_KEY')
    const baseURL = str('CEREBRAS_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'cerebras', provider: 'cerebras', model, label: `cerebras • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_GIGACHAT')) {
    const model = str('GIGACHAT_TEST_MODEL')
    const apiKey = str('GIGACHAT_TEST_API_KEY')
    const baseURL = str('GIGACHAT_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'gigachat', provider: 'gigachat', model, label: `gigachat • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_YANDEXGPT')) {
    const model = str('YANDEXGPT_TEST_MODEL')
    const apiKey = str('YANDEXGPT_TEST_API_KEY')
    const baseURL = str('YANDEXGPT_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'yandexgpt', provider: 'yandexgpt', model, label: `yandexgpt • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_GOOGLE')) {
    const model = str('GOOGLE_TEST_MODEL')
    const apiKey = str('GOOGLE_TEST_API_KEY')
    const baseURL = str('GOOGLE_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'google', provider: 'google', model, label: `google • ${model} (Test mode)` })
  }
  if (bool('SPACE_BUILDER_TEST_ENABLE_CUSTOM')) {
    const name = str('CUSTOM_TEST_NAME') || 'custom'
    const model = str('CUSTOM_TEST_MODEL')
    const apiKey = str('CUSTOM_TEST_API_KEY')
    const baseURL = str('CUSTOM_TEST_BASE_URL')
    if (model && apiKey && baseURL) items.push({ id: 'custom', provider: 'custom', model, label: `${name} • ${model} (Test mode)` })
  }

  // Keep insertion order (env order) to respect .env sequence
  return items
}

router.get('/health', (_req, res) => res.json({ ok: true }))
router.get('/config', (_req, res) => {
  const testMode = bool('SPACE_BUILDER_TEST_MODE')
  const disableUserCredentials = bool('SPACE_BUILDER_DISABLE_USER_CREDENTIALS')
  const items = testMode ? buildTestItems() : []
  res.json({ testMode, disableUserCredentials, items })
})

// GET /api/v1/space-builder/providers
// Aggregates chat model providers (nodes), credential types and user credentials into a single list
router.get('/providers', async (req, res) => {
  try {
    const { unikId } = (req.query || {}) as { unikId?: string }
    if (!providersDeps) return res.status(501).json({ error: 'Providers not configured' })
    const chatModelNodes = await providersDeps.listChatModelNodes()
    const SUPPORTED_NODE_NAMES = new Set(['chatOpenAI', 'azureChatOpenAI', 'groqChat', 'chatOpenRouter', 'chatCerebras'])
    const componentCredentialsList = await providersDeps.listComponentCredentials()
    const componentCredentials: Record<string, any> = {}
    for (const cr of componentCredentialsList) componentCredentials[cr.name] = cr

    // Helper: build icon URL for a credential or fallback to node icon
    const buildIconUrl = (credName: string | undefined, nodeName: string, nodeIcon: string | undefined): string => {
      if (credName) return `/api/v1/components-credentials-icon/${credName}`
      // fallback to node icon if available
      if (nodeIcon) return `/api/v1/node-icon/${nodeName}`
      return ''
    }

    // Prepare providers payload
    const providers: Array<{
      id: string
      label: string
      iconUrl: string
      credentialNames: string[]
      credentials: Array<{ id: string; label: string; credentialName: string }>
      supportsAsyncModels: boolean
      inputsSchema: any[]
    }> = []

    for (const node of chatModelNodes) {
      if (!SUPPORTED_NODE_NAMES.has(String(node?.name))) continue
      const credentialNames: string[] = (node?.credential?.credentialNames || []).slice()

      // Pick first matching credential icon if any
      const firstCredName = credentialNames.find((cn) => componentCredentials[cn])
      const iconUrl = buildIconUrl(firstCredName, String(node?.name || ''), node?.icon)

      // Load user's credentials filtered by credentialNames (if unikId provided)
      let userCredentials: any[] = []
      if (credentialNames.length && unikId) {
        try {
          const namesParam = credentialNames.length > 1 ? credentialNames : credentialNames[0]
          const creds = await providersDeps.listUserCredentials(unikId, namesParam)
          userCredentials = Array.isArray(creds) ? creds : []
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`[space-builder] Failed to list user credentials for unikId ${unikId}:`, e)
          userCredentials = []
        }
      }

      const mappedCreds = userCredentials.map((c: any) => ({ id: c.id, label: c.name, credentialName: c.credentialName }))

      const supportsAsyncModels = !!(node?.inputs || []).find((p: any) => p.name === 'modelName' && (p.type === 'asyncOptions' || p.type === 'options'))
      const inputsSchema = (node?.inputs || [])
        .filter((p: any) => ['modelName', 'temperature', 'streaming', 'maxTokens', 'topP'].includes(String(p?.name)))
        .map((p: any) => ({ name: p.name, label: p.label, type: p.type, default: p.default, options: p.options }))

      providers.push({
        id: String(node?.name || ''),
        label: String(node?.label || node?.name || ''),
        iconUrl,
        credentialNames,
        credentials: mappedCreds,
        supportsAsyncModels,
        inputsSchema
      })
    }

    // Sort for stable UI
    providers.sort((a, b) => a.label.localeCompare(b.label))
    res.json({ providers })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[space-builder] providers error', err)
    res.status(500).json({ error: 'Failed to list providers', details: err?.message || 'Unknown error' })
  }
})
// Order does not matter but keep prepare first for clarity
router.post('/prepare', prepareController)
router.post('/generate', generateController)
router.post('/revise', reviseController)
router.post('/manual', manualController)

export default router
