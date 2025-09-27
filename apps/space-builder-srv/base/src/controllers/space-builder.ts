import { Request, Response } from 'express'
import { MANUAL_QUIZ_MAX_LENGTH, spaceBuilderService } from '../services/SpaceBuilderService'
import { GraphSchema } from '../schemas/graph'
import { QuizPlanSchema } from '../schemas/quiz'
import { ManualQuizParseError, describeManualError } from '../services/parsers/manualQuiz'

export async function prepareController(req: Request, res: Response) {
  const { sourceText, selectedChatModel, options, additionalConditions } = req.body || {}
  const text = String(sourceText || '').trim()
  if (!text || text.length > 5000) {
    return res.status(400).json({ error: 'Invalid input: sourceText length must be 1..5000' })
  }
  if (typeof additionalConditions !== 'undefined') {
    const ac = String(additionalConditions || '')
    if (ac.length > 500) {
      return res.status(400).json({ error: 'Invalid input: additionalConditions max length 500' })
    }
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
    const plan = await spaceBuilderService.proposeQuiz({ sourceText: text, selectedChatModel, options: { questionsCount: qCount, answersPerQuestion: aPerQ }, additionalConditions: String(additionalConditions || '').trim() || undefined })
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
  const { question, selectedChatModel, quizPlan, options } = req.body || {}
  if (quizPlan) {
    try {
      const graph = await spaceBuilderService.generateFromPlan({ quizPlan, selectedChatModel, options })
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

export async function reviseController(req: Request, res: Response) {
  const { quizPlan, instructions, selectedChatModel } = req.body || {}
  const instr = String(instructions || '').trim()
  if (!instr || instr.length > 500) {
    return res.status(400).json({ error: 'Invalid input: instructions 1..500' })
  }
  const parsed = QuizPlanSchema.safeParse(quizPlan)
  if (!parsed.success) {
    return res.status(422).json({ error: 'Invalid quizPlan', issues: parsed.error.issues })
  }
  try {
    const revised = await spaceBuilderService.reviseQuizPlan({ quizPlan: parsed.data, instructions: instr, selectedChatModel })
    // Invariant checks: sizes and one-correct per question must hold
    if (revised.items.length !== parsed.data.items.length) {
      return res.status(422).json({ error: 'Revised plan changed questions count' })
    }
    for (let i = 0; i < parsed.data.items.length; i++) {
      if (revised.items[i].answers.length !== parsed.data.items[i].answers.length) {
        return res.status(422).json({ error: `Revised plan changed answers count at question ${i + 1}` })
      }
      const correctCount = revised.items[i].answers.filter((a) => a.isCorrect).length
      if (correctCount !== 1) {
        return res.status(422).json({ error: `Exactly one correct answer required at question ${i + 1}` })
      }
    }
    return res.json({ quizPlan: revised })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[space-builder] revise error', err)
    const message = typeof err?.message === 'string' ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Revision failed', details: message })
  }
}

export async function manualController(req: Request, res: Response) {
  const { rawText, selectedChatModel, fallbackToLLM } = req.body || {}
  const text = String(rawText || '')
  if (!text.trim() || text.length > MANUAL_QUIZ_MAX_LENGTH) {
    return res.status(400).json({
      error: `Invalid input: rawText length must be 1..${MANUAL_QUIZ_MAX_LENGTH} characters`
    })
  }
  if (fallbackToLLM) {
    const provider = String(selectedChatModel?.provider || '').trim()
    const modelName = String(selectedChatModel?.modelName || '').trim()
    if (!provider || !modelName) {
      return res.status(400).json({ error: 'Invalid input: selectedChatModel is required when fallbackToLLM is true' })
    }
  }
  try {
    const plan = await spaceBuilderService.normalizeManualQuiz({
      rawText: text,
      selectedChatModel: selectedChatModel || {},
      fallbackToLLM: Boolean(fallbackToLLM)
    })
    const parsed = QuizPlanSchema.safeParse(plan)
    if (!parsed.success) {
      return res.status(422).json({ error: 'Invalid quizPlan', issues: parsed.error.issues })
    }
    return res.json({ quizPlan: parsed.data })
  } catch (err: any) {
    if (err instanceof ManualQuizParseError) {
      const shaped = describeManualError(err)
      return res.status(422).json({ error: shaped.message, issues: shaped.issues })
    }
    // eslint-disable-next-line no-console
    console.error('[space-builder] manual normalize error', err)
    const message = typeof err?.message === 'string' ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Manual normalization failed', details: message })
  }
}
