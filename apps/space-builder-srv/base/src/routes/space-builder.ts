import { Router } from 'express'
import { generateController } from '../controllers/space-builder'

const router = Router()

router.get('/health', (_req, res) => res.json({ ok: true }))
router.get('/config', (_req, res) => {
  const testMode = String(process.env.SPACE_BUILDER_TEST_MODE || '').toLowerCase() === 'true'
  res.json({ testMode })
})
router.post('/generate', generateController)

export default router
