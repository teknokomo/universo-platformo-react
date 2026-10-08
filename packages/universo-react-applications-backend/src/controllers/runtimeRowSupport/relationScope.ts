import type { DbExecutor } from '@universo-react/utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    buildRuntimeActiveRowCondition,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import {
    isRuntimeObjectTargetKind,
    type RuntimeObjectCollectionAttr,
    type RuntimeZoneWidgets
} from '../../services/runtimeRowSupport/contracts'
import { buildRuntimeRecordAccessClause } from '../../services/runtimeRowSupport/access'
import { findRuntimeAttrByFieldKey, resolveRuntimeObjectCollection } from './objects'
import { resolveRuntimeObjectCollectionConfig } from './objects'
import { resolveRuntimeRelationPanelAuthority, resolveRuntimeReorderField } from '../../services/runtimeRowSupport/list'
import { resolveRuntimeRecordReference } from '../../services/runtimeRecordHandle'

export type RuntimeRelationScope = {
    fieldCodename: string
    parentRecordId: string
}

type RuntimeParentCollection = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectCollection>>['objectCollection']>

export type ResolvedRuntimeRelationScope = {
    request: RuntimeRelationScope
    parentFieldAttr: RuntimeObjectCollectionAttr
    parentCollection: RuntimeParentCollection
    parentAttrs: RuntimeObjectCollectionAttr[]
    sortOrderAttr: ReturnType<typeof resolveRuntimeReorderField>
}

/** Resolve Entity-level authority from validated layout bindings; the exact parent record is rechecked by the row lock. */
export const resolveRuntimeRelationWriteScope = async (params: {
    manager: DbExecutor
    applicationId: string
    workspaceId: string | null
    schemaIdent: string
    zoneWidgets: RuntimeZoneWidgets
    childEntity: { codename: unknown }
    childAttrs: RuntimeObjectCollectionAttr[]
    request: RuntimeRelationScope
}): Promise<ResolvedRuntimeRelationScope | null> => {
    const parentFieldAttr = findRuntimeAttrByFieldKey(params.childAttrs, params.request.fieldCodename)
    if (
        !parentFieldAttr ||
        parentFieldAttr.data_type !== 'REF' ||
        !parentFieldAttr.target_object_id ||
        !isRuntimeObjectTargetKind(parentFieldAttr.target_object_kind) ||
        !IDENTIFIER_REGEX.test(parentFieldAttr.column_name)
    ) {
        return null
    }

    const parentResult = await resolveRuntimeObjectCollection(params.manager, params.schemaIdent, parentFieldAttr.target_object_id)
    const parentCollection = parentResult.objectCollection
    if (!parentCollection || parentCollection.id !== parentFieldAttr.target_object_id) return null
    const parentEntityCodename = resolveRuntimeCodenameText(parentCollection.codename)
    const parentReference = resolveRuntimeRecordReference(params.request.parentRecordId, {
        applicationId: params.applicationId,
        workspaceId: params.workspaceId,
        entityCodename: parentEntityCodename
    })
    if (!parentReference) return null
    const request = { ...params.request, parentRecordId: parentReference.recordId }

    const authority = resolveRuntimeRelationPanelAuthority(params.zoneWidgets, {
        parentFieldCodename: params.request.fieldCodename,
        parentEntityCodename,
        parentRecordId: request.parentRecordId,
        childEntityCodename: resolveRuntimeCodenameText(params.childEntity.codename)
    })
    if (!authority) return null

    const sortOrderAttr = resolveRuntimeReorderField(params.childAttrs, authority.sortOrderFieldCodename)
    if (authority.enableRowReordering && !sortOrderAttr) return null

    return {
        request,
        parentFieldAttr,
        parentCollection,
        parentAttrs: parentResult.attrs,
        sortOrderAttr
    }
}

/** Re-resolve panel authority on the transaction executor before locking or mutating scoped rows. */
export const revalidateRuntimeRelationWriteScope = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollectionId: string
    childEntity: { codename: unknown }
    childAttrs: RuntimeObjectCollectionAttr[]
    scope: ResolvedRuntimeRelationScope
}): Promise<ResolvedRuntimeRelationScope> => {
    const { selectedLayout } = await resolveRuntimeObjectCollectionConfig({
        manager: params.executor,
        applicationId: params.applicationId,
        userId: params.ctx.userId,
        role: params.ctx.role,
        workspaceId: params.ctx.currentWorkspaceId,
        objectCollectionId: params.objectCollectionId,
        objectCollectionCodename: resolveRuntimeCodenameText(params.childEntity.codename)
    })
    const currentScope = await resolveRuntimeRelationWriteScope({
        manager: params.executor,
        applicationId: params.applicationId,
        workspaceId: params.ctx.currentWorkspaceId,
        schemaIdent: params.ctx.schemaIdent,
        zoneWidgets: selectedLayout.zoneWidgets,
        childEntity: params.childEntity,
        childAttrs: params.childAttrs,
        request: params.scope.request
    })
    if (!currentScope) {
        throw new UpdateFailure(409, {
            error: 'The relation layout changed before the operation could be completed',
            code: 'RUNTIME_RELATION_SCOPE_INVALID'
        })
    }
    return currentScope
}

/** Lock and authorize the parent before any scoped child write, serializing relation creates/reorders. */
export const lockRuntimeRelationParentRecord = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    scope: ResolvedRuntimeRelationScope
}): Promise<void> => {
    const { executor, ctx, scope } = params
    const parent = scope.parentCollection
    const parentTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(parent.table_name)}`
    const parentActiveCondition = buildRuntimeActiveRowCondition(
        parent.lifecycleContract,
        parent.config,
        'parentRecord',
        ctx.currentWorkspaceId
    )
    const parentValues: unknown[] = [scope.request.parentRecordId]
    const parentAccessClause = await buildRuntimeRecordAccessClause({
        manager: executor,
        schemaIdent: ctx.schemaIdent,
        currentWorkspaceId: ctx.currentWorkspaceId,
        currentUserId: ctx.userId,
        permissions: ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(parent.codename),
        attrs: scope.parentAttrs,
        config: parent.config,
        outerRowIdSql: 'parentRecord.id',
        values: parentValues,
        minimumAccessLevel: 'edit'
    })
    const parentRows = (await executor.query(
        `
        SELECT parentRecord.id, parentRecord._upl_locked
        FROM ${parentTableIdent} AS parentRecord
        WHERE parentRecord.id = $1
          AND ${parentActiveCondition}
          AND ${parentAccessClause ?? 'TRUE'}
        FOR UPDATE OF parentRecord
        `,
        parentValues
    )) as Array<{ id: string; _upl_locked?: boolean | null }>

    if (!parentRows[0]) throw new UpdateFailure(404, { error: 'Parent record is unavailable' })
    if (parentRows[0]._upl_locked === true) throw new UpdateFailure(423, { error: 'Parent record is locked' })
}

export const buildRuntimeRelationRowPredicate = (params: {
    scope: ResolvedRuntimeRelationScope
    tableAlias?: string
    parameterIndex: number
}): string => {
    const prefix = params.tableAlias ? `${params.tableAlias}.` : ''
    return `${prefix}${quoteIdentifier(params.scope.parentFieldAttr.column_name)} = $${params.parameterIndex}`
}
