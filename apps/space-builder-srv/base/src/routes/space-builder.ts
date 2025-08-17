import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { generateController, prepareController, reviseController } from '../controllers/space-builder'

const router: ExpressRouter = Router()

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

  // Sort alphabetically by label for transparent ordering
  items.sort((a, b) => a.label.localeCompare(b.label))
  return items
}

router.get('/health', (_req, res) => res.json({ ok: true }))
router.get('/config', (_req, res) => {
  const testMode = bool('SPACE_BUILDER_TEST_MODE')
  const disableUserCredentials = bool('SPACE_BUILDER_DISABLE_USER_CREDENTIALS')
  const items = testMode ? buildTestItems() : []
  res.json({ testMode, disableUserCredentials, items })
})
// Order does not matter but keep prepare first for clarity
router.post('/prepare', prepareController)
router.post('/generate', generateController)
router.post('/revise', reviseController)

export default router
