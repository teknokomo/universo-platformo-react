import { z } from 'zod'

const codenameSchema = z.string().trim().min(1).max(128)

export const SEQUENCE_POLICY_MODES = ['free', 'sequential', 'scheduled', 'prerequisite'] as const
export type SequencePolicyMode = (typeof SEQUENCE_POLICY_MODES)[number]

export const completionConditionSchema = z
    .object({
        kind: z.enum(['manual', 'progressPercent', 'scoreAtLeast', 'allStepsCompleted', 'attendanceMarked', 'certificateIssued']),
        field: codenameSchema.optional(),
        value: z.unknown().optional()
    })
    .strict()
export type CompletionCondition = z.infer<typeof completionConditionSchema>

export const sequencePolicySchema = z
    .object({
        mode: z.enum(SEQUENCE_POLICY_MODES).default('free'),
        prerequisiteFieldCodename: codenameSchema.optional(),
        orderFieldCodename: codenameSchema.optional(),
        availableFromFieldCodename: codenameSchema.optional(),
        availableToFieldCodename: codenameSchema.optional(),
        dueAtFieldCodename: codenameSchema.optional(),
        retryLimit: z.number().int().min(0).max(100).optional(),
        maxAttempts: z.number().int().min(1).max(100).optional(),
        completion: z.array(completionConditionSchema).max(16).default([])
    })
    .strict()
export type SequencePolicy = z.infer<typeof sequencePolicySchema>

export const COMPLETION_ITEM_STATUSES = [
    'notStarted',
    'inProgress',
    'completed',
    'accepted',
    'declined',
    'passed',
    'failed',
    'attended',
    'noShow',
    'issued',
    'revoked',
    'expired',
    'overdue'
] as const
export type CompletionItemStatus = (typeof COMPLETION_ITEM_STATUSES)[number]

export const completionItemSchema = z
    .object({
        id: z.string().trim().min(1).max(256),
        status: z.enum(COMPLETION_ITEM_STATUSES).default('notStarted'),
        progressPercent: z.number().min(0).max(100).optional(),
        scorePercent: z.number().min(0).max(100).optional(),
        weight: z.number().positive().max(100000).optional()
    })
    .strict()
export type CompletionItem = z.infer<typeof completionItemSchema>

export const sequenceStepSchema = z
    .object({
        id: z.string().trim().min(1).max(256),
        order: z.number().finite().optional(),
        availableFrom: z.string().datetime().optional(),
        availableTo: z.string().datetime().optional(),
        prerequisiteStepIds: z.array(z.string().trim().min(1).max(256)).max(256).default([]),
        status: z.enum(COMPLETION_ITEM_STATUSES).default('notStarted'),
        progressPercent: z.number().min(0).max(100).optional(),
        scorePercent: z.number().min(0).max(100).optional()
    })
    .strict()
export type SequenceStep = z.infer<typeof sequenceStepSchema>

export const SEQUENCE_AVAILABILITY_REASONS = [
    'available',
    'missingStep',
    'scheduledNotStarted',
    'scheduledExpired',
    'sequentialLocked',
    'prerequisiteLocked'
] as const
export type SequenceAvailabilityReason = (typeof SEQUENCE_AVAILABILITY_REASONS)[number]

export type SequenceAvailabilityResult = {
    stepId: string
    available: boolean
    reason: SequenceAvailabilityReason
    lockedByStepIds: string[]
}

const COMPLETED_STATUSES = new Set<CompletionItemStatus>(['completed', 'accepted', 'passed', 'attended', 'issued'])

const roundProgress = (value: number): number => Math.round(value * 100) / 100

const clampPercent = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return Math.max(0, Math.min(100, value))
}

const normalizeStatus = (value: unknown): string =>
    typeof value === 'string'
        ? value
              .trim()
              .replace(/[_\s-]+/g, '')
              .toLowerCase()
        : ''

export function isCompletionItemComplete(item: Pick<CompletionItem, 'status' | 'progressPercent'>): boolean {
    return COMPLETED_STATUSES.has(item.status) || (typeof item.progressPercent === 'number' && item.progressPercent >= 100)
}

export function calculateWeightedProgress(items: readonly CompletionItem[]): number {
    if (items.length === 0) return 0

    const normalizedItems = items.map((item) => completionItemSchema.parse(item))
    const totalWeight = normalizedItems.reduce((sum, item) => sum + (item.weight ?? 1), 0)
    if (totalWeight <= 0) return 0

    const total = normalizedItems.reduce((sum, item) => {
        const weight = item.weight ?? 1
        let itemProgress = 0

        if ((item.status === 'passed' || item.status === 'failed') && typeof item.scorePercent === 'number') {
            itemProgress = clampPercent(item.scorePercent) ?? 0
        } else if (COMPLETED_STATUSES.has(item.status)) {
            itemProgress = 100
        } else if (item.status === 'inProgress') {
            itemProgress = clampPercent(item.progressPercent) ?? 0
        } else if (typeof item.progressPercent === 'number') {
            itemProgress = clampPercent(item.progressPercent) ?? 0
        }

        return sum + itemProgress * weight
    }, 0)

    return roundProgress(total / totalWeight)
}

const readFieldValue = (record: Record<string, unknown>, field?: string): unknown => {
    if (!field) return undefined
    if (Object.prototype.hasOwnProperty.call(record, field)) return record[field]

    const normalizedField = field.trim().toLowerCase()
    const foundKey = Object.keys(record).find((key) => key.trim().toLowerCase() === normalizedField)
    return foundKey ? record[foundKey] : undefined
}

const equalsExpectedValue = (actual: unknown, expected: unknown): boolean => {
    if (expected === undefined) return Boolean(actual)
    if (typeof expected === 'number') return Number(actual) === expected
    if (typeof expected === 'boolean') return actual === expected
    return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase()
}

export function evaluateCompletionCondition(
    condition: CompletionCondition,
    record: Record<string, unknown>,
    items: readonly CompletionItem[] = []
): boolean {
    const parsedCondition = completionConditionSchema.parse(condition)
    const value = readFieldValue(record, parsedCondition.field)

    switch (parsedCondition.kind) {
        case 'manual':
            return equalsExpectedValue(value, parsedCondition.value)
        case 'progressPercent': {
            const threshold = typeof parsedCondition.value === 'number' ? parsedCondition.value : 100
            return Number(value) >= threshold
        }
        case 'scoreAtLeast': {
            const threshold = typeof parsedCondition.value === 'number' ? parsedCondition.value : 0
            return Number(value) >= threshold
        }
        case 'allStepsCompleted':
            return items.length > 0 && items.every((item) => isCompletionItemComplete(completionItemSchema.parse(item)))
        case 'attendanceMarked': {
            if (parsedCondition.value !== undefined) return equalsExpectedValue(value, parsedCondition.value)
            const normalized = normalizeStatus(value)
            return normalized === 'attended' || normalized === 'noshow'
        }
        case 'certificateIssued': {
            if (parsedCondition.value !== undefined) return equalsExpectedValue(value, parsedCondition.value)
            return normalizeStatus(value) === 'issued' || value === true
        }
        default:
            return false
    }
}

export function evaluateCompletionConditions(
    conditions: readonly CompletionCondition[],
    record: Record<string, unknown>,
    items: readonly CompletionItem[] = []
): boolean {
    if (conditions.length === 0) return false
    return conditions.every((condition) => evaluateCompletionCondition(condition, record, items))
}

const parseDateTime = (value: string | undefined): number | null => {
    if (!value) return null
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : null
}

const orderSequenceSteps = (steps: readonly SequenceStep[]): SequenceStep[] =>
    [...steps].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER
        const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.id.localeCompare(b.id)
    })

const unavailable = (
    stepId: string,
    reason: Exclude<SequenceAvailabilityReason, 'available'>,
    lockedByStepIds: string[] = []
): SequenceAvailabilityResult => ({
    stepId,
    available: false,
    reason,
    lockedByStepIds
})

export function evaluateSequenceStepAvailability(
    policy: SequencePolicy,
    steps: readonly SequenceStep[],
    stepId: string,
    now: Date = new Date()
): SequenceAvailabilityResult {
    const parsedPolicy = sequencePolicySchema.parse(policy)
    const parsedSteps = steps.map((step) => sequenceStepSchema.parse(step))
    const step = parsedSteps.find((candidate) => candidate.id === stepId)

    if (!step) return unavailable(stepId, 'missingStep')

    const nowTimestamp = now.getTime()
    const availableFrom = parseDateTime(step.availableFrom)
    const availableTo = parseDateTime(step.availableTo)

    if (availableFrom !== null && availableFrom > nowTimestamp) {
        return unavailable(step.id, 'scheduledNotStarted')
    }

    if (availableTo !== null && availableTo < nowTimestamp) {
        return unavailable(step.id, 'scheduledExpired')
    }

    if (parsedPolicy.mode === 'sequential') {
        const orderedSteps = orderSequenceSteps(parsedSteps)
        const stepIndex = orderedSteps.findIndex((candidate) => candidate.id === step.id)
        const incompletePreviousStep = orderedSteps.slice(0, stepIndex).find((candidate) => !isCompletionItemComplete(candidate))

        if (incompletePreviousStep) {
            return unavailable(step.id, 'sequentialLocked', [incompletePreviousStep.id])
        }
    }

    if (parsedPolicy.mode === 'prerequisite') {
        const stepById = new Map(parsedSteps.map((candidate) => [candidate.id, candidate]))
        const lockedByStepIds = step.prerequisiteStepIds.filter((prerequisiteStepId) => {
            const prerequisiteStep = stepById.get(prerequisiteStepId)
            return !prerequisiteStep || !isCompletionItemComplete(prerequisiteStep)
        })

        if (lockedByStepIds.length > 0) {
            return unavailable(step.id, 'prerequisiteLocked', lockedByStepIds)
        }
    }

    return {
        stepId: step.id,
        available: true,
        reason: 'available',
        lockedByStepIds: []
    }
}
