import { qSchemaTable } from '@universo/database'
import {
    isBuiltinEntityKind,
    normalizeEntityResourceSurfaceDefinitions,
    validateEntityResourceSurfacesAgainstComponents,
    validateComponentDependencies,
    type ComponentManifest,
    type EntityKind,
    type EntityTypeUIConfig,
    type ResolvedEntityType
} from '@universo/types'
import {
    getDbErrorConstraint,
    isUniqueViolation,
    queryMany,
    queryOne,
    queryOneOrThrow,
    type DbExecutor,
    type SqlQueryable
} from '@universo/utils/database'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'
import { codenamePrimaryTextSql, ensureCodenameValue, getCodenameText } from '../../shared/codename'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'

const TABLE = '_mhb_entity_type_definitions'
const ACTIVE_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'
const KIND_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/
const ENTITY_TYPE_KIND_KEY_ACTIVE_CONSTRAINT = 'idx_mhb_entity_type_definitions_kind_key_active'
const ENTITY_TYPE_CODENAME_ACTIVE_CONSTRAINT = 'idx_mhb_entity_type_definitions_codename_active'

type JsonRecord = Record<string, unknown>

interface StoredEntityTypeRow {
    id: string
    kind_key: string
    codename: unknown
    presentation: unknown
    components: unknown
    ui_config: unknown
    config: unknown
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

export interface CreateEntityTypeInput {
    kindKey: string
    codename: unknown
    presentation?: JsonRecord
    components: ComponentManifest
    ui: EntityTypeUIConfig
    config?: JsonRecord
    published?: boolean
    createdBy?: string | null
}

export interface UpdateEntityTypeInput {
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

const normalizeEntityTypeCodename = (value: unknown): JsonRecord => {
    return ensureCodenameValue(value)
}

const getNormalizedPrimaryCodenameText = (value: unknown): string => {
    return getCodenameText(value).trim().toLowerCase()
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

    let resourceSurfaces: EntityTypeUIConfig['resourceSurfaces']
    try {
        resourceSurfaces = normalizeEntityResourceSurfaceDefinitions(value.resourceSurfaces, { requireFallbackTitle: false })
    } catch (error) {
        throw new MetahubValidationError(error instanceof Error ? error.message : 'Invalid entity resource surface definition')
    }

    return {
        iconName,
        tabs,
        sidebarSection: value.sidebarSection === 'admin' ? 'admin' : 'objects',
        sidebarOrder,
        nameKey,
        descriptionKey:
            typeof value.descriptionKey === 'string' && value.descriptionKey.trim().length > 0 ? value.descriptionKey : undefined,
        resourceSurfaces
    }
}

const validateResourceSurfacesAgainstComponents = (ui: EntityTypeUIConfig, components: ComponentManifest): void => {
    try {
        validateEntityResourceSurfacesAgainstComponents(ui.resourceSurfaces, components)
    } catch (error) {
        throw new MetahubValidationError(error instanceof Error ? error.message : 'Invalid entity resource surface component binding')
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

const canonicalizeJsonValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(canonicalizeJsonValue)
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
                .map(([key, item]) => [key, canonicalizeJsonValue(item)])
        )
    }

    return value ?? null
}

const stableStringify = (value: unknown): string => JSON.stringify(canonicalizeJsonValue(value))

const stripEditableResourceSurfaceLabels = (ui: EntityTypeUIConfig): EntityTypeUIConfig => ({
    ...ui,
    resourceSurfaces: ui.resourceSurfaces?.map((surface) => {
        const { title: _title, titleKey: _titleKey, fallbackTitle: _fallbackTitle, ...structuralSurface } = surface
        return structuralSurface
    })
})

const assertStandardEntityTypeUpdateAllowed = (
    existing: StoredEntityTypeRow,
    next: {
        kindKey: string
        codename: JsonRecord
        components: ComponentManifest
        ui: EntityTypeUIConfig
        config: JsonRecord
        published: boolean
    }
): void => {
    if (!isBuiltinEntityKind(existing.kind_key)) {
        return
    }

    if (next.kindKey !== existing.kind_key) {
        throw new MetahubValidationError('Standard entity kind keys cannot be changed', { kindKey: existing.kind_key })
    }

    if (stableStringify(next.codename) !== stableStringify(normalizeEntityTypeCodename(existing.codename))) {
        throw new MetahubValidationError('Standard entity type codenames cannot be changed', { kindKey: existing.kind_key })
    }

    if (stableStringify(next.components) !== stableStringify(parseStoredComponentManifest(existing.components))) {
        throw new MetahubValidationError('Standard entity type components cannot be changed through the Entities constructor', {
            kindKey: existing.kind_key
        })
    }

    if (stableStringify(next.config) !== stableStringify(ensureJsonRecord(existing.config))) {
        throw new MetahubValidationError('Standard entity type config cannot be changed through the Entities constructor', {
            kindKey: existing.kind_key
        })
    }

    if (next.published !== (existing._mhb_published === true)) {
        throw new MetahubValidationError('Standard entity type publication state cannot be changed through the Entities constructor', {
            kindKey: existing.kind_key
        })
    }

    const nextUiStructure = stripEditableResourceSurfaceLabels(next.ui)
    const existingUiStructure = stripEditableResourceSurfaceLabels(parseStoredUiConfig(existing.ui_config))

    if (stableStringify(nextUiStructure) !== stableStringify(existingUiStructure)) {
        throw new MetahubValidationError('Standard entity type UI structure cannot be changed through the Entities constructor', {
            kindKey: existing.kind_key
        })
    }
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

    private normalizeTypeRow(row: StoredEntityTypeRow): MetahubResolvedEntityType {
        return {
            id: row.id,
            kindKey: row.kind_key as EntityKind,
            components: parseStoredComponentManifest(row.components),
            ui: parseStoredUiConfig(row.ui_config),
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

    private async findTypeRowById(schemaName: string, id: string, db: SqlQueryable = this.exec): Promise<StoredEntityTypeRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityTypeRow>(db, `SELECT * FROM ${qt} WHERE id = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [id])
    }

    async getTypeById(metahubId: string, entityTypeId: string, userId?: string): Promise<MetahubResolvedEntityType | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.findTypeRowById(schemaName, entityTypeId)
        return row ? this.normalizeTypeRow(row) : null
    }

    private async findTypeRowByKindKey(
        schemaName: string,
        kindKey: string,
        db: SqlQueryable = this.exec
    ): Promise<StoredEntityTypeRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityTypeRow>(db, `SELECT * FROM ${qt} WHERE kind_key = $1 AND ${ACTIVE_CLAUSE} LIMIT 1`, [kindKey])
    }

    private async findTypeRowByCodename(
        schemaName: string,
        codename: unknown,
        db: SqlQueryable = this.exec
    ): Promise<StoredEntityTypeRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<StoredEntityTypeRow>(
            db,
            `SELECT * FROM ${qt}
             WHERE LOWER(${codenamePrimaryTextSql('codename')}) = $1 AND ${ACTIVE_CLAUSE}
             LIMIT 1`,
            [getNormalizedPrimaryCodenameText(codename)]
        )
    }

    private rethrowDuplicateConstraint(error: unknown, details: { kindKey: string; codename: unknown; existingId?: string }): never {
        if (!isUniqueViolation(error)) {
            throw error
        }

        const constraint = getDbErrorConstraint(error) ?? ''
        if (constraint === ENTITY_TYPE_KIND_KEY_ACTIVE_CONSTRAINT) {
            throw new MetahubConflictError('Entity type kindKey already exists', {
                kindKey: details.kindKey,
                ...(details.existingId ? { existingId: details.existingId } : {})
            })
        }

        if (constraint === ENTITY_TYPE_CODENAME_ACTIVE_CONSTRAINT) {
            throw new MetahubConflictError('Entity type codename already exists', {
                code: 'CODENAME_CONFLICT',
                kindKey: details.kindKey,
                codename: getCodenameText(details.codename)
            })
        }

        throw error
    }

    async listEditableTypesInSchema(schemaName: string, db: SqlQueryable = this.exec): Promise<MetahubResolvedEntityType[]> {
        const qt = qSchemaTable(schemaName, TABLE)
        const rows = await queryMany<StoredEntityTypeRow>(
            db,
            `SELECT * FROM ${qt} WHERE ${ACTIVE_CLAUSE} ORDER BY kind_key ASC, _upl_created_at ASC, id ASC`
        )

        return rows.map((row) => this.normalizeTypeRow(row))
    }

    async listTypesInSchema(schemaName: string, db: SqlQueryable = this.exec): Promise<MetahubResolvedEntityType[]> {
        const qt = qSchemaTable(schemaName, TABLE)
        const rows = await queryMany<StoredEntityTypeRow>(
            db,
            `SELECT * FROM ${qt} WHERE ${ACTIVE_CLAUSE} ORDER BY kind_key ASC, _upl_created_at ASC, id ASC`
        )

        return rows.map((row) => this.normalizeTypeRow(row))
    }

    async listEditableTypes(metahubId: string, userId?: string): Promise<MetahubResolvedEntityType[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.listEditableTypesInSchema(schemaName)
    }

    async listTypes(metahubId: string, userId?: string): Promise<MetahubResolvedEntityType[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.listTypesInSchema(schemaName)
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
        const typeRow = await this.findTypeRowByKindKey(schemaName, normalizedKindKey, db)
        return typeRow ? this.normalizeTypeRow(typeRow) : null
    }

    async createType(metahubId: string, input: CreateEntityTypeInput, userId?: string): Promise<MetahubResolvedEntityType> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const kindKey = normalizeEntityTypeKindKey(input.kindKey)

        if (isBuiltinEntityKind(kindKey)) {
            throw new MetahubValidationError('Standard entity kinds are reserved for platform-provided entity types', { kindKey })
        }

        const components = normalizeComponentManifest(input.components)
        const ui = normalizeUiConfig(input.ui)
        validateResourceSurfacesAgainstComponents(ui, components)
        const codename = normalizeEntityTypeCodename(input.codename)
        const presentation = ensureJsonRecord(input.presentation)
        const config = ensureJsonRecord(input.config)
        const published = input.published !== false
        const qt = qSchemaTable(schemaName, TABLE)

        return this.exec.transaction(async (tx) => {
            const existingByKindKey = await this.findTypeRowByKindKey(schemaName, kindKey, tx)
            if (existingByKindKey) {
                throw new MetahubConflictError('Entity type kindKey already exists', { kindKey, existingId: existingByKindKey.id })
            }

            const existingByCodename = await this.findTypeRowByCodename(schemaName, codename, tx)
            if (existingByCodename) {
                throw new MetahubConflictError('Entity type codename already exists', {
                    code: 'CODENAME_CONFLICT',
                    kindKey,
                    codename: getCodenameText(codename),
                    existingId: existingByCodename.id
                })
            }

            try {
                const created = await queryOneOrThrow<StoredEntityTypeRow>(
                    tx,
                    `INSERT INTO ${qt} (
                        kind_key,
                        codename,
                        presentation,
                        components,
                        ui_config,
                        config,
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
                              $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb,
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

                return this.normalizeTypeRow(created)
            } catch (error) {
                this.rethrowDuplicateConstraint(error, { kindKey, codename })
            }
        })
    }

    async updateType(
        metahubId: string,
        entityTypeId: string,
        input: UpdateEntityTypeInput,
        userId?: string
    ): Promise<MetahubResolvedEntityType> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findTypeRowById(schemaName, entityTypeId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity type', entityTypeId)
        }

        const nextKindKey = input.kindKey !== undefined ? normalizeEntityTypeKindKey(input.kindKey) : existing.kind_key
        if (!isBuiltinEntityKind(existing.kind_key) && isBuiltinEntityKind(nextKindKey)) {
            throw new MetahubValidationError('Standard entity kinds are reserved for platform-provided entity types', {
                kindKey: nextKindKey
            })
        }

        const nextComponents =
            input.components !== undefined
                ? normalizeComponentManifest(input.components)
                : parseStoredComponentManifest(existing.components)
        const nextUi = input.ui !== undefined ? normalizeUiConfig(input.ui) : parseStoredUiConfig(existing.ui_config)
        validateResourceSurfacesAgainstComponents(nextUi, nextComponents)
        const nextCodename =
            input.codename !== undefined ? normalizeEntityTypeCodename(input.codename) : normalizeEntityTypeCodename(existing.codename)
        const nextPresentation =
            input.presentation !== undefined ? ensureJsonRecord(input.presentation) : ensureJsonRecord(existing.presentation)
        const nextConfig = input.config !== undefined ? ensureJsonRecord(input.config) : ensureJsonRecord(existing.config)
        const nextPublished = input.published !== undefined ? input.published : existing._mhb_published === true
        assertStandardEntityTypeUpdateAllowed(existing, {
            kindKey: nextKindKey,
            codename: nextCodename,
            components: nextComponents,
            ui: nextUi,
            config: nextConfig,
            published: nextPublished
        })

        return this.exec.transaction(async (tx) => {
            const conflictByKindKey = await this.findTypeRowByKindKey(schemaName, nextKindKey, tx)
            if (conflictByKindKey && conflictByKindKey.id !== existing.id) {
                throw new MetahubConflictError('Entity type kindKey already exists', {
                    kindKey: nextKindKey,
                    existingId: conflictByKindKey.id
                })
            }

            const conflictByCodename = await this.findTypeRowByCodename(schemaName, nextCodename, tx)
            if (conflictByCodename && conflictByCodename.id !== existing.id) {
                throw new MetahubConflictError('Entity type codename already exists', {
                    code: 'CODENAME_CONFLICT',
                    kindKey: nextKindKey,
                    codename: getCodenameText(nextCodename),
                    existingId: conflictByCodename.id
                })
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

            try {
                const updated =
                    input.expectedVersion !== undefined
                        ? await updateWithVersionCheck({
                              executor: tx,
                              schemaName,
                              tableName: TABLE,
                              entityId: entityTypeId,
                              entityType: 'entity_type',
                              expectedVersion: input.expectedVersion,
                              updateData,
                              wrapInTransaction: false
                          })
                        : await incrementVersion(tx, schemaName, TABLE, entityTypeId, updateData)

                return this.normalizeTypeRow(updated as unknown as StoredEntityTypeRow)
            } catch (error) {
                this.rethrowDuplicateConstraint(error, { kindKey: nextKindKey, codename: nextCodename, existingId: entityTypeId })
            }
        })
    }

    async deleteType(metahubId: string, entityTypeId: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findTypeRowById(schemaName, entityTypeId)
        if (!existing) {
            throw new MetahubNotFoundError('Entity type', entityTypeId)
        }

        if (isBuiltinEntityKind(existing.kind_key)) {
            throw new MetahubValidationError('Standard entity types are managed by template presets and cannot be deleted', {
                entityTypeId,
                kindKey: existing.kind_key
            })
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

    async findTypeByCodename(metahubId: string, codename: string, userId?: string): Promise<MetahubResolvedEntityType | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        const row = await queryOne<StoredEntityTypeRow>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE ${codenamePrimaryTextSql('codename')} = $1 AND ${ACTIVE_CLAUSE}
             LIMIT 1`,
            [codename]
        )

        return row ? this.normalizeTypeRow(row) : null
    }
}
