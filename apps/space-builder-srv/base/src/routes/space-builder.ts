import { Router } from 'express'
import { generateController, prepareController, reviseController } from '../controllers/space-builder'

const router = Router()

router.get('/health', (_req, res) => res.json({ ok: true }))
router.get('/config', (_req, res) => {
  const testMode = String(process.env.SPACE_BUILDER_TEST_MODE || '').toLowerCase() === 'true'
  res.json({ testMode })
})
// Order does not matter but keep prepare first for clarity
router.post('/prepare', prepareController)
router.post('/generate', generateController)
router.post('/revise', reviseController)

export default router
