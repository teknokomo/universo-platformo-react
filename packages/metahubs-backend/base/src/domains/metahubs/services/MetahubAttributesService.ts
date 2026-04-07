import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import {
    AttributeDataType,
    TABLE_CHILD_DATA_TYPES,
    type CatalogAttributeSystemMetadata,
    type CatalogSystemFieldKey,
    type CatalogSystemFieldState,
    type CatalogSystemFieldsSnapshot,
    type PlatformSystemAttributesPolicy
} from '@universo/types'
import {
    deriveApplicationLifecycleContract,
    generateUuidV7,
    getCatalogSystemAttributeSeedRecords,
    getCatalogSystemFieldDefinition,
    getReservedCatalogSystemFieldCodenames,
    OptimisticLockError,
    validateCatalogSystemFieldToggleSet
} from '@universo/utils'
import { buildCodenameAttempt, CODENAME_RETRY_MAX_ATTEMPTS } from '../../shared/codenameStyleHelper'
import {
    getPlatformSystemAttributeMutationBlockReason,
    readPlatformSystemAttributesPolicy,
    resolveCatalogSystemAttributeSeedPlan
} from '../../shared/platformSystemAttributesPolicy'
import { codenamePrimaryTextSql, ensureCodenameValue, getCodenameText } from '../../shared/codename'
import { MetahubDomainError, MetahubNotFoundError, MetahubValidationError, MetahubConflictError } from '../../shared/domainErrors'
import { mhbSoftDelete } from '../../../persistence/metahubsQueryHelpers'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
type AttributeScope = 'business' | 'system' | 'all'
const RESERVED_CATALOG_SYSTEM_CODENAMES = new Set(getReservedCatalogSystemFieldCodenames())

/**
 * Service to manage Metahub Attributes stored in isolated schemas (_mhb_attributes).
 */
export class MetahubAttributesService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

    private getScopeCondition(scope: AttributeScope = 'business'): string {
        if (scope === 'system') return 'is_system = true'
        if (scope === 'all') return 'TRUE'
        return 'COALESCE(is_system, false) = false'
    }

    private getSystemMetadata(row: Record<string, unknown>): CatalogAttributeSystemMetadata {
        const systemKey =
            typeof row.system_key === 'string' && getCatalogSystemFieldDefinition(row.system_key as CatalogSystemFieldKey)
                ? (row.system_key as CatalogSystemFieldKey)
                : null

        return {
            isSystem: row.is_system === true,
            systemKey,
            isManaged: row.is_system_managed !== false,
            isEnabled: row.is_system_enabled !== false
        }
    }

    private assertSystemMutationAllowed(
        attribute: ReturnType<MetahubAttributesService['mapRowToAttribute']> | null,
        data: Record<string, unknown>
    ): void {
        if (!attribute?.system?.isSystem) return

        const allowedKeys = new Set(['isEnabled', 'updatedBy', 'expectedVersion'])
        const forbiddenKeys = Object.keys(data).filter((key) => data[key] !== undefined && !allowedKeys.has(key))

        if (forbiddenKeys.length > 0) {
            throw new MetahubDomainError({
                message: `System attribute mutation is restricted: ${forbiddenKeys.join(', ')}`,
                statusCode: 409,
                code: 'SYSTEM_ATTRIBUTE_PROTECTED'
            })
        }
    }

    private assertReservedBusinessCodenameAllowed(
        codename: unknown,
        currentAttribute: ReturnType<MetahubAttributesService['mapRowToAttribute']> | null = null
    ): void {
        if (typeof codename !== 'string' || codename.length === 0) return
        if (currentAttribute?.system?.isSystem) return
        if (currentAttribute?.codename === codename) return
        if (RESERVED_CATALOG_SYSTEM_CODENAMES.has(codename)) {
            throw new MetahubDomainError({
                message: `Codename ${codename} is reserved for managed system attributes`,
                statusCode: 409,
                code: 'SYSTEM_ATTRIBUTE_PROTECTED'
            })
        }
    }

    private getMaxChildAttributesLimit(validationRules: unknown): number | null {
        if (!validationRules || typeof validationRules !== 'object') {
            return null
        }
        const raw = (validationRules as Record<string, unknown>).maxChildAttributes
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
            return null
        }
        return raw
    }

    private createTableChildLimitError(maxChildAttributes: number): MetahubDomainError {
        return new MetahubDomainError({
            message: `Maximum ${maxChildAttributes} child attributes per TABLE`,
            statusCode: 409,
            code: 'TABLE_CHILD_LIMIT_REACHED',
            details: { maxChildAttributes }
        })
    }

    private createTableAttributeLimitError(maxTableAttributes: number): MetahubDomainError {
        return new MetahubDomainError({
            message: `Maximum ${maxTableAttributes} TABLE attributes per catalog`,
            statusCode: 409,
            code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
            details: { maxTableAttributes }
        })
    }

    private createTableDisplayAttributeForbiddenError(): MetahubDomainError {
        return new MetahubDomainError({
            message: 'TABLE attributes cannot be set as display attribute',
            statusCode: 400,
            code: 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN'
        })
    }

    private async generateUniqueTableAttributeId(schemaName: string, catalogId: string, db?: SqlQueryable): Promise<string> {
        const runner = db ?? this.exec
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const existingTableAttrs = await queryMany<{ id: string }>(
            runner,
            `SELECT id FROM ${qt} WHERE object_id = $1 AND data_type = $2 AND parent_attribute_id IS NULL`,
            [catalogId, AttributeDataType.TABLE]
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
            message: 'Failed to generate a unique TABLE attribute ID',
            statusCode: 500,
            code: 'VALIDATION_ERROR'
        })
    }

    /**
     * Count root-level attributes for a specific object (catalog).
     * Excludes child attributes of TABLE types.
     */
    async countByObjectId(metahubId: string, objectId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const result = await queryOne<{ count: number }>(
            this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt}
             WHERE object_id = $1 AND parent_attribute_id IS NULL AND ${this.getScopeCondition('business')} AND ${ACTIVE}`,
            [objectId]
        )
        return result ? result.count : 0
    }

    /**
     * Count TABLE-type attributes for a specific object.
     */
    async countTableAttributes(metahubId: string, objectId: string, userId?: string, db?: SqlQueryable): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const result = await queryOne<{ count: number }>(
            db ?? this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt}
             WHERE object_id = $1 AND data_type = $2 AND parent_attribute_id IS NULL AND ${this.getScopeCondition(
                 'business'
             )} AND ${ACTIVE}`,
            [objectId, AttributeDataType.TABLE]
        )
        return result ? result.count : 0
    }

    /**
     * Count child attributes of a TABLE attribute.
     */
    async countChildAttributes(metahubId: string, parentAttributeId: string, userId?: string, db?: SqlQueryable): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const result = await queryOne<{ count: number }>(
            db ?? this.exec,
            `SELECT COUNT(*)::int AS count FROM ${qt}
             WHERE parent_attribute_id = $1 AND ${this.getScopeCondition('business')} AND ${ACTIVE}`,
            [parentAttributeId]
        )
        return result ? result.count : 0
    }

    /**
     * Count attributes for multiple objects (batch operation).
     */
    async countByObjectIds(metahubId: string, objectIds: string[], userId?: string): Promise<Map<string, number>> {
        if (objectIds.length === 0) return new Map()

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
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
     * Returns only root-level attributes (parent_attribute_id IS NULL).
     * Use findAllFlat() to get all attributes including children.
     */
    async findAll(metahubId: string, objectId: string, userId?: string, scope: AttributeScope = 'business', db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await queryMany(
            db ?? this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND parent_attribute_id IS NULL AND ${this.getScopeCondition(scope)} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )

        return rows.map((row) => this.mapRowToAttribute(row))
    }

    /**
     * Returns ALL attributes (root + child) for snapshot/sync purposes.
     */
    async findAllFlat(metahubId: string, objectId: string, userId?: string, scope: AttributeScope = 'business') {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await queryMany(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${this.getScopeCondition(scope)} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )

        return rows.map((row) => this.mapRowToAttribute(row))
    }

    /**
     * Returns ALL attributes (root + child) while preserving localized codename payloads.
     * Use this only for snapshot-oriented export flows that must keep raw codename objects.
     */
    async findAllFlatForSnapshot(metahubId: string, objectId: string, userId?: string, scope: AttributeScope = 'business') {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await queryMany(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE object_id = $1 AND ${this.getScopeCondition(scope)} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [objectId]
        )

        return rows.map((row) => this.mapRowToSnapshotAttribute(row))
    }

    /**
     * Returns child attributes of a TABLE attribute.
     */
    async findChildAttributes(metahubId: string, parentAttributeId: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await queryMany(
            db ?? this.exec,
            `SELECT * FROM ${qt}
             WHERE parent_attribute_id = $1 AND ${this.getScopeCondition('business')} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [parentAttributeId]
        )

        return rows.map(this.mapRowToAttribute)
    }

    /**
     * Returns child attributes for multiple TABLE parents in a single query.
     * Grouped by parent attribute ID for efficient batch lookup.
     */
    async findChildAttributesByParentIds(metahubId: string, parentAttributeIds: string[], userId?: string) {
        const result = new Map<string, ReturnType<typeof this.mapRowToAttribute>[]>()
        for (const parentId of parentAttributeIds) {
            result.set(parentId, [])
        }
        if (parentAttributeIds.length === 0) return result

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await queryMany(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE parent_attribute_id = ANY($1::uuid[]) AND ${this.getScopeCondition('business')} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [parentAttributeIds]
        )

        for (const row of rows) {
            const attr = this.mapRowToAttribute(row)
            const parentId = attr.parentAttributeId
            if (parentId && result.has(parentId)) {
                result.get(parentId)!.push(attr)
            }
        }
        return result
    }

    async getAllAttributes(metahubId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const rows = await queryMany(
            this.exec,
            `SELECT * FROM ${qt} WHERE ${this.getScopeCondition('all')} AND ${ACTIVE}
             ORDER BY sort_order ASC, _upl_created_at ASC`
        )

        return rows.map((row) => this.mapRowToAttribute(row))
    }

    async findById(metahubId: string, id: string, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const row = await queryOne(db ?? this.exec, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} LIMIT 1`, [id])

        return row ? this.mapRowToAttribute(row) : null
    }

    async findByCodename(
        metahubId: string,
        objectId: string,
        codename: string,
        parentAttributeId?: string | null,
        userId?: string,
        db?: SqlQueryable,
        options?: { ignoreParentScope?: boolean }
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const conditions = [`object_id = $1`, `${codenamePrimaryTextSql('codename')} = $2`, ACTIVE]
        const params: unknown[] = [objectId, codename]
        let idx = 3

        if (!options?.ignoreParentScope) {
            if (parentAttributeId) {
                conditions.push(`parent_attribute_id = $${idx}`)
                params.push(parentAttributeId)
                idx++
            } else {
                conditions.push(`parent_attribute_id IS NULL`)
            }
        }

        const row = await queryOne(db ?? this.exec, `SELECT * FROM ${qt} WHERE ${conditions.join(' AND ')} LIMIT 1`, params)

        return row ? this.mapRowToAttribute(row) : null
    }

    async listCatalogSystemAttributes(metahubId: string, catalogId: string, userId?: string, db?: SqlQueryable) {
        return this.findAll(metahubId, catalogId, userId, 'system', db)
    }

    async getCatalogSystemFieldsSnapshot(
        metahubId: string,
        catalogId: string,
        userId?: string,
        db?: SqlQueryable
    ): Promise<CatalogSystemFieldsSnapshot> {
        const attributes = await this.listCatalogSystemAttributes(metahubId, catalogId, userId, db)
        const states: CatalogSystemFieldState[] = attributes
            .filter((attribute) => attribute.system?.isSystem && attribute.system.systemKey)
            .map((attribute) => ({
                key: attribute.system!.systemKey!,
                enabled: attribute.system!.isEnabled
            }))
        const normalized = validateCatalogSystemFieldToggleSet(states).normalized
        return {
            fields: normalized,
            lifecycleContract: deriveApplicationLifecycleContract(normalized)
        }
    }

    private resolveCatalogSystemToggleState(
        currentStates: CatalogSystemFieldState[],
        targetKey: CatalogSystemFieldKey,
        enabled: boolean
    ): CatalogSystemFieldState[] {
        const nextStates = new Map<CatalogSystemFieldKey, boolean>(currentStates.map((state) => [state.key, state.enabled]))
        const visited = new Set<string>()

        const applyState = (key: CatalogSystemFieldKey, nextEnabled: boolean, origin: 'requested' | 'dependency') => {
            const visitKey = `${origin}:${key}:${nextEnabled ? '1' : '0'}`
            if (visited.has(visitKey)) {
                return
            }
            visited.add(visitKey)

            const definition = getCatalogSystemFieldDefinition(key)
            if (!definition) {
                throw new MetahubValidationError(`System attribute ${key} is not registered`)
            }
            if (!nextEnabled && !definition.canDisable && origin === 'requested') {
                throw new MetahubDomainError({
                    message: `System attribute ${key} cannot be disabled`,
                    statusCode: 409,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })
            }

            nextStates.set(key, nextEnabled)

            if (nextEnabled) {
                for (const requiredKey of definition.requires ?? []) {
                    applyState(requiredKey, true, 'dependency')
                }
                return
            }

            for (const dependent of getCatalogSystemAttributeSeedRecords()) {
                if (dependent.key === key) {
                    continue
                }
                const dependentDefinition = getCatalogSystemFieldDefinition(dependent.key)
                if (dependentDefinition?.requires?.includes(key) && nextStates.get(dependentDefinition.key) === true) {
                    applyState(dependentDefinition.key, false, 'dependency')
                }
            }
        }

        applyState(targetKey, enabled, 'requested')

        const validation = validateCatalogSystemFieldToggleSet(
            Array.from(nextStates.entries()).map(([key, stateEnabled]) => ({ key, enabled: stateEnabled }))
        )
        if (validation.errors.length > 0) {
            throw new MetahubValidationError(validation.errors.join('; '))
        }

        return validation.normalized
    }

    async ensureCatalogSystemAttributes(
        metahubId: string,
        catalogId: string,
        userId?: string,
        db?: SqlQueryable,
        optionsOrStates?:
            | CatalogSystemFieldState[]
            | {
                  states?: CatalogSystemFieldState[]
                  policy?: import('@universo/types').PlatformSystemAttributesPolicy
              }
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const runner = db ?? this.exec
        const now = new Date()
        const states = Array.isArray(optionsOrStates) ? optionsOrStates : optionsOrStates?.states
        const policy = Array.isArray(optionsOrStates) ? undefined : optionsOrStates?.policy
        const existingRows = await queryMany<Record<string, unknown>>(
            runner,
            `SELECT * FROM ${qt} WHERE object_id = $1 AND is_system = true AND ${ACTIVE}`,
            [catalogId]
        )
        const existingByKey = new Map<string, Record<string, unknown>>()
        for (const row of existingRows) {
            if (typeof row.system_key === 'string') {
                existingByKey.set(row.system_key, row)
            }
        }

        const seedPlan = resolveCatalogSystemAttributeSeedPlan(states, policy, existingByKey.keys())
        const forceStateKeySet = new Set(seedPlan.forceStateKeys)

        for (const seed of getCatalogSystemAttributeSeedRecords(seedPlan.states).filter((record) => seedPlan.allowedKeys.has(record.key))) {
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
                  is_required, is_display_attribute, target_object_id, target_object_kind, target_constant_id,
                  parent_attribute_id, is_system, system_key, is_system_managed, is_system_enabled,
                  _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ($1, $2::jsonb, $3, $4::jsonb, '{}'::jsonb, '{}'::jsonb, $5, false, false, null, null, null,
                         null, true, $6, true, $7, $8, $9, $8, $9)`,
                [
                    catalogId,
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

        return this.listCatalogSystemAttributes(metahubId, catalogId, userId, runner)
    }

    /**
     * Find REF attributes in other catalogs that reference the target catalog.
     * Used to block catalog deletion when cross-catalog dependencies exist.
     */
    async findCatalogReferenceBlockers(metahubId: string, targetCatalogId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const attrTable = qSchemaTable(schemaName, '_mhb_attributes')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await queryMany<{
            attribute_id: string
            attribute_codename: string
            attribute_presentation: any
            source_catalog_id: string
            source_catalog_codename: string
            source_catalog_presentation: any
        }>(
            this.exec,
            `SELECT
                attr.id AS attribute_id,
                attr.codename AS attribute_codename,
                attr.presentation AS attribute_presentation,
                attr.object_id AS source_catalog_id,
                obj.codename AS source_catalog_codename,
                obj.presentation AS source_catalog_presentation
             FROM ${attrTable} attr
             LEFT JOIN ${objTable} obj ON obj.id = attr.object_id
             WHERE attr.data_type = 'REF'
               AND attr.target_object_id = $1
               AND attr.object_id != $1
               AND (attr.target_object_kind = 'catalog' OR attr.target_object_kind IS NULL)
               AND attr._upl_deleted = false AND attr._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, attr.sort_order ASC`,
            [targetCatalogId]
        )

        return rows.map((row) => ({
            attributeId: row.attribute_id,
            attributeCodename: getCodenameText(row.attribute_codename),
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: getCodenameText(row.source_catalog_codename),
            sourceCatalogName: row.source_catalog_presentation?.name ?? null
        }))
    }

    /**
     * Find REF attributes that reference a target object by kind and id.
     * Used to block deletion of referenced objects (e.g. enumerations).
     */
    async findReferenceBlockersByTarget(metahubId: string, targetObjectId: string, targetObjectKind: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const attrTable = qSchemaTable(schemaName, '_mhb_attributes')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await queryMany<{
            attribute_id: string
            attribute_codename: string
            attribute_presentation: any
            source_catalog_id: string
            source_catalog_codename: string
            source_catalog_presentation: any
        }>(
            this.exec,
            `SELECT
                attr.id AS attribute_id,
                attr.codename AS attribute_codename,
                attr.presentation AS attribute_presentation,
                attr.object_id AS source_catalog_id,
                obj.codename AS source_catalog_codename,
                obj.presentation AS source_catalog_presentation
             FROM ${attrTable} attr
             LEFT JOIN ${objTable} obj ON obj.id = attr.object_id
             WHERE attr.data_type = 'REF'
               AND attr.target_object_id = $1
               AND attr.target_object_kind = $2
               AND attr._upl_deleted = false AND attr._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, attr.sort_order ASC`,
            [targetObjectId, targetObjectKind]
        )

        return rows.map((row) => ({
            attributeId: row.attribute_id,
            attributeCodename: getCodenameText(row.attribute_codename),
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: getCodenameText(row.source_catalog_codename),
            sourceCatalogName: row.source_catalog_presentation?.name ?? null
        }))
    }

    /**
     * Find REF attributes that use a specific enumeration value as default in ui_config.
     * Used to block deletion of enumeration values that are still configured as defaults.
     */
    async findDefaultEnumValueBlockers(metahubId: string, enumValueId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const attrTable = qSchemaTable(schemaName, '_mhb_attributes')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await queryMany<{
            attribute_id: string
            attribute_codename: string
            attribute_presentation: any
            source_catalog_id: string
            source_catalog_codename: string
            source_catalog_presentation: any
        }>(
            this.exec,
            `SELECT
                attr.id AS attribute_id,
                attr.codename AS attribute_codename,
                attr.presentation AS attribute_presentation,
                attr.object_id AS source_catalog_id,
                obj.codename AS source_catalog_codename,
                obj.presentation AS source_catalog_presentation
             FROM ${attrTable} attr
             LEFT JOIN ${objTable} obj ON obj.id = attr.object_id
             WHERE attr.data_type = 'REF'
               AND attr.target_object_kind = 'enumeration'
               AND attr.ui_config ->> 'defaultEnumValueId' = $1
               AND attr._upl_deleted = false AND attr._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, attr.sort_order ASC`,
            [enumValueId]
        )

        return rows.map((row) => ({
            attributeId: row.attribute_id,
            attributeCodename: getCodenameText(row.attribute_codename),
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: getCodenameText(row.source_catalog_codename),
            sourceCatalogName: row.source_catalog_presentation?.name ?? null
        }))
    }

    /**
     * Find predefined elements that reference a specific enumeration value.
     * Used to prevent deleting values that are still used in catalog predefined data.
     */
    async findElementEnumValueBlockers(metahubId: string, enumerationId: string, enumValueId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const attrTable = qSchemaTable(schemaName, '_mhb_attributes')
        const objTable = qSchemaTable(schemaName, '_mhb_objects')
        const elTable = qSchemaTable(schemaName, '_mhb_elements')
        const rows = await queryMany<{
            attribute_id: string
            attribute_codename: string
            attribute_presentation: any
            source_catalog_id: string
            source_catalog_codename: string
            source_catalog_presentation: any
            usage_count: string
        }>(
            this.exec,
            `SELECT
                attr.id AS attribute_id,
                attr.codename AS attribute_codename,
                attr.presentation AS attribute_presentation,
                attr.object_id AS source_catalog_id,
                obj.codename AS source_catalog_codename,
                obj.presentation AS source_catalog_presentation,
                COUNT(el.id) AS usage_count
             FROM ${attrTable} attr
             LEFT JOIN ${objTable} obj ON obj.id = attr.object_id
             LEFT JOIN ${elTable} el ON el.object_id = attr.object_id
             WHERE attr.data_type = 'REF'
               AND attr.target_object_kind = 'enumeration'
               AND attr.target_object_id = $1
               AND el.data ->> (${codenamePrimaryTextSql('attr.codename')}) = $2
               AND attr._upl_deleted = false AND attr._mhb_deleted = false
               AND obj._upl_deleted = false AND obj._mhb_deleted = false
               AND el._upl_deleted = false AND el._mhb_deleted = false
             GROUP BY attr.id, attr.codename, attr.presentation, attr.object_id, obj.codename, obj.presentation
             ORDER BY ${codenamePrimaryTextSql('obj.codename')} ASC, attr.sort_order ASC`,
            [enumerationId, enumValueId]
        )

        return rows.map((row) => ({
            attributeId: row.attribute_id,
            attributeCodename: getCodenameText(row.attribute_codename),
            attributeName: row.attribute_presentation?.name ?? null,
            sourceCatalogId: row.source_catalog_id,
            sourceCatalogCodename: getCodenameText(row.source_catalog_codename),
            sourceCatalogName: row.source_catalog_presentation?.name ?? null,
            usageCount: parseInt(row.usage_count ?? '0', 10)
        }))
    }

    async create(metahubId: string, data: any, userId?: string, db?: SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        let explicitAttributeId: string | undefined

        this.assertReservedBusinessCodenameAllowed(data.codename)

        // TABLE attribute limits validation
        if (data.parentAttributeId) {
            const parent = await this.findById(metahubId, data.parentAttributeId, userId, db)
            if (!parent) {
                throw new MetahubNotFoundError('Parent attribute', data.parentAttributeId)
            }
            if (parent.dataType !== AttributeDataType.TABLE) {
                throw new MetahubValidationError(`Parent attribute must be TABLE type, got ${parent.dataType}`)
            }
            if (data.dataType === AttributeDataType.TABLE) {
                throw new MetahubValidationError('Nested TABLE attributes are not allowed')
            }
            const maxChildAttributes = this.getMaxChildAttributesLimit(parent.validationRules)
            if (typeof maxChildAttributes === 'number') {
                const childCount = await this.countChildAttributes(metahubId, data.parentAttributeId, userId, db)
                if (childCount >= maxChildAttributes) {
                    throw this.createTableChildLimitError(maxChildAttributes)
                }
            }
        }

        if (data.dataType === AttributeDataType.TABLE) {
            const tableCount = await this.countTableAttributes(metahubId, data.catalogId, userId, db)
            if (tableCount >= 10) {
                throw this.createTableAttributeLimitError(10)
            }

            explicitAttributeId = await this.generateUniqueTableAttributeId(schemaName, data.catalogId, db)
        }

        const sortOrder = data.sortOrder ?? (await this.getNextSortOrder(schemaName, data.catalogId, data.parentAttributeId, db))
        const now = new Date()
        const presentation = JSON.stringify({ name: data.name })
        const validationRules = JSON.stringify(data.validationRules || {})
        const uiConfig = JSON.stringify(data.uiConfig || {})
        const codename = ensureCodenameValue(data.codename)

        const columns = [
            ...(explicitAttributeId ? ['id'] : []),
            'object_id',
            'codename',
            'data_type',
            'is_system',
            'system_key',
            'is_system_managed',
            'is_system_enabled',
            'is_required',
            'is_display_attribute',
            'target_object_id',
            'target_object_kind',
            'target_constant_id',
            'parent_attribute_id',
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
            ...(explicitAttributeId ? [explicitAttributeId] : []),
            data.catalogId,
            JSON.stringify(codename),
            data.dataType,
            data.system?.isSystem === true,
            data.system?.systemKey ?? null,
            data.system?.isManaged !== false,
            data.system?.isEnabled !== false,
            data.isDisplayAttribute ? true : data.isRequired ?? false,
            data.isDisplayAttribute ?? false,
            data.targetEntityId ?? null,
            data.targetEntityKind ?? null,
            data.targetConstantId ?? null,
            data.parentAttributeId ?? null,
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
        const created = await queryOneOrThrow(
            runner,
            `INSERT INTO ${qt} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            values
        )

        return this.mapRowToAttribute(created)
    }

    async update(metahubId: string, id: string, data: any, userId?: string, db?: DbExecutor | SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
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
                    message: 'System attribute toggle key is missing',
                    statusCode: 409,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })
            }

            const platformSystemAttributesPolicy: PlatformSystemAttributesPolicy =
                data.platformSystemAttributesPolicy ?? (await readPlatformSystemAttributesPolicy(runner))
            const policyBlockReason = getPlatformSystemAttributeMutationBlockReason(systemKey ?? null, platformSystemAttributesPolicy)
            if (policyBlockReason) {
                throw new MetahubDomainError({
                    message: policyBlockReason,
                    statusCode: 403,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })
            }

            const updateSystemRows = async (tx: SqlQueryable) => {
                const lockedCurrent = await queryOneOrThrow<Record<string, unknown>>(
                    tx,
                    `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`,
                    [id],
                    undefined,
                    'attribute not found'
                )

                if (data.expectedVersion !== undefined) {
                    const actualVersion = Number(lockedCurrent._upl_version ?? 1)
                    if (actualVersion !== data.expectedVersion) {
                        throw new OptimisticLockError({
                            entityId: id,
                            entityType: 'attribute',
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
                    [current.catalogId]
                )

                const normalizedStates =
                    data.isEnabled !== undefined && systemKey
                        ? this.resolveCatalogSystemToggleState(
                              systemRows
                                  .filter(
                                      (row): row is Record<string, unknown> & { system_key: CatalogSystemFieldKey } =>
                                          typeof row.system_key === 'string' &&
                                          !!getCatalogSystemFieldDefinition(row.system_key as CatalogSystemFieldKey)
                                  )
                                  .map((row) => ({
                                      key: row.system_key as CatalogSystemFieldKey,
                                      enabled: row.is_system_enabled !== false
                                  })),
                              systemKey,
                              data.isEnabled
                          )
                        : null

                const nextEnabledByKey = normalizedStates
                    ? new Map<CatalogSystemFieldKey, boolean>(normalizedStates.map((state) => [state.key, state.enabled]))
                    : null

                let updatedTarget: Record<string, unknown> | null = null

                for (const row of systemRows) {
                    const rowId = String(row.id)
                    const rowUpdateData: Record<string, unknown> = {
                        _upl_updated_at: updateData._upl_updated_at,
                        _upl_updated_by: updateData._upl_updated_by
                    }

                    const rowSystemKey =
                        typeof row.system_key === 'string' && getCatalogSystemFieldDefinition(row.system_key as CatalogSystemFieldKey)
                            ? (row.system_key as CatalogSystemFieldKey)
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

                    const updatedRow = await incrementVersion(tx, schemaName, '_mhb_attributes', rowId, rowUpdateData)
                    if (rowId === id) {
                        updatedTarget = updatedRow
                    }
                }

                return updatedTarget
            }

            const updatedSystem = db ? await updateSystemRows(runner) : await this.exec.transaction(async (tx) => updateSystemRows(tx))

            return updatedSystem ? this.mapRowToAttribute(updatedSystem) : null
        }

        if (data.codename !== undefined) {
            const currentCodename = await queryOne<Record<string, unknown>>(runner, `SELECT codename FROM ${qt} WHERE id = $1`, [id])
            updateData.codename = ensureCodenameValue(data.codename ?? currentCodename?.codename)
        }
        if (data.dataType !== undefined) updateData.data_type = data.dataType
        if (data.isRequired !== undefined) updateData.is_required = data.isRequired
        if (data.isDisplayAttribute !== undefined) updateData.is_display_attribute = data.isDisplayAttribute
        if (data.isDisplayAttribute === true) updateData.is_required = true
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
                tableName: '_mhb_attributes',
                entityId: id,
                entityType: 'attribute',
                expectedVersion: data.expectedVersion,
                updateData
            })
            return this.mapRowToAttribute(updated)
        }

        // Fallback: increment version without check (backwards compatibility)
        const updated = await incrementVersion(runner, schemaName, '_mhb_attributes', id, updateData)
        return updated ? this.mapRowToAttribute(updated) : null
    }

    async delete(metahubId: string, id: string, userId?: string, db?: DbExecutor | SqlQueryable) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const runner = db ?? this.exec
        const attribute = await this.findById(metahubId, id, userId, runner)

        if (attribute?.system?.isSystem) {
            throw new MetahubDomainError({
                message: 'System attributes cannot be deleted',
                statusCode: 403,
                code: 'SYSTEM_ATTRIBUTE_PROTECTED'
            })
        }

        const runDelete = async (tx: SqlQueryable) => {
            // If TABLE type, soft-delete children before parent
            const [attribute] = await tx.query<Record<string, unknown>>(`SELECT data_type FROM ${qt} WHERE id = $1`, [id])
            if (attribute?.data_type === AttributeDataType.TABLE) {
                const children = await tx.query<{ id: string }>(`SELECT id FROM ${qt} WHERE parent_attribute_id = $1 AND ${ACTIVE}`, [id])
                for (const child of children) {
                    await mhbSoftDelete(tx, schemaName, '_mhb_attributes', child.id, userId)
                }
            }

            const deleted = await mhbSoftDelete(tx, schemaName, '_mhb_attributes', id, userId)
            if (!deleted) {
                throw new MetahubNotFoundError('Attribute', id)
            }
        }

        if (db) {
            await runDelete(runner)
            return
        }

        await this.exec.transaction(async (tx) => runDelete(tx))
    }

    async moveAttribute(metahubId: string, objectId: string, attributeId: string, direction: 'up' | 'down', userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            // Fetch current attribute to know its parent scope
            const current = await queryOne<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1`, [attributeId])
            if (!current) throw new MetahubNotFoundError('Attribute', attributeId)
            if (current.is_system === true)
                throw new MetahubDomainError({
                    message: 'System attributes cannot be reordered',
                    statusCode: 403,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })

            const parentAttributeId: string | null = (current.parent_attribute_id as string | null) ?? null

            // Ensure sequential order only among siblings (same parent)
            await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, parentAttributeId)

            // Re-fetch after reordering
            const refreshed = await queryOneOrThrow<Record<string, unknown>>(tx, `SELECT * FROM ${qt} WHERE id = $1`, [attributeId])
            const currentOrder = refreshed.sort_order as number

            // Find neighbor among siblings only
            const parentCond = parentAttributeId ? `parent_attribute_id = $3` : `parent_attribute_id IS NULL`
            const params: unknown[] = [objectId, currentOrder, ...(parentAttributeId ? [parentAttributeId] : [])]

            let neighborSql: string
            if (direction === 'up') {
                neighborSql = `SELECT * FROM ${qt} WHERE object_id = $1 AND ${parentCond} AND sort_order < $2 ORDER BY sort_order DESC LIMIT 1`
            } else {
                neighborSql = `SELECT * FROM ${qt} WHERE object_id = $1 AND ${parentCond} AND sort_order > $2 ORDER BY sort_order ASC LIMIT 1`
            }

            const neighbor = await queryOne<Record<string, unknown>>(tx, neighborSql, params)

            if (neighbor) {
                // Swap
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [neighbor.sort_order, attributeId])
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [currentOrder, neighbor.id])
            }

            // Fetch updated
            const updated = await queryOneOrThrow(tx, `SELECT * FROM ${qt} WHERE id = $1`, [attributeId])
            return this.mapRowToAttribute(updated)
        })
    }

    /**
     * Reorder an attribute to a new sort_order (and optionally transfer to a different parent list).
     * @param codenameScope - 'per-level' or 'global' codename uniqueness scope
     * @param codenameStyle - 'kebab-case' or 'pascal-case' for auto-rename suffix
     * @param autoRenameCodename - if true, auto-rename codename on conflict
     */
    async reorderAttribute(
        metahubId: string,
        objectId: string,
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId: string | null | undefined,
        codenameScope: 'per-level' | 'global',
        codenameStyle: 'kebab-case' | 'pascal-case',
        allowCrossListRootChildren: boolean,
        allowCrossListBetweenChildren: boolean,
        autoRenameCodename?: boolean,
        userId?: string
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            // 1. Fetch current attribute
            const current = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [attributeId, objectId]
            )
            if (!current) throw new MetahubNotFoundError('Attribute', attributeId)
            if (current.is_system === true)
                throw new MetahubDomainError({
                    message: 'System attributes cannot be reordered',
                    statusCode: 403,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })

            const currentParent: string | null = (current.parent_attribute_id as string | null) ?? null
            const targetParent: string | null = newParentAttributeId !== undefined ? newParentAttributeId : currentParent
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

                // Move: update parent_attribute_id
                await tx.query(`UPDATE ${qt} SET parent_attribute_id = $1 WHERE id = $2`, [targetParent, attributeId])

                // Normalize source list (close gap left by the moved attribute)
                await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, currentParent)

                // Auto-set display attribute + required when attribute becomes the only child in target list
                if (targetParent !== null) {
                    const [siblingCount] = await tx.query<{ count: number }>(
                        `SELECT COUNT(*)::int AS count FROM ${qt}
                         WHERE object_id = $1 AND parent_attribute_id = $2 AND ${ACTIVE}`,
                        [objectId, targetParent]
                    )
                    if (siblingCount && siblingCount.count === 1) {
                        await tx.query(`UPDATE ${qt} SET is_display_attribute = true, is_required = true WHERE id = $1`, [attributeId])
                    }
                }
            }

            // 2. Ensure sequential order in target list
            await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, targetParent)

            // 3. Re-fetch to get current sort_order after normalization
            const refreshed = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [attributeId, objectId]
            )
            if (!refreshed) throw new MetahubNotFoundError('Attribute', attributeId)
            const oldOrder = refreshed.sort_order as number
            const clampedNew = Math.max(1, newSortOrder)

            if (oldOrder !== clampedNew) {
                const parentCond = targetParent ? `parent_attribute_id = $4` : `parent_attribute_id IS NULL`
                const baseParams: unknown[] = [objectId, attributeId, ...(targetParent ? [targetParent] : [])]
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
                await tx.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [clampedNew, attributeId])
            }

            // 4. Final normalization pass
            await this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, targetParent)

            // 5. Return updated attribute
            const updated = await queryOne<Record<string, unknown>>(
                tx,
                `SELECT * FROM ${qt} WHERE id = $1 AND object_id = $2 AND ${ACTIVE}`,
                [attributeId, objectId]
            )
            if (!updated) throw new MetahubNotFoundError('Attribute', attributeId)
            return this.mapRowToAttribute(updated)
        })
    }

    /**
     * Validate a cross-list attribute transfer (change of parent_attribute_id).
     * Throws typed errors that the route handler maps to HTTP status codes.
     */
    private async _validateCrossListTransfer(
        db: SqlQueryable,
        schemaName: string,
        objectId: string,
        attribute: any,
        currentParentId: string | null,
        targetParentId: string | null,
        allowCrossListRootChildren: boolean,
        allowCrossListBetweenChildren: boolean,
        codenameScope: 'per-level' | 'global',
        codenameStyle: 'kebab-case' | 'pascal-case',
        autoRenameCodename?: boolean
    ): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const sourceIsRoot = currentParentId === null
        const targetIsRoot = targetParentId === null

        if ((sourceIsRoot || targetIsRoot) && !allowCrossListRootChildren) {
            throw new MetahubDomainError({
                message: 'Moving attributes between root and child lists is disabled by settings',
                statusCode: 403,
                code: 'TRANSFER_NOT_ALLOWED'
            })
        }

        if (!sourceIsRoot && !targetIsRoot && !allowCrossListBetweenChildren) {
            throw new MetahubDomainError({
                message: 'Moving attributes between child lists is disabled by settings',
                statusCode: 403,
                code: 'TRANSFER_NOT_ALLOWED'
            })
        }

        // 1. Display attribute cannot be moved across lists
        if (attribute.is_display_attribute) {
            throw new MetahubDomainError({
                message: 'Display attribute cannot be moved. Assign another attribute as the display attribute first.',
                statusCode: 403,
                code: 'DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED'
            })
        }

        // 2. TABLE attributes can only exist at root level
        if (attribute.data_type === AttributeDataType.TABLE && targetParentId !== null) {
            throw new MetahubDomainError({
                message: 'TABLE attributes can only exist at the root level',
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
            if (!parentAttr || parentAttr.data_type !== AttributeDataType.TABLE) {
                throw new MetahubDomainError({
                    message: 'Target parent is not a TABLE attribute',
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            }
            if (!TABLE_CHILD_DATA_TYPES.includes(attribute.data_type)) {
                throw new MetahubDomainError({
                    message: `${attribute.data_type} attributes are not allowed in TABLE children`,
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            }

            const maxChildAttributes = this.getMaxChildAttributesLimit(parentAttr.validation_rules)
            if (typeof maxChildAttributes === 'number') {
                const [countResult] = await db.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${qt}
                     WHERE object_id = $1 AND parent_attribute_id = $2 AND ${ACTIVE}`,
                    [objectId, targetParentId]
                )
                const childCount = countResult?.count ?? 0
                if (childCount >= maxChildAttributes) {
                    throw this.createTableChildLimitError(maxChildAttributes)
                }
            }
        }

        // 4. Codename uniqueness check in target scope
        const hasConflict = async (codename: string): Promise<boolean> => {
            const conditions = [`object_id = $1`, `codename = $2`, `id != $3`, ACTIVE]
            const params: unknown[] = [objectId, codename, attribute.id]

            if (codenameScope !== 'global') {
                if (targetParentId) {
                    conditions.push(`parent_attribute_id = $4`)
                    params.push(targetParentId)
                } else {
                    conditions.push(`parent_attribute_id IS NULL`)
                }
            }

            const row = await queryOne(db, `SELECT id FROM ${qt} WHERE ${conditions.join(' AND ')} LIMIT 1`, params)
            return !!row
        }

        if (await hasConflict(attribute.codename)) {
            if (!autoRenameCodename) {
                throw new MetahubConflictError(`Codename "${attribute.codename}" already exists in the target scope`, {
                    code: 'CODENAME_CONFLICT',
                    codename: attribute.codename
                })
            }

            // Auto-rename using buildCodenameAttempt() retry loop
            let renamed = false
            for (let attempt = 2; attempt <= CODENAME_RETRY_MAX_ATTEMPTS && !renamed; attempt++) {
                const candidate = buildCodenameAttempt(attribute.codename, attempt, codenameStyle)
                if (!(await hasConflict(candidate))) {
                    const nextPresentation =
                        attribute.presentation && typeof attribute.presentation === 'object'
                            ? { ...(attribute.presentation as Record<string, unknown>), codename: null }
                            : { codename: null }
                    await db.query(`UPDATE ${qt} SET codename = $1, presentation = $2 WHERE id = $3`, [
                        candidate,
                        JSON.stringify(nextPresentation),
                        attribute.id
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
     * Ensure sequential sort order among sibling attributes.
     * Scoped by parentAttributeId: null = root attributes, string = children of that parent.
     */
    private async _ensureSequentialSortOrder(
        metahubId: string,
        objectId: string,
        db: SqlQueryable,
        userId?: string,
        parentAttributeId?: string | null
    ) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')

        const parentCond = parentAttributeId ? `parent_attribute_id = $2` : `parent_attribute_id IS NULL`
        const params: unknown[] = [objectId, ...(parentAttributeId ? [parentAttributeId] : [])]

        const attributes = await queryMany<{ id: string; sort_order: number }>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE object_id = $1 AND ${parentCond} AND ${this.getScopeCondition('business')}
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            params
        )

        // Check consistency
        let consistent = true
        for (let i = 0; i < attributes.length; i++) {
            if (attributes[i].sort_order !== i + 1) {
                consistent = false
                break
            }
        }

        if (!consistent) {
            for (let i = 0; i < attributes.length; i++) {
                const attr = attributes[i]
                if (attr.sort_order !== i + 1) {
                    await db.query(`UPDATE ${qt} SET sort_order = $1 WHERE id = $2`, [i + 1, attr.id])
                }
            }
        }
    }

    // Public wrapper if needed independently
    async ensureSequentialSortOrder(
        metahubId: string,
        objectId: string,
        userId?: string,
        parentAttributeId?: string | null,
        db?: DbExecutor | SqlQueryable
    ) {
        if (db) {
            return this._ensureSequentialSortOrder(metahubId, objectId, db, userId, parentAttributeId)
        }

        return this.exec.transaction((tx) => this._ensureSequentialSortOrder(metahubId, objectId, tx, userId, parentAttributeId))
    }

    /**
     * Set an attribute as the display attribute for its catalog.
     * Only one attribute per catalog can be the display attribute at each level:
     * - Root attributes: only one root attribute can be exhibit
     * - Child attributes: only one child per parent can be exhibit
     * TABLE type attributes cannot be display attributes.
     */
    async setDisplayAttribute(
        metahubId: string,
        catalogId: string,
        attributeId: string,
        userId?: string,
        db?: DbExecutor | SqlQueryable
    ): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const runner = db ?? this.exec

        const attribute = await this.findById(metahubId, attributeId, userId, runner)
        if (!attribute) {
            throw new MetahubNotFoundError('Attribute', attributeId)
        }
        if (attribute.system?.isSystem) {
            throw new MetahubDomainError({
                message: 'System attributes cannot be used as display attributes',
                statusCode: 403,
                code: 'SYSTEM_ATTRIBUTE_PROTECTED'
            })
        }

        // TABLE type attributes cannot be display attributes
        if (attribute.dataType === AttributeDataType.TABLE) {
            throw this.createTableDisplayAttributeForbiddenError()
        }

        const now = new Date()
        const applyDisplayAttribute = async (tx: SqlQueryable) => {
            if (attribute.parentAttributeId) {
                // Child attribute: reset only siblings (children of the same parent)
                await tx.query(
                    `UPDATE ${qt} SET is_display_attribute = false, _upl_updated_at = $1, _upl_updated_by = $2
                     WHERE parent_attribute_id = $3`,
                    [now, userId ?? null, attribute.parentAttributeId]
                )
            } else {
                // Root attribute: reset only root attributes in this catalog
                await tx.query(
                    `UPDATE ${qt} SET is_display_attribute = false, _upl_updated_at = $1, _upl_updated_by = $2
                     WHERE object_id = $3 AND parent_attribute_id IS NULL`,
                    [now, userId ?? null, catalogId]
                )
            }

            // Set the specified attribute as display attribute
            await tx.query(
                `UPDATE ${qt} SET is_display_attribute = true, is_required = true, _upl_updated_at = $1, _upl_updated_by = $2
                 WHERE id = $3`,
                [now, userId ?? null, attributeId]
            )
        }

        if (db) {
            await applyDisplayAttribute(runner)
            return
        }

        await this.exec.transaction(async (tx) => applyDisplayAttribute(tx))
    }

    /**
     * Clear display attribute flag from an attribute.
     */
    async clearDisplayAttribute(metahubId: string, attributeId: string, userId?: string, db?: DbExecutor | SqlQueryable): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const runner = db ?? this.exec

        const attribute = await queryOne<Record<string, unknown>>(runner, `SELECT * FROM ${qt} WHERE id = $1`, [attributeId])
        if (!attribute) {
            throw new MetahubNotFoundError('Attribute', attributeId)
        }
        if (attribute.is_system === true) {
            throw new MetahubDomainError({
                message: 'System attributes cannot be used as display attributes',
                statusCode: 403,
                code: 'SYSTEM_ATTRIBUTE_PROTECTED'
            })
        }

        if (attribute.is_display_attribute) {
            const parentCond = attribute.parent_attribute_id ? `parent_attribute_id = $2` : `parent_attribute_id IS NULL`
            const params: unknown[] = [attribute.object_id, ...(attribute.parent_attribute_id ? [attribute.parent_attribute_id] : [])]

            const [displayCountResult] = await runner.query<{ count: number }>(
                `SELECT COUNT(*)::int AS count FROM ${qt}
                 WHERE object_id = $1 AND ${parentCond} AND is_display_attribute = true`,
                params
            )
            const displayCount = displayCountResult?.count ?? 0

            if (displayCount <= 1) {
                throw new MetahubValidationError('At least one display attribute is required in each scope')
            }
        }

        await runner.query(`UPDATE ${qt} SET is_display_attribute = false, _upl_updated_at = $1, _upl_updated_by = $2 WHERE id = $3`, [
            new Date(),
            userId ?? null,
            attributeId
        ])
    }

    private async getNextSortOrder(
        schemaName: string,
        objectId: string,
        parentAttributeId?: string | null,
        db?: SqlQueryable
    ): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_attributes')
        const runner = db ?? this.exec
        const parentCond = parentAttributeId ? `parent_attribute_id = $2` : `parent_attribute_id IS NULL`
        const params: unknown[] = [objectId, ...(parentAttributeId ? [parentAttributeId] : [])]

        const [result] = await runner.query<{ max: number | null }>(
            `SELECT MAX(sort_order) AS max FROM ${qt} WHERE object_id = $1 AND ${parentCond} AND ${this.getScopeCondition('business')}`,
            params
        )

        const max = result?.max
        if (typeof max === 'number') return max + 1
        const parsed = max !== undefined && max !== null ? Number(max) : 0
        return Number.isFinite(parsed) ? parsed + 1 : 1
    }

    private mapRowToAttribute = (row: any) => {
        return {
            id: row.id,
            catalogId: row.object_id,
            codename: getCodenameText(row.codename),
            dataType: row.data_type,
            isRequired: row.is_required,
            isDisplayAttribute: row.is_display_attribute ?? false,
            // Polymorphic reference fields
            targetEntityId: row.target_object_id,
            targetEntityKind: row.target_object_kind,
            targetConstantId: row.target_constant_id ?? null,
            // TABLE parent reference
            parentAttributeId: row.parent_attribute_id ?? null,
            sortOrder: row.sort_order,
            name: row.presentation?.name,
            description: row.presentation?.description,
            validationRules: row.validation_rules,
            uiConfig: row.ui_config,
            system: this.getSystemMetadata(row),
            version: row._upl_version || 1,
            createdAt: row._upl_created_at,
            updatedAt: row._upl_updated_at
        }
    }

    private mapRowToSnapshotAttribute = (row: any) => {
        return {
            ...this.mapRowToAttribute(row),
            codename: ensureCodenameValue(row.codename)
        }
    }
}
