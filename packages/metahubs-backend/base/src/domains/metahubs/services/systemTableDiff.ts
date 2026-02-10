import type { SystemTableDef, SystemColumnDef, SystemIndexDef, SystemForeignKeyDef } from './systemTableDefinitions'
import { UPL_SYSTEM_FIELDS, MHB_SYSTEM_FIELDS } from './systemTableDefinitions'

// ─── Change types ────────────────────────────────────────────────────────────

export enum SystemChangeType {
    ADD_TABLE = 'ADD_TABLE',
    DROP_TABLE = 'DROP_TABLE',
    ADD_COLUMN = 'ADD_COLUMN',
    DROP_COLUMN = 'DROP_COLUMN',
    ALTER_COLUMN = 'ALTER_COLUMN',
    ADD_INDEX = 'ADD_INDEX',
    DROP_INDEX = 'DROP_INDEX',
    ADD_FK = 'ADD_FK',
    DROP_FK = 'DROP_FK'
}

export interface SystemTableChange {
    type: SystemChangeType
    tableName: string
    columnName?: string
    indexName?: string
    /** True if this change removes data or structure. */
    isDestructive: boolean
    description: string
    /** The new definition (for ADD_TABLE, ADD_COLUMN, ADD_INDEX, ALTER_COLUMN). */
    definition?: SystemTableDef | SystemColumnDef | SystemIndexDef
    /** FK definition (for ADD_FK / DROP_FK changes). */
    fkDef?: SystemForeignKeyDef
}

export interface SystemTableDiff {
    hasChanges: boolean
    fromVersion: number
    toVersion: number
    additive: SystemTableChange[]
    destructive: SystemTableChange[]
    summary: string
}

// ─── Diff engine ─────────────────────────────────────────────────────────────

/**
 * Computes all columns for a table (own + shared system fields).
 */
function getAllColumns(table: SystemTableDef): SystemColumnDef[] {
    return [...table.columns, ...UPL_SYSTEM_FIELDS, ...MHB_SYSTEM_FIELDS]
}

/**
 * Calculate the diff between two structure versions.
 *
 * Compares old and new table definitions and produces a list of
 * additive and destructive changes. Only additive changes (ADD_TABLE,
 * ADD_COLUMN, ADD_INDEX, ADD_FK) are applied automatically during
 * migration; destructive changes are logged as warnings.
 */
export function calculateSystemTableDiff(
    oldTables: readonly SystemTableDef[],
    newTables: readonly SystemTableDef[],
    fromVersion: number,
    toVersion: number
): SystemTableDiff {
    const diff: SystemTableDiff = {
        hasChanges: false,
        fromVersion,
        toVersion,
        additive: [],
        destructive: [],
        summary: ''
    }

    const oldByName = new Map(oldTables.map((t) => [t.name, t]))
    const newByName = new Map(newTables.map((t) => [t.name, t]))

    // 1. New tables (ADD_TABLE)
    for (const [name, newTable] of newByName) {
        if (!oldByName.has(name)) {
            diff.additive.push({
                type: SystemChangeType.ADD_TABLE,
                tableName: name,
                isDestructive: false,
                description: `Add table "${name}": ${newTable.description}`,
                definition: newTable
            })
        }
    }

    // 2. Dropped tables (DROP_TABLE) — destructive, not auto-applied
    for (const [name] of oldByName) {
        if (!newByName.has(name)) {
            diff.destructive.push({
                type: SystemChangeType.DROP_TABLE,
                tableName: name,
                isDestructive: true,
                description: `Drop table "${name}" (requires manual migration)`
            })
        }
    }

    // 3. Detailed changes for tables that exist in both versions
    for (const [name, newTable] of newByName) {
        const oldTable = oldByName.get(name)
        if (!oldTable) continue

        diffColumns(diff, name, oldTable, newTable)
        diffIndexes(diff, name, oldTable, newTable)
        diffForeignKeys(diff, name, oldTable, newTable)
    }

    diff.hasChanges = diff.additive.length > 0 || diff.destructive.length > 0

    const parts: string[] = []
    if (diff.additive.length > 0) parts.push(`${diff.additive.length} additive`)
    if (diff.destructive.length > 0) parts.push(`${diff.destructive.length} DESTRUCTIVE`)
    diff.summary = parts.length === 0 ? 'No changes' : `V${fromVersion}→V${toVersion}: ${parts.join(', ')}`

    return diff
}

// ─── Column diff ─────────────────────────────────────────────────────────────

function diffColumns(diff: SystemTableDiff, tableName: string, oldTable: SystemTableDef, newTable: SystemTableDef): void {
    const oldCols = new Map(getAllColumns(oldTable).map((c) => [c.name, c]))
    const newCols = getAllColumns(newTable)
    const newColNames = new Set(newCols.map((c) => c.name))

    // Added columns
    for (const col of newCols) {
        const oldCol = oldCols.get(col.name)
        if (!oldCol) {
            diff.additive.push({
                type: SystemChangeType.ADD_COLUMN,
                tableName,
                columnName: col.name,
                isDestructive: false,
                description: `Add column "${col.name}" (${col.type}) to "${tableName}"`,
                definition: col
            })
            continue
        }

        // Altered columns — compare type and nullable
        const typeChanged = col.type !== oldCol.type
        const nullableChanged = Boolean(col.nullable) !== Boolean(oldCol.nullable)

        if (typeChanged || nullableChanged) {
            const details: string[] = []
            if (typeChanged) details.push(`type ${oldCol.type}→${col.type}`)
            if (nullableChanged) details.push(`nullable ${oldCol.nullable ?? true}→${col.nullable ?? true}`)

            // Type change is destructive; nullable-only change is additive
            const isDestructive = typeChanged
            const target = isDestructive ? diff.destructive : diff.additive
            target.push({
                type: SystemChangeType.ALTER_COLUMN,
                tableName,
                columnName: col.name,
                isDestructive,
                description: `Alter column "${col.name}" in "${tableName}": ${details.join(', ')}`,
                definition: col
            })
        }
    }

    // Dropped columns
    for (const [colName] of oldCols) {
        if (!newColNames.has(colName)) {
            diff.destructive.push({
                type: SystemChangeType.DROP_COLUMN,
                tableName,
                columnName: colName,
                isDestructive: true,
                description: `Drop column "${colName}" from "${tableName}" (requires manual migration)`
            })
        }
    }
}

// ─── Index diff ──────────────────────────────────────────────────────────────

function diffIndexes(diff: SystemTableDiff, tableName: string, oldTable: SystemTableDef, newTable: SystemTableDef): void {
    const oldIdxNames = new Set((oldTable.indexes ?? []).map((i) => i.name))
    const newIdxNames = new Set((newTable.indexes ?? []).map((i) => i.name))

    for (const idx of newTable.indexes ?? []) {
        if (!oldIdxNames.has(idx.name)) {
            diff.additive.push({
                type: SystemChangeType.ADD_INDEX,
                tableName,
                indexName: idx.name,
                isDestructive: false,
                description: `Add index "${idx.name}" on "${tableName}"`,
                definition: idx
            })
        }
    }

    for (const idx of oldTable.indexes ?? []) {
        if (!newIdxNames.has(idx.name)) {
            diff.destructive.push({
                type: SystemChangeType.DROP_INDEX,
                tableName,
                indexName: idx.name,
                isDestructive: true,
                description: `Drop index "${idx.name}" from "${tableName}" (requires manual migration)`
            })
        }
    }
}

// ─── Foreign key diff ────────────────────────────────────────────────────────

/** Produces a stable identity key for a FK definition. */
function fkIdentity(fk: SystemForeignKeyDef): string {
    return `${fk.column}->${fk.referencesTable}.${fk.referencesColumn}`
}

function diffForeignKeys(diff: SystemTableDiff, tableName: string, oldTable: SystemTableDef, newTable: SystemTableDef): void {
    const oldFKs = new Map((oldTable.foreignKeys ?? []).map((fk) => [fkIdentity(fk), fk]))
    const newFKs = new Map((newTable.foreignKeys ?? []).map((fk) => [fkIdentity(fk), fk]))

    for (const [key, fk] of newFKs) {
        if (!oldFKs.has(key)) {
            diff.additive.push({
                type: SystemChangeType.ADD_FK,
                tableName,
                columnName: fk.column,
                isDestructive: false,
                description: `Add FK "${fk.column}" → "${fk.referencesTable}.${fk.referencesColumn}" on "${tableName}"`,
                fkDef: fk
            })
        }
    }

    for (const [key, fk] of oldFKs) {
        if (!newFKs.has(key)) {
            diff.destructive.push({
                type: SystemChangeType.DROP_FK,
                tableName,
                columnName: fk.column,
                isDestructive: true,
                description: `Drop FK "${fk.column}" from "${tableName}" (requires manual migration)`,
                fkDef: fk
            })
        }
    }
}
