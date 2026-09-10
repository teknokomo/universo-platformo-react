import { z } from 'zod'

import {
    runtimeEntityCodenameSchema,
    runtimeLocaleSchema,
    runtimeTargetSchema,
    runtimeTargetThemeSchema,
    type RuntimeTarget
} from '@universo-react/types'

import { isUuidV7 } from '../uuid'

/** Zod wrapper for the existing UUID v7 helper; generic UUID callers are unchanged. */
export const uuidV7Schema = z.string().refine(isUuidV7, 'UUID v7 is required')

const normalizeRuntimeLocale = (locale: string): string => locale.trim().replace(/_/gu, '-').toLowerCase()

export type RuntimeLayoutTargetKind = 'page' | 'object'

export interface RuntimeLayoutTargetInput {
    targetKind?: RuntimeLayoutTargetKind | null
    entityTypeId?: string | null
    entityTypeCodename?: string | null
    workspaceId?: string | null
    locale?: string | null
    themeVariant?: 'light' | 'dark' | 'system' | null
    /** Accepted only for backwards-compatible callers; never part of layout identity. */
    recordKey?: string | null
}

export interface NormalizedRuntimeLayoutTarget {
    targetKind: RuntimeLayoutTargetKind | null
    entityTypeId: string | null
    entityTypeCodename: string | null
    workspaceId: string | null
    locale: string | null
    themeVariant: 'light' | 'dark' | 'system' | null
}

const runtimeLayoutTargetInputSchema = z
    .object({
        targetKind: z.enum(['page', 'object']).nullable().optional(),
        entityTypeId: z.string().trim().min(1).nullable().optional(),
        entityTypeCodename: runtimeEntityCodenameSchema.nullable().optional(),
        workspaceId: z.string().trim().min(1).nullable().optional(),
        locale: runtimeLocaleSchema.nullable().optional(),
        themeVariant: z
            .preprocess((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value), runtimeTargetThemeSchema)
            .nullable()
            .optional(),
        recordKey: z.string().trim().min(1).nullable().optional()
    })
    .strict()

/**
 * Canonical client/server query identity for target-aware runtime requests.
 * Physical UUID-v7 enforcement remains at the server RuntimeTarget boundary;
 * this input helper also supports deterministic unit-test and URL construction.
 */
export const normalizeRuntimeLayoutTarget = (input?: RuntimeLayoutTargetInput | null): NormalizedRuntimeLayoutTarget => {
    const parsed = runtimeLayoutTargetInputSchema.parse(input ?? {})
    const targetKind = parsed.targetKind ?? null
    const entityTypeId = parsed.entityTypeId?.trim().toLowerCase() || null
    const entityTypeCodename = parsed.entityTypeCodename?.trim() || null

    if (entityTypeId && entityTypeCodename) {
        throw new Error('Runtime target must use entityTypeId or entityTypeCodename, not both')
    }
    if ((entityTypeId || entityTypeCodename) && !targetKind) {
        throw new Error('Runtime target kind is required when an entity selector is provided')
    }
    if (targetKind && !entityTypeId && !entityTypeCodename) {
        throw new Error('Runtime target selector is required for an entity target')
    }

    return {
        targetKind,
        entityTypeId,
        entityTypeCodename,
        workspaceId: parsed.workspaceId?.trim().toLowerCase() || null,
        locale: parsed.locale ? normalizeRuntimeLocale(parsed.locale) : null,
        themeVariant: parsed.themeVariant ?? null
    }
}

/** Parse and canonicalize a target without accepting record/content selectors. */
export const normalizeRuntimeTarget = (input: unknown): RuntimeTarget => {
    const target = runtimeTargetSchema.parse(input)
    const common = {
        applicationId: target.applicationId.toLowerCase(),
        ...(target.workspaceId ? { workspaceId: target.workspaceId.toLowerCase() } : {}),
        locale: normalizeRuntimeLocale(target.locale),
        ...(target.themeVariant ? { themeVariant: target.themeVariant } : {})
    }

    if (target.targetKind === null) return { ...common, targetKind: null }

    if ('entityTypeId' in target && typeof target.entityTypeId === 'string') {
        return {
            ...common,
            targetKind: target.targetKind,
            entityTypeId: target.entityTypeId.toLowerCase()
        }
    }

    return {
        ...common,
        targetKind: target.targetKind,
        entityTypeCodename: target.entityTypeCodename.trim()
    }
}

export const parseRuntimeTarget = normalizeRuntimeTarget

/** Stable JSON identity for request/cache keys. */
export const canonicalRuntimeTargetIdentity = (input: unknown): string => JSON.stringify(normalizeRuntimeTarget(input))

/** Query-key compatible target identity with the normalized target as its final segment. */
export const canonicalRuntimeTargetKey = (input: unknown) => {
    const target = normalizeRuntimeTarget(input)
    return ['applications', target.applicationId, 'runtime', 'effective-layout', target] as const
}
