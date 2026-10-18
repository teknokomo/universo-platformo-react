import { createHash, randomInt } from 'node:crypto'
import { z } from 'zod'
import type { GuestAssessmentAttemptPhase, GuestAssessmentTimerState } from '@universo-react/types'
import { assessmentAttemptFlowSnapshotSchema, getDisplayQuestionNumber, type AssessmentAttemptFlowSnapshot } from './assessmentAttemptFlow'
import { resolveLocalizedContent } from '../shared/runtimeHelpers'

const QUESTION_LIMIT = 1000
const OPTION_LIMIT = 20
const uuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'UUID v7 is required')

const assessmentOptionSchema = z
    .object({
        id: uuidV7Schema,
        label: z.string().trim().min(1).max(2000),
        isCorrect: z.boolean()
    })
    .strict()

const assessmentQuestionSchema = z
    .object({
        id: uuidV7Schema,
        prompt: z.string().trim().min(1).max(10000),
        description: z.string().max(10000).nullable().optional(),
        explanation: z.string().max(10000).nullable().optional(),
        sortOrder: z.number().finite(),
        blockKey: uuidV7Schema.nullable(),
        options: z.array(assessmentOptionSchema).min(2).max(OPTION_LIMIT)
    })
    .strict()
    .superRefine((question, context) => {
        const optionIds = new Set(question.options.map((option) => option.id))
        if (optionIds.size !== question.options.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Option identifiers must be unique' })
        }
        if (question.options.filter((option) => option.isCorrect).length !== 1) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Exactly one correct option is required' })
        }
    })

export const assessmentAttemptQuestionSchema = assessmentQuestionSchema

export const assessmentAttemptQuestionsSchema = z.array(assessmentAttemptQuestionSchema).min(1).max(QUESTION_LIMIT)
export type AssessmentAttemptQuestion = z.infer<typeof assessmentAttemptQuestionSchema>

export interface SourceAssessmentQuestion {
    id: string
    prompt: string
    description?: string | null
    explanation?: string | null
    sortOrder: number
    blockKey: string | null
    options: Array<{ id: string; label: string; isCorrect: boolean }>
}

const secureShuffle = <T>(items: T[]): T[] => {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1)
        ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
    }
    return shuffled
}

/**
 * Snapshot option order once per attempt and balance correct positions across
 * the attempt. Persisting the result lets reload/resume keep the same choices.
 */
export const buildAssessmentAttemptSnapshot = (
    questions: SourceAssessmentQuestion[],
    flowInput: AssessmentAttemptFlowSnapshot
): AssessmentAttemptQuestion[] => {
    const parsedQuestions = z.array(assessmentQuestionSchema).min(1).max(QUESTION_LIMIT).parse(questions)
    const flow = assessmentAttemptFlowSnapshotSchema.parse(flowInput)
    const blockOrder = new Map(flow.blocks.map((block, index) => [block.key, index]))
    if (flow.blocks.length === 0 && parsedQuestions.some((question) => question.blockKey !== null)) {
        throw new Error('Flat assessment questions cannot have block membership')
    }
    if (
        flow.blocks.length > 0 &&
        (parsedQuestions.some((question) => question.blockKey === null || !blockOrder.has(question.blockKey)) ||
            flow.blocks.some((block) => !parsedQuestions.some((question) => question.blockKey === block.key)))
    ) {
        throw new Error('Every blocked assessment question must belong to a non-empty block')
    }
    // Preserve the caller's persisted row order when optional sort-order values tie.
    const orderedQuestions = parsedQuestions
        .map((question, sourceIndex) => ({ question, sourceIndex }))
        .sort((left, right) => {
            if (flow.blocks.length > 0) {
                const blockDelta =
                    (blockOrder.get(left.question.blockKey as string) ?? -1) - (blockOrder.get(right.question.blockKey as string) ?? -1)
                if (blockDelta !== 0) return blockDelta
            }
            return left.question.sortOrder - right.question.sortOrder || left.sourceIndex - right.sourceIndex
        })
    const correctPositionPools = new Map<number, number[]>()

    return orderedQuestions.map(({ question }) => {
        const correctOption = question.options.find((option) => option.isCorrect)
        if (!correctOption) throw new Error('Validated assessment question has no correct option')
        const distractors = secureShuffle(question.options.filter((option) => !option.isCorrect))
        const orderedOptions = [...distractors]
        const optionCount = question.options.length
        let availablePositions = correctPositionPools.get(optionCount)
        if (!availablePositions?.length) {
            availablePositions = secureShuffle(Array.from({ length: optionCount }, (_, index) => index))
            correctPositionPools.set(optionCount, availablePositions)
        }
        const correctPosition = availablePositions.pop()
        if (correctPosition === undefined) throw new Error('Validated assessment question has no answer position')
        orderedOptions.splice(correctPosition, 0, correctOption)
        return {
            id: question.id,
            prompt: question.prompt,
            description: question.description ?? null,
            explanation: question.explanation ?? null,
            sortOrder: question.sortOrder,
            blockKey: question.blockKey,
            options: orderedOptions
        }
    })
}

export const createAssessmentQuestionSetDigest = (questions: AssessmentAttemptQuestion[]): string =>
    createHash('sha256')
        .update(JSON.stringify(assessmentAttemptQuestionsSchema.parse(questions)))
        .digest('hex')

export const scoreAssessmentAttempt = (
    questions: AssessmentAttemptQuestion[],
    responses: ReadonlyMap<string, string>
): { score: number; total: number; correctQuestionIds: string[] } => {
    const parsed = assessmentAttemptQuestionsSchema.parse(questions)
    let score = 0
    const correctQuestionIds: string[] = []

    for (const question of parsed) {
        const selectedOptionId = responses.get(question.id)
        if (!selectedOptionId) continue
        const selectedOption = question.options.find((option) => option.id === selectedOptionId)
        if (selectedOption?.isCorrect) {
            score += 1
            correctQuestionIds.push(question.id)
        }
    }

    return { score, total: parsed.length, correctQuestionIds }
}

export interface GuestAssessmentAttemptStateInput {
    attemptId: string
    attemptNumber: number
    status: string
    startedAt: string
    deadlineAt: string | null
    questions: AssessmentAttemptQuestion[]
    answeredQuestionIds: readonly string[]
    flow: AssessmentAttemptFlowSnapshot
    phase: GuestAssessmentAttemptPhase
    phaseRevision: number
    timerState: GuestAssessmentTimerState
    remainingMs: number | null
    locale?: string
    result?: { score: number; total: number; passed: boolean; finishedReason: string } | null
}

/** Constructs a public allowlist projection; correctness and explanations stay server-side. */
export const toGuestAssessmentAttemptState = (input: GuestAssessmentAttemptStateInput) => {
    const attemptId = uuidV7Schema.parse(input.attemptId)
    const attemptNumber = z.number().int().positive().parse(input.attemptNumber)
    const questions = assessmentAttemptQuestionsSchema.parse(input.questions)
    const flow = assessmentAttemptFlowSnapshotSchema.parse(input.flow)
    const phase = z.enum(['block_intro', 'question']).parse(input.phase)
    const phaseRevision = z.number().int().nonnegative().parse(input.phaseRevision)
    const timerState = z.enum(['untimed', 'running', 'paused']).parse(input.timerState)
    const revoked = input.status.toLowerCase() === 'revoked' || input.result?.finishedReason === 'revoked'
    const isInProgress = !revoked && input.status.toLowerCase() === 'in_progress'
    const questionIds = new Set(questions.map((question) => question.id))
    const answeredIds = new Set(revoked ? [] : input.answeredQuestionIds.filter((id) => questionIds.has(id)))
    const nextUnansweredIndex = isInProgress ? questions.findIndex((question) => !answeredIds.has(question.id)) : -1
    if (
        isInProgress &&
        nextUnansweredIndex >= 0 &&
        questions.slice(nextUnansweredIndex + 1).some((question) => answeredIds.has(question.id))
    ) {
        throw new Error('Assessment responses are not a contiguous question prefix')
    }
    const currentQuestionIndex = isInProgress && nextUnansweredIndex >= 0 ? nextUnansweredIndex : questions.length
    const nextQuestion = nextUnansweredIndex >= 0 ? questions[nextUnansweredIndex] : null
    if (isInProgress && phase === 'block_intro' && (!nextQuestion || !flow.blocks.some((block) => block.key === nextQuestion.blockKey))) {
        throw new Error('Block introduction does not match the next unanswered question')
    }
    const currentQuestion = phase === 'question' ? nextQuestion : null
    const currentBlockKey = nextQuestion?.blockKey ?? null
    const currentBlock =
        phase === 'block_intro' && currentBlockKey !== null ? flow.blocks.find((block) => block.key === currentBlockKey) ?? null : null
    const blockIndex = currentBlockKey === null ? -1 : flow.blocks.findIndex((block) => block.key === currentBlockKey)
    const blockQuestionIndex =
        nextUnansweredIndex < 0 || currentBlockKey === null
            ? -1
            : questions.slice(0, nextUnansweredIndex + 1).filter((question) => question.blockKey === currentBlockKey).length - 1
    const displayNumber = currentQuestion
        ? getDisplayQuestionNumber({
              globalIndex: currentQuestionIndex,
              blockIndex,
              blockQuestionIndex,
              numberingMode: flow.numberingMode
          })
        : null

    return {
        attemptId,
        attemptNumber,
        status: input.status,
        startedAt: input.startedAt,
        deadlineAt: input.deadlineAt,
        currentQuestionIndex,
        totalQuestions: questions.length,
        answeredCount: answeredIds.size,
        phase,
        phaseRevision,
        timerState,
        remainingMs: input.remainingMs,
        numberingMode: flow.numberingMode,
        currentBlock: currentBlock ? { title: currentBlock.title, introduction: currentBlock.introduction ?? '' } : null,
        questions: currentQuestion
            ? [
                  {
                      id: currentQuestion.id,
                      prompt: currentQuestion.prompt,
                      description: currentQuestion.description ?? null,
                      sortOrder: currentQuestion.sortOrder,
                      displayNumber,
                      options: currentQuestion.options.map(({ id, label }) => ({ id, label }))
                  }
              ]
            : [],
        result: input.result ?? null,
        completionText: resolveLocalizedContent(flow.completionText, input.locale ?? 'en', '')
    }
}
