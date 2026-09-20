import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { interpretationNetworkStructureModeLockKey } from '../../shared/interpretationNetworkStructureModeGuard'
import { type Response } from 'express'
import { z } from 'zod'
import { type DbExecutor } from '@universo-react/utils'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { type RolePermission } from '../../routes/guards'
import { SYSTEM_STRUCTURE_KEY } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { resolveInterpretationNetworkRuntimeSurface } from '../../services/interpretationNetwork/runtimeInterpretationNetworkSurface'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    formatRuntimeFieldLabel,
    getRuntimeInputValue,
    isSoftDeleteLifecycle,
    buildRuntimeActiveRowCondition,
    type RuntimeSchemaContext
} from '../../shared/runtimeHelpers'
import {
    runtimeAccessEntryConfigSchema,
    runtimeCopyRelationSchema,
    runtimeLibraryConfigSchema,
    runtimeRecordParentAccessConfigSchema,
    type RuntimeAccessEntryConfig,
    type RuntimeCopyRelationsConfig,
    type RuntimeLibraryConfig,
    type RuntimeLibraryRelation,
    type RuntimeObjectCollectionAttr,
    type RuntimeRecordParentAccessConfig,
    type RuntimeRecordPickerReferenceConfig,
    type RuntimeRelationBinding,
    isRuntimeServerOwnedAttr,
    readRuntimeRecordAccessConfig
} from './contracts'
import {
    findRuntimeAttrByFieldKey,
    findRuntimeSystemKeyAttr,
    readRuntimeAttrStringValue,
    resolveRuntimeObjectCollectionByCodename,
    resolveRuntimeRecordOwnerColumnName
} from './objects'

export const normalizeRuntimeAccessLevel = (value: string | null | undefined): 'canView' | 'canEdit' | null => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
    if (normalized === 'canview') return 'canView'
    if (normalized === 'canedit') return 'canEdit'
    return null
}

export const buildRuntimeRelationTimestampValueSql = (params: {
    binding: RuntimeRelationBinding
    currentObjectCodename: string
    currentUserId: string
    outerRowIdSql: string
    values: unknown[]
}): string | null => {
    if (!params.binding.actorColumnName || !params.binding.timestampColumnName) return null

    params.values.push(params.currentObjectCodename)
    const objectPlaceholder = `$${params.values.length}`
    params.values.push(params.currentUserId)
    const userPlaceholder = `$${params.values.length}`

    const relationPredicates = [
        `rel.${quoteIdentifier(params.binding.targetObjectColumnName)}::text = ${objectPlaceholder}::text`,
        `rel.${quoteIdentifier(params.binding.targetRecordColumnName)}::text = ${params.outerRowIdSql}::text`,
        `rel.${quoteIdentifier(params.binding.actorColumnName)}::text = ${userPlaceholder}::text`,
        params.binding.activeCondition
    ]

    return `(
      SELECT rel.${quoteIdentifier(params.binding.timestampColumnName)}
      FROM ${params.binding.tableIdent} rel
      WHERE ${relationPredicates.join(' AND ')}
      ORDER BY rel.${quoteIdentifier(params.binding.timestampColumnName)} DESC NULLS LAST
      LIMIT 1
    )`
}

export const buildRuntimeSharedRelationTimestampValueSql = (params: {
    binding: RuntimeRelationBinding
    currentObjectCodename: string
    currentUserId: string
    outerRowIdSql: string
    values: unknown[]
}): string | null => {
    if (!params.binding.principalTypeColumnName || !params.binding.principalIdColumnName || !params.binding.timestampColumnName) {
        return null
    }

    params.values.push(params.currentObjectCodename)
    const objectPlaceholder = `$${params.values.length}`
    params.values.push(params.currentUserId)
    const userPlaceholder = `$${params.values.length}`
    params.values.push(params.binding.allowedPrincipalTypes)
    const principalTypesPlaceholder = `$${params.values.length}`

    const relationPredicates = [
        `rel.${quoteIdentifier(params.binding.targetObjectColumnName)}::text = ${objectPlaceholder}::text`,
        `rel.${quoteIdentifier(params.binding.targetRecordColumnName)}::text = ${params.outerRowIdSql}::text`,
        `rel.${quoteIdentifier(params.binding.principalTypeColumnName)} = ANY(${principalTypesPlaceholder}::text[])`,
        `rel.${quoteIdentifier(params.binding.principalIdColumnName)}::text = ${userPlaceholder}::text`,
        params.binding.activeCondition
    ]

    return `(
      SELECT rel.${quoteIdentifier(params.binding.timestampColumnName)}
      FROM ${params.binding.tableIdent} rel
      WHERE ${relationPredicates.join(' AND ')}
      ORDER BY rel.${quoteIdentifier(params.binding.timestampColumnName)} DESC NULLS LAST
      LIMIT 1
    )`
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const readTrimmedStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined
    const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    return values.length > 0 ? values : undefined
}

export const readRuntimeRecordPickerReferenceConfig = (attr: RuntimeObjectCollectionAttr): RuntimeRecordPickerReferenceConfig | null => {
    const uiConfig = attr.ui_config ?? {}
    const rawPicker = uiConfig.runtimeRecordPicker
    const pickerConfig = isRecordValue(rawPicker) ? rawPicker : {}
    const widget =
        typeof uiConfig.widget === 'string' ? uiConfig.widget : typeof pickerConfig.widget === 'string' ? pickerConfig.widget : null
    const enabled = rawPicker === true || widget === 'runtimeRecordPicker' || widget === 'recordPicker'
    if (!enabled) return null

    const targetObjectCodenameField =
        typeof pickerConfig.targetObjectCodenameField === 'string' && pickerConfig.targetObjectCodenameField.trim().length > 0
            ? pickerConfig.targetObjectCodenameField.trim()
            : typeof uiConfig.targetObjectCodenameField === 'string' && uiConfig.targetObjectCodenameField.trim().length > 0
            ? uiConfig.targetObjectCodenameField.trim()
            : null
    if (!targetObjectCodenameField) return null

    return {
        targetObjectCodenameField,
        allowedObjectCodenames: readTrimmedStringArray(pickerConfig.allowedObjectCodenames ?? uiConfig.allowedObjectCodenames)
    }
}

export const assertNotProtectedSystemStructureRuntimeRow = async (
    manager: DbExecutor,
    ctx: Pick<RuntimeSchemaContext, 'schemaName' | 'schemaIdent' | 'currentWorkspaceId'>,
    applicationId: string,
    objectCollectionId: string,
    attrs: Array<{ codename: unknown; column_name: string; ui_config?: Record<string, unknown> | null }>,
    row: Record<string, unknown>
): Promise<void> => {
    const systemKeyAttr = findRuntimeSystemKeyAttr(attrs)
    const surface = await resolveInterpretationNetworkRuntimeSurface(manager, {
        applicationId,
        schemaName: ctx.schemaName,
        workspaceId: ctx.currentWorkspaceId
    })
    if (surface.featureState === 'ambiguous-widget') {
        throw new UpdateFailure(409, {
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
    }
    const isSingleSystemAggregateObject =
        surface.structureMode === 'singleSystem' &&
        (surface.resolvedObjects.Structure === objectCollectionId || surface.resolvedObjects.Interpretation === objectCollectionId)
    if (surface.featureState !== 'ready' && isSingleSystemAggregateObject) {
        throw new UpdateFailure(409, {
            error: 'Interpretation Network runtime metadata is incomplete for single-structure mode',
            code: 'INTERPRETATION_NETWORK_MISSING_METADATA'
        })
    }
    if (surface.structureMode !== 'singleSystem') return
    if (surface.resolvedObjects.Structure === objectCollectionId) {
        if (!systemKeyAttr || String(row[systemKeyAttr.column_name] ?? '').trim() !== SYSTEM_STRUCTURE_KEY) return
        throw new UpdateFailure(409, {
            error: 'System Structure is managed by Interpretation Network single-structure mode',
            code: 'INTERPRETATION_NETWORK_SYSTEM_STRUCTURE_IMMUTABLE'
        })
    }
    if (surface.resolvedObjects.Interpretation !== objectCollectionId) return

    const parentStructureAttr = attrs.find((attr) => attr.codename === 'ParentStructure' && IDENTIFIER_REGEX.test(attr.column_name))
    const structureId = parentStructureAttr ? String(row[parentStructureAttr.column_name] ?? '').trim() : ''
    const structureContract = 'contracts' in surface ? surface.contracts.Structure : undefined
    const structureKeyAttr = structureContract
        ? Object.values(structureContract.fields).find((field) => field.codename === 'SystemKey')
        : undefined
    if (!structureId || !structureKeyAttr || !IDENTIFIER_REGEX.test(structureKeyAttr.column_name)) return
    const structureRows = await manager.query<Record<string, unknown>>(
        `
        SELECT ${quoteIdentifier(structureKeyAttr.column_name)}
        FROM ${ctx.schemaIdent}.${quoteIdentifier(structureContract!.object.table_name)}
        WHERE id = $1
          AND _upl_deleted = false
          AND _app_deleted = false
          ${ctx.currentWorkspaceId ? 'AND workspace_id = $2' : ''}
        LIMIT 1
        `,
        ctx.currentWorkspaceId ? [structureId, ctx.currentWorkspaceId] : [structureId]
    )
    if (String(structureRows[0]?.[structureKeyAttr.column_name] ?? '').trim() !== SYSTEM_STRUCTURE_KEY) return
    throw new UpdateFailure(409, {
        error: 'System Interpretation is managed by Interpretation Network single-structure mode',
        code: 'INTERPRETATION_NETWORK_SYSTEM_INTERPRETATION_IMMUTABLE'
    })
}

export const assertInterpretationNetworkGenericCreateAllowed = async (
    manager: DbExecutor,
    ctx: Pick<RuntimeSchemaContext, 'schemaName' | 'currentWorkspaceId'>,
    applicationId: string,
    objectCollectionId: string
): Promise<void> => {
    await acquireAdvisoryXactLock(manager, interpretationNetworkStructureModeLockKey(ctx.schemaName))
    const surface = await resolveInterpretationNetworkRuntimeSurface(manager, {
        applicationId,
        schemaName: ctx.schemaName,
        workspaceId: ctx.currentWorkspaceId
    })
    if (surface.featureState === 'ambiguous-widget') {
        throw new UpdateFailure(409, {
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
    }
    const requestedObjectRoles = Object.entries(surface.resolvedObjects)
        .filter(([, resolvedObjectId]) => resolvedObjectId === objectCollectionId)
        .map(([role]) => role)
    const protectsSingleSystemAggregate =
        surface.structureMode === 'singleSystem' &&
        (requestedObjectRoles.includes('Structure') || requestedObjectRoles.includes('Interpretation'))

    if (surface.featureState !== 'ready' && protectsSingleSystemAggregate) {
        throw new UpdateFailure(409, {
            error: 'Interpretation Network runtime metadata is incomplete for single-structure mode',
            code: 'INTERPRETATION_NETWORK_MISSING_METADATA'
        })
    }
    if (surface.featureState === 'ready' && !protectsSingleSystemAggregate) {
        return
    }
    if (surface.featureState !== 'ready' || surface.structureMode !== 'singleSystem') {
        return
    }

    throw new UpdateFailure(409, {
        error: 'Structure aggregates are managed by Interpretation Network single-structure mode',
        code: 'INTERPRETATION_NETWORK_GENERIC_CREATE_FORBIDDEN'
    })
}

export const assertInterpretationNetworkGenericCopyAllowed = async (
    manager: DbExecutor,
    ctx: Pick<RuntimeSchemaContext, 'schemaName' | 'currentWorkspaceId'>,
    applicationId: string,
    objectCollectionId: string
): Promise<void> => {
    const surface = await resolveInterpretationNetworkRuntimeSurface(manager, {
        applicationId,
        schemaName: ctx.schemaName,
        workspaceId: ctx.currentWorkspaceId
    })
    if (surface.featureState === 'ambiguous-widget') {
        throw new UpdateFailure(409, {
            error: 'Interpretation Network runtime widget context is ambiguous',
            code: 'INTERPRETATION_NETWORK_AMBIGUOUS_WIDGET_CONTEXT'
        })
    }
    if (surface.featureState !== 'ready' || !Object.values(surface.resolvedObjects).includes(objectCollectionId)) return
    throw new UpdateFailure(409, {
        error: 'Interpretation Network aggregates must be copied with dedicated commands',
        code: 'INTERPRETATION_NETWORK_GENERIC_COPY_FORBIDDEN'
    })
}

export const hasRuntimeServerOwnedInput = (
    data: Record<string, unknown>,
    attr: { column_name: string; codename: unknown; ui_config?: Record<string, unknown> | null }
): boolean => isRuntimeServerOwnedAttr(attr) && getRuntimeInputValue(data, attr.column_name, attr.codename).hasUserValue

export const rejectRuntimeServerOwnedInput = (
    res: Response,
    data: Record<string, unknown>,
    attr: { column_name: string; codename: unknown; ui_config?: Record<string, unknown> | null },
    fieldPath?: string
): boolean => {
    if (!hasRuntimeServerOwnedInput(data, attr)) return false
    res.status(400).json({ error: `Field is server-owned: ${fieldPath ?? formatRuntimeFieldLabel(attr.codename)}` })
    return true
}

export const readRuntimeCopyRelations = (config: Record<string, unknown> | null | undefined): RuntimeCopyRelationsConfig | null => {
    const runtimeCopy = isRecordValue(config?.runtimeCopy) ? config.runtimeCopy : null
    if (!runtimeCopy || !Object.prototype.hasOwnProperty.call(runtimeCopy, 'relations')) return null

    const parsed = z.array(runtimeCopyRelationSchema).max(16).safeParse(runtimeCopy.relations)
    if (!parsed.success) return { invalid: true }
    if (parsed.data.length === 0) return null

    return { relations: parsed.data, invalid: false }
}

export const readRuntimeLibraryConfig = (config: Record<string, unknown> | null | undefined): RuntimeLibraryConfig | null => {
    const parsed = runtimeLibraryConfigSchema.safeParse(config?.runtimeLibrary)
    return parsed.success ? parsed.data : null
}

export const readRuntimeRecordParentAccessConfigs = (
    config: Record<string, unknown> | null | undefined
): RuntimeRecordParentAccessConfig[] | null => {
    const raw = config?.runtimeRecordParentAccess
    if (!raw) return []
    const parsed = Array.isArray(raw)
        ? z.array(runtimeRecordParentAccessConfigSchema).max(8).safeParse(raw)
        : runtimeRecordParentAccessConfigSchema.safeParse(raw)
    if (!parsed.success) return null
    return Array.isArray(parsed.data) ? parsed.data : [parsed.data]
}

export const readRuntimeAccessEntryConfig = (config: Record<string, unknown> | null | undefined): RuntimeAccessEntryConfig | null => {
    const parsed = runtimeAccessEntryConfigSchema.safeParse(config?.runtimeAccessEntry)
    return parsed.success ? parsed.data : null
}

export const resolveRuntimeRelationBinding = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    relation: RuntimeLibraryRelation
}): Promise<RuntimeRelationBinding | null> => {
    const relatedObject = await resolveRuntimeObjectCollectionByCodename(params.manager, params.schemaIdent, params.relation.objectCodename)
    if (!relatedObject) return null

    const targetObjectAttr = findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.targetObjectFieldCodename)
    const targetRecordAttr = findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.targetRecordFieldCodename)
    const actorAttr = params.relation.actorFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.actorFieldCodename)
        : undefined
    const timestampAttr = params.relation.timestampFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.timestampFieldCodename)
        : undefined
    const principalTypeAttr = params.relation.principalTypeFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.principalTypeFieldCodename)
        : undefined
    const principalIdAttr = params.relation.principalIdFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.principalIdFieldCodename)
        : undefined
    const accessLevelAttr = params.relation.accessLevelFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.accessLevelFieldCodename)
        : undefined

    const requiredAttrs = [targetObjectAttr, targetRecordAttr]
    if (requiredAttrs.some((attr) => !attr || !IDENTIFIER_REGEX.test(attr.column_name))) {
        return null
    }
    if (actorAttr && !IDENTIFIER_REGEX.test(actorAttr.column_name)) return null
    if (timestampAttr && !IDENTIFIER_REGEX.test(timestampAttr.column_name)) return null
    if (principalTypeAttr && !IDENTIFIER_REGEX.test(principalTypeAttr.column_name)) return null
    if (principalIdAttr && !IDENTIFIER_REGEX.test(principalIdAttr.column_name)) return null
    if (accessLevelAttr && !IDENTIFIER_REGEX.test(accessLevelAttr.column_name)) return null
    const lifecycleContract = resolveApplicationLifecycleContractFromConfig(relatedObject.config)

    return {
        tableIdent: `${params.schemaIdent}.${quoteIdentifier(relatedObject.tableName)}`,
        activeCondition: buildRuntimeActiveRowCondition(lifecycleContract, relatedObject.config, 'rel', params.currentWorkspaceId),
        targetObjectColumnName: targetObjectAttr!.column_name,
        targetRecordColumnName: targetRecordAttr!.column_name,
        ...(actorAttr ? { actorColumnName: actorAttr.column_name } : {}),
        ...(timestampAttr ? { timestampColumnName: timestampAttr.column_name } : {}),
        ...(principalTypeAttr ? { principalTypeColumnName: principalTypeAttr.column_name } : {}),
        ...(principalIdAttr ? { principalIdColumnName: principalIdAttr.column_name } : {}),
        ...(accessLevelAttr ? { accessLevelColumnName: accessLevelAttr.column_name } : {}),
        allowedPrincipalTypes: params.relation.allowedPrincipalTypes ?? ['workspaceMember', 'user'],
        isSoftDelete: isSoftDeleteLifecycle(lifecycleContract),
        lifecycleContract,
        config: relatedObject.config
    }
}

export const buildRuntimeRelationExistsClause = (params: {
    binding: RuntimeRelationBinding
    currentObjectCodename: string
    currentUserId: string
    outerRowIdSql: string
    values: unknown[]
    kind: 'recent' | 'starred' | 'shared'
    minimumAccessLevel?: 'read' | 'edit'
}) => {
    params.values.push(params.currentObjectCodename)
    const objectPlaceholder = `$${params.values.length}`
    params.values.push(params.currentUserId)
    const userPlaceholder = `$${params.values.length}`

    const relationPredicates = [
        `rel.${quoteIdentifier(params.binding.targetObjectColumnName)}::text = ${objectPlaceholder}::text`,
        `rel.${quoteIdentifier(params.binding.targetRecordColumnName)}::text = ${params.outerRowIdSql}::text`,
        params.binding.activeCondition
    ]

    if (params.kind === 'shared') {
        if (!params.binding.principalTypeColumnName || !params.binding.principalIdColumnName) {
            return null
        }
        params.values.push(params.binding.allowedPrincipalTypes)
        const principalTypesPlaceholder = `$${params.values.length}`
        relationPredicates.push(
            `rel.${quoteIdentifier(params.binding.principalTypeColumnName)} = ANY(${principalTypesPlaceholder}::text[])`
        )
        relationPredicates.push(`rel.${quoteIdentifier(params.binding.principalIdColumnName)}::text = ${userPlaceholder}::text`)
        if (params.minimumAccessLevel === 'edit') {
            if (!params.binding.accessLevelColumnName) return null
            relationPredicates.push(`LOWER(rel.${quoteIdentifier(params.binding.accessLevelColumnName)}::text) = 'canedit'`)
        }
    } else {
        if (!params.binding.actorColumnName) {
            return null
        }
        relationPredicates.push(`rel.${quoteIdentifier(params.binding.actorColumnName)}::text = ${userPlaceholder}::text`)
    }

    return `EXISTS (
      SELECT 1
      FROM ${params.binding.tableIdent} rel
      WHERE ${relationPredicates.join(' AND ')}
    )`
}

export const resolveRuntimeOuterRowSql = (outerRowIdSql: string): string | null => {
    const trimmed = outerRowIdSql.trim()
    return trimmed.endsWith('.id') ? trimmed.slice(0, -3) : null
}

export const buildRuntimeParentRecordAccessClauses = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    attrs: RuntimeObjectCollectionAttr[]
    config: Record<string, unknown> | null | undefined
    outerRowIdSql: string
    values: unknown[]
    minimumAccessLevel?: 'read' | 'edit'
    accessDepth: number
}): Promise<string[]> => {
    const parentAccessConfigs = readRuntimeRecordParentAccessConfigs(params.config)
    if (!parentAccessConfigs) return ['FALSE']
    if (parentAccessConfigs.length === 0) return []
    if (params.accessDepth > 4) return ['FALSE']

    const outerRowSql = resolveRuntimeOuterRowSql(params.outerRowIdSql)
    if (!outerRowSql) return ['FALSE']

    const clauses: string[] = []
    for (let index = 0; index < parentAccessConfigs.length; index++) {
        const parentAccessConfig = parentAccessConfigs[index]
        const parentFieldAttr = findRuntimeAttrByFieldKey(params.attrs, parentAccessConfig.parentFieldCodename)
        if (!parentFieldAttr || parentFieldAttr.data_type !== 'REF' || !IDENTIFIER_REGEX.test(parentFieldAttr.column_name)) {
            clauses.push('FALSE')
            continue
        }

        const parentObject = await resolveRuntimeObjectCollectionByCodename(
            params.manager,
            params.schemaIdent,
            parentAccessConfig.parentObjectCodename
        )
        if (!parentObject || (parentFieldAttr.target_object_id && parentFieldAttr.target_object_id !== parentObject.id)) {
            clauses.push('FALSE')
            continue
        }

        const parentAlias = `parent_access_${index}`
        const parentTableIdent = `${params.schemaIdent}.${quoteIdentifier(parentObject.tableName)}`
        const parentLifecycleContract = resolveApplicationLifecycleContractFromConfig(parentObject.config)
        const parentActiveCondition = buildRuntimeActiveRowCondition(
            parentLifecycleContract,
            parentObject.config,
            parentAlias,
            params.currentWorkspaceId
        )
        const parentAccessClause = await buildRuntimeRecordAccessClause({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            currentWorkspaceId: params.currentWorkspaceId,
            currentUserId: params.currentUserId,
            permissions: params.permissions,
            objectCodename: parentObject.codename,
            attrs: parentObject.attrs,
            config: parentObject.config,
            outerRowIdSql: `${parentAlias}.id`,
            values: params.values,
            minimumAccessLevel: params.minimumAccessLevel,
            accessDepth: params.accessDepth + 1
        })
        const parentWhereSql = [
            `${parentAlias}.id::text = ${outerRowSql}.${quoteIdentifier(parentFieldAttr.column_name)}::text`,
            parentActiveCondition,
            parentAccessClause
        ]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')

        clauses.push(`EXISTS (
      SELECT 1
      FROM ${parentTableIdent} ${parentAlias}
      WHERE ${parentWhereSql}
    )`)
    }

    return clauses
}

export const buildRuntimeRecordAccessClause = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    objectCodename: string
    attrs: RuntimeObjectCollectionAttr[]
    config: Record<string, unknown> | null | undefined
    outerRowIdSql: string
    values: unknown[]
    minimumAccessLevel?: 'read' | 'edit'
    accessDepth?: number
}): Promise<string | null> => {
    const parentAccessClauses = await buildRuntimeParentRecordAccessClauses({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        attrs: params.attrs,
        config: params.config,
        outerRowIdSql: params.outerRowIdSql,
        values: params.values,
        minimumAccessLevel: params.minimumAccessLevel,
        accessDepth: params.accessDepth ?? 0
    })

    const accessConfig = readRuntimeRecordAccessConfig(params.config)
    if (!accessConfig || params.permissions.manageApplication || !params.currentUserId) {
        return parentAccessClauses.length > 0 ? parentAccessClauses.join(' AND ') : null
    }

    const ownerColumnName = resolveRuntimeRecordOwnerColumnName(params.attrs, params.config)
    const libraryConfig = readRuntimeLibraryConfig(params.config)
    const sharedRelation = libraryConfig?.[accessConfig.sharedRelationKey]
    if (!ownerColumnName || !sharedRelation) {
        return parentAccessClauses.length > 0 ? [...parentAccessClauses, 'FALSE'].join(' AND ') : 'FALSE'
    }

    const relationBinding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation: sharedRelation
    })
    if (!relationBinding) return 'FALSE'

    params.values.push(params.currentUserId)
    const ownerPlaceholder = `$${params.values.length}`
    const sharedClause = buildRuntimeRelationExistsClause({
        binding: relationBinding,
        currentObjectCodename: params.objectCodename,
        currentUserId: params.currentUserId,
        outerRowIdSql: params.outerRowIdSql,
        values: params.values,
        kind: 'shared',
        minimumAccessLevel: params.minimumAccessLevel ?? 'read'
    })
    if (!sharedClause) return `${quoteIdentifier(ownerColumnName)} = ${ownerPlaceholder}`

    const ownerOrSharedClause = `(${quoteIdentifier(ownerColumnName)} = ${ownerPlaceholder} OR ${sharedClause})`
    return parentAccessClauses.length > 0 ? [...parentAccessClauses, ownerOrSharedClause].join(' AND ') : ownerOrSharedClause
}

export const loadRuntimeRowByIdWithRecordAccess = async (params: {
    manager: DbExecutor
    schemaIdent: string
    dataTableIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    objectCodename: string
    attrs: RuntimeObjectCollectionAttr[]
    config: Record<string, unknown> | null | undefined
    rowId: string
    rowCondition: string
    minimumAccessLevel?: 'read' | 'edit'
}): Promise<Record<string, unknown> | null> => {
    const values: unknown[] = [params.rowId]
    const accessClause = await buildRuntimeRecordAccessClause({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        objectCodename: params.objectCodename,
        attrs: params.attrs,
        config: params.config,
        outerRowIdSql: `${params.dataTableIdent}.id`,
        values,
        minimumAccessLevel: params.minimumAccessLevel
    })
    const whereSql = ['id = $1', params.rowCondition, accessClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const rows = (await params.manager.query(
        `
      SELECT *
      FROM ${params.dataTableIdent}
      WHERE ${whereSql}
      LIMIT 1
    `,
        values
    )) as Array<Record<string, unknown>>

    return rows[0] ?? null
}

export const buildRuntimeLibraryViewClause = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    objectCodename: string
    config: Record<string, unknown> | null | undefined
    libraryView: 'all' | 'recent' | 'starred' | 'shared'
    outerRowIdSql: string
    values: unknown[]
}): Promise<string | null> => {
    if (params.libraryView === 'all') return null
    if (!params.currentUserId) return 'FALSE'

    const libraryConfig = readRuntimeLibraryConfig(params.config)
    const relation = libraryConfig?.[params.libraryView]
    if (!relation) return 'FALSE'

    const binding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation
    })
    if (!binding) return 'FALSE'

    return buildRuntimeRelationExistsClause({
        binding,
        currentObjectCodename: params.objectCodename,
        currentUserId: params.currentUserId,
        outerRowIdSql: params.outerRowIdSql,
        values: params.values,
        kind: params.libraryView
    })
}

export const validateRuntimeAccessEntryMembership = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    objectConfig: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): Promise<string | null> => {
    const accessConfig = readRuntimeAccessEntryConfig(params.objectConfig)
    if (!accessConfig) return null
    if (!params.currentWorkspaceId) {
        return 'Access entries require an active workspace'
    }

    const principalTypeAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.principalTypeFieldCodename)
    const principalIdAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.principalIdFieldCodename)
    const principalType = readRuntimeAttrStringValue(params.row, principalTypeAttr)
    const principalId = readRuntimeAttrStringValue(params.row, principalIdAttr)
    if (!principalType || !principalId) {
        return 'Access entry principal fields are required'
    }
    if (!accessConfig.supportedPrincipalTypes.includes(principalType as 'workspaceMember' | 'user')) {
        return 'Unsupported access entry principal type'
    }
    if (!UUID_REGEX.test(principalId)) {
        return 'Access entry principal must be a UUID'
    }

    const membershipRows = (await params.manager.query(
        `
      SELECT 1
      FROM ${params.schemaIdent}._app_workspace_user_roles
      WHERE workspace_id = $1
        AND user_id = $2
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [params.currentWorkspaceId, principalId]
    )) as Array<{ '?column?'?: number }>

    if (membershipRows.length === 0) return 'Access entry principal is not a member of the current workspace'

    if (accessConfig.accessLevelFieldCodename) {
        const accessLevelAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.accessLevelFieldCodename)
        const accessLevel = readRuntimeAttrStringValue(params.row, accessLevelAttr)
        if (accessLevel && !normalizeRuntimeAccessLevel(accessLevel)) {
            return 'Access entry access level is not supported'
        }
    }

    if (!accessConfig.targetObjectFieldCodename || !accessConfig.targetRecordFieldCodename) {
        return null
    }

    const targetObjectAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.targetObjectFieldCodename)
    const targetRecordAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.targetRecordFieldCodename)
    const targetObjectCodename = readRuntimeAttrStringValue(params.row, targetObjectAttr)
    const targetRecordId = readRuntimeAttrStringValue(params.row, targetRecordAttr)
    if (!targetObjectCodename || !targetRecordId) {
        return 'Access entry target fields are required'
    }
    if (!UUID_REGEX.test(targetRecordId)) {
        return 'Access entry target record must be a UUID'
    }

    const targetObject = await resolveRuntimeObjectCollectionByCodename(params.manager, params.schemaIdent, targetObjectCodename)
    if (!targetObject) {
        return 'Access entry target object was not found'
    }

    const targetTableIdent = `${params.schemaIdent}.${quoteIdentifier(targetObject.tableName)}`
    const targetLifecycleContract = resolveApplicationLifecycleContractFromConfig(targetObject.config)
    const targetActiveCondition = buildRuntimeActiveRowCondition(
        targetLifecycleContract,
        targetObject.config,
        undefined,
        params.currentWorkspaceId
    )
    const targetValues: unknown[] = [targetRecordId]
    const targetAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        objectCodename: targetObject.codename,
        attrs: targetObject.attrs,
        config: targetObject.config,
        outerRowIdSql: `${targetTableIdent}.id`,
        values: targetValues,
        minimumAccessLevel: 'edit'
    })
    const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const targetRows = (await params.manager.query(
        `
      SELECT id
      FROM ${targetTableIdent}
      WHERE ${targetWhereSql}
      LIMIT 1
    `,
        targetValues
    )) as Array<{ id: string }>

    return targetRows[0]?.id ? null : 'Access entry target row is not editable by the current user'
}

export const validateRuntimeSharedRelationPrincipal = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaIdent: string
    currentWorkspaceId: string | null
    binding: RuntimeRelationBinding
    principalType: 'workspaceMember' | 'user'
    principalId: string
    explicitPrincipal: boolean
}): Promise<string | null> => {
    if (!params.binding.allowedPrincipalTypes.includes(params.principalType)) {
        return 'Unsupported runtime shared principal type'
    }

    if (!params.explicitPrincipal) return null

    if (params.principalType === 'user') {
        const membershipRows = (await params.manager.query(
            `
      SELECT 1
      FROM applications.rel_application_users
      WHERE application_id = $1
        AND user_id = $2
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
            [params.applicationId, params.principalId]
        )) as Array<{ '?column?'?: number }>

        return membershipRows.length > 0 ? null : 'Runtime shared principal is not a member of the application'
    }

    if (!params.currentWorkspaceId) {
        return 'Runtime shared workspace member requires an active workspace'
    }

    const membershipRows = (await params.manager.query(
        `
      SELECT 1
      FROM ${params.schemaIdent}._app_workspace_user_roles
      WHERE workspace_id = $1
        AND user_id = $2
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [params.currentWorkspaceId, params.principalId]
    )) as Array<{ '?column?'?: number }>

    return membershipRows.length > 0 ? null : 'Runtime shared principal is not a member of the current workspace'
}
