import { qSchemaTable } from '@universo/database'
import {
    BUILTIN_ENTITY_TYPE_REGISTRY,
    isBuiltinKind,
    validateComponentDependencies,
    type ComponentManifest,
    type EntityKind,
    type EntityTypeUIConfig,
    type ResolvedEntityType
} from '@universo/types'
import { queryMany, queryOne, queryOneOrThrow, type DbExecutor, type SqlQueryable } from '@universo/utils/database'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { codenamePrimaryTextSql, ensureCodenameValue } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'

const TABLE = '_mhb_entity_type_definitions'
const ACTIVE_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'
const KIND_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/

type JsonRecord = Record<string, unknown>

interface StoredEntityTypeRow {
    id: string
    kind_key: string
    codename: unknown
    presentation: unknown
    components: unknown
    ui_config: unknown
    config: unknown
    is_builtin: boolean
    _mhb_published?: boolean | null
    _upl_version?: number
    _upl_updated_at?: string | Date | null
}

export interface MetahubResolvedEntityType extends ResolvedEntityType {
    id?: string
    codename?: JsonRecord | null
    presentation?: JsonRecord
    config?: JsonRecord
    published?: boolean
    version?: number
    updatedAt?: string | null
}

export interface CreateCustomEntityTypeInput {
    kindKey: string
    codename: unknown
    presentation?: JsonRecord
    components: ComponentManifest
    ui: EntityTypeUIConfig
    config?: JsonRecord
    published?: boolean
    createdBy?: string | null
}

export interface UpdateCustomEntityTypeInput {
    kindKey?: string
    codename?: unknown
    presentation?: JsonRecord
    components?: ComponentManifest
    ui?: EntityTypeUIConfig
    config?: JsonRecord
    published?: boolean
    updatedBy?: string | null
    expectedVersion?: number
}

const ensureJsonRecord = (value: unknown): JsonRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as JsonRecord
}

const normalizeEntityTypeKindKey = (value: string): string => {
    const normalized = value.trim().toLowerCase()
    if (!KIND_KEY_PATTERN.test(normalized)) {
        throw new MetahubValidationError('Entity type kindKey must use lowercase letters, digits, dots, underscores, or hyphens')
    }
    return normalized
}

const normalizeUiConfig = (value: EntityTypeUIConfig): EntityTypeUIConfig => {
    const tabs = Array.isArray(value.tabs) ? value.tabs.map((tab) => String(tab).trim()).filter((tab) => tab.length > 0) : []

    if (tabs.length === 0) {
        throw new MetahubValidationError('Entity type UI config must contain at least one tab')
    }

    const iconName = String(value.iconName ?? '').trim()
    if (!iconName) {
        throw new MetahubValidationError('Entity type UI config must contain an iconName')
    }

    const nameKey = String(value.nameKey ?? '').trim()
    if (!nameKey) {
        throw new MetahubValidationError('Entity type UI config must contain a nameKey')
    }

    const sidebarOrder = value.sidebarOrder
    if (sidebarOrder !== undefined && (!Number.isInteger(sidebarOrder) || sidebarOrder < 0)) {
        throw new MetahubValidationError('Entity type UI config sidebarOrder must be a non-negative integer')
    }

    return {
        iconName,
        tabs,
        sidebarSection: value.sidebarSection === 'admin' ? 'admin' : 'objects',
        sidebarOrder,
        nameKey,
        descriptionKey:
            typeof value.descriptionKey === 'string' && value.descriptionKey.trim().length > 0 ? value.descriptionKey : undefined
    }
}

const normalizeComponentManifest = (value: ComponentManifest): ComponentManifest => {
    const manifest = value as ComponentManifest
    const dependencyErrors = validateComponentDependencies(manifest)
    if (dependencyErrors.length > 0) {
        throw new MetahubValidationError(dependencyErrors.join('; '))
    }
    return manifest
}

const parseStoredComponentManifest = (value: unknown): ComponentManifest => {
    return normalizeComponentManifest(ensureJsonRecord(value) as unknown as ComponentManifest)
}

const parseStoredUiConfig = (value: unknown): EntityTypeUIConfig => {
    return normalizeUiConfig(ensureJsonRecord(value) as unknown as EntityTypeUIConfig)
}

export class EntityTypeService {
    constructor(private readonly exec: DbExecutor, private readonly schemaService: MetahubSchemaService) {}

    private async countDependentObjectsByKind(schemaName: string, kindKey: string, db: SqlQueryable = this.exec): Promise<number> {
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const row = await queryOne<{ count: string }>(db, `SELECT COUNT(*) AS count FROM ${qt} WHERE kind = $1 AND _upl_deleted = false`, [
            kindKey
        ])

        return row ? parseInt(row.count, 10) : 0
    }

    private toBuiltinResolvedType(definition: ResolvedEntityType): MetahubResolvedEntityType {
        return {
            ...definition,
            presentation: {},
            config: {},
            codename: null,
            updatedAt: null
        }
    }

    private normalizeCustomRow(row: StoredEntityTypeRow): MetahubResolvedEntityType {
        return {
            id: row.id,
            kindKey: row.kind_key as EntityKind,
            isBuiltin: Boolean(row.is_builtin),
            components: parseStoredComponentManifest(row.components),
            ui: parseStoredUiConfig(row.ui_config),
            source: 'custom',
            codename: ensureCodenameValue(row.codename),
            presentation: ensureJsonRecord(row.presentation),
            config: ensureJsonRecord(row.config),
            published: row._mhb_published === true,
            version: Number(row._upl_version ?? 1),
            updatedAt:
                row._upl_updated_at instanceof Date
                    ? row._upl_updated_at.toISOString()
                    : typeof row._upl_updated_at === 'string'
                    ? row._upl_updated_at
                    : null
        }
    }

    private async findCustomRowById(schemaName: string, id: string, db: SqlQueryable = this.exec): Promise<StoredEntityTypeRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityTypeRow>(db, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [id])
    }

    async getCustomTypeById(metahubId: string, entityTypeId: string, userId?: string): Promise<MetahubResolvedEntityType | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.findCustomRowById(schemaName, entityTypeId)
        return row ? this.normalizeCustomRow(row) : null
    }

    private async findCustomRowByKindKey(
        schemaName: string,
        kindKey: string,
        db: SqlQueryable = this.exec
    ): Promise<StoredEntityTypeRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityTypeRow>(db, `SELECT * FROM ${qt} WHERE kind_key = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [kindKey])
    }

    async listCustomTypesInSchema(schemaName: string, db: SqlQueryable = this.exec): Promise<MetahubResolvedEntityType[]> {
        const qt = qSchemaTable(schemaName, TABLE)
        const rows = await queryMany<StoredEntityTypeRow>(
            db,
            `SELECT * FROM ${qt} WHERE ${ACTIVE_CLAUSE} ORDER BY kind_key ASC, _upl_created_at ASC, id ASC`
        )

        return rows.map((row) => this.normalizeCustomRow(row))
    }

    async listCustomTypes(metahubId: string, userId?: string): Promise<MetahubResolvedEntityType[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.listCustomTypesInSchema(schemaName)
    }

    async listResolvedTypes(metahubId: string, userId?: string): Promise<MetahubResolvedEntityType[]> {
        const customTypes = await this.listCustomTypes(metahubId, userId)
        const builtinTypes = [...BUILTIN_ENTITY_TYPE_REGISTRY.values()].map((definition) =>
            this.toBuiltinResolvedType({ ...definition, source: 'builtin' })
        )

        return [...builtinTypes, ...customTypes]
    }

    async resolveType(metahubId: string, kindKey: EntityKind | string, userId?: string): Promise<MetahubResolvedEntityType | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.resolveTypeInSchema(schemaName, kindKey)
    }

    async resolveTypeInSchema(
        schemaName: string,
        kindKey: EntityKind | string,
        db: SqlQueryable = this.exec
    ): Promise<MetahubResolvedEntityType | null> {
        const normalizedKindKey = String(kindKey).trim()
        const builtin = BUILTIN_ENTITY_TYPE_REGISTRY.get(normalizedKindKey)
        if (builtin) {
            return this.toBuiltinResolvedType({ ...builtin, source: 'builtin' })
        }

        const customRow = await this.findCustomRowByKindKey(schemaName, normalizedKindKey, db)
        return customRow ? this.normalizeCustomRow(customRow) : null
    }

    async createCustomType(metahubId: string, input: CreateCustomEntityTypeInput, userId?: string): Promise<MetahubResolvedEntityType> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const kindKey = normalizeEntityTypeKindKey(input.kindKey)

        if (isBuiltinKind(kindKey)) {
            throw new MetahubValidationError('Built-in entity kinds cannot be redefined as custom types', { kindKey })
        }

        const components = normalizeComponentManifest(input.components)
        const ui = normalizeUiConfig(input.ui)
        const codename = ensureCodenameValue(input.codename)
        const presentation = ensureJsonRecord(input.presentation)
        const config = ensureJsonRecord(input.config)
        const published = input.published !== false
        const qt = qSchemaTable(schemaName, TABLE)

        return this.exec.transaction(async (tx) => {
            const existing = await this.findCustomRowByKindKey(schemaName, kindKey, tx)
            if (existing) {
                throw new MetahubConflictError('Entity type kindKey already exists', { kindKey, existingId: existing.id })
            }

            const created = await queryOneOrThrow<StoredEntityTypeRow>(
                tx,
                `INSERT INTO ${qt} (
                    kind_key,
                    codename,
                    presentation,
                    components,
                    ui_config,
                    config,
                    is_builtin,
                    _upl_created_at,
                    _upl_created_by,
                    _upl_updated_at,
                    _upl_updated_by,
                    _upl_version,
                    _upl_archived,
                    _upl_deleted,
                    _upl_locked,
                    _mhb_published,
                    _mhb_archived,
                    _mhb_deleted
                 ) VALUES (
                    $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, false,
                          $7, $8, $7, $8, 1, false, false, false, $9, false, false
                 )
                 RETURNING *`,
                [
                    kindKey,
                    JSON.stringify(codename),
                    JSON.stringify(presentation),
                    JSON.stringify(components),
                    JSON.stringify(ui),
                    JSON.stringify(config),
                    new Date(),
                    input.createdBy ?? userId ?? null,
                    published
                ]
            )

            return this.normalizeCustomRow(created)
        })
    }

    async updateCustomType(
        metahubId: string,
        entityTypeId: string,
        input: UpdateCustomEntityTypeInput,
        userId?: string
    ): Promise<MetahubResolvedEntityType> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findCustomRowById(schemaName, entityTypeId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity type', entityTypeId)
        }

        const nextKindKey = input.kindKey !== undefined ? normalizeEntityTypeKindKey(input.kindKey) : existing.kind_key
        if (isBuiltinKind(nextKindKey)) {
            throw new MetahubValidationError('Built-in entity kinds cannot be assigned to custom entity types', { kindKey: nextKindKey })
        }

        const nextComponents =
            input.components !== undefined
                ? normalizeComponentManifest(input.components)
                : parseStoredComponentManifest(existing.components)
        const nextUi = input.ui !== undefined ? normalizeUiConfig(input.ui) : parseStoredUiConfig(existing.ui_config)
        const nextCodename = input.codename !== undefined ? ensureCodenameValue(input.codename) : ensureCodenameValue(existing.codename)
        const nextPresentation =
            input.presentation !== undefined ? ensureJsonRecord(input.presentation) : ensureJsonRecord(existing.presentation)
        const nextConfig = input.config !== undefined ? ensureJsonRecord(input.config) : ensureJsonRecord(existing.config)
        const nextPublished = input.published !== undefined ? input.published : existing._mhb_published === true

        return this.exec.transaction(async (tx) => {
            const conflict = await this.findCustomRowByKindKey(schemaName, nextKindKey, tx)
            if (conflict && conflict.id !== existing.id) {
                throw new MetahubConflictError('Entity type kindKey already exists', { kindKey: nextKindKey, existingId: conflict.id })
            }

            const updateData = {
                kind_key: nextKindKey,
                codename: JSON.stringify(nextCodename),
                presentation: JSON.stringify(nextPresentation),
                components: JSON.stringify(nextComponents),
                ui_config: JSON.stringify(nextUi),
                config: JSON.stringify(nextConfig),
                _mhb_published: nextPublished,
                _upl_updated_at: new Date(),
                _upl_updated_by: input.updatedBy ?? userId ?? null
            }

            const updated =
                input.expectedVersion !== undefined
                    ? await updateWithVersionCheck({
                          executor: tx,
                          schemaName,
                          tableName: TABLE,
                          entityId: entityTypeId,
                          entityType: 'entity_type',
                          expectedVersion: input.expectedVersion,
                          updateData
                      })
                    : await incrementVersion(tx, schemaName, TABLE, entityTypeId, updateData)

            return this.normalizeCustomRow(updated as unknown as StoredEntityTypeRow)
        })
    }

    async deleteCustomType(metahubId: string, entityTypeId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findCustomRowById(schemaName, entityTypeId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity type', entityTypeId)
        }

        await this.exec.transaction(async (tx) => {
            const dependentObjects = await this.countDependentObjectsByKind(schemaName, existing.kind_key, tx)
            if (dependentObjects > 0) {
                throw new MetahubConflictError('Entity type cannot be deleted while dependent entity instances still exist', {
                    entityTypeId,
                    kindKey: existing.kind_key,
                    dependentObjects
                })
            }

            await incrementVersion(tx, schemaName, TABLE, entityTypeId, {
                _mhb_deleted: true,
                _mhb_deleted_at: new Date(),
                _mhb_deleted_by: userId ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
        })
    }

    async findCustomTypeByCodename(metahubId: string, codename: string, userId?: string): Promise<MetahubResolvedEntityType | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        const row = await queryOne<StoredEntityTypeRow>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE ${codenamePrimaryTextSql('codename')} = $1 AND ${ACTIVE_CLAUSE}
             LIMIT 1`,
            [codename]
        )

        return row ? this.normalizeCustomRow(row) : null
    }
}
