import { Request, Response } from 'express'
import { spaceBuilderService } from '../services/SpaceBuilderService'
import { GraphSchema } from '../schemas/graph'
import { QuizPlanSchema } from '../schemas/quiz'

export async function prepareController(req: Request, res: Response) {
  const { sourceText, selectedChatModel, options } = req.body || {}
  const text = String(sourceText || '').trim()
  if (!text || text.length > 2000) {
    return res.status(400).json({ error: 'Invalid input: sourceText length must be 1..2000' })
  }
  const qCount = Number(options?.questionsCount ?? 1)
  const aPerQ = Number(options?.answersPerQuestion ?? 2)
  if (!Number.isInteger(qCount) || qCount < 1 || qCount > 10) {
    return res.status(400).json({ error: 'Invalid input: questionsCount must be 1..10' })
  }
  if (!Number.isInteger(aPerQ) || aPerQ < 2 || aPerQ > 5) {
    return res.status(400).json({ error: 'Invalid input: answersPerQuestion must be 2..5' })
  }
  try {
    const plan = await spaceBuilderService.proposeQuiz({ sourceText: text, selectedChatModel, options: { questionsCount: qCount, answersPerQuestion: aPerQ } })
    const parsed = QuizPlanSchema.safeParse(plan)
    if (!parsed.success) {
      return res.status(422).json({ error: 'Invalid quizPlan', issues: parsed.error.issues })
    }
    const items = parsed.data.items
    const sizesOk = items.length === qCount && items.every((it) => it.answers.length === aPerQ)
    if (!sizesOk) {
      return res.status(422).json({ error: 'Quiz plan does not match requested sizes' })
    }
    return res.json({ quizPlan: parsed.data })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[space-builder] prepare error', err)
    const message = typeof err?.message === 'string' ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Preparation failed', details: message })
  }
}

export async function generateController(req: Request, res: Response) {
  const { question, selectedChatModel, quizPlan } = req.body || {}
  if (quizPlan) {
    try {
      const graph = await spaceBuilderService.generateFromPlan({ quizPlan, selectedChatModel })
      const parsed = GraphSchema.safeParse(graph)
      if (!parsed.success) {
        return res.status(422).json({ error: 'Invalid graph', issues: parsed.error.issues })
      }
      return res.json(parsed.data)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[space-builder] generateFromPlan error', err)
      const message = typeof err?.message === 'string' ? err.message : 'Unknown error'
      return res.status(500).json({ error: 'Generation failed', details: message })
    }
  }

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
