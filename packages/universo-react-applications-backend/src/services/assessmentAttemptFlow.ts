import { isUuidV7 } from '@universo-react/utils'
import { z } from 'zod'
import {
    guestAssessmentAttemptPhaseSchema,
    guestAssessmentNumberingModeSchema,
    guestAssessmentTimerStateSchema
} from '@universo-react/types'
import type { GuestAssessmentNumberingMode } from '@universo-react/types'

const uuidV7Schema = z.string().uuid().refine(isUuidV7, 'UUID v7 is required')
const localeKeySchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/)
const MAX_COMPLETION_TEXT_LOCALES = 50
const localizedCompletionTextSchema = z
    .object({
        _schema: z.literal('1'),
        _primary: localeKeySchema,
        locales: z
            .record(localeKeySchema, z.object({ content: z.string().max(2000) }))
            .refine((locales) => Object.keys(locales).length <= MAX_COMPLETION_TEXT_LOCALES)
    })
    .strip()
const completionTextSourceSchema = z.union([
    z.string().max(2000),
    localizedCompletionTextSchema,
    z.record(localeKeySchema, z.string().max(2000)).refine((locales) => Object.keys(locales).length <= MAX_COMPLETION_TEXT_LOCALES)
])

export const assessmentAttemptBlockSchema = z
    .object({
        key: uuidV7Schema,
        title: z.string().trim().min(1).max(255),
        introduction: z.string().max(10000).nullable(),
        sortOrder: z.number().finite()
    })
    .strict()

export const assessmentAttemptFlowSnapshotSchema = z
    .object({
        contractVersion: z.literal(1),
        blocks: z.array(assessmentAttemptBlockSchema).max(100),
        pauseTimerOnBlockIntro: z.boolean(),
        numberingMode: guestAssessmentNumberingModeSchema,
        completionText: completionTextSourceSchema
    })
    .strict()
    .superRefine((flow, context) => {
        const keys = flow.blocks.map((block) => block.key)
        if (new Set(keys).size !== keys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks'], message: 'Block keys must be unique' })
        }
    })
    .transform((flow) =>
        flow.blocks.length === 0 && flow.numberingMode === 'block' ? { ...flow, numberingMode: 'global' as const } : flow
    )

export type AssessmentAttemptBlock = z.infer<typeof assessmentAttemptBlockSchema>
export type AssessmentAttemptFlowSnapshot = z.infer<typeof assessmentAttemptFlowSnapshotSchema>

export const createAssessmentAttemptFlowSnapshot = (input: {
    blocks: AssessmentAttemptBlock[]
    pauseTimerOnBlockIntro: boolean
    numberingMode: GuestAssessmentNumberingMode
    completionText: unknown
}): AssessmentAttemptFlowSnapshot => {
    const blocks = input.blocks
        .map((block, sourceIndex) => ({ block: assessmentAttemptBlockSchema.parse(block), sourceIndex }))
        .sort((left, right) => left.block.sortOrder - right.block.sortOrder || left.sourceIndex - right.sourceIndex)
        .map(({ block }, sortOrder) => ({ ...block, sortOrder }))
    return assessmentAttemptFlowSnapshotSchema.parse({
        contractVersion: 1,
        blocks,
        pauseTimerOnBlockIntro: input.pauseTimerOnBlockIntro,
        numberingMode: input.numberingMode,
        completionText: input.completionText
    })
}

export interface AssessmentAttemptRuntimeStateInput {
    phase: unknown
    phaseRevision: number
    timerState: unknown
    deadlineAt: string | null
    frozenRemainingMs: number | null
    effectiveTimeLimitSeconds: number
    status: string
    flow: AssessmentAttemptFlowSnapshot
    questionBlockKeys: readonly (string | null)[]
}

/** Validate persisted cross-field invariants before a guest attempt is exposed or changed. */
export const parseAssessmentAttemptRuntimeState = (input: AssessmentAttemptRuntimeStateInput) => {
    const parsed = {
        phase: guestAssessmentAttemptPhaseSchema.parse(input.phase),
        phaseRevision: z.number().int().nonnegative().parse(input.phaseRevision),
        timerState: guestAssessmentTimerStateSchema.parse(input.timerState),
        deadlineAt: input.deadlineAt === null ? null : z.string().datetime().parse(input.deadlineAt),
        frozenRemainingMs: input.frozenRemainingMs === null ? null : z.number().int().positive().parse(input.frozenRemainingMs),
        effectiveTimeLimitSeconds: z.number().int().nonnegative().parse(input.effectiveTimeLimitSeconds),
        status: z.string().min(1).parse(input.status),
        flow: assessmentAttemptFlowSnapshotSchema.parse(input.flow),
        questionBlockKeys: z.array(uuidV7Schema.nullable()).min(1).parse(input.questionBlockKeys)
    }
    const isStarted = parsed.status.toLowerCase() === 'started'
    const blocked = parsed.flow.blocks.length > 0
    const hasTimeLimit = parsed.effectiveTimeLimitSeconds > 0

    if (new Set(parsed.flow.blocks.map((block) => block.key)).size !== parsed.flow.blocks.length) {
        throw new Error('Stored assessment flow contains duplicate blocks')
    }
    if (blocked) {
        const blockKeys = new Set(parsed.flow.blocks.map((block) => block.key))
        if (parsed.questionBlockKeys.some((key) => key === null || !blockKeys.has(key))) {
            throw new Error('Stored assessment questions must belong to a valid block')
        }
        if (parsed.flow.blocks.some((block) => !parsed.questionBlockKeys.includes(block.key))) {
            throw new Error('Stored assessment blocks must contain at least one question')
        }
        const orderByBlockKey = new Map(parsed.flow.blocks.map((block, index) => [block.key, index]))
        const encountered = new Set<string>()
        let lastBlockOrder = -1
        for (const blockKey of parsed.questionBlockKeys) {
            if (blockKey === null) throw new Error('Stored assessment question is missing block membership')
            const blockOrder = orderByBlockKey.get(blockKey)
            if (blockOrder === undefined || blockOrder < lastBlockOrder || (encountered.has(blockKey) && blockOrder !== lastBlockOrder)) {
                throw new Error('Stored assessment questions must stay in ordered contiguous block groups')
            }
            if (blockOrder !== lastBlockOrder) encountered.add(blockKey)
            lastBlockOrder = blockOrder
        }
        if (parsed.flow.blocks.some((block, index) => block.sortOrder !== index)) {
            throw new Error('Stored assessment block order is not canonical')
        }
    } else if (parsed.questionBlockKeys.some((key) => key !== null)) {
        throw new Error('Flat assessment questions cannot have block membership')
    }
    const isRevoked = parsed.status.toLowerCase() === 'revoked'
    const isTimedOut = parsed.status.toLowerCase() === 'timedout'
    if (parsed.phase === 'block_intro' && (!blocked || (!isStarted && !isRevoked && !isTimedOut))) {
        throw new Error('Only an in-progress blocked assessment can be on a block introduction')
    }
    if (parsed.timerState === 'untimed' && (hasTimeLimit || parsed.deadlineAt !== null || parsed.frozenRemainingMs !== null)) {
        throw new Error('Untimed assessment contains timed state')
    }
    if (parsed.timerState === 'running' && (!hasTimeLimit || parsed.deadlineAt === null || parsed.frozenRemainingMs !== null)) {
        throw new Error('Running assessment requires one active deadline')
    }
    if (parsed.timerState === 'paused') {
        if (
            !hasTimeLimit ||
            parsed.deadlineAt !== null ||
            parsed.frozenRemainingMs === null ||
            parsed.phase !== 'block_intro' ||
            !parsed.flow.pauseTimerOnBlockIntro ||
            (!isStarted && !isRevoked)
        ) {
            throw new Error('Paused assessment state is inconsistent')
        }
    }
    return parsed
}

export const getDisplayQuestionNumber = (input: {
    globalIndex: number
    blockIndex: number
    blockQuestionIndex: number
    numberingMode: GuestAssessmentNumberingMode
}): string => (input.numberingMode === 'block' ? `${input.blockIndex + 1}.${input.blockQuestionIndex + 1}` : String(input.globalIndex + 1))
