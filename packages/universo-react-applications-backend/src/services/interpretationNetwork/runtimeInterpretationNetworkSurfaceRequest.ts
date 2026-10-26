import { layoutInstanceKeySchema, runtimeTargetSchema, uuidV7Schema } from '@universo-react/types'
import { z } from 'zod'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { InterpretationNetworkRuntimeSurfaceParams } from './runtimeInterpretationNetworkSurface'

export const interpretationNetworkRuntimeSurfaceQuerySchema = z
    .object({
        widgetId: z.string().uuid().optional(),
        layoutId: z.string().uuid().optional(),
        instanceKey: layoutInstanceKeySchema.optional(),
        targetKind: z.enum(['page', 'object']).optional(),
        entityTypeId: uuidV7Schema.optional(),
        locale: z.string().trim().min(1).max(32).default('en'),
        themeVariant: z.enum(['light', 'dark', 'system']).optional()
    })
    .strict()
    .superRefine((value, context) => {
        if ((value.targetKind && !value.entityTypeId) || (!value.targetKind && value.entityTypeId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'A page or object runtime target requires an entity type ID' })
        }
    })

export type InterpretationNetworkRuntimeSurfaceQuery = z.infer<typeof interpretationNetworkRuntimeSurfaceQuerySchema>

type RuntimeSurfaceContext = Pick<
    RuntimeSchemaContext,
    'schemaName' | 'currentWorkspaceId' | 'workspacesEnabled' | 'baseApplicationSettings' | 'userId' | 'role'
>

export type InterpretationNetworkRuntimeSurfaceContextResult =
    | { ok: true; params: InterpretationNetworkRuntimeSurfaceParams }
    | { ok: false; reason: 'missing-instance-key' | 'invalid-runtime-target'; details?: unknown }

export const parseInterpretationNetworkRuntimeSurfaceQuery = (query: unknown) => {
    const values = query && typeof query === 'object' && !Array.isArray(query) ? (query as Record<string, unknown>) : {}
    return interpretationNetworkRuntimeSurfaceQuerySchema.safeParse({
        ...(typeof values.widgetId === 'string' ? { widgetId: values.widgetId } : {}),
        ...(typeof values.layoutId === 'string' ? { layoutId: values.layoutId } : {}),
        ...(typeof values.instanceKey === 'string' ? { instanceKey: values.instanceKey } : {}),
        ...(typeof values.targetKind === 'string' ? { targetKind: values.targetKind } : {}),
        ...(typeof values.entityTypeId === 'string' ? { entityTypeId: values.entityTypeId } : {}),
        ...(typeof values.locale === 'string' ? { locale: values.locale } : {}),
        ...(typeof values.themeVariant === 'string' ? { themeVariant: values.themeVariant } : {})
    })
}

export const buildInterpretationNetworkRuntimeSurfaceContext = (
    context: RuntimeSurfaceContext,
    applicationId: string,
    query: InterpretationNetworkRuntimeSurfaceQuery
): InterpretationNetworkRuntimeSurfaceContextResult => {
    const { targetKind, entityTypeId, instanceKey, locale, themeVariant, ...placementScope } = query
    let workspaceSettings: InterpretationNetworkRuntimeSurfaceParams['workspaceSettings']

    if (context.workspacesEnabled && context.currentWorkspaceId) {
        if (!instanceKey) return { ok: false, reason: 'missing-instance-key' }

        const runtimeTarget = runtimeTargetSchema.safeParse({
            applicationId,
            targetKind: targetKind ?? null,
            ...(entityTypeId ? { entityTypeId } : {}),
            workspaceId: context.currentWorkspaceId,
            locale,
            ...(themeVariant ? { themeVariant } : {})
        })
        if (!runtimeTarget.success) return { ok: false, reason: 'invalid-runtime-target', details: runtimeTarget.error.flatten() }

        workspaceSettings = {
            applicationSettings: context.baseApplicationSettings,
            authContext: { applicationId, userId: context.userId, role: context.role },
            runtimeTarget: runtimeTarget.data,
            instanceKey
        }
    }

    return {
        ok: true,
        params: {
            applicationId,
            schemaName: context.schemaName,
            workspaceId: context.currentWorkspaceId,
            scopeEntityId: entityTypeId ?? null,
            ...placementScope,
            ...(workspaceSettings ? { workspaceSettings } : {})
        }
    }
}
