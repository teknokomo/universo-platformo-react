/**
 * Declarative definitions for system tables in metahub dynamic schemas.
 *
 * Instead of imperative Knex code, each table is described as a typed data structure.
 * A DDL generator converts these definitions into SQL via Knex schema builder.
 *
 * Shared field sets (_upl_* and _mhb_*) are defined once and applied to all tables.
 */

// ─── Column types ────────────────────────────────────────────────────────────

export type SystemColumnType = 'uuid' | 'string' | 'text' | 'integer' | 'boolean' | 'jsonb' | 'timestamptz'

export interface SystemColumnDef {
    name: string
    type: SystemColumnType
    /** String max length (only for 'string' type) */
    length?: number
    nullable?: boolean
    /** Default value expression (Knex-compatible). Use '$uuid_v7' for uuid_generate_v7(). Use '$now' for fn.now(). */
    defaultTo?: string | number | boolean | '$uuid_v7' | '$now'
    primary?: boolean
    index?: boolean
}

export interface SystemForeignKeyDef {
    column: string
    /** Reference table name (without schema prefix — resolved at runtime). */
    referencesTable: string
    referencesColumn: string
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export interface SystemIndexDef {
    name: string
    columns: string[]
    unique?: boolean
    /** Previous index names (used to detect explicit index rename migrations). */
    renamedFrom?: string[]
    /** Optional raw WHERE clause for partial indexes. */
    where?: string
    /** Index method (default: btree). */
    method?: 'btree' | 'gin'
}

export interface SystemTableDef {
    name: string
    /** Previous table names (used to detect explicit table rename migrations). */
    renamedFrom?: string[]
    description: string
    /** Own columns (excluding shared _upl_* / _mhb_* fields). */
    columns: SystemColumnDef[]
    foreignKeys?: SystemForeignKeyDef[]
    /** Named indexes (created as raw SQL). */
    indexes?: SystemIndexDef[]
    /** Unique constraints on column groups. */
    uniqueConstraints?: string[][]
}

// ─── Shared system field sets ────────────────────────────────────────────────

/**
 * Platform-level audit fields (_upl_*).
 * Present in every system table.
 */
export const UPL_SYSTEM_FIELDS: SystemColumnDef[] = [
    { name: '_upl_created_at', type: 'timestamptz', nullable: false, defaultTo: '$now' },
    { name: '_upl_created_by', type: 'uuid', nullable: true },
    { name: '_upl_updated_at', type: 'timestamptz', nullable: false, defaultTo: '$now' },
    { name: '_upl_updated_by', type: 'uuid', nullable: true },
    { name: '_upl_version', type: 'integer', nullable: false, defaultTo: 1 },
    { name: '_upl_archived', type: 'boolean', nullable: false, defaultTo: false },
    { name: '_upl_archived_at', type: 'timestamptz', nullable: true },
    { name: '_upl_archived_by', type: 'uuid', nullable: true },
    { name: '_upl_deleted', type: 'boolean', nullable: false, defaultTo: false },
    { name: '_upl_deleted_at', type: 'timestamptz', nullable: true },
    { name: '_upl_deleted_by', type: 'uuid', nullable: true },
    { name: '_upl_purge_after', type: 'timestamptz', nullable: true },
    { name: '_upl_locked', type: 'boolean', nullable: false, defaultTo: false },
    { name: '_upl_locked_at', type: 'timestamptz', nullable: true },
    { name: '_upl_locked_by', type: 'uuid', nullable: true },
    { name: '_upl_locked_reason', type: 'text', nullable: true }
]

/**
 * Metahub-level lifecycle fields (_mhb_*).
 * Present in every system table.
 */
export const MHB_SYSTEM_FIELDS: SystemColumnDef[] = [
    { name: '_mhb_published', type: 'boolean', nullable: false, defaultTo: true },
    { name: '_mhb_published_at', type: 'timestamptz', nullable: true },
    { name: '_mhb_published_by', type: 'uuid', nullable: true },
    { name: '_mhb_archived', type: 'boolean', nullable: false, defaultTo: false },
    { name: '_mhb_archived_at', type: 'timestamptz', nullable: true },
    { name: '_mhb_archived_by', type: 'uuid', nullable: true },
    { name: '_mhb_deleted', type: 'boolean', nullable: false, defaultTo: false },
    { name: '_mhb_deleted_at', type: 'timestamptz', nullable: true },
    { name: '_mhb_deleted_by', type: 'uuid', nullable: true }
]

// ─── V1 System table definitions ─────────────────────────────────────────────

const mhbObjects: SystemTableDef = {
    name: '_mhb_objects',
    description: 'Unified registry for all object types (Catalogs, Hubs, Documents)',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'kind', type: 'string', nullable: false, index: true },
        { name: 'codename', type: 'string', nullable: false },
        { name: 'table_name', type: 'string', nullable: true },
        { name: 'presentation', type: 'jsonb', defaultTo: '{}' },
        { name: 'config', type: 'jsonb', defaultTo: '{}' }
    ],
    indexes: [
        {
            name: 'idx_mhb_objects_kind_codename_active',
            columns: ['kind', 'codename'],
            unique: true,
            where: '_upl_deleted = false AND _mhb_deleted = false'
        },
        {
            name: 'idx_mhb_objects_mhb_deleted',
            columns: ['_mhb_deleted_at'],
            where: '_mhb_deleted = true'
        },
        {
            name: 'idx_mhb_objects_upl_deleted',
            columns: ['_upl_deleted_at'],
            where: '_upl_deleted = true'
        }
    ]
}

const mhbAttributes: SystemTableDef = {
    name: '_mhb_attributes',
    description: 'Field definitions for objects',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'object_id', type: 'uuid', nullable: false },
        { name: 'codename', type: 'string', nullable: false },
        { name: 'data_type', type: 'string', nullable: false },
        { name: 'presentation', type: 'jsonb', defaultTo: '{}' },
        { name: 'validation_rules', type: 'jsonb', defaultTo: '{}' },
        { name: 'ui_config', type: 'jsonb', defaultTo: '{}' },
        { name: 'sort_order', type: 'integer', defaultTo: 0 },
        { name: 'is_required', type: 'boolean', defaultTo: false },
        { name: 'is_display_attribute', type: 'boolean', defaultTo: false },
        { name: 'target_object_id', type: 'uuid', nullable: true },
        { name: 'target_object_kind', type: 'string', length: 20, nullable: true }
    ],
    foreignKeys: [{ column: 'object_id', referencesTable: '_mhb_objects', referencesColumn: 'id', onDelete: 'CASCADE' }],
    indexes: [
        { name: 'idx_mhb_attributes_object_id', columns: ['object_id'] },
        { name: 'idx_mhb_attributes_target_object_id', columns: ['target_object_id'] },
        {
            name: 'idx_mhb_attributes_object_codename_active',
            columns: ['object_id', 'codename'],
            unique: true,
            where: '_upl_deleted = false AND _mhb_deleted = false'
        }
    ]
}

const mhbElements: SystemTableDef = {
    name: '_mhb_elements',
    description: 'Predefined data for catalogs',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'object_id', type: 'uuid', nullable: false },
        { name: 'data', type: 'jsonb', nullable: false, defaultTo: '{}' },
        { name: 'sort_order', type: 'integer', defaultTo: 0 },
        { name: 'owner_id', type: 'uuid', nullable: true }
    ],
    foreignKeys: [{ column: 'object_id', referencesTable: '_mhb_objects', referencesColumn: 'id', onDelete: 'CASCADE' }],
    indexes: [
        { name: 'idx_mhb_elements_object_id', columns: ['object_id'] },
        { name: 'idx_mhb_elements_object_sort', columns: ['object_id', 'sort_order'] },
        { name: 'idx_mhb_elements_owner_id', columns: ['owner_id'] },
        { name: 'idx_mhb_elements_data_gin', columns: ['data'], method: 'gin' },
        {
            name: 'idx_mhb_elements_mhb_deleted',
            columns: ['_mhb_deleted_at'],
            where: '_mhb_deleted = true'
        },
        {
            name: 'idx_mhb_elements_upl_deleted',
            columns: ['_upl_deleted_at'],
            where: '_upl_deleted = true'
        }
    ]
}

const mhbSettings: SystemTableDef = {
    name: '_mhb_settings',
    description: 'Metahub branch settings (key-value pairs)',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'key', type: 'string', length: 100, nullable: false },
        { name: 'value', type: 'jsonb', nullable: false, defaultTo: '{}' }
    ],
    uniqueConstraints: [['key']]
}

const mhbLayouts: SystemTableDef = {
    name: '_mhb_layouts',
    description: 'UI layouts for published Applications',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'template_key', type: 'string', length: 100, nullable: false, defaultTo: 'dashboard' },
        { name: 'name', type: 'jsonb', nullable: false, defaultTo: '{}' },
        { name: 'description', type: 'jsonb', nullable: true },
        { name: 'config', type: 'jsonb', nullable: false, defaultTo: '{}' },
        { name: 'is_active', type: 'boolean', nullable: false, defaultTo: true },
        { name: 'is_default', type: 'boolean', nullable: false, defaultTo: false },
        { name: 'sort_order', type: 'integer', nullable: false, defaultTo: 0 },
        { name: 'owner_id', type: 'uuid', nullable: true }
    ],
    indexes: [
        { name: 'idx_mhb_layouts_template_key', columns: ['template_key'] },
        { name: 'idx_mhb_layouts_is_active', columns: ['is_active'] },
        { name: 'idx_mhb_layouts_is_default', columns: ['is_default'] },
        { name: 'idx_mhb_layouts_sort_order', columns: ['sort_order'] },
        {
            name: 'idx_mhb_layouts_default_active',
            columns: ['is_default'],
            unique: true,
            where: 'is_default = true AND _upl_deleted = false AND _mhb_deleted = false'
        }
    ]
}

const mhbLayoutZoneWidgets: SystemTableDef = {
    name: '_mhb_layout_zone_widgets',
    description: 'Widget assignments per layout zone',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'layout_id', type: 'uuid', nullable: false },
        { name: 'zone', type: 'string', length: 20, nullable: false },
        { name: 'widget_key', type: 'string', length: 100, nullable: false },
        { name: 'sort_order', type: 'integer', nullable: false, defaultTo: 1 },
        { name: 'config', type: 'jsonb', nullable: false, defaultTo: '{}' }
    ],
    foreignKeys: [{ column: 'layout_id', referencesTable: '_mhb_layouts', referencesColumn: 'id', onDelete: 'CASCADE' }],
    indexes: [
        { name: 'idx_mhb_layout_zone_widgets_layout_id', columns: ['layout_id'] },
        { name: 'idx_mhb_layout_zone_widgets_layout_zone_sort', columns: ['layout_id', 'zone', 'sort_order'] }
    ]
}

const mhbMigrations: SystemTableDef = {
    name: '_mhb_migrations',
    description: 'Metahub structure migration history',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'name', type: 'string', length: 255, nullable: false },
        { name: 'applied_at', type: 'timestamptz', nullable: false, defaultTo: '$now' },
        { name: 'from_version', type: 'integer', nullable: false },
        { name: 'to_version', type: 'integer', nullable: false },
        { name: 'meta', type: 'jsonb', nullable: false, defaultTo: '{}' }
    ],
    indexes: [{ name: 'idx_mhb_migrations_applied_at', columns: ['applied_at'] }],
    uniqueConstraints: [['name']]
}

const mhbWidgets: SystemTableDef = {
    name: '_mhb_widgets',
    renamedFrom: ['_mhb_layout_zone_widgets'],
    description: 'Widget assignments per layout zone',
    columns: [
        { name: 'id', type: 'uuid', primary: true, defaultTo: '$uuid_v7' },
        { name: 'layout_id', type: 'uuid', nullable: false },
        { name: 'zone', type: 'string', length: 20, nullable: false },
        { name: 'widget_key', type: 'string', length: 100, nullable: false },
        { name: 'sort_order', type: 'integer', nullable: false, defaultTo: 1 },
        { name: 'config', type: 'jsonb', nullable: false, defaultTo: '{}' }
    ],
    foreignKeys: [{ column: 'layout_id', referencesTable: '_mhb_layouts', referencesColumn: 'id', onDelete: 'CASCADE' }],
    indexes: [
        { name: 'idx_mhb_widgets_layout_id', renamedFrom: ['idx_mhb_layout_zone_widgets_layout_id'], columns: ['layout_id'] },
        {
            name: 'idx_mhb_widgets_layout_zone_sort',
            renamedFrom: ['idx_mhb_layout_zone_widgets_layout_zone_sort'],
            columns: ['layout_id', 'zone', 'sort_order']
        }
    ]
}

// ─── Version registry ────────────────────────────────────────────────────────

/**
 * Structure version 1 — baseline system tables, including migration history.
 */
export const SYSTEM_TABLES_V1: SystemTableDef[] = [
    mhbObjects,
    mhbAttributes,
    mhbElements,
    mhbSettings,
    mhbLayouts,
    mhbLayoutZoneWidgets,
    mhbMigrations
]

/**
 * Structure version 2 — `_mhb_layout_zone_widgets` renamed to `_mhb_widgets`.
 */
export const SYSTEM_TABLES_V2: SystemTableDef[] = [
    mhbObjects,
    mhbAttributes,
    mhbElements,
    mhbSettings,
    mhbLayouts,
    mhbWidgets,
    mhbMigrations
]

/**
 * Maps a structure version number to its table definitions.
 * Each entry is the COMPLETE set of tables for that version.
 *
 * When adding a new version, list ALL tables from the previous version plus new ones.
 * The diff engine compares consecutive versions to produce migrations.
 */
export const SYSTEM_TABLE_VERSIONS: ReadonlyMap<number, readonly SystemTableDef[]> = new Map([
    [1, SYSTEM_TABLES_V1],
    [2, SYSTEM_TABLES_V2]
])

export interface SystemStructureSnapshotTable {
    name: string
    columns: SystemColumnDef[]
    indexes: SystemIndexDef[]
    foreignKeys: SystemForeignKeyDef[]
    uniqueConstraints: string[][]
}

export interface SystemStructureSnapshot {
    version: number
    tables: SystemStructureSnapshotTable[]
}

const cloneColumn = (column: SystemColumnDef): SystemColumnDef => ({ ...column })
const cloneIndex = (index: SystemIndexDef): SystemIndexDef => ({ ...index, columns: [...index.columns] })
const cloneForeignKey = (foreignKey: SystemForeignKeyDef): SystemForeignKeyDef => ({ ...foreignKey })

/**
 * Builds a JSON-safe structure snapshot from declarative system table definitions.
 * Returns null if the structure version is unknown.
 */
export function buildSystemStructureSnapshot(version: number): SystemStructureSnapshot | null {
    const definitions = SYSTEM_TABLE_VERSIONS.get(version)
    if (!definitions) return null

    return {
        version,
        tables: definitions.map((table) => ({
            name: table.name,
            columns: table.columns.map(cloneColumn),
            indexes: (table.indexes ?? []).map(cloneIndex),
            foreignKeys: (table.foreignKeys ?? []).map(cloneForeignKey),
            uniqueConstraints: (table.uniqueConstraints ?? []).map((constraint) => [...constraint])
        }))
    }
}

// ─── Shared column builder ───────────────────────────────────────────────────

/**
 * Builds a raw CREATE INDEX SQL statement from a SystemIndexDef.
 * Shared helper used by both SystemTableDDLGenerator and SystemTableMigrator.
 *
 * @param schemaName - Target schema
 * @param tableName  - Table to index
 * @param idx        - Index definition
 * @returns Complete SQL string ready for knex.raw()
 */
export function buildIndexSQL(schemaName: string, tableName: string, idx: SystemIndexDef): string {
    const qualifiedTable = `"${schemaName}"."${tableName}"`
    const colExpr = idx.columns.map((c) => `"${c}"`).join(', ')
    const uniqueStr = idx.unique ? 'UNIQUE ' : ''
    const methodStr = idx.method === 'gin' ? ' USING GIN' : ''
    const whereStr = idx.where ? ` WHERE ${idx.where}` : ''

    return `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${idx.name}" ON ${qualifiedTable}${methodStr}(${colExpr})${whereStr}`
}

/**
 * Builds a Knex column from a SystemColumnDef on a table builder.
 *
 * @param t - Knex table builder (CreateTableBuilder or AlterTableBuilder)
 * @param col - Column definition
 * @param knex - Knex instance (for raw defaults)
 * @param forceNullable - If true, always makes the column nullable (used for ALTER TABLE migrations)
 */
export function buildColumnOnTable(
    t: import('knex').Knex.CreateTableBuilder,
    col: SystemColumnDef,
    knex: import('knex').Knex,
    forceNullable?: boolean
): void {
    let chain: import('knex').Knex.ColumnBuilder

    switch (col.type) {
        case 'uuid':
            chain = t.uuid(col.name)
            break
        case 'string':
            chain = col.length ? t.string(col.name, col.length) : t.string(col.name)
            break
        case 'text':
            chain = t.text(col.name)
            break
        case 'integer':
            chain = t.integer(col.name)
            break
        case 'boolean':
            chain = t.boolean(col.name)
            break
        case 'jsonb':
            chain = t.jsonb(col.name)
            break
        case 'timestamptz':
            chain = t.timestamp(col.name, { useTz: true })
            break
        default:
            throw new Error(`Unsupported column type: ${col.type as string}`)
    }

    if (col.primary && !forceNullable) {
        chain = chain.primary()
    }

    if (forceNullable) {
        chain = chain.nullable()
    } else if (col.nullable === false) {
        chain = chain.notNullable()
    } else if (col.nullable === true) {
        chain = chain.nullable()
    }

    if (col.defaultTo !== undefined) {
        if (col.defaultTo === '$uuid_v7') {
            chain.defaultTo(knex.raw('public.uuid_generate_v7()'))
        } else if (col.defaultTo === '$now') {
            chain.defaultTo(knex.fn.now())
        } else {
            chain.defaultTo(col.defaultTo as import('knex').Knex.Value)
        }
    }
}
