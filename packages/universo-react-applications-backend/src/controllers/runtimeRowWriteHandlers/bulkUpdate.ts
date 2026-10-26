import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { assertRuntimeRecordMutable } from '../../services/runtimeRecordBehavior'
import {
    dispatchRuntimeLifecycle,
    dispatchRuntimeLifecycleAfterCommit,
    type RuntimeLifecycleDispatchRequest
} from '../../services/runtimeLifecycleDispatch'
import {
    IDENTIFIER_REGEX,
    RUNTIME_WRITABLE_TYPES,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    buildRuntimeRestoreSetClause,
    buildRuntimeSoftDeleteSetClause,
    coerceRuntimeValue,
    ensureEnumerationValueBelongsToTarget,
    ensureRuntimePermission,
    formatRuntimeFieldLabel,
    getEnumPresentationMode,
    getRuntimeInputValue,
    getSetConstantConfig,
    isSoftDeleteLifecycle,
    normalizeConfiguredRuntimeJsonValue,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    toRuntimeInputFormatErrorBody,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import { assertRuntimeRecordRules } from '../../services/runtimeRecordRules'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import { resolveAccessLinkIntakePolicy } from '../../services/guestAccessLinkIntakePolicy'
import {
    isRuntimeEnumerationKind,
    isRuntimeSetKind,
    runtimeBulkUpdateBodySchema,
    type RuntimeObjectCollectionAttr
} from '../../services/runtimeRowSupport/contracts'
import {
    findRuntimeAttrByFieldKey,
    resolveRuntimeObjectCollection,
    resolveRuntimeObjectCollectionConfig
} from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import {
    validateRuntimeDateOrderRules,
    validateRuntimeAccessLinkTarget,
    validateRuntimeParentRecordAccessReferences,
    validateRuntimeRecordPickerReferences,
    validateRuntimeRequiredWhenRules,
    hasRuntimeServerOwnedInput
} from '../runtimeRowSupport/validation'
import {
    assertNotProtectedSystemStructureRuntimeRow,
    buildRuntimeRecordAccessClause,
    loadRuntimeRowByIdWithRecordAccess,
    validateRuntimeAccessEntryMembership
} from '../../services/runtimeRowSupport/access'
import { collectTouchedComponentIds, loadRuntimeRowById } from '../runtimeRowSupport/rows'
import {
    buildRuntimeRelationRowPredicate,
    lockRuntimeRelationParentRecord,
    resolveRuntimeRelationAuthorityLayout,
    resolveRuntimeRelationWriteScope,
    revalidateRuntimeRelationWriteScope,
    type ResolvedRuntimeRelationScope
} from '../runtimeRowSupport/relationScope'
import { resolveRuntimeRelationOwnedFieldCodenames } from '../../services/runtimeRowSupport/list'
import { lockGuestAccessLinkWorkspace, revokeGuestSessionsForAccessLink } from '../../services/guestAccessLinkRevocation'
import { getRuntimeTableTemplateGenericMutationFailure } from '../runtimeChildRowsInterpretationNetworkGuard'

import { buildBulkUpdateTableEntries, replaceRuntimeTableChildRows } from './bulkUpdateTableChildren'
export { buildBulkUpdateTableEntries, prepareBulkUpdateTableChildRows, replaceRuntimeTableChildRows } from './bulkUpdateTableChildren'

import type { RuntimeRowWriteDeps, RuntimeWriteResolvedObjectCollection, RuntimeWriteTableDataEntry } from './types'
import { isRuntimeRecordReference, resolveRuntimeRecordReference } from '../../services/runtimeRecordHandle'

export const buildBulkUpdateScalarPatch = async (params: {
    manager: DbExecutor
    schemaIdent: string
    data: Record<string, unknown>
    nonTableAttrs: RuntimeObjectCollectionAttr[]
}): Promise<
    | { kind: 'ok'; setClauses: string[]; values: unknown[]; normalizedPatchByColumn: Record<string, unknown>; paramIndex: number }
    | { kind: 'failure'; statusCode: number; body: Record<string, unknown> }
> => {
    const setClauses: string[] = []
    const values: unknown[] = []
    const normalizedPatchByColumn: Record<string, unknown> = {}
    let paramIndex = 1

    for (const cmp of params.nonTableAttrs) {
        const attrLabel = formatRuntimeFieldLabel(cmp.codename)
        const { value: raw } = getRuntimeInputValue(params.data, cmp.column_name, cmp.codename)
        if (raw === undefined) continue
        if (hasRuntimeServerOwnedInput(params.data, cmp)) {
            return { kind: 'failure', statusCode: 400, body: { error: `Field is server-owned: ${attrLabel}` } }
        }
        let normalizedRaw = raw

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            getEnumPresentationMode(cmp.ui_config) === 'label'
        ) {
            return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
        }
        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(raw)
            if (!providedRefId) {
                normalizedRaw = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return { kind: 'failure', statusCode: 400, body: { error: `Field is read-only: ${attrLabel}` } }
            } else {
                normalizedRaw = valueGroupFixedValueConfig.id
            }
        }

        try {
            const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(normalizedRaw, cmp.data_type, cmp.validation_rules), cmp)
            if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                return { kind: 'failure', statusCode: 400, body: { error: `Required field cannot be set to null: ${attrLabel}` } }
            }

            if (
                cmp.data_type === 'REF' &&
                isRuntimeEnumerationKind(cmp.target_object_kind) &&
                typeof cmp.target_object_id === 'string' &&
                coerced
            ) {
                await ensureEnumerationValueBelongsToTarget(params.manager, params.schemaIdent, String(coerced), cmp.target_object_id)
            }

            setClauses.push(`${quoteIdentifier(cmp.column_name)} = $${paramIndex}`)
            values.push(coerced)
            normalizedPatchByColumn[cmp.column_name] = coerced
            paramIndex++
        } catch (e) {
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return { kind: 'failure', statusCode: 400, body: formatError }
            return { kind: 'failure', statusCode: 400, body: { error: `Invalid value for ${attrLabel}: ${(e as Error).message}` } }
        }
    }

    return { kind: 'ok', setClauses, values, normalizedPatchByColumn, paramIndex }
}

export const executeBulkUpdateStatement = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    dataTableIdent: string
    runtimeRowCondition: string
    runtimeDeleteSetClause: string | null
    setClauses: string[]
    values: unknown[]
    rowId: string
    rowIdParamIndex: number
    versionCheckClause: string
    expectedVersion: number | undefined
    tableDataEntries: RuntimeWriteTableDataEntry[]
    relationScope?: ResolvedRuntimeRelationScope
}): Promise<void> => {
    const objectCodename = resolveRuntimeCodenameText(params.objectCollection.codename)
    const updateAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename,
        attrs: params.attrs,
        config: params.objectCollection.config,
        outerRowIdSql: `${params.dataTableIdent}.id`,
        values: params.values,
        minimumAccessLevel: 'edit'
    })
    const relationScopeClause = params.relationScope
        ? buildRuntimeRelationRowPredicate({
              scope: params.relationScope,
              parameterIndex: params.values.length + 1
          })
        : null
    if (params.relationScope) params.values.push(params.relationScope.request.parentRecordId)
    const updateWhereSql = [
        `id = $${params.rowIdParamIndex}`,
        params.runtimeRowCondition,
        'COALESCE(_upl_locked, false) = false',
        updateAccessClause,
        relationScopeClause
    ]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const updated = (await params.executor.query(
        `
      UPDATE ${params.dataTableIdent}
      SET ${params.setClauses.join(', ')}
      WHERE ${updateWhereSql}
        ${params.versionCheckClause}
      RETURNING id
    `,
        params.values
    )) as Array<{ id: string }>

    if (updated.length === 0) {
        const exists = (await params.executor.query(
            `SELECT id, _upl_locked, _upl_version FROM ${params.dataTableIdent} WHERE id = $1 AND ${params.runtimeRowCondition}`,
            [params.rowId]
        )) as Array<{
            id: string
            _upl_locked?: boolean
            _upl_version?: number
        }>

        if (exists.length > 0 && exists[0]._upl_locked) {
            throw new UpdateFailure(423, {
                error: 'Record is locked'
            })
        }
        if (exists.length > 0 && params.expectedVersion !== undefined) {
            const actualVersion = Number(exists[0]._upl_version ?? 1)
            if (actualVersion !== params.expectedVersion) {
                throw createRuntimeVersionConflictFailure(params.expectedVersion, actualVersion)
            }
        }
        throw new UpdateFailure(404, {
            error: 'Row not found'
        })
    }

    await replaceRuntimeTableChildRows({
        executor: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        objectCollectionId: params.objectCollection.id,
        userId: params.ctx.userId,
        workspacesEnabled: params.ctx.workspacesEnabled,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        runtimeRowCondition: params.runtimeRowCondition,
        runtimeDeleteSetClause: params.runtimeDeleteSetClause,
        runtimeDeletedRowCondition: params.runtimeDeleteSetClause
            ? buildRuntimeDeletedRowCondition(
                  params.objectCollection.lifecycleContract,
                  params.objectCollection.config,
                  undefined,
                  params.ctx.currentWorkspaceId
              )
            : null,
        runtimeRestoreSetClause: params.runtimeDeleteSetClause
            ? buildRuntimeRestoreSetClause('$1', params.objectCollection.lifecycleContract, params.objectCollection.config)
            : null,
        parentRowId: params.rowId,
        entries: params.tableDataEntries
    })
}

export const applyBulkUpdateInTransaction = async (params: {
    executor: DbExecutor
    ctx: RuntimeSchemaContext
    applicationId: string
    objectCollection: RuntimeWriteResolvedObjectCollection
    attrs: RuntimeObjectCollectionAttr[]
    data: Record<string, unknown>
    normalizedPatchByColumn: Record<string, unknown>
    expectedVersion: number | undefined
    runtimeRowCondition: string
    dataTableIdent: string
    touchedComponentIds: string[]
    runtimeDeleteSetClause: string | null
    setClauses: string[]
    values: unknown[]
    rowId: string
    rowIdParamIndex: number
    versionCheckClause: string
    tableDataEntries: RuntimeWriteTableDataEntry[]
    relationScope?: ResolvedRuntimeRelationScope
}): Promise<RuntimeLifecycleDispatchRequest | null> => {
    const relationScope = params.relationScope
        ? await revalidateRuntimeRelationWriteScope({
              executor: params.executor,
              ctx: params.ctx,
              applicationId: params.applicationId,
              childEntity: params.objectCollection,
              childAttrs: params.attrs,
              scope: params.relationScope
          })
        : undefined
    if (relationScope) {
        const changedRelationOwnedField = relationScope.ownedFieldAttrs.find((attr) =>
            Object.prototype.hasOwnProperty.call(params.normalizedPatchByColumn, attr.column_name)
        )
        if (changedRelationOwnedField) {
            throw new UpdateFailure(400, { error: 'Relation parent and ordering fields are server-owned' })
        }
        await lockRuntimeRelationParentRecord({ executor: params.executor, ctx: params.ctx, scope: relationScope })
    }
    const previousRow = await loadRuntimeRowByIdWithRecordAccess({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        dataTableIdent: params.dataTableIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        attrs: params.attrs,
        config: params.objectCollection.config,
        rowId: params.rowId,
        rowCondition: params.runtimeRowCondition,
        minimumAccessLevel: 'edit'
    })
    if (!previousRow || !previousRow.id) {
        throw new UpdateFailure(404, {
            error: 'Row not found'
        })
    }
    if (params.tableDataEntries.some((entry) => entry.cmp.validation_rules?.matrixUniqueCoordinates === true)) {
        throw new UpdateFailure(409, {
            error: 'Matrix cells must be changed through aggregate Matrix commands so associated Materials remain consistent',
            code: 'INTERPRETATION_NETWORK_MATRIX_AGGREGATE_COMMAND_REQUIRED'
        })
    }
    const templateChildReplacementFailure =
        params.tableDataEntries.length > 0
            ? getRuntimeTableTemplateGenericMutationFailure(params.objectCollection.codename, 'child-replacement')
            : null
    if (templateChildReplacementFailure) {
        const lockedParentRows = (await params.executor.query(
            `SELECT id FROM ${params.dataTableIdent} WHERE id = $1 AND ${params.runtimeRowCondition} FOR UPDATE`,
            [params.rowId]
        )) as Array<{ id: string }>
        if (lockedParentRows.length === 0) throw new UpdateFailure(404, { error: 'Row not found' })

        for (const entry of params.tableDataEntries) {
            const tabTableIdent = qSchemaTable(params.ctx.schemaName, entry.tabTableName)
            const currentChildRows = await params.executor.query<{ id: string }>(
                `SELECT id FROM ${tabTableIdent} WHERE _tp_parent_id = $1 AND ${params.runtimeRowCondition} FOR UPDATE`,
                [params.rowId]
            )
            if (currentChildRows.length > 0) {
                throw new UpdateFailure(templateChildReplacementFailure.statusCode, templateChildReplacementFailure.body)
            }
        }
    }
    if (relationScope && previousRow[relationScope.parentFieldAttr.column_name] !== relationScope.request.parentRecordId) {
        throw new UpdateFailure(404, { error: 'Row not found' })
    }
    if (previousRow._upl_locked) {
        throw new UpdateFailure(423, {
            error: 'Record is locked'
        })
    }
    await assertNotProtectedSystemStructureRuntimeRow(
        params.executor,
        params.ctx,
        params.applicationId,
        params.objectCollection.id,
        params.attrs,
        previousRow
    )
    assertRuntimeRecordMutable(params.objectCollection.config, previousRow)

    const referenceValidationError = await validateRuntimeRecordPickerReferences({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (referenceValidationError) {
        throw new UpdateFailure(400, { error: referenceValidationError })
    }
    const accessLinkIntakePolicy = resolveAccessLinkIntakePolicy({
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        fields: params.attrs.map((attr) => ({
            codename: attr.codename,
            columnName: attr.column_name,
            dataType: attr.data_type,
            defaultValue: attr.ui_config?.defaultValue
        })),
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (!accessLinkIntakePolicy.valid) {
        throw new UpdateFailure(400, { error: accessLinkIntakePolicy.error, code: accessLinkIntakePolicy.code })
    }
    const accessLinkTargetError = await validateRuntimeAccessLinkTarget({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn },
        lockTarget: true
    })
    if (accessLinkTargetError) {
        throw new UpdateFailure(400, { error: accessLinkTargetError })
    }
    const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (accessEntryValidationError) {
        throw new UpdateFailure(400, { error: accessEntryValidationError })
    }
    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        objectConfig: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn },
        minimumAccessLevel: 'edit'
    })
    if (parentAccessValidationError) {
        throw new UpdateFailure(400, { error: parentAccessValidationError })
    }
    const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (requiredWhenValidationError) {
        throw new UpdateFailure(400, { error: requiredWhenValidationError })
    }
    const dateOrderValidationError = validateRuntimeDateOrderRules({
        config: params.objectCollection.config,
        attrs: params.attrs,
        row: { ...previousRow, ...params.normalizedPatchByColumn }
    })
    if (dateOrderValidationError) {
        throw new UpdateFailure(400, { error: dateOrderValidationError })
    }

    if (params.expectedVersion !== undefined) {
        const versionRows = (await params.executor.query(
            `SELECT _upl_version FROM ${params.dataTableIdent} WHERE id = $1 AND ${params.runtimeRowCondition}`,
            [params.rowId]
        )) as Array<{ _upl_version?: number }>
        const actualVersion = Number(versionRows[0]?._upl_version ?? 1)
        if (versionRows.length > 0 && actualVersion !== params.expectedVersion) {
            throw createRuntimeVersionConflictFailure(params.expectedVersion, actualVersion)
        }
    }
    await assertRuntimeRecordRules({
        manager: params.executor,
        schemaIdent: params.ctx.schemaIdent,
        dataTableIdent: params.dataTableIdent,
        activeCondition: params.runtimeRowCondition,
        attrs: params.attrs,
        row: params.normalizedPatchByColumn,
        excludeRowId: params.rowId
    })

    await dispatchRuntimeLifecycle({
        manager: params.executor,
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        componentIds: params.touchedComponentIds,
        payload: {
            eventName: 'beforeUpdate',
            previousRow,
            patch: params.data
        }
    })

    await executeBulkUpdateStatement({
        executor: params.executor,
        ctx: params.ctx,
        objectCollection: params.objectCollection,
        attrs: params.attrs,
        dataTableIdent: params.dataTableIdent,
        runtimeRowCondition: params.runtimeRowCondition,
        runtimeDeleteSetClause: params.runtimeDeleteSetClause,
        setClauses: params.setClauses,
        values: params.values,
        rowId: params.rowId,
        rowIdParamIndex: params.rowIdParamIndex,
        versionCheckClause: params.versionCheckClause,
        expectedVersion: params.expectedVersion,
        tableDataEntries: params.tableDataEntries,
        relationScope
    })

    const nextRow = await loadRuntimeRowById(params.executor, params.dataTableIdent, params.rowId, params.runtimeRowCondition)
    return {
        applicationId: params.applicationId,
        schemaName: params.ctx.schemaName,
        objectCollection: params.objectCollection,
        currentWorkspaceId: params.ctx.currentWorkspaceId,
        currentUserId: params.ctx.userId,
        permissions: params.ctx.permissions,
        componentIds: params.touchedComponentIds,
        payload: {
            eventName: 'afterUpdate',
            row: nextRow,
            previousRow,
            patch: params.data
        }
    }
}

export const createBulkUpdateRowHandler = ({ getDbExecutor, query }: RuntimeRowWriteDeps) => {
    // ============ BULK UPDATE ROW ============
    const bulkUpdateRow = async (req: Request, res: Response) => {
        const { applicationId, rowId: rowReference } = req.params
        if (!isRuntimeRecordReference(rowReference)) return res.status(400).json({ error: 'Invalid row reference format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const {
            objectCollectionId: requestedObjectCollectionId,
            data,
            expectedVersion,
            relationScope: requestedRelationScope
        } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return
        const resolvedReference = resolveRuntimeRecordReference(rowReference, {
            applicationId,
            workspaceId: ctx.currentWorkspaceId,
            entityCodename: resolveRuntimeCodenameText(objectCollection.codename)
        })
        if (!resolvedReference) return res.status(404).json({ error: 'Row not found' })
        const rowId = resolvedReference.recordId
        const selectedLayout = (
            await resolveRuntimeObjectCollectionConfig({
                manager: ctx.manager,
                applicationId,
                userId: ctx.userId,
                role: ctx.role,
                workspaceId: ctx.currentWorkspaceId,
                objectCollectionId: objectCollection.id,
                objectCollectionCodename: resolveRuntimeCodenameText(objectCollection.codename)
            })
        ).selectedLayout
        const relationOwnedAttrs = resolveRuntimeRelationOwnedFieldCodenames(
            selectedLayout.zoneWidgets,
            resolveRuntimeCodenameText(objectCollection.codename)
        )
            .map((fieldCodename) => findRuntimeAttrByFieldKey(attrs, fieldCodename))
            .filter((attr): attr is RuntimeObjectCollectionAttr => Boolean(attr))
        const relationAuthorityLayout = requestedRelationScope
            ? await resolveRuntimeRelationAuthorityLayout({
                  manager: ctx.manager,
                  applicationId,
                  userId: ctx.userId,
                  role: ctx.role,
                  workspaceId: ctx.currentWorkspaceId,
                  target: requestedRelationScope.layoutTarget,
                  childEntity: objectCollection,
                  locale: typeof req.query.locale === 'string' ? req.query.locale : 'en'
              })
            : null
        const relationScope = requestedRelationScope
            ? relationAuthorityLayout
                ? await resolveRuntimeRelationWriteScope({
                      manager: ctx.manager,
                      applicationId,
                      workspaceId: ctx.currentWorkspaceId,
                      schemaIdent: ctx.schemaIdent,
                      zoneWidgets: relationAuthorityLayout.zoneWidgets,
                      childEntity: objectCollection,
                      childAttrs: attrs,
                      request: requestedRelationScope
                  })
                : null
            : null
        if (requestedRelationScope && !relationScope) {
            return res.status(409).json({ error: 'The requested relation scope is unavailable', code: 'RUNTIME_RELATION_SCOPE_INVALID' })
        }
        const ownedAttrs = new Map(
            [...relationOwnedAttrs, ...(relationScope?.ownedFieldAttrs ?? [])].map((attr) => [attr.column_name, attr])
        )
        const suppliedRelationOwnedAttr = [...ownedAttrs.values()].find(
            (attr) => getRuntimeInputValue(data, attr.column_name, attr.codename).hasUserValue
        )
        if (suppliedRelationOwnedAttr && !relationScope) {
            return res.status(409).json({
                error: 'A verified relation scope is required to change this relationship',
                code: 'RUNTIME_RELATION_SCOPE_REQUIRED'
            })
        }
        if (relationScope && denyRuntimeEntityMutation(res, relationScope.parentCollection.config)) return
        if (suppliedRelationOwnedAttr) {
            return res.status(400).json({ error: 'Relation parent and ordering fields are server-owned' })
        }
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const touchedComponentIds = collectTouchedComponentIds(attrs, data)

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForUpdate = safeAttrs.filter((a) => a.data_type === 'TABLE')

        const scalarPatchResult = await buildBulkUpdateScalarPatch({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            data,
            nonTableAttrs
        })
        if (scalarPatchResult.kind === 'failure') {
            return res.status(scalarPatchResult.statusCode).json(scalarPatchResult.body)
        }
        const { setClauses, values, normalizedPatchByColumn, paramIndex: scalarParamIndex } = scalarPatchResult

        const tableEntriesResult = await buildBulkUpdateTableEntries({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            data,
            tableAttrs: tableAttrsForUpdate
        })
        if (tableEntriesResult.kind === 'failure') {
            return res.status(tableEntriesResult.statusCode).json(tableEntriesResult.body)
        }
        const tableDataEntries = tableEntriesResult.entries
        const accessLinkActiveAttr = attrs.find((attr) => resolveRuntimeCodenameText(attr.codename) === 'IsActive')

        if (setClauses.length === 0 && tableDataEntries.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' })
        }

        let paramIndex = scalarParamIndex
        setClauses.push('_upl_updated_at = NOW()')
        setClauses.push(`_upl_updated_by = $${paramIndex}`)
        values.push(ctx.userId)
        paramIndex++
        // Keep the immutable seed key for reconciliation while marking the row
        // as authored. This prevents the next publication from materializing a
        // duplicate row for the same source element.
        if (ctx.workspacesEnabled) {
            setClauses.push('_seed_source_owned = false')
        }
        setClauses.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        values.push(rowId)
        const rowIdParamIndex = paramIndex
        let versionCheckClause = ''

        if (expectedVersion !== undefined) {
            values.push(expectedVersion)
            versionCheckClause = `AND COALESCE(_upl_version, 1) = $${rowIdParamIndex + 1}`
        }

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                if (resolveRuntimeCodenameText(objectCollection.codename) === 'AccessLinks') {
                    await lockGuestAccessLinkWorkspace({
                        executor: txManager,
                        schemaName: ctx.schemaName,
                        workspacesEnabled: ctx.workspacesEnabled,
                        workspaceId: ctx.currentWorkspaceId
                    })
                }
                afterUpdateLifecycleRequest = await applyBulkUpdateInTransaction({
                    executor: txManager,
                    ctx,
                    applicationId,
                    objectCollection,
                    attrs,
                    data,
                    normalizedPatchByColumn,
                    expectedVersion,
                    runtimeRowCondition,
                    dataTableIdent,
                    touchedComponentIds,
                    runtimeDeleteSetClause,
                    setClauses,
                    values,
                    rowId,
                    rowIdParamIndex,
                    versionCheckClause,
                    tableDataEntries,
                    relationScope: relationScope ?? undefined
                })
                if (
                    resolveRuntimeCodenameText(objectCollection.codename) === 'AccessLinks' &&
                    accessLinkActiveAttr &&
                    normalizedPatchByColumn[accessLinkActiveAttr.column_name] === false
                ) {
                    await revokeGuestSessionsForAccessLink({
                        executor: txManager,
                        applicationId,
                        schemaName: ctx.schemaName,
                        settings: ctx.applicationSettings,
                        workspacesEnabled: ctx.workspacesEnabled,
                        workspaceId: ctx.currentWorkspaceId,
                        accessLinkId: rowId,
                        actorUserId: ctx.userId
                    })
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterUpdateLifecycleRequest)
            return res.json({ status: 'ok' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }
    return bulkUpdateRow
}
