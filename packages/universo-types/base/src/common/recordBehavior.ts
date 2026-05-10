import { z } from 'zod'

export const CATALOG_RECORD_MODES = ['reference', 'transactional', 'hybrid'] as const
export type CatalogRecordMode = (typeof CATALOG_RECORD_MODES)[number]

export const RECORD_NUMBERING_SCOPES = ['global', 'workspace'] as const
export type RecordNumberingScope = (typeof RECORD_NUMBERING_SCOPES)[number]

export const RECORD_NUMBERING_PERIODICITIES = ['none', 'day', 'month', 'quarter', 'year'] as const
export type RecordNumberingPeriodicity = (typeof RECORD_NUMBERING_PERIODICITIES)[number]

export const RECORD_POSTING_MODES = ['disabled', 'manual', 'automatic'] as const
export type RecordPostingMode = (typeof RECORD_POSTING_MODES)[number]

export const RECORD_IMMUTABILITY_MODES = ['none', 'posted', 'final'] as const
export type RecordImmutabilityMode = (typeof RECORD_IMMUTABILITY_MODES)[number]

export interface RecordNumberingBehavior {
    enabled: boolean
    scope: RecordNumberingScope
    periodicity: RecordNumberingPeriodicity
    prefix?: string
    minLength?: number
}

export interface RecordDateBehavior {
    enabled: boolean
    fieldCodename?: string
    defaultToNow: boolean
}

export interface RecordLifecycleState {
    codename: string
    title: string
    isInitial?: boolean
    isFinal?: boolean
}

export interface RecordLifecycleBehavior {
    enabled: boolean
    stateFieldCodename?: string
    states: RecordLifecycleState[]
}

export interface RecordPostingBehavior {
    mode: RecordPostingMode
    targetLedgers: string[]
    scriptCodename?: string
}

export interface CatalogRecordBehavior {
    mode: CatalogRecordMode
    numbering: RecordNumberingBehavior
    effectiveDate: RecordDateBehavior
    lifecycle: RecordLifecycleBehavior
    posting: RecordPostingBehavior
    immutability: RecordImmutabilityMode
}

export const DEFAULT_CATALOG_RECORD_BEHAVIOR: CatalogRecordBehavior = {
    mode: 'reference',
    numbering: {
        enabled: false,
        scope: 'workspace',
        periodicity: 'none',
        minLength: 6
    },
    effectiveDate: {
        enabled: false,
        defaultToNow: true
    },
    lifecycle: {
        enabled: false,
        states: []
    },
    posting: {
        mode: 'disabled',
        targetLedgers: []
    },
    immutability: 'none'
}

const CATALOG_RECORD_MODE_SET = new Set<string>(CATALOG_RECORD_MODES)
const RECORD_NUMBERING_SCOPE_SET = new Set<string>(RECORD_NUMBERING_SCOPES)
const RECORD_NUMBERING_PERIODICITY_SET = new Set<string>(RECORD_NUMBERING_PERIODICITIES)
const RECORD_POSTING_MODE_SET = new Set<string>(RECORD_POSTING_MODES)
const RECORD_IMMUTABILITY_MODE_SET = new Set<string>(RECORD_IMMUTABILITY_MODES)

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeOptionalString = (value: unknown, maxLength: number): string | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }
    const normalized = value.trim()
    return normalized.length > 0 ? normalized.slice(0, maxLength) : undefined
}

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const normalizeInteger = (value: unknown, fallback: number | undefined, min: number, max: number): number | undefined => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
    if (!Number.isInteger(parsed)) {
        return fallback
    }
    return Math.min(max, Math.max(min, parsed))
}

const normalizeEnumValue = <T extends string>(value: unknown, allowed: ReadonlySet<string>, fallback: T): T =>
    typeof value === 'string' && allowed.has(value) ? (value as T) : fallback

const normalizeStringList = (value: unknown, maxItems: number, maxLength: number): string[] => {
    if (!Array.isArray(value)) {
        return []
    }

    const seen = new Set<string>()
    const result: string[] = []
    for (const item of value) {
        const normalized = normalizeOptionalString(item, maxLength)
        if (!normalized || seen.has(normalized)) {
            continue
        }
        seen.add(normalized)
        result.push(normalized)
        if (result.length >= maxItems) {
            break
        }
    }
    return result
}

const normalizeLifecycleStates = (value: unknown): RecordLifecycleState[] => {
    if (!Array.isArray(value)) {
        return []
    }

    const seen = new Set<string>()
    const states: RecordLifecycleState[] = []
    for (const item of value) {
        if (!isRecord(item)) {
            continue
        }

        const codename = normalizeOptionalString(item.codename, 128)
        if (!codename || seen.has(codename)) {
            continue
        }

        const title = normalizeOptionalString(item.title, 128) ?? codename
        seen.add(codename)
        states.push({
            codename,
            title,
            ...(typeof item.isInitial === 'boolean' ? { isInitial: item.isInitial } : {}),
            ...(typeof item.isFinal === 'boolean' ? { isFinal: item.isFinal } : {})
        })

        if (states.length >= 32) {
            break
        }
    }
    return states
}

export const catalogRecordBehaviorSchema = z
    .object({
        mode: z.enum(CATALOG_RECORD_MODES),
        numbering: z
            .object({
                enabled: z.boolean(),
                scope: z.enum(RECORD_NUMBERING_SCOPES),
                periodicity: z.enum(RECORD_NUMBERING_PERIODICITIES),
                prefix: z.string().trim().min(1).max(32).optional(),
                minLength: z.number().int().min(1).max(32).optional()
            })
            .strict(),
        effectiveDate: z
            .object({
                enabled: z.boolean(),
                fieldCodename: z.string().trim().min(1).max(128).optional(),
                defaultToNow: z.boolean()
            })
            .strict(),
        lifecycle: z
            .object({
                enabled: z.boolean(),
                stateFieldCodename: z.string().trim().min(1).max(128).optional(),
                states: z
                    .array(
                        z
                            .object({
                                codename: z.string().trim().min(1).max(128),
                                title: z.string().trim().min(1).max(128),
                                isInitial: z.boolean().optional(),
                                isFinal: z.boolean().optional()
                            })
                            .strict()
                    )
                    .max(32)
            })
            .strict(),
        posting: z
            .object({
                mode: z.enum(RECORD_POSTING_MODES),
                targetLedgers: z.array(z.string().trim().min(1).max(128)).max(64),
                scriptCodename: z.string().trim().min(1).max(128).optional()
            })
            .strict(),
        immutability: z.enum(RECORD_IMMUTABILITY_MODES)
    })
    .strict() satisfies z.ZodType<CatalogRecordBehavior>

export const normalizeCatalogRecordBehavior = (value: unknown): CatalogRecordBehavior => {
    const raw = isRecord(value) ? value : {}
    const numbering = isRecord(raw.numbering) ? raw.numbering : {}
    const effectiveDate = isRecord(raw.effectiveDate) ? raw.effectiveDate : {}
    const lifecycle = isRecord(raw.lifecycle) ? raw.lifecycle : {}
    const posting = isRecord(raw.posting) ? raw.posting : {}

    return catalogRecordBehaviorSchema.parse({
        mode: normalizeEnumValue(raw.mode, CATALOG_RECORD_MODE_SET, DEFAULT_CATALOG_RECORD_BEHAVIOR.mode),
        numbering: {
            enabled: normalizeBoolean(numbering.enabled, DEFAULT_CATALOG_RECORD_BEHAVIOR.numbering.enabled),
            scope: normalizeEnumValue(numbering.scope, RECORD_NUMBERING_SCOPE_SET, DEFAULT_CATALOG_RECORD_BEHAVIOR.numbering.scope),
            periodicity: normalizeEnumValue(
                numbering.periodicity,
                RECORD_NUMBERING_PERIODICITY_SET,
                DEFAULT_CATALOG_RECORD_BEHAVIOR.numbering.periodicity
            ),
            ...(normalizeOptionalString(numbering.prefix, 32) ? { prefix: normalizeOptionalString(numbering.prefix, 32) } : {}),
            ...(normalizeInteger(numbering.minLength, DEFAULT_CATALOG_RECORD_BEHAVIOR.numbering.minLength, 1, 32)
                ? { minLength: normalizeInteger(numbering.minLength, DEFAULT_CATALOG_RECORD_BEHAVIOR.numbering.minLength, 1, 32) }
                : {})
        },
        effectiveDate: {
            enabled: normalizeBoolean(effectiveDate.enabled, DEFAULT_CATALOG_RECORD_BEHAVIOR.effectiveDate.enabled),
            ...(normalizeOptionalString(effectiveDate.fieldCodename, 128)
                ? { fieldCodename: normalizeOptionalString(effectiveDate.fieldCodename, 128) }
                : {}),
            defaultToNow: normalizeBoolean(effectiveDate.defaultToNow, DEFAULT_CATALOG_RECORD_BEHAVIOR.effectiveDate.defaultToNow)
        },
        lifecycle: {
            enabled: normalizeBoolean(lifecycle.enabled, DEFAULT_CATALOG_RECORD_BEHAVIOR.lifecycle.enabled),
            ...(normalizeOptionalString(lifecycle.stateFieldCodename, 128)
                ? { stateFieldCodename: normalizeOptionalString(lifecycle.stateFieldCodename, 128) }
                : {}),
            states: normalizeLifecycleStates(lifecycle.states)
        },
        posting: {
            mode: normalizeEnumValue(posting.mode, RECORD_POSTING_MODE_SET, DEFAULT_CATALOG_RECORD_BEHAVIOR.posting.mode),
            targetLedgers: normalizeStringList(posting.targetLedgers, 64, 128),
            ...(normalizeOptionalString(posting.scriptCodename, 128)
                ? { scriptCodename: normalizeOptionalString(posting.scriptCodename, 128) }
                : {})
        },
        immutability: normalizeEnumValue(raw.immutability, RECORD_IMMUTABILITY_MODE_SET, DEFAULT_CATALOG_RECORD_BEHAVIOR.immutability)
    })
}

export const normalizeCatalogRecordBehaviorFromConfig = (config: Record<string, unknown> | null | undefined): CatalogRecordBehavior =>
    normalizeCatalogRecordBehavior(isRecord(config?.recordBehavior) ? config.recordBehavior : undefined)

export const isCatalogRecordBehaviorEnabled = (behavior: CatalogRecordBehavior): boolean =>
    behavior.mode === 'transactional' ||
    behavior.mode === 'hybrid' ||
    behavior.numbering.enabled ||
    behavior.effectiveDate.enabled ||
    behavior.lifecycle.enabled ||
    behavior.posting.mode !== 'disabled' ||
    behavior.immutability !== 'none'
