import { z } from 'zod'
import {
    EFFECTIVE_LAYOUT_ERROR_CODES as LAYOUT_RUNTIME_ERROR_CODES,
    EFFECTIVE_LAYOUT_ERROR_STATUS as LAYOUT_RUNTIME_ERROR_STATUS,
    runtimeEntityCodenameSchema,
    runtimeLocaleSchema,
    runtimeTargetSchema,
    uuidV7Schema,
    type EffectiveLayoutCompositionMode,
    type EffectiveLayoutResult,
    type EffectiveWidget,
    type EffectiveLayoutScope,
    type LayoutRuntimeErrorCode,
    type RuntimeTarget
} from '@universo-react/types'

export const EFFECTIVE_LAYOUT_ERROR_CODES = LAYOUT_RUNTIME_ERROR_CODES
export type EffectiveLayoutErrorCode = LayoutRuntimeErrorCode
export const EFFECTIVE_LAYOUT_ERROR_STATUS = LAYOUT_RUNTIME_ERROR_STATUS
export { runtimeTargetSchema }

const rawRuntimeQuerySchema = z
    .object({
        targetKind: z.enum(['page', 'object']).optional(),
        entityTypeId: uuidV7Schema.optional(),
        entityTypeCodename: runtimeEntityCodenameSchema.optional(),
        workspaceId: uuidV7Schema.optional(),
        locale: runtimeLocaleSchema.optional().default('en'),
        themeVariant: z.enum(['light', 'dark', 'system']).optional()
    })
    .strict()

export class EffectiveLayoutError extends Error {
    readonly code: EffectiveLayoutErrorCode
    readonly httpStatus: number

    constructor(code: EffectiveLayoutErrorCode) {
        super(code)
        this.name = 'EffectiveLayoutError'
        this.code = code
        this.httpStatus = EFFECTIVE_LAYOUT_ERROR_STATUS[code]
    }
}

export const failEffectiveLayout = (code: EffectiveLayoutErrorCode): never => {
    throw new EffectiveLayoutError(code)
}

export function normalizeRuntimeTarget(input: unknown): RuntimeTarget {
    const parsed = runtimeTargetSchema.safeParse(input)
    if (!parsed.success) return failEffectiveLayout('LAYOUT_REQUEST_INVALID')
    return parsed.data
}

export function parseRuntimeTarget(applicationId: unknown, query: unknown): RuntimeTarget {
    const parsedQuery = rawRuntimeQuerySchema.safeParse(query)
    if (!parsedQuery.success) return failEffectiveLayout('LAYOUT_REQUEST_INVALID')

    const { targetKind, entityTypeId, entityTypeCodename, ...common } = parsedQuery.data
    if (!targetKind && (entityTypeId || entityTypeCodename)) {
        return failEffectiveLayout('LAYOUT_REQUEST_INVALID')
    }
    if (targetKind && Boolean(entityTypeId) === Boolean(entityTypeCodename)) {
        return failEffectiveLayout('LAYOUT_REQUEST_INVALID')
    }

    return normalizeRuntimeTarget({
        applicationId,
        targetKind: targetKind ?? null,
        ...(entityTypeId ? { entityTypeId } : {}),
        ...(entityTypeCodename ? { entityTypeCodename } : {}),
        ...common
    })
}

export type { EffectiveLayoutCompositionMode, EffectiveLayoutResult, EffectiveLayoutScope, RuntimeTarget }
export type EffectiveLayoutSuccess = Extract<EffectiveLayoutResult, { status: 'ok' }>

// Keep the backend-facing name while using the single neutral contract owned
// by the shared types package. This prevents the API client and resolver from
// silently drifting apart as templates add fields.
export type EffectiveLayoutWidget = EffectiveWidget

export const effectiveLayoutErrorBody = (error: EffectiveLayoutError) => ({
    status: 'failed' as const,
    error: {
        code: error.code,
        httpStatus: error.httpStatus
    }
})
