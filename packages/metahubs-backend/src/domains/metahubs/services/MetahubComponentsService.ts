import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import {
    ComponentDefinitionDataType,
    TABLE_CHILD_DATA_TYPES,
    SHARED_ENTITY_KIND_TO_POOL_KIND,
    type ComponentSystemMetadata,
    type ObjectSystemFieldKey,
    type ObjectSystemFieldState,
    type ObjectSystemFieldsSnapshot,
    type PlatformSystemComponentsPolicy,
    type VersionedLocalizedContent,
    type SharedBehavior
} from '@universo/types'
import {
    deriveApplicationLifecycleContract,
    generateUuidV7,
    getObjectSystemComponentSeedRecords,
    getObjectSystemComponent,
    getReservedObjectSystemFieldCodenames,
    OptimisticLockError,
    validateObjectSystemFieldToggleSet
} from '@universo/utils'
import { buildCodenameAttempt, CODENAME_RETRY_MAX_ATTEMPTS } from '../../shared/codenameStyleHelper'
import {
    getPlatformSystemComponentMutationBlockReason,
    readPlatformSystemComponentsPolicy,
    resolveObjectSystemComponentSeedPlan
} from '../../shared/platformSystemComponentsPolicy'
import { codenamePrimaryTextSql, ensureCodenameValue, getCodenameText } from '../../shared/codename'
import { MetahubDomainError, MetahubNotFoundError, MetahubValidationError, MetahubConflictError } from '../../shared/domainErrors'
import { buildMergedSharedEntityList, planMergedSharedEntityOrder, type SharedEntityListItem } from '../../shared/mergedSharedEntityList'
import { SharedEntityOverridesService } from '../../shared/services/SharedEntityOverridesService'
import { SharedContainerService } from '../../shared/services/SharedContainerService'
import { mhbSoftDelete } from '../../../persistence/metahubsQueryHelpers'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
type ComponentScope = 'business' | 'system' | 'all'
const RESERVED_OBJECT_SYSTEM_CODENAMES = new Set(getReservedObjectSystemFieldCodenames())

const normalizeCompatibleTargetKinds = (targetKinds: string | readonly string[]): string[] => {
    const rawKinds = Array.isArray(targetKinds) ? targetKinds : [targetKinds]
    const normalized = Array.from(new Set(rawKinds.map((kind) => kind.trim()).filter((kind) => kind.length > 0)))

    if (normalized.length === 0) {
        throw new MetahubValidationError('Target object kinds are required for blocker lookup')
    }

    return normalized
}

type MetahubComponentRecord = {
    id: string
    objectCollectionId: string
    codename: string
    dataType: ComponentDefinitionDataType
    isRequired: boolean
    isDisplayComponent: boolean
    targetEntityId: string | null
    targetEntityKind: string | null
    targetConstantId: string | null
    parentComponentId: string | null
    sortOrder: number
    name: VersionedLocalizedContent<string> | undefined
    description: VersionedLocalizedContent<string> | undefined
    validationRules: Record<string, unknown> | undefined
    uiConfig: Record<string, unknown> | undefined
    system: ComponentSystemMetadata
    version: number
    createdAt: unknown
    updatedAt: unknown
}

type ComponentMutationInput = Record<string, unknown> & {
    objectCollectionId?: string
    codename?: unknown
    dataType?: ComponentDefinitionDataType
    isRequired?: boolean
    isDisplayComponent?: boolean
    targetEntityId?: string | null
    targetEntityKind?: string | null
    targetConstantId?: string | null
    parentComponentId?: string | null
    sortOrder?: number
    name?: unknown
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    system?: Partial<ComponentSystemMetadata>
    createdBy?: string | null
    updatedBy?: string | null
    expectedVersion?: number
    isEnabled?: boolean
    platformSystemComponentsPolicy?: PlatformSystemComponentsPolicy
}

type ComponentCreateInput = ComponentMutationInput & {
    objectCollectionId: string
    codename: unknown
    dataType: ComponentDefinitionDataType
}

type ReferenceBlockerRow = {
    component_id: string
    component_codename: string
    component_presentation: unknown
    source_object_id: string
    source_object_codename: string
    source_object_presentation: unknown
    usage_count?: string
}

const readPresentationName = (value: unknown): unknown =>
    value && typeof value === 'object' ? (value as { name?: unknown }).name ?? null : null

/**
 * Service to manage design-time components stored in isolated schemas (_mhb_components).
 */
export class MetahubComponentsService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

    private async listRootRowsByObjectId(
        schemaName: string,
        objectId: string,
        scope: ComponentScope,
        db: SqlQueryable
    ): Promise<Record<string, unknown>[]> {
        const qt = qSchemaTable(schemaName, '_mhb_components')
        return queryMany<Record<string, unknown>>(
            db,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND parent_component_id IS NULL AND ${this.getScopeCondition(scope)} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )
    }

    private getScopeCondition(scope: ComponentScope = 'business'): string {
        if (scope === 'system') return 'is_system = true'
        if (scope === 'all') return 'TRUE'
        return 'COALESCE(is_system, false) = false'
    }

    private getSystemMetadata(row: Record<string, unknown>): ComponentSystemMetadata {
        const systemKey =
            typeof row.system_key === 'string' && getObjectSystemComponent(row.system_key as ObjectSystemFieldKey)
                ? (row.system_key as ObjectSystemFieldKey)
                : null

        return {
            isSystem: row.is_system === true,
            systemKey,
            isManaged: row.is_system_managed !== false,
            isEnabled: row.is_system_enabled !== false
        }
    }

    private assertSystemMutationAllowed(
        component: ReturnType<MetahubComponentsService['mapRowToComponent']> | null,
        data: Record<string, unknown>
    ): void {
        if (!component?.system?.isSystem) return

        const allowedKeys = new Set(['isEnabled', 'updatedBy', 'expectedVersion'])
        const forbiddenKeys = Object.keys(data).filter((key) => data[key] !== undefined && !allowedKeys.has(key))

        if (forbiddenKeys.length > 0) {
            throw new MetahubDomainError({
                message: `System component mutation is restricted: ${forbiddenKeys.join(', ')}`,
                statusCode: 409,
                code: 'SYSTEM_COMPONENT_PROTECTED'
            })
        }
    }

    private assertReservedBusinessCodenameAllowed(
        codename: unknown,
        currentComponent: ReturnType<MetahubComponentsService['mapRowToComponent']> | null = null
    ): void {
        if (typeof codename !== 'string' || codename.length === 0) return
        if (currentComponent?.system?.isSystem) return
        if (currentComponent?.codename === codename) return
        if (RESERVED_OBJECT_SYSTEM_CODENAMES.has(codename)) {
            throw new MetahubDomainError({
                message: `Codename ${codename} is reserved for managed system components`,
                statusCode: 409,
                code: 'SYSTEM_COMPONENT_PROTECTED'
            })
        }
    }

    private getMaxChildComponentsLimit(validationRules: unknown): number | null {
        if (!validationRules || typeof validationRules !== 'object') {
            return null
        }
        const raw = (validationRules as Record<string, unknown>).maxChildComponents
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
            return null
        }
        return raw
    }

    private createTableChildLimitError(maxChildComponents: number): MetahubDomainError {
        return new MetahubDomainError({
            message: `Maximum ${maxChildComponents} child components per TABLE`,
            statusCode: 409,
            code: 'TABLE_CHILD_LIMIT_REACHED',
            details: { maxChildComponents }
        })
    }

    private createTableComponentLimitError(maxTableComponents: number): MetahubDomainError {
        return new MetahubDomainError({
            message: `Maximum ${maxTableComponents} TABLE components per object`,
            statusCode: 409,
            code: 'TABLE_COMPONENT_LIMIT_REACHED',
            details: { maxTableComponents }
        })
    }

    private createTableDisplayComponentForbiddenError(): MetahubDomainError {
        return new MetahubDomainError({
            message: 'TABLE components cannot be set as display component',
            statusCode: 400,
            code: 'TABLE_DISPLAY_COMPONENT_FORBIDDEN'
        })
    }

    private async generateUniqueTableComponentId(schemaName: string, objectCollectionId: string, db?: SqlQueryable): Promise<string> {
        const runner = db ?? this.exec
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const existingTableAttrs = await queryMany<{ id: string }>(
            runner,
            `SELECT id FROM ${qt} WHERE object_id = $1 AND data_type = $2 AND parent_component_id IS NULL`,
            [objectCollectionId, ComponentDefinitionDataType.TABLE]
        )

        const usedPrefixes = new Set(existingTableAttrs.map((row) => row.id.replace(/-/g, '').substring(0, 12)))

        for (let attempt = 0; attempt < 64; attempt++) {
            const candidate = generateUuidV7()
            const prefix = candidate.replace(/-/g, '').substring(0, 12)
            if (!usedPrefixes.has(prefix)) {
                return candidate
            }
        }

        throw new MetahubDomainError({
            message: 'Failed to generate a unique TABLE component ID',
            statusCode: 500,
            code: 'VALIDATION_ERROR'
        })
    }

    /**
     * Count root-level components for a specific object (object).
     * Excludes child components of TABLE types.
     */
    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const result = await queryOne<{ count: number }>(
            this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt}
             WHERE object_id = $1 AND parent_component_id IS NULL AND ${this.getScopeCondition('business')} AND ${ACTIVE}`,
            [objectId]
        )
        return result ? result.count : 0
    }

    /**
     * Count TABLE-type components for a specific object.
     */
    async countTableComponents(metahubId: string, objectId: string, userId?: string, db?: SqlQueryable): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const result = await queryOne<{ count: number }>(
            db ?? this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt}
             WHERE object_id = $1 AND data_type = $2 AND parent_component_id IS NULL AND ${this.getScopeCondition(
                 'business'
             )} AND ${ACTIVE}`,
            [objectId, ComponentDefinitionDataType.TABLE]
        )
        return result ? result.count : 0
    }

    /**
     * Count child components of a TABLE component.
     */
    async countChildComponents(metahubId: string, parentComponentId: string, userId?: string, db?: SqlQueryable): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const result = await queryOne<{ count: number }>(
            db ?? this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt}
             WHERE parent_component_id = $1 AND ${this.getScopeCondition('business')} AND ${ACTIVE}`,
            [parentComponentId]
        )
        return result ? result.count : 0
    }

    /**
     * Count components for multiple objects (batch operation).
     */
    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const results = await queryMany<{ object_id: string; count: number }>(
            this.exec,
            `SELECT object_id, COUNT(*)::int AS count FROM ${qt}
             WHERE object_id = ANY($1::uuid[]) AND ${this.getScopeCondition('business')} AND ${ACTIVE}
             GROUP BY object_id`,
            [objectIds]
        )

        const counts = new Map<string, number>()
        results.forEach((row) => {
            counts.set(row.object_id, row.count)
        })
        return counts
    }

    /**
     * Returns only root-level components (parent_component_id IS NULL).
     * Use findAllFlat() to get all components including children.
     */
    async findAll(metahubId: string, objectId: string, userId?: string, scope: ComponentScope = 'business', db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const rows = await this.listRootRowsByObjectId(schemaName, objectId, scope, db ?? this.exec)

        return rows.map((row) => this.mapRowToComponent(row))
    }

    async findAllMerged(metahubId: string, objectId: string, userId?: string, scope: ComponentScope = 'business', db?: SqlQueryable) {
        if (scope !== 'business') {
            return this.findAll(metahubId, objectId, userId, scope, db)
        }

        return this.findAllBusinessMerged(metahubId, objectId, userId, db)
    }

    private async findAllBusinessMerged(
        metahubId: string,
        objectId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<SharedEntityListItem<MetahubComponentRecord>[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const run = async (runner: SqlQueryable) => {
            await this._ensureSequentialSortOrder(metahubId, objectId, runner, userId, null)

            const sharedContainerService = new SharedContainerService(this.exec, this.schemaService)
            const sharedObjectCollectionId = await sharedContainerService.findContainerObjectId(
                metahubId,
                SHARED_ENTITY_KIND_TO_POOL_KIND.component,
                userId,
                runner
            )
            const sharedOverridesService = new SharedEntityOverridesService(this.exec, this.schemaService)
            const overrides = await sharedOverridesService.findByTargetObject(metahubId, 'component', objectId, userId, runner)

            const localItems = (await this.listRootRowsByObjectId(schemaName, objectId, 'business', runner)).map((row) =>
                this.mapRowToComponent(row)
            )
            const sharedItems = sharedObjectCollectionId
                ? (await this.listRootRowsByObjectId(schemaName, sharedObjectCollectionId, 'business', runner)).map((row) =>
                      this.mapRowToComponent(row)
                  )
                : []

            return buildMergedSharedEntityList({
                localItems,
                sharedItems,
                overrides,
                getId: (item) => item.id,
                getSortOrder: (item) => item.sortOrder,
                getSharedBehavior: (item) =>
                    ((item.uiConfig as Record<string, unknown> | undefined)?.sharedBehavior as SharedBehavior | undefined) ?? undefined,
                includeInactive: true
            })
        }

        if (db) {
            return run(db)
        }

        return this.exec.transaction((tx: SqlQueryable) => run(tx))
    }

    /**
     * Returns ALL components (root + child) for snapshot/sync purposes.
     */
    async findAllFlat(metahubId: string, objectId: string, userId?: string, scope: ComponentScope = 'business') {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${this.getScopeCondition(scope)} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )

        return rows.map((row) => this.mapRowToComponent(row))
    }

    /**
     * Returns ALL components (root + child) while preserving localized codename payloads.
     * Use this only for snapshot-oriented export flows that must keep raw codename objects.
     */
    async findAllFlatForSnapshot(metahubId: string, objectId: string, userId?: string, scope: ComponentScope = 'business') {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${this.getScopeCondition(scope)} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )

        return rows.map((row) => this.mapRowToSnapshotComponent(row))
    }

    /**
     * Returns child components of a TABLE component.
     */
    async findChildComponents(metahubId: string, parentComponentId: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const rows = await queryMany<Record<string, unknown>>(
            db ?? this.exec,
            `SELECT * FROM ${qt}
             WHERE parent_component_id = $1 AND ${this.getScopeCondition('business')} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [parentComponentId]
        )

        return rows.map(this.mapRowToComponent)
    }

    /**
     * Returns child components for multiple TABLE parents in a single query.
     * Grouped by parent component ID for efficient batch lookup.
     */
    async findChildComponentsByParentIds(metahubId: string, parentComponentIds: string[], userId?: string) {
        const result = new Map<string, ReturnType<typeof this.mapRowToComponent>[]>()
        for (const parentId of parentComponentIds) {
            result.set(parentId, [])
        }
        if (parentComponentIds.length === 0) return result

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE parent_component_id = ANY($1::uuid[]) AND ${this.getScopeCondition('business')} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [parentComponentIds]
        )

        for (const row of rows) {
            const cmp = this.mapRowToComponent(row)
            const parentId = cmp.parentComponentId
            if (parentId && result.has(parentId)) {
                result.get(parentId)!.push(cmp)
            }
        }
        return result
    }

    async getAllComponents(metahubId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const rows = await queryMany<Record<string, unknown>>(
            this.exec,
            `SELECT * FROM ${qt} WHERE ${this.getScopeCondition('all')} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`
        )

        return rows.map((row) => this.mapRowToComponent(row))
    }

    async findById(metahubId: string, id: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const row = await queryOne<Record<string, unknown>>(db ?? this.exec, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [
            id
        ])

        return row ? this.mapRowToComponent(row) : null
    }

    async findByCodename(
        metahubId: string,
        objectId: string,
        codename: string,
        parentComponentId?: string | null,
        userId?: string,
        db?: SqlQueryable,
        options?: { ignoreParentScope?: boolean }
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const conditions = [`object_id = $1`, `${codenamePrimaryTextSql('codename')} = $2`, ACTIVE]
        const params: unknown[] = [objectId, codename]
        let idx = 3

        if (!options?.ignoreParentScope) {
            if (parentComponentId) {
                conditions.push(`parent_component_id = $${idx}`)
                params.push(parentComponentId)
                idx++
            } else {
                conditions.push(`parent_component_id IS NULL`)
            }
        }

        const row = await queryOne<Record<string, unknown>>(
            db ?? this.exec,
            `SELECT * FROM ${qt} WHERE ${conditions.join(' AND ')} LIMIT 1`,
            params
        )

        return row ? this.mapRowToComponent(row) : null
    }

    async listObjectSystemComponents(metahubId: string, objectId: string, userId?: string, db?: SqlQueryable) {
        return this.findAll(metahubId, objectId, userId, 'system', db)
    }

    async getObjectSystemFieldsSnapshot(
        metahubId: string,
        objectId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<ObjectSystemFieldsSnapshot> {
        const components = await this.listObjectSystemComponents(metahubId, objectId, userId, db)
        const states: ObjectSystemFieldState[] = components
            .filter((component) => component.system?.isSystem && component.system.systemKey)
            .map((component) => ({
                key: component.system!.systemKey!,
                enabled: component.system!.isEnabled
            }))
        const normalized = validateObjectSystemFieldToggleSet(states).normalized
        return {
            fields: normalized,
            lifecycleContract: deriveApplicationLifecycleContract(normalized)
        }
    }

    private resolveObjectSystemToggleState(
        currentStates: ObjectSystemFieldState[],
        targetKey: ObjectSystemFieldKey,
        enabled: boolean
    ): ObjectSystemFieldState[] {
        const nextStates = new Map<ObjectSystemFieldKey, boolean>(currentStates.map((state) => [state.key, state.enabled]))
        const visited = new Set<string>()

        const applyState = (key: ObjectSystemFieldKey, nextEnabled: boolean, origin: 'requested' | 'dependency') => {
            const visitKey = `${origin}:${key}:${nextEnabled ? '1' : '0'}`
            if (visited.has(visitKey)) {
                return
            }
            visited.add(visitKey)

            const definition = getObjectSystemComponent(key)
            if (!definition) {
                throw new MetahubValidationError(`System component ${key} is not registered`)
            }
            if (!nextEnabled && !definition.canDisable && origin === 'requested') {
                throw new MetahubDomainError({
                    message: `System component ${key} cannot be disabled`,
                    statusCode: 409,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })
            }

            nextStates.set(key, nextEnabled)

            if (nextEnabled) {
                for (const requiredKey of definition.requires ?? []) {
                    applyState(requiredKey, true, 'dependency')
                }
                return
            }

            for (const dependent of getObjectSystemComponentSeedRecords()) {
                if (dependent.key === key) {
                    continue
                }
                const dependentDefinition = getObjectSystemComponent(dependent.key)
                if (dependentDefinition?.requires?.includes(key) && nextStates.get(dependentDefinition.key) === true) {
                    applyState(dependentDefinition.key, false, 'dependency')
                }
            }
        }

        applyState(targetKey, enabled, 'requested')

        const validation = validateObjectSystemFieldToggleSet(
            Array.from(nextStates.entries()).map(([key, stateEnabled]) => ({ key, enabled: stateEnabled }))
        )
        if (validation.errors.length > 0) {
            throw new MetahubValidationError(validation.errors.join('; '))
        }

        return validation.normalized
    }

    async ensureObjectSystemComponents(
        metahubId: string,
        objectId: string,
        userId?: string,
        db?: SqlQueryable,
        optionsOrStates?:
            | ObjectSystemFieldState[]
            | {
                  states?: ObjectSystemFieldState[]
                  policy?: import('@universo/types').PlatformSystemComponentsPolicy
              }
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const runner = db ?? this.exec
        const now = new Date()
        const states = Array.isArray(optionsOrStates) ? optionsOrStates : optionsOrStates?.states
        const policy = Array.isArray(optionsOrStates) ? undefined : optionsOrStates?.policy
        const existingRows = await queryMany<Record<string, unknown>>(
            runner,
            `SELECT * FROM ${qt} WHERE object_id = $1 AND is_system = true AND ${ACTIVE}`,
            [objectId]
        )
        const existingByKey = new Map<string, Record<string, unknown>>()
        for (const row of existingRows) {
            if (typeof row.system_key === 'string') {
                existingByKey.set(row.system_key, row)
            }
        }

        const seedPlan = resolveObjectSystemComponentSeedPlan(states, policy, existingByKey.keys())
        const forceStateKeySet = new Set(seedPlan.forceStateKeys)

        for (const seed of getObjectSystemComponentSeedRecords(seedPlan.states).filter((record) => seedPlan.allowedKeys.has(record.key))) {
            const presentation = JSON.stringify(seed.presentation)
            const existing = existingByKey.get(seed.key)

            if (existing) {
                const forceEnabledState = forceStateKeySet.has(seed.key)
                await runner.query(
                    `UPDATE ${qt}
                            SET codename = $1::jsonb,
                         data_type = $2,
                         presentation = $3::jsonb,
                         sort_order = $4,
                         is_system = $5,
                         system_key = $6,
                         is_system_managed = $7,
                         is_system_enabled = ${forceEnabledState ? '$8' : 'COALESCE(is_system_enabled, $8)'},
                         _upl_updated_at = $9,
                         _upl_updated_by = $10
                     WHERE id = $11`,
                    [
                        JSON.stringify(ensureCodenameValue(seed.codename)),
                        seed.dataType,
                        presentation,
                        seed.sortOrder,
                        seed.isSystem,
                        seed.key,
                        seed.isSystemManaged,
                        seed.isSystemEnabled,
                        now,
                        userId ?? null,
                        existing.id
                    ]
                )
                continue
            }

            await runner.query(
                `INSERT INTO ${qt}
                 (object_id, codename, data_type, presentation, validation_rules, ui_config, sort_order,
                  is_required, is_display_component, target_object_id, target_object_kind, target_constant_id,
                  parent_component_id, is_system, system_key, is_system_managed, is_system_enabled,
                  _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2::jsonb, $3, $4::jsonb, '{}'::jsonb, '{}'::jsonb, $5, false, false, null, null, null,
                         null, true, $6, true, $7, $8, $9, $8, $9)`,
                [
                    objectId,
                    JSON.stringify(ensureCodenameValue(seed.codename)),
                    seed.dataType,
                    presentation,
                    seed.sortOrder,
                    seed.key,
                    seed.isSystemEnabled,
                    now,
                    userId ?? null
                ]
            )
        }

        return this.listObjectSystemComponents(metahubId, objectId, userId, runner)
    }

    /**
     * Find REF components in other objects that reference the target object.
     * Used to block object deletion when cross-object dependencies exist.
     */
    async findObjectReferenceBlockers(metahubId: string, targetObjectCollectionId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const componentTable = qSchemaTable(schemaName, '_mhb_components')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await queryMany<ReferenceBlockerRow>(
            this.exec,
            `SELECT
                cmp.id AS component_id,
                cmp.codename AS component_codename,
                cmp.presentation AS component_presentation,
                cmp.object_id AS source_object_id,
                obj.codename AS source_object_codename,
                obj.presentation AS source_object_presentation
             FROM ${componentTable} cmp
             LEFT JOIN ${objTable} obj ON obj.id = cmp.object_id
             WHERE cmp.data_type = 'REF'
               AND cmp.target_object_id = $1
               AND cmp.object_id != $1
               AND (cmp.target_object_kind = 'object' OR cmp.target_object_kind IS NULL)
               AND cmp._upl_deleted = false AND cmp._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, cmp.sort_order ASC`,
            [targetObjectCollectionId]
        )

        return rows.map((row) => ({
            componentId: row.component_id,
            componentCodename: getCodenameText(row.component_codename),
            componentName: readPresentationName(row.component_presentation),
            sourceObjectCollectionId: row.source_object_id,
            sourceObjectCodename: getCodenameText(row.source_object_codename),
            sourceObjectName: readPresentationName(row.source_object_presentation)
        }))
    }

    /**
     * Find REF components that reference a target object by kind and id.
     * Used to block deletion of referenced objects (e.g. enumerations).
     */
    async findReferenceBlockersByTarget(
        metahubId: string,
        targetObjectId: string,
        targetObjectKinds: string | readonly string[],
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const componentTable = qSchemaTable(schemaName, '_mhb_components')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const compatibleTargetKinds = normalizeCompatibleTargetKinds(targetObjectKinds)
        const rows = await queryMany<ReferenceBlockerRow>(
            this.exec,
            `SELECT
                cmp.id AS component_id,
                cmp.codename AS component_codename,
                cmp.presentation AS component_presentation,
                cmp.object_id AS source_object_id,
                obj.codename AS source_object_codename,
                obj.presentation AS source_object_presentation
             FROM ${componentTable} cmp
             LEFT JOIN ${objTable} obj ON obj.id = cmp.object_id
             WHERE cmp.data_type = 'REF'
               AND cmp.target_object_id = $1
                             AND cmp.target_object_kind = ANY($2::text[])
               AND cmp._upl_deleted = false AND cmp._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, cmp.sort_order ASC`,
            [targetObjectId, compatibleTargetKinds]
        )

        return rows.map((row) => ({
            componentId: row.component_id,
            componentCodename: getCodenameText(row.component_codename),
            componentName: readPresentationName(row.component_presentation),
            sourceObjectCollectionId: row.source_object_id,
            sourceObjectCodename: getCodenameText(row.source_object_codename),
            sourceObjectName: readPresentationName(row.source_object_presentation)
        }))
    }

    /**
     * Find REF components that use a specific enumeration value as default in ui_config.
     * Used to block deletion of enumeration values that are still configured as defaults.
     */
    async findDefaultEnumValueBlockers(metahubId: string, enumValueId: string, userId?: string, targetObjectKinds?: readonly string[]) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const componentTable = qSchemaTable(schemaName, '_mhb_components')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const compatibleTargetKinds = normalizeCompatibleTargetKinds(targetObjectKinds ?? ['enumeration'])
        const rows = await queryMany<ReferenceBlockerRow>(
            this.exec,
            `SELECT
                cmp.id AS component_id,
                cmp.codename AS component_codename,
                cmp.presentation AS component_presentation,
                cmp.object_id AS source_object_id,
                obj.codename AS source_object_codename,
                obj.presentation AS source_object_presentation
             FROM ${componentTable} cmp
             LEFT JOIN ${objTable} obj ON obj.id = cmp.object_id
             WHERE cmp.data_type = 'REF'
                             AND cmp.target_object_kind = ANY($2::text[])
               AND cmp.ui_config ->> 'defaultEnumValueId' = $1
               AND cmp._upl_deleted = false AND cmp._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, cmp.sort_order ASC`,
            [enumValueId, compatibleTargetKinds]
        )

        return rows.map((row) => ({
            componentId: row.component_id,
            componentCodename: getCodenameText(row.component_codename),
            componentName: readPresentationName(row.component_presentation),
            sourceObjectCollectionId: row.source_object_id,
            sourceObjectCodename: getCodenameText(row.source_object_codename),
            sourceObjectName: readPresentationName(row.source_object_presentation)
        }))
    }

    /**
     * Find predefined elements that reference a specific enumeration value.
     * Used to prevent deleting values that are still used in object predefined data.
     */
    async findElementEnumValueBlockers(
        metahubId: string,
        optionListId: string,
        enumValueId: string,
        userId?: string,
        targetObjectKinds?: readonly string[]
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const componentTable = qSchemaTable(schemaName, '_mhb_components')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const elTable = qSchemaTable(schemaName, '_mhb_elements')
        const compatibleTargetKinds = normalizeCompatibleTargetKinds(targetObjectKinds ?? ['enumeration'])
        const rows = await queryMany<ReferenceBlockerRow>(
            this.exec,
            `SELECT
                cmp.id AS component_id,
                cmp.codename AS component_codename,
                cmp.presentation AS component_presentation,
                cmp.object_id AS source_object_id,
                obj.codename AS source_object_codename,
                obj.presentation AS source_object_presentation,
                COUNT(el.id) AS usage_count
             FROM ${componentTable} cmp
             LEFT JOIN ${objTable} obj ON obj.id = cmp.object_id
             LEFT JOIN ${elTable} el ON el.object_id = cmp.object_id
             WHERE cmp.data_type = 'REF'
                             AND cmp.target_object_kind = ANY($3::text[])
               AND cmp.target_object_id = $1
               AND el.data ->> (${codenamePrimaryTextSql('cmp.codename')}) = $2
               AND cmp._upl_deleted = false AND cmp._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
               AND el._upl_deleted = false AND el._mhb_deleted = false
             GROUP BY cmp.id, cmp.codename, cmp.presentation, cmp.object_id, obj.codename, obj.presentation
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, cmp.sort_order ASC`,
            [optionListId, enumValueId, compatibleTargetKinds]
        )

        return rows.map((row) => ({
            componentId: row.component_id,
            componentCodename: getCodenameText(row.component_codename),
            componentName: readPresentationName(row.component_presentation),
            sourceObjectCollectionId: row.source_object_id,
            sourceObjectCodename: getCodenameText(row.source_object_codename),
            sourceObjectName: readPresentationName(row.source_object_presentation),
            usageCount: parseInt(row.usage_count ?? '0', 10)
        }))
    }

    async create(metahubId: string, data: ComponentCreateInput, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        let explicitComponentId: string | undefined

        this.assertReservedBusinessCodenameAllowed(data.codename)

        // TABLE component limits validation
        if (data.parentComponentId) {
            const parent = await this.findById(metahubId, data.parentComponentId, userId, db)
            if (!parent) {
                throw new MetahubNotFoundError('Parent component', data.parentComponentId)
            }
            if (parent.dataType !== ComponentDefinitionDataType.TABLE) {
                throw new MetahubValidationError(`Parent component must be TABLE type, got ${parent.dataType}`)
            }
            if (data.dataType === ComponentDefinitionDataType.TABLE) {
                throw new MetahubValidationError('Nested TABLE components are not allowed')
            }
            const maxChildComponents = this.getMaxChildComponentsLimit(parent.validationRules)
            if (typeof maxChildComponents === 'number') {
                const childCount = await this.countChildComponents(metahubId, data.parentComponentId, userId, db)
                if (childCount >= maxChildComponents) {
                    throw this.createTableChildLimitError(maxChildComponents)
                }
            }
        }

        if (data.dataType === ComponentDefinitionDataType.TABLE) {
            const tableCount = await this.countTableComponents(metahubId, data.objectCollectionId, userId, db)
            if (tableCount >= 10) {
                throw this.createTableComponentLimitError(10)
            }

            explicitComponentId = await this.generateUniqueTableComponentId(schemaName, data.objectCollectionId, db)
        }

        const sortOrder = data.sortOrder ?? (await this.getNextSortOrder(schemaName, data.objectCollectionId, data.parentComponentId, db))
        const now = new Date()
        const presentation = JSON.stringify({ name: data.name })
        const validationRules = JSON.stringify(data.validationRules || {})
        const uiConfig = JSON.stringify(data.uiConfig || {})
        const codename = ensureCodenameValue(data.codename)

        const columns = [
            ...(explicitComponentId ? ['id'] : []),
            'object_id',
            'codename',
            'data_type',
            'is_system',
            'system_key',
            'is_system_managed',
            'is_system_enabled',
            'is_required',
            'is_display_component',
            'target_object_id',
            'target_object_kind',
            'target_constant_id',
            'parent_component_id',
            'sort_order',
            'presentation',
            'validation_rules',
            'ui_config',
            '_upl_created_at',
            '_upl_created_by',
            '_upl_updated_at',
            '_upl_updated_by'
        ]
        const values: unknown[] = [
            ...(explicitComponentId ? [explicitComponentId] : []),
            data.objectCollectionId,
            JSON.stringify(codename),
            data.dataType,
            data.system?.isSystem === true,
            data.system?.systemKey ?? null,
            data.system?.isManaged !== false,
            data.system?.isEnabled !== false,
            data.isDisplayComponent ? true : data.isRequired ?? false,
            data.isDisplayComponent ?? false,
            data.targetEntityId ?? null,
            data.targetEntityKind ?? null,
            data.targetConstantId ?? null,
            data.parentComponentId ?? null,
            sortOrder,
            presentation,
            validationRules,
            uiConfig,
            now,
            data.createdBy ?? null,
            now,
            data.createdBy ?? null
        ]
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

        const runner = db ?? this.exec
        const created = await queryOneOrThrow<Record<string, unknown>>(
            runner,
            `INSERT INTO ${qt} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values
        )

        return this.mapRowToComponent(created)
    }

    async update(metahubId: string, id: string, data: ComponentMutationInput, userId?: string, db?: DbExecutor | SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const runner = db ?? this.exec
        const current = await this.findById(metahubId, id, userId, runner)
        this.assertReservedBusinessCodenameAllowed(data.codename, current)
        this.assertSystemMutationAllowed(current, data)

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: data.updatedBy ?? null
        }

        if (current?.system?.isSystem) {
            const systemKey = current.system.systemKey
            if (!systemKey && data.isEnabled !== undefined) {
                throw new MetahubDomainError({
                    message: 'System component toggle key is missing',
                    statusCode: 409,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })
            }

            const platformSystemComponentsPolicy: PlatformSystemComponentsPolicy =
                data.platformSystemComponentsPolicy ?? (await readPlatformSystemComponentsPolicy(runner))
            const policyBlockReason = getPlatformSystemComponentMutationBlockReason(systemKey ?? null, platformSystemComponentsPolicy)
            if (policyBlockReason) {
                throw new MetahubDomainError({
                    message: policyBlockReason,
                    statusCode: 403,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })
            }

            const updateSystemRows = async (tx: SqlQueryable) => {
                const lockedCurrent = await queryOneOrThrow<Record<string, unknown>>(
                    tx,
                    `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`,
                    [id],
                    undefined,
                    'component not found'
                )

                if (data.expectedVersion !== undefined) {
                    const actualVersion = Number(lockedCurrent._upl_version ?? 1)
                    if (actualVersion !== data.expectedVersion) {
                        throw new OptimisticLockError({
                            entityId: id,
                            entityType: 'component',
                            expectedVersion: data.expectedVersion,
                            actualVersion,
                            updatedAt: new Date(String(lockedCurrent._upl_updated_at ?? new Date().toISOString())),
                            updatedBy: (lockedCurrent._upl_updated_by as string | null) ?? null
                        })
                    }
                }

                const systemRows = await queryMany<Record<string, unknown>>(
                    tx,
                    `SELECT * FROM ${qt} WHERE object_id = $1 AND is_system = true AND ${ACTIVE} FOR UPDATE`,
                    [current.objectCollectionId]
                )

                const normalizedStates =
                    data.isEnabled !== undefined && systemKey
                        ? this.resolveObjectSystemToggleState(
                              systemRows
                                  .filter(
                                      (row): row is Record<string, unknown> & { system_key: ObjectSystemFieldKey } =>
                                          typeof row.system_key === 'string' &&
                                          !!getObjectSystemComponent(row.system_key as ObjectSystemFieldKey)
                                  )
                                  .map((row) => ({
                                      key: row.system_key as ObjectSystemFieldKey,
                                      enabled: row.is_system_enabled !== false
                                  })),
                              systemKey,
                              data.isEnabled
                          )
                        : null

                const nextEnabledByKey = normalizedStates
                    ? new Map<ObjectSystemFieldKey, boolean>(normalizedStates.map((state) => [state.key, state.enabled]))
                    : null

                let updatedTarget: Record<string, unknown> | null = null

                for (const row of systemRows) {
                    const rowId = String(row.id)
                    const rowUpdateData: Record<string, unknown> = {
                        _upl_updated_at: updateData._upl_updated_at,
                        _upl_updated_by: updateData._upl_updated_by
                    }

                    const rowSystemKey =
                        typeof row.system_key === 'string' && getObjectSystemComponent(row.system_key as ObjectSystemFieldKey)
                            ? (row.system_key as ObjectSystemFieldKey)
                            : null

                    if (rowSystemKey && nextEnabledByKey) {
                        const nextEnabled = nextEnabledByKey.get(rowSystemKey)
                        if (typeof nextEnabled === 'boolean' && nextEnabled !== (row.is_system_enabled !== false)) {
                            rowUpdateData.is_system_enabled = nextEnabled
                        }
                    }

                    if (rowId !== id && !Object.prototype.hasOwnProperty.call(rowUpdateData, 'is_system_enabled')) {
                        continue
                    }

                    const updatedRow = await incrementVersion(tx, schemaName, '_mhb_components', rowId, rowUpdateData)
                    if (rowId === id) {
                        updatedTarget = updatedRow
                    }
                }

                return updatedTarget
            }

            const updatedSystem = db ? await updateSystemRows(runner) : await this.exec.transaction(async (tx) => updateSystemRows(tx))

            return updatedSystem ? this.mapRowToComponent(updatedSystem) : null
        }

        if (data.codename !== undefined) {
            const currentCodename = await queryOne<Record<string, unknown>>(runner, `SELECT codename FROM ${qt} WHERE id = $1`, [id])
            updateData.codename = ensureCodenameValue(data.codename ?? currentCodename?.codename)
        }
        if (data.dataType !== undefined) updateData.data_type = data.dataType
        if (data.isRequired !== undefined) updateData.is_required = data.isRequired
        if (data.isDisplayComponent !== undefined) updateData.is_display_component = data.isDisplayComponent
        if (data.isDisplayComponent === true) updateData.is_required = true
        if (data.targetEntityId !== undefined) updateData.target_object_id = data.targetEntityId
        if (data.targetEntityKind !== undefined) updateData.target_object_kind = data.targetEntityKind
        if (data.targetConstantId !== undefined) updateData.target_constant_id = data.targetConstantId
        if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder

        if (data.name !== undefined) {
            const currentPresentation = await queryOne<Record<string, unknown>>(runner, `SELECT presentation FROM ${qt} WHERE id = $1`, [
                id
            ])
            updateData.presentation = JSON.stringify({
                ...(currentPresentation?.presentation ?? {}),
                ...(data.name !== undefined ? { name: data.name } : {})
            })
        }

        if (data.validationRules !== undefined) updateData.validation_rules = JSON.stringify(data.validationRules)
        if (data.uiConfig !== undefined) updateData.ui_config = JSON.stringify(data.uiConfig)

        // If expectedVersion is provided, use version-checked update
        if (data.expectedVersion !== undefined) {
            const updated = await updateWithVersionCheck({
                executor: runner,
                schemaName,
                tableName: '_mhb_components',
                entityId: id,
                entityType: 'component',
                expectedVersion: data.expectedVersion,
                updateData,
                wrapInTransaction: db === undefined
            })
            return this.mapRowToComponent(updated)
        }

        // Fallback: increment version without check (backwards compatibility)
        const updated = await incrementVersion(runner, schemaName, '_mhb_components', id, updateData)
        return updated ? this.mapRowToComponent(updated) : null
    }

    async delete(metahubId: string, id: string, userId?: string, db?: DbExecutor | SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const runner = db ?? this.exec
        const component = await this.findById(metahubId, id, userId, runner)

        if (component?.system?.isSystem) {
            throw new MetahubDomainError({
                message: 'System components cannot be deleted',
                statusCode: 403,
                code: 'SYSTEM_COMPONENT_PROTECTED'
            })
        }

        const runDelete = async (tx: SqlQueryable) => {
            // If TABLE type, soft-delete children before parent
            const [component] = await tx.query<Record<string, unknown>>(`SELECT data_type FROM ${qt} WHERE id = $1`, [id])
            if (component?.data_type === ComponentDefinitionDataType.TABLE) {
                const children = await tx.query<{ id: string }>(`SELECT id FROM ${qt} WHERE parent_component_id = $1 AND ${ACTIVE}`, [id])
                for (const child of children) {
                    await mhbSoftDelete(tx, schemaName, '_mhb_components', child.id, userId)
                }
            }

            const deleted = await mhbSoftDelete(tx, schemaName, '_mhb_components', id, userId)
            if (!deleted) {
                throw new MetahubNotFoundError('Component', id)
            }

            const [parentObject] = await tx.query<{ kind?: string }>(
                `SELECT kind
                 FROM ${qSchemaTable(schemaName, '_mhb_objects')}
                 WHERE id = $1
                 LIMIT 1`,
                [component?.objectId]
            )
            if (parentObject?.kind === SHARED_ENTITY_KIND_TO_POOL_KIND.component) {
                const sharedOverridesService = new SharedEntityOverridesService(this.exec, this.schemaService)
                await sharedOverridesService.cleanupForDeletedEntity(metahubId, 'component', id, userId, tx)
            }
        }

        if (db) {
            await runDelete(runner)
            return
        }

        await this.exec.transaction(async (tx) => runDelete(tx))
    }

    async moveComponent(metahubId: string, objectId: string, componentId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            // Fetch current component to know its parent scope
            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [componentId, objectId]
            )
            if (!current) throw new MetahubNotFoundError('Component', componentId)
            if (current.is_system === true)
                throw new MetahubDomainError({
                    message: 'System components cannot be reordered',
                    statusCode: 403,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })

            const parentComponentId: string | null = (current.parent_component_id as string | null) ?? null

            // Ensure sequential order only among siblings (same parent)
            await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, parentComponentId)

            // Re-fetch after reordering
            const refreshed = await queryOneOrThrow<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [componentId, objectId]
            )
            const currentOrder = refreshed.sort_order as number

            // Find neighbor among siblings only
            const parentCond = parentComponentId ? `parent_component_id = $3` : `parent_component_id IS NULL`
            const params: unknown[] = [objectId, currentOrder, ...(parentComponentId ? [parentComponentId] : [])]

            let neighborSql: string
            if (direction === 'up') {
                neighborSql = `SELECT * FROM ${qt} WHERE object_id = $1 AND ${parentCond} AND sort_order < $2 ORDER BY sort_order DESC LIMIT 1`
            } else {
                neighborSql = `SELECT * FROM ${qt} WHERE object_id = $1 AND ${parentCond} AND sort_order > $2 ORDER BY sort_order ASC LIMIT 1`
            }

            const neighbor = await queryOne<Record<string, unknown>>(tx, neighborSql, params)

            if (neighbor) {
                // Swap
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [neighbor.sort_order, componentId])
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [currentOrder, neighbor.id])
            }

            // Fetch updated
            const updated = await queryOneOrThrow<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE} LIMIT 1`,
                [componentId, objectId]
            )
            return this.mapRowToComponent(updated)
        })
    }

    /**
     * Reorder an component to a new sort_order (and optionally transfer to a different parent list).
     * @param codenameScope - 'per-level' or 'global' codename uniqueness scope
     * @param codenameStyle - 'kebab-case' or 'pascal-case' for auto-rename suffix
     * @param autoRenameCodename - if true, auto-rename codename on conflict
     */
    async reorderComponent(
        metahubId: string,
        objectId: string,
        componentId: string,
        newSortOrder: number,
        newParentComponentId: string | null | undefined,
        codenameScope: 'per-level' | 'global',
        codenameStyle: 'kebab-case' | 'pascal-case',
        allowCrossListRootChildren: boolean,
        allowCrossListBetweenChildren: boolean,
        autoRenameCodename?: boolean,
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            // 1. Fetch current component
            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [componentId, objectId]
            )
            if (!current) throw new MetahubNotFoundError('Component', componentId)
            if (current.is_system === true)
                throw new MetahubDomainError({
                    message: 'System components cannot be reordered',
                    statusCode: 403,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })

            const currentParent: string | null = (current.parent_component_id as string | null) ?? null
            const targetParent: string | null = newParentComponentId !== undefined ? newParentComponentId : currentParent
            const isCrossList = targetParent !== currentParent

            if (isCrossList) {
                // ── Cross-list transfer validation ──
                await this._validateCrossListTransfer(
                    tx,
                    schemaName,
                    objectId,
                    current,
                    currentParent,
                    targetParent,
                    allowCrossListRootChildren,
                    allowCrossListBetweenChildren,
                    codenameScope,
                    codenameStyle,
                    autoRenameCodename
                )

                // Move: update parent_component_id
                await tx.query(`UPDATE ${qt} SET parent_component_id = $1 WHERE id = $2`, [targetParent, componentId])

                // Normalize source list (close gap left by the moved component)
                await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, currentParent)

                // Auto-set display component + required when component becomes the only child in target list
                if (targetParent !== null) {
                    const [siblingCount] = await tx.query<{ count: number }>(
                        `SELECT COUNT(*)::int AS count FROM ${qt}
                         WHERE object_id = $1 AND parent_component_id = $2 AND ${ACTIVE}`,
                        [objectId, targetParent]
                    )
                    if (siblingCount && siblingCount.count === 1) {
                        await tx.query(`UPDATE ${qt} SET is_display_component = true, is_required = true WHERE id = $1`, [componentId])
                    }
                }
            }

            // 2. Ensure sequential order in target list
            await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, targetParent)

            // 3. Re-fetch to get current sort_order after normalization
            const refreshed = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [componentId, objectId]
            )
            if (!refreshed) throw new MetahubNotFoundError('Component', componentId)
            const oldOrder = refreshed.sort_order as number
            const clampedNew = Math.max(1, newSortOrder)

            if (oldOrder !== clampedNew) {
                const parentCond = targetParent ? `parent_component_id = $4` : `parent_component_id IS NULL`
                const baseParams: unknown[] = [objectId, componentId, ...(targetParent ? [targetParent] : [])]
                const sortParamOffset = baseParams.length + 1

                if (clampedNew < oldOrder) {
                    // Moving up: shift items [clampedNew, oldOrder) down by 1
                    await tx.query(
                        `UPDATE ${qt} SET sort_order = sort_order + 1
                         WHERE object_id = $1 AND ${parentCond}
                           AND sort_order >= $${sortParamOffset} AND sort_order < $${sortParamOffset + 1}
                           AND id != $2`,
                        [...baseParams, clampedNew, oldOrder]
                    )
                } else {
                    // Moving down: shift items (oldOrder, clampedNew] up by 1
                    await tx.query(
                        `UPDATE ${qt} SET sort_order = sort_order - 1
                         WHERE object_id = $1 AND ${parentCond}
                           AND sort_order > $${sortParamOffset} AND sort_order <= $${sortParamOffset + 1}
                           AND id != $2`,
                        [...baseParams, oldOrder, clampedNew]
                    )
                }

                // Set the target sort_order
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [clampedNew, componentId])
            }

            // 4. Final normalization pass
            await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, targetParent)

            // 5. Return updated component
            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [componentId, objectId]
            )
            if (!updated) throw new MetahubNotFoundError('Component', componentId)
            return this.mapRowToComponent(updated)
        })
    }

    async reorderComponentMergedOrder(
        metahubId: string,
        objectId: string,
        componentId: string,
        orderedMovableIds: string[],
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            const items = await this.findAllBusinessMerged(metahubId, objectId, userId, tx)
            const current = items.find((item) => item.id === componentId)
            if (!current) {
                throw new MetahubNotFoundError('Component', componentId)
            }

            const assignments = planMergedSharedEntityOrder(items, orderedMovableIds)
            for (const assignment of assignments.localSortOrders) {
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [assignment.sortOrder, assignment.id])
            }

            const sharedOverridesService = new SharedEntityOverridesService(this.exec, this.schemaService)
            for (const assignment of assignments.sharedSortOrders) {
                await sharedOverridesService.upsertOverride({
                    metahubId,
                    entityKind: 'component',
                    sharedEntityId: assignment.id,
                    targetObjectId: objectId,
                    sortOrder: assignment.sortOrder,
                    userId,
                    db: tx
                })
            }

            const updatedItems = await this.findAllBusinessMerged(metahubId, objectId, userId, tx)
            const updated = updatedItems.find((item) => item.id === componentId)
            if (!updated) {
                throw new MetahubNotFoundError('Component', componentId)
            }
            return updated
        })
    }

    /**
     * Validate a cross-list component transfer (change of parent_component_id).
     * Throws typed errors that the route handler maps to HTTP status codes.
     */
    private async _validateCrossListTransfer(
        db: SqlQueryable,
        schemaName: string,
        objectId: string,
        component: Record<string, unknown>,
        currentParentId: string | null,
        targetParentId: string | null,
        allowCrossListRootChildren: boolean,
        allowCrossListBetweenChildren: boolean,
        codenameScope: 'per-level' | 'global',
        codenameStyle: 'kebab-case' | 'pascal-case',
        autoRenameCodename?: boolean
    ): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const sourceIsRoot = currentParentId === null
        const targetIsRoot = targetParentId === null
        const componentId = String(component.id)
        const componentCodename = getCodenameText(component.codename)
        const componentDataType = typeof component.data_type === 'string' ? component.data_type : ''

        if ((sourceIsRoot || targetIsRoot) && !allowCrossListRootChildren) {
            throw new MetahubDomainError({
                message: 'Moving components between root and child lists is disabled by settings',
                statusCode: 403,
                code: 'TRANSFER_NOT_ALLOWED'
            })
        }

        if (!sourceIsRoot && !targetIsRoot && !allowCrossListBetweenChildren) {
            throw new MetahubDomainError({
                message: 'Moving components between child lists is disabled by settings',
                statusCode: 403,
                code: 'TRANSFER_NOT_ALLOWED'
            })
        }

        // 1. Display component cannot be moved across lists
        if (component.is_display_component) {
            throw new MetahubDomainError({
                message: 'Display component cannot be moved. Assign another component as the display component first.',
                statusCode: 403,
                code: 'DISPLAY_COMPONENT_TRANSFER_BLOCKED'
            })
        }

        // 2. TABLE components can only exist at root level
        if (componentDataType === ComponentDefinitionDataType.TABLE && targetParentId !== null) {
            throw new MetahubDomainError({
                message: 'TABLE components can only exist at the root level',
                statusCode: 403,
                code: 'TRANSFER_NOT_ALLOWED'
            })
        }

        // 3. If target is a child list, verify parent is TABLE type and data type is allowed
        if (targetParentId !== null) {
            const parentAttr = await queryOne<Record<string, unknown>>(
                db,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [targetParentId, objectId]
            )
            if (!parentAttr || parentAttr.data_type !== ComponentDefinitionDataType.TABLE) {
                throw new MetahubDomainError({
                    message: 'Target parent is not a TABLE component',
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            }
            if (!(TABLE_CHILD_DATA_TYPES as readonly string[]).includes(componentDataType)) {
                throw new MetahubDomainError({
                    message: `${componentDataType} components are not allowed in TABLE children`,
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            }

            const maxChildComponents = this.getMaxChildComponentsLimit(parentAttr.validation_rules)
            if (typeof maxChildComponents === 'number') {
                const [countResult] = await db.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${qt}
                     WHERE object_id = $1 AND parent_component_id = $2 AND ${ACTIVE}`,
                    [objectId, targetParentId]
                )
                const childCount = countResult?.count ?? 0
                if (childCount >= maxChildComponents) {
                    throw this.createTableChildLimitError(maxChildComponents)
                }
            }
        }

        // 4. Codename uniqueness check in target scope
        const hasConflict = async (codename: string): Promise<boolean> => {
            const conditions = [`object_id = $1`, `codename = $2`, `id != $3`, ACTIVE]
            const params: unknown[] = [objectId, codename, componentId]

            if (codenameScope !== 'global') {
                if (targetParentId) {
                    conditions.push(`parent_component_id = $4`)
                    params.push(targetParentId)
                } else {
                    conditions.push(`parent_component_id IS NULL`)
                }
            }

            const row = await queryOne(db, `SELECT id FROM ${qt} WHERE ${conditions.join(' AND ')} LIMIT 1`, params)
            return !!row
        }

        if (await hasConflict(componentCodename)) {
            if (!autoRenameCodename) {
                throw new MetahubConflictError(`Codename "${componentCodename}" already exists in the target scope`, {
                    code: 'CODENAME_CONFLICT',
                    codename: componentCodename
                })
            }

            // Auto-rename using buildCodenameAttempt() retry loop
            let renamed = false
            for (let attempt = 2; attempt <= CODENAME_RETRY_MAX_ATTEMPTS && !renamed; attempt++) {
                const candidate = buildCodenameAttempt(componentCodename, attempt, codenameStyle)
                if (!(await hasConflict(candidate))) {
                    const nextPresentation =
                        component.presentation && typeof component.presentation === 'object'
                            ? { ...(component.presentation as Record<string, unknown>), codename: null }
                            : { codename: null }
                    await db.query(`UPDATE ${qt} SET codename = $1, presentation = $2 WHERE id = $3`, [
                        candidate,
                        JSON.stringify(nextPresentation),
                        componentId
                    ])
                    renamed = true
                }
            }
            if (!renamed) {
                throw new MetahubConflictError(`Could not generate unique codename after ${CODENAME_RETRY_MAX_ATTEMPTS} attempts`, {
                    code: 'CODENAME_CONFLICT'
                })
            }
        }
    }

    /**
     * Ensure sequential sort order among sibling components.
     * Scoped by parentComponentId: null = root components, string = children of that parent.
     */
    private async _ensureSequentialSortOrder(
        metahubId: string,
        objectId: string,
        db: SqlQueryable,
        userId?: string,
        parentComponentId?: string | null
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')

        const parentCond = parentComponentId ? `parent_component_id = $2` : `parent_component_id IS NULL`
        const params: unknown[] = [objectId, ...(parentComponentId ? [parentComponentId] : [])]

        const components = await queryMany<{ id: string; sort_order: number }>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE object_id = $1 AND ${parentCond} AND ${this.getScopeCondition('business')}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            params
        )

        // Check consistency
        let consistent = true
        for (let i = 0; i < components.length; i++) {
            if (components[i].sort_order !== i + 1) {
                consistent = false
                break
            }
        }

        if (!consistent) {
            for (let i = 0; i < components.length; i++) {
                const cmp = components[i]
                if (cmp.sort_order !== i + 1) {
                    await db.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [i + 1, cmp.id])
                }
            }
        }
    }

    // Public wrapper if needed independently
    async ensureSequentialSortOrder(
        metahubId: string,
        objectId: string,
        userId?: string,
        parentComponentId?: string | null,
        db?: DbExecutor | SqlQueryable
    ) {
        if (db) {
            return this._ensureSequentialSortOrder(metahubId, objectId, db, userId, parentComponentId)
        }

        return this.exec.transaction((tx) => this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, parentComponentId))
    }

    /**
     * Set an component as the display component for its object.
     * Only one component per object can be the display component at each level:
     * - Root components: only one root component can be exhibit
     * - Child components: only one child per parent can be exhibit
     * TABLE type components cannot be display components.
     */
    async setDisplayComponent(
        metahubId: string,
        objectCollectionId: string,
        componentId: string,
        userId?: string,
        db?: DbExecutor | SqlQueryable
    ): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const runner = db ?? this.exec

        const component = await this.findById(metahubId, componentId, userId, runner)
        if (!component) {
            throw new MetahubNotFoundError('Component', componentId)
        }
        if (component.system?.isSystem) {
            throw new MetahubDomainError({
                message: 'System components cannot be used as display components',
                statusCode: 403,
                code: 'SYSTEM_COMPONENT_PROTECTED'
            })
        }

        // TABLE type components cannot be display components
        if (component.dataType === ComponentDefinitionDataType.TABLE) {
            throw this.createTableDisplayComponentForbiddenError()
        }

        const now = new Date()
        const applyDisplayComponent = async (tx: SqlQueryable) => {
            if (component.parentComponentId) {
                // Child component: reset only siblings (children of the same parent)
                await tx.query(
                    `UPDATE ${qt} SET is_display_component = false, _upl_updated_at = $1, _upl_updated_by = $2
                     WHERE parent_component_id = $3`,
                    [now, userId ?? null, component.parentComponentId]
                )
            } else {
                // Root component: reset only root components in this object
                await tx.query(
                    `UPDATE ${qt} SET is_display_component = false, _upl_updated_at = $1, _upl_updated_by = $2
                     WHERE object_id = $3 AND parent_component_id IS NULL`,
                    [now, userId ?? null, objectCollectionId]
                )
            }

            // Set the specified component as display component
            await tx.query(
                `UPDATE ${qt} SET is_display_component = true, is_required = true, _upl_updated_at = $1, _upl_updated_by = $2
                 WHERE id = $3`,
                [now, userId ?? null, componentId]
            )
        }

        if (db) {
            await applyDisplayComponent(runner)
            return
        }

        await this.exec.transaction(async (tx) => applyDisplayComponent(tx))
    }

    /**
     * Clear display component flag from an component.
     */
    async clearDisplayComponent(metahubId: string, componentId: string, userId?: string, db?: DbExecutor | SqlQueryable): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const runner = db ?? this.exec

        const component = await queryOne<Record<string, unknown>>(runner, `SELECT * FROM ${qt} WHERE id = $1`, [componentId])
        if (!component) {
            throw new MetahubNotFoundError('Component', componentId)
        }
        if (component.is_system === true) {
            throw new MetahubDomainError({
                message: 'System components cannot be used as display components',
                statusCode: 403,
                code: 'SYSTEM_COMPONENT_PROTECTED'
            })
        }

        if (component.is_display_component) {
            const parentCond = component.parent_component_id ? `parent_component_id = $2` : `parent_component_id IS NULL`
            const params: unknown[] = [component.object_id, ...(component.parent_component_id ? [component.parent_component_id] : [])]

            const [displayCountResult] = await runner.query<{ count: number }>(
                `SELECT COUNT(*)::int AS count FROM ${qt}
                 WHERE object_id = $1 AND ${parentCond} AND is_display_component = true`,
                params
            )
            const displayCount = displayCountResult?.count ?? 0

            if (displayCount <= 1) {
                throw new MetahubValidationError('At least one display component is required in each scope')
            }
        }

        await runner.query(`UPDATE ${qt} SET is_display_component = false, _upl_updated_at = $1, _upl_updated_by = $2 WHERE id = $3`, [
            new Date(),
            userId ?? null,
            componentId
        ])
    }

    private async getNextSortOrder(
        schemaName: string,
        objectId: string,
        parentComponentId?: string | null,
        db?: SqlQueryable
    ): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_components')
        const runner = db ?? this.exec
        const parentCond = parentComponentId ? `parent_component_id = $2` : `parent_component_id IS NULL`
        const params: unknown[] = [objectId, ...(parentComponentId ? [parentComponentId] : [])]

        const [result] = await runner.query<{ max: number | null }>(
            `SELECT MAX(sort_order) AS max FROM ${qt} WHERE object_id = $1 AND ${parentCond} AND ${this.getScopeCondition('business')}`,
            params
        )

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    private mapRowToComponent = (row: Record<string, unknown>): MetahubComponentRecord => {
        const presentation = row.presentation as Record<string, unknown> | null | undefined
        return {
            id: row.id as string,
            objectCollectionId: row.object_id as string,
            codename: getCodenameText(row.codename),
            dataType: row.data_type as ComponentDefinitionDataType,
            isRequired: row.is_required as boolean,
            isDisplayComponent: (row.is_display_component as boolean | null | undefined) ?? false,
            // Polymorphic reference fields
            targetEntityId: (row.target_object_id as string | null | undefined) ?? null,
            targetEntityKind: (row.target_object_kind as string | null | undefined) ?? null,
            targetConstantId: (row.target_constant_id as string | null | undefined) ?? null,
            // TABLE parent reference
            parentComponentId: (row.parent_component_id as string | null | undefined) ?? null,
            sortOrder: row.sort_order as number,
            name: (presentation?.name as VersionedLocalizedContent<string> | undefined) ?? undefined,
            description: (presentation?.description as VersionedLocalizedContent<string> | undefined) ?? undefined,
            validationRules: (row.validation_rules as Record<string, unknown> | undefined) ?? undefined,
            uiConfig: (row.ui_config as Record<string, unknown> | undefined) ?? undefined,
            system: this.getSystemMetadata(row),
            version: (row._upl_version as number) || 1,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }

    private mapRowToSnapshotComponent = (row: Record<string, unknown>) => {
        return {
            ...this.mapRowToComponent(row),
            codename: ensureCodenameValue(row.codename)
        }
    }
}
