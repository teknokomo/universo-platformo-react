import { Request, Response } from 'express'
import { spaceBuilderService } from '../services/SpaceBuilderService'
import { GraphSchema } from '../schemas/graph'

export async function generateController(req: Request, res: Response) {
  const { question, selectedChatModel } = req.body || {}
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Invalid input: question is required' })
  }
  const q = String(question).trim()
  if (q.length > 4000) {
    return res.status(400).json({ error: 'Invalid input: question too long' })
  }
  try {
    const graph = await spaceBuilderService.generate({ question, selectedChatModel })
    const parsed = GraphSchema.safeParse(graph)
    if (!parsed.success) {
      return res.status(422).json({ error: 'Invalid graph', issues: parsed.error.issues })
    }
    return res.json(parsed.data)
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[space-builder] generation error', err)
    const message = typeof err?.message === 'string' ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Generation failed', details: message })
  }
}
