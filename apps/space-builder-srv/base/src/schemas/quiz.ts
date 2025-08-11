import { z } from 'zod'

export const AnswerSchema = z.object({
  text: z.string().min(1).max(400),
  isCorrect: z.boolean()
})

export const QuizItemSchema = z
  .object({
    question: z.string().min(1).max(400),
    answers: z.array(AnswerSchema).min(2).max(5)
  })
  .refine((it) => it.answers.filter((a) => a.isCorrect).length === 1, {
    message: 'Exactly one correct answer is required',
    path: ['answers']
  })

export const QuizPlanSchema = z.object({
  items: z.array(QuizItemSchema).min(1).max(10)
})

export type QuizPlan = z.infer<typeof QuizPlanSchema>
