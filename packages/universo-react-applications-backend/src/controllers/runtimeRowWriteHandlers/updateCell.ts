import type { Request, Response } from 'express'
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
    UUID_REGEX,
    UpdateFailure,
    buildRuntimeActiveRowCondition,
    coerceRuntimeValue,
    ensureEnumerationValueBelongsToTarget,
    ensureRuntimePermission,
    formatRuntimeFieldLabel,
    getEnumPresentationMode,
    getSetConstantConfig,
    normalizeConfiguredRuntimeJsonValue,
    quoteIdentifier,
    resolveRefId,
    resolveRuntimeCodenameText,
    resolveRuntimeSchema,
    toRuntimeInputFormatErrorBody
} from '../../shared/runtimeHelpers'
import { assertRuntimeRecordRules } from '../../services/runtimeRecordRules'
import { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'
import {
    isRuntimeEnumerationKind,
    isRuntimeSetKind,
    runtimeUpdateBodySchema,
    isRuntimeServerOwnedAttr
} from '../runtimeRowSupport/contracts'
import { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import {
    validateRuntimeDateOrderRules,
    validateRuntimeParentRecordAccessReferences,
    validateRuntimeRecordPickerReferences,
    validateRuntimeRequiredWhenRules
} from '../runtimeRowSupport/validation'
import {
    assertNotProtectedSystemStructureRuntimeRow,
    buildRuntimeRecordAccessClause,
    loadRuntimeRowByIdWithRecordAccess,
    validateRuntimeAccessEntryMembership
} from '../runtimeRowSupport/access'
import { loadRuntimeRowById } from '../runtimeRowSupport/rows'

import type { RuntimeRowWriteDeps } from './types'

export const createUpdateCellHandler = ({ getDbExecutor, query }: RuntimeRowWriteDeps) => {
    const updateCell = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { field, value, objectCollectionId: requestedObjectCollectionId, expectedVersion } = parsedBody.data
        if (!IDENTIFIER_REGEX.test(field)) {
            return res.status(400).json({ error: 'Invalid field name' })
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (denyRuntimeEntityMutation(res, objectCollection.config)) return
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const cmp = attrs.find((a) => a.column_name === field)
        if (!cmp) return res.status(404).json({ error: 'Component not found' })
        if (isRuntimeServerOwnedAttr(cmp)) {
            return res.status(400).json({
                error: `Field is server-owned: ${formatRuntimeFieldLabel(cmp.codename)}`
            })
        }
        if (!RUNTIME_WRITABLE_TYPES.has(cmp.data_type)) {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} is not editable`
            })
        }

        if (cmp.data_type === 'TABLE') {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} must be edited via tabular endpoints`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            getEnumPresentationMode(cmp.ui_config) === 'label'
        ) {
            return res.status(400).json({
                error: `Field is read-only: ${cmp.codename}`
            })
        }

        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        let rawValue = value
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(rawValue)
            if (!providedRefId) {
                rawValue = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return res.status(400).json({
                    error: `Field is read-only: ${cmp.codename}`
                })
            } else {
                rawValue = valueGroupFixedValueConfig.id
            }
        }

        let coerced: unknown
        try {
            coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(rawValue, cmp.data_type, cmp.validation_rules), cmp)
        } catch (e) {
            const formatError = toRuntimeInputFormatErrorBody(e)
            if (formatError) return res.status(400).json(formatError)
            return res.status(400).json({ error: (e as Error).message })
        }

        if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
            return res.status(400).json({
                error: `Required field cannot be set to null: ${cmp.codename}`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            typeof cmp.target_object_id === 'string' &&
            coerced
        ) {
            try {
                await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
            } catch (error) {
                return res.status(400).json({ error: (error as Error).message })
            }
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await withTransactionSavepoint(ctx.manager, async (txManager) => {
                const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
                const previousRow = await loadRuntimeRowByIdWithRecordAccess({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    rowId,
                    rowCondition: runtimeRowCondition,
                    minimumAccessLevel: 'edit'
                })
                if (!previousRow || !previousRow.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                await assertNotProtectedSystemStructureRuntimeRow(txManager, ctx, applicationId, objectCollection.id, attrs, previousRow)
                assertRuntimeRecordMutable(objectCollection.config, previousRow)

                const referenceValidationError = await validateRuntimeRecordPickerReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (referenceValidationError) {
                    throw new UpdateFailure(400, { error: referenceValidationError })
                }
                const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (accessEntryValidationError) {
                    throw new UpdateFailure(400, { error: accessEntryValidationError })
                }
                const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced },
                    minimumAccessLevel: 'edit'
                })
                if (parentAccessValidationError) {
                    throw new UpdateFailure(400, { error: parentAccessValidationError })
                }
                const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (requiredWhenValidationError) {
                    throw new UpdateFailure(400, { error: requiredWhenValidationError })
                }
                const dateOrderValidationError = validateRuntimeDateOrderRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (dateOrderValidationError) {
                    throw new UpdateFailure(400, { error: dateOrderValidationError })
                }

                if (expectedVersion !== undefined && Number(previousRow._upl_version ?? 1) !== expectedVersion) {
                    throw createRuntimeVersionConflictFailure(expectedVersion, Number(previousRow._upl_version ?? 1))
                }

                await assertRuntimeRecordRules({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    activeCondition: runtimeRowCondition,
                    attrs,
                    row: { [field]: coerced },
                    excludeRowId: rowId
                })

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: { [field]: coerced }
                    }
                })

                const updateValues: unknown[] = [coerced, ctx.userId, rowId]
                if (expectedVersion !== undefined) updateValues.push(expectedVersion)
                const versionCheckClause = expectedVersion !== undefined ? `AND COALESCE(_upl_version, 1) = $${updateValues.length}` : ''
                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: updateValues,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = ['id = $3', runtimeRowCondition, 'COALESCE(_upl_locked, false) = false', updateAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const seedOwnershipClause = ctx.workspacesEnabled ? '_seed_source_owned = false,' : ''

                const updated = (await txManager.query(
                    `
            UPDATE ${dataTableIdent}
            SET ${quoteIdentifier(field)} = $1,
                ${seedOwnershipClause}
                _upl_updated_at = NOW(),
                _upl_updated_by = $2,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE ${updateWhereSql}
              ${versionCheckClause}
            RETURNING id
          `,
                    updateValues
                )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

                if (updated.length === 0) {
                    const exists = (await txManager.query(
                        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                        [rowId]
                    )) as Array<{
                        id: string
                        _upl_locked?: boolean
                        _upl_version?: number
                    }>

                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }

                    if (exists.length > 0 && expectedVersion !== undefined) {
                        const actualVersion = Number(exists[0]._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                        }
                    }

                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                afterUpdateLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow,
                        patch: { [field]: coerced }
                    }
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
    return updateCell
}
