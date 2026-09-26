import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { DbExecutor } from '@universo-react/utils'
import { quoteIdentifier, UpdateFailure, buildRuntimeSoftDeleteSetClause } from '../../shared/runtimeHelpers'
import type { RuntimeLibraryRelationKey, RuntimeRelationBinding } from '../runtimeRowSupport/contracts'
import { readRuntimeLibraryConfig, resolveRuntimeRelationBinding } from '../runtimeRowSupport/access'
import { assertRuntimeEntityMutationAllowed } from '../../shared/entityMutationPolicy'

import type { RuntimeLibraryRelationColumns } from './types'

export const updateExistingLibraryRelationRow = async (params: {
    executor: DbExecutor
    binding: RuntimeRelationBinding
    activeRowId: string
    relationKey: RuntimeLibraryRelationKey
    isSharedRelation: boolean
    accessLevelColumn: string | null
    timestampColumn: string | null
    sharedAccessLevel: string
    refreshTimestampOnActive?: boolean
    userId: string
}): Promise<{ active: boolean; changed: boolean }> => {
    const { accessLevelColumn, timestampColumn } = params
    if (
        !(
            (params.relationKey === 'recent' && timestampColumn) ||
            (params.isSharedRelation && (accessLevelColumn || timestampColumn)) ||
            (params.refreshTimestampOnActive === true && timestampColumn)
        )
    ) {
        return { active: true, changed: false }
    }

    const updateAssignments = [
        ...(accessLevelColumn ? [`${accessLevelColumn} = $2`] : []),
        ...(timestampColumn ? [`${timestampColumn} = NOW()`] : []),
        `_upl_updated_at = NOW()`,
        `_upl_updated_by = $${accessLevelColumn ? 3 : 2}`,
        `_upl_version = COALESCE(_upl_version, 1) + 1`
    ]
    const updateValues = accessLevelColumn
        ? [params.activeRowId, params.sharedAccessLevel, params.userId]
        : [params.activeRowId, params.userId]
    const updatedRows = (await params.executor.query(
        `
    UPDATE ${params.binding.tableIdent} rel
    SET ${updateAssignments.join(',\n            ')}
    WHERE rel.id = $1
      AND ${params.binding.activeCondition}
    RETURNING id
  `,
        updateValues
    )) as Array<{ id: string }>
    if (updatedRows.length === 0) {
        throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
    }
    return { active: true, changed: true }
}

export const insertLibraryRelationRow = async (params: {
    executor: DbExecutor
    binding: RuntimeRelationBinding
    columns: RuntimeLibraryRelationColumns
    objectCodename: string
    rowId: string
    isSharedRelation: boolean
    sharedPrincipalType: string | null
    sharedPrincipalId: string | null
    sharedAccessLevel: string
    userId: string
    workspacesEnabled: boolean
    currentWorkspaceId: string | null
}): Promise<{ active: boolean; changed: boolean }> => {
    const [{ id }] = await params.executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
    const insertColumns = params.isSharedRelation
        ? [
              'id',
              params.columns.targetObjectColumn,
              params.columns.targetRecordColumn,
              params.columns.principalTypeColumn!,
              params.columns.principalIdColumn!
          ]
        : ['id', params.columns.targetObjectColumn, params.columns.targetRecordColumn, params.columns.actorColumn!]
    const insertValues: unknown[] = params.isSharedRelation
        ? [id, params.objectCodename, params.rowId, params.sharedPrincipalType, params.sharedPrincipalId]
        : [id, params.objectCodename, params.rowId, params.userId]
    const insertPlaceholders = insertValues.map((_value, index) => `$${index + 1}`)

    if (params.columns.timestampColumn) {
        insertColumns.push(params.columns.timestampColumn)
        insertPlaceholders.push('NOW()')
    }
    if (params.isSharedRelation && params.columns.accessLevelColumn) {
        insertColumns.push(params.columns.accessLevelColumn)
        insertPlaceholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.sharedAccessLevel)
    }
    if (params.workspacesEnabled && params.currentWorkspaceId) {
        insertColumns.push('workspace_id')
        insertPlaceholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.currentWorkspaceId)
    }

    insertColumns.push('_upl_created_by', '_upl_updated_by')
    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
    insertValues.push(params.userId, params.userId)

    await params.executor.query(
        `
    INSERT INTO ${params.binding.tableIdent} (${insertColumns.join(', ')})
    VALUES (${insertPlaceholders.join(', ')})
  `,
        insertValues
    )
    return { active: true, changed: true }
}

export const deactivateLibraryRelationRow = async (params: {
    executor: DbExecutor
    binding: RuntimeRelationBinding
    relationWhereSql: string
    relationParams: unknown[]
    userId: string
}): Promise<{ active: boolean; changed: boolean }> => {
    if (params.binding.isSoftDelete) {
        const deletedByParam = `$${params.relationParams.length + 1}`
        const updatedRows = (await params.executor.query(
            `
    UPDATE ${params.binding.tableIdent} rel
    SET ${buildRuntimeSoftDeleteSetClause(deletedByParam, params.binding.lifecycleContract, params.binding.config)},
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE ${params.relationWhereSql}
      AND ${params.binding.activeCondition}
    RETURNING id
  `,
            [...params.relationParams, params.userId]
        )) as Array<{ id: string }>
        if (updatedRows.length === 0) {
            throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
        }
    } else {
        const deletedRows = (await params.executor.query(
            `
    DELETE FROM ${params.binding.tableIdent} rel
    WHERE ${params.relationWhereSql}
      AND ${params.binding.activeCondition}
    RETURNING id
  `,
            params.relationParams
        )) as Array<{ id: string }>
        if (deletedRows.length === 0) {
            throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
        }
    }

    return { active: false, changed: true }
}

export const persistRuntimeActorLibraryRelation = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaIdent: string
    objectCollectionId: string
    objectCodename: string
    objectConfig: Record<string, unknown> | null | undefined
    relationKey: RuntimeLibraryRelationKey
    rowId: string
    userId: string
    currentWorkspaceId: string | null
    workspacesEnabled: boolean
    active: boolean
    refreshTimestampOnActive?: boolean
}): Promise<{ active: boolean; changed: boolean } | null> => {
    assertRuntimeEntityMutationAllowed(params.objectConfig)
    const libraryConfig = readRuntimeLibraryConfig(params.objectConfig)
    const relation = libraryConfig?.[params.relationKey]
    if (!relation?.actorFieldCodename) return null

    const binding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation
    })
    if (!binding?.actorColumnName) return null
    assertRuntimeEntityMutationAllowed(binding.config)

    const targetObjectColumn = quoteIdentifier(binding.targetObjectColumnName)
    const targetRecordColumn = quoteIdentifier(binding.targetRecordColumnName)
    const actorColumn = quoteIdentifier(binding.actorColumnName)
    const timestampColumn = binding.timestampColumnName ? quoteIdentifier(binding.timestampColumnName) : null
    const relationWorkspaceClause = params.workspacesEnabled && params.currentWorkspaceId ? 'AND rel.workspace_id = $4' : ''
    const relationParams =
        params.workspacesEnabled && params.currentWorkspaceId
            ? [params.objectCodename, params.rowId, params.userId, params.currentWorkspaceId]
            : [params.objectCodename, params.rowId, params.userId]
    const relationWhereSql = `
        rel.${targetObjectColumn}::text = $1::text
        AND rel.${targetRecordColumn}::text = $2::text
        AND rel.${actorColumn}::text = $3::text
        ${relationWorkspaceClause}
    `
    const relationLockKey = `${params.applicationId}:${params.objectCollectionId}:${params.rowId}:${params.relationKey}:${params.userId}:${
        params.currentWorkspaceId ?? 'default'
    }`

    await acquireAdvisoryXactLock(params.manager, relationLockKey)
    const activeRows = (await params.manager.query(
        `
    SELECT rel.id
    FROM ${binding.tableIdent} rel
    WHERE ${relationWhereSql}
      AND ${binding.activeCondition}
    LIMIT 1
  `,
        relationParams
    )) as Array<{ id: string }>
    const activeRowId = activeRows[0]?.id
    const wasActive = Boolean(activeRowId)

    if (params.active) {
        if (wasActive && activeRowId) {
            return updateExistingLibraryRelationRow({
                executor: params.manager,
                binding,
                activeRowId,
                relationKey: params.relationKey,
                isSharedRelation: false,
                accessLevelColumn: null,
                timestampColumn,
                sharedAccessLevel: '',
                refreshTimestampOnActive: params.refreshTimestampOnActive,
                userId: params.userId
            })
        }

        return insertLibraryRelationRow({
            executor: params.manager,
            binding,
            columns: {
                targetObjectColumn,
                targetRecordColumn,
                actorColumn,
                principalTypeColumn: null,
                principalIdColumn: null,
                accessLevelColumn: null,
                timestampColumn
            },
            objectCodename: params.objectCodename,
            rowId: params.rowId,
            isSharedRelation: false,
            sharedPrincipalType: null,
            sharedPrincipalId: null,
            sharedAccessLevel: '',
            userId: params.userId,
            workspacesEnabled: params.workspacesEnabled,
            currentWorkspaceId: params.currentWorkspaceId
        })
    }

    if (!wasActive) {
        return { active: false, changed: false }
    }

    return deactivateLibraryRelationRow({
        executor: params.manager,
        binding,
        relationWhereSql,
        relationParams,
        userId: params.userId
    })
}
