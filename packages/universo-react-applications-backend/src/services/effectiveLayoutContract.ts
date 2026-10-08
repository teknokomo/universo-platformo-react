import { z } from 'zod'
import {
    EFFECTIVE_LAYOUT_ERROR_CODES as LAYOUT_RUNTIME_ERROR_CODES,
    EFFECTIVE_LAYOUT_ERROR_STATUS as LAYOUT_RUNTIME_ERROR_STATUS,
    runtimeEntityCodenameSchema,
    runtimeLocaleSchema,
    runtimeTargetSchema,
    applicationLayoutZoneSchema,
    applicationLayoutWidgetKeySchema,
    layoutInstanceKeySchema,
    layoutLogicalPlacementSchema,
    layoutSemanticRegionSchema,
    uuidV7Schema,
    type EffectiveLayoutCompositionMode,
    type EffectiveLayoutResult,
    type EffectiveLayoutScope,
    type LayoutRuntimeErrorCode,
    type RuntimeTarget
} from '@universo-react/types'
import { effectiveWidgetRuntimeDataSchema, type EffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeData'

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
type SharedEffectiveLayoutSuccess = Extract<EffectiveLayoutResult, { status: 'ok' }>
export type EffectiveLayoutSuccess = Omit<SharedEffectiveLayoutSuccess, 'widgets'> & { widgets: EffectiveLayoutWidget[] }

/** Strict renderer projection; parent links are semantic and source lineage stays server-side. */
export type EffectiveLayoutWidget = {
    id: string
    instanceKey: string
    parentInstanceKey: string | null
    slotKey: string | null
    zone: import('@universo-react/types').ApplicationLayoutZone
    semanticRegion: import('@universo-react/types').LayoutSemanticRegion
    widgetKey: import('@universo-react/types').ApplicationLayoutWidgetKey
    sortOrder: number
    config: Record<string, unknown>
    placement?: 'start' | 'end'
    isActive: boolean
    runtimeData?: EffectiveWidgetRuntimeData
}

export const effectiveLayoutWidgetRuntimeSchema = z
    .object({
        id: uuidV7Schema,
        instanceKey: layoutInstanceKeySchema,
        parentInstanceKey: layoutInstanceKeySchema.nullable(),
        slotKey: z.string().trim().min(1).max(128).nullable(),
        zone: applicationLayoutZoneSchema,
        semanticRegion: layoutSemanticRegionSchema,
        widgetKey: applicationLayoutWidgetKeySchema,
        sortOrder: z.number().int(),
        config: z.record(z.string(), z.unknown()),
        placement: layoutLogicalPlacementSchema.optional(),
        isActive: z.boolean(),
        runtimeData: effectiveWidgetRuntimeDataSchema.optional()
    })
    .strict()
    .superRefine((widget, context) => {
        if ((widget.parentInstanceKey === null) !== (widget.slotKey === null)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Parent and slot must either both be set or both be null' })
        }
        if (Object.prototype.hasOwnProperty.call(widget.config, 'instanceKey')) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config', 'instanceKey'],
                message: 'Placement identity is not renderer config.'
            })
        }
    })

export const effectiveLayoutErrorBody = (error: EffectiveLayoutError) => ({
    status: 'failed' as const,
    error: {
        code: error.code,
        httpStatus: error.httpStatus
    }
})
