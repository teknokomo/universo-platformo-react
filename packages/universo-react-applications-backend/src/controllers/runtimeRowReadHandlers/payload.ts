import { normalizeRuntimePageBlocks } from '@universo-react/types'
import { normalizeObjectCollectionRuntimeViewConfig } from '@universo-react/utils'
import { normalizeRuntimeRecordBehavior } from '../../services/runtimeRecordBehavior'
import { resolvePresentationName, resolveRuntimeCodenameText, type RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { resolveRuntimeStandardKind } from '../../services/runtimeRowSupport/contracts'
import { readConfiguredWorkflowActions } from '../../services/runtimeRowSupport/workflow'

import type { RuntimeReadColumnDefinition, RuntimeReadObjectCollection, RuntimeReadRuntimeConfig, RuntimeReadRuntimeSection } from './types'

export const buildRuntimeReadSections = (params: {
    runtimeObjects: RuntimeReadObjectCollection[]
    activeObjectCollection: RuntimeReadObjectCollection
    activeObjectCollectionRuntimeConfig: RuntimeReadRuntimeConfig
    requestedLocale: string
}): {
    objectCollectionsForRuntime: RuntimeReadRuntimeSection[]
} => {
    const objectCollectionsForRuntime: RuntimeReadRuntimeSection[] = params.runtimeObjects.map((objectRow) => ({
        id: objectRow.id,
        kind: resolveRuntimeStandardKind(objectRow.kind) ?? 'object',
        codename: resolveRuntimeCodenameText(objectRow.codename),
        tableName: objectRow.table_name,
        runtimeConfig:
            objectRow.id === params.activeObjectCollection.id
                ? normalizeObjectCollectionRuntimeViewConfig(params.activeObjectCollectionRuntimeConfig)
                : normalizeObjectCollectionRuntimeViewConfig(undefined),
        recordBehavior:
            resolveRuntimeStandardKind(objectRow.kind) === 'page' ? undefined : normalizeRuntimeRecordBehavior(objectRow.config),
        workflowActions: resolveRuntimeStandardKind(objectRow.kind) === 'page' ? [] : readConfiguredWorkflowActions(objectRow.config),
        name: resolvePresentationName(objectRow.presentation, params.requestedLocale, resolveRuntimeCodenameText(objectRow.codename))
    }))
    return { objectCollectionsForRuntime }
}

export const buildRuntimeReadResponsePayload = (params: {
    runtimeContext: RuntimeSchemaContext
    activeObjectCollection: RuntimeReadObjectCollection
    activeObjectCollectionKind: ReturnType<typeof resolveRuntimeStandardKind>
    isActivePage: boolean
    activeRecordBehavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
    activeWorkflowActions: ReturnType<typeof readConfiguredWorkflowActions>
    activeObjectCollectionRuntimeConfig: RuntimeReadRuntimeConfig
    requestedLocale: string
    objectCollectionsForRuntime: RuntimeReadRuntimeSection[]
    columns: RuntimeReadColumnDefinition[]
    rows: Array<Record<string, unknown> & { id: string }>
    total: number
    limit: number
    offset: number
    workspaceLimit: { maxRows: number | null; currentRows: number; canCreate: boolean } | undefined
}): Record<string, unknown> => {
    const activeSectionPayload = {
        id: params.activeObjectCollection.id,
        kind: params.activeObjectCollectionKind ?? 'object',
        codename: resolveRuntimeCodenameText(params.activeObjectCollection.codename),
        tableName: params.activeObjectCollection.table_name,
        pageBlocks: params.isActivePage ? normalizeRuntimePageBlocks(params.activeObjectCollection.config?.blockContent) : undefined,
        runtimeConfig: normalizeObjectCollectionRuntimeViewConfig(params.activeObjectCollectionRuntimeConfig),
        recordBehavior: params.isActivePage ? undefined : params.activeRecordBehavior,
        workflowActions: params.activeWorkflowActions,
        name: resolvePresentationName(
            params.activeObjectCollection.presentation,
            params.requestedLocale,
            resolveRuntimeCodenameText(params.activeObjectCollection.codename)
        )
    }

    return {
        section: activeSectionPayload,
        sections: params.objectCollectionsForRuntime,
        activeSectionId: params.activeObjectCollection.id,
        objectCollection: {
            ...activeSectionPayload
        },
        objectCollections: params.objectCollectionsForRuntime,
        activeObjectCollectionId: params.isActivePage ? null : params.activeObjectCollection.id,
        columns: params.columns,
        rows: params.rows,
        pagination: {
            total: typeof params.total === 'number' ? params.total : Number(params.total) || 0,
            limit: params.limit,
            offset: params.offset
        },
        ...(params.workspaceLimit ? { workspaceLimit: params.workspaceLimit } : {}),
        settings: params.runtimeContext.applicationSettings,
        workspacesEnabled: params.runtimeContext.workspacesEnabled,
        currentWorkspaceId: params.runtimeContext.currentWorkspaceId,
        permissions: params.runtimeContext.permissions,
        workflowCapabilities: params.runtimeContext.workflowCapabilities
    }
}
