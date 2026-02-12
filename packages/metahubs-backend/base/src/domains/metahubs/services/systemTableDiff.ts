import type { SystemTableDef, SystemColumnDef, SystemIndexDef, SystemForeignKeyDef } from './systemTableDefinitions'
import { UPL_SYSTEM_FIELDS, MHB_SYSTEM_FIELDS } from './systemTableDefinitions'

// ─── Change types ────────────────────────────────────────────────────────────

export enum SystemChangeType {
    ADD_TABLE = 'ADD_TABLE',
    RENAME_TABLE = 'RENAME_TABLE',
    DROP_TABLE = 'DROP_TABLE',
    ADD_COLUMN = 'ADD_COLUMN',
    DROP_COLUMN = 'DROP_COLUMN',
    ALTER_COLUMN = 'ALTER_COLUMN',
    ADD_INDEX = 'ADD_INDEX',
    RENAME_INDEX = 'RENAME_INDEX',
    DROP_INDEX = 'DROP_INDEX',
    ADD_FK = 'ADD_FK',
    DROP_FK = 'DROP_FK'
}

export interface SystemTableChange {
    type: SystemChangeType
    tableName: string
    fromTableName?: string
    columnName?: string
    indexName?: string
    fromIndexName?: string
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
    const matchedOldTableNames = new Set<string>()
    const tablePairs: Array<{ oldName: string; oldTable: SystemTableDef; newName: string; newTable: SystemTableDef }> = []

    // 1. Resolve table pairs, supporting explicit rename mappings via `renamedFrom`.
    for (const newTable of newTables) {
        const directMatch = oldByName.get(newTable.name)
        if (directMatch) {
            matchedOldTableNames.add(newTable.name)
            tablePairs.push({ oldName: newTable.name, oldTable: directMatch, newName: newTable.name, newTable })
            continue
        }

        const renamedFrom = (newTable.renamedFrom ?? []).find(
            (candidate) => oldByName.has(candidate) && !matchedOldTableNames.has(candidate)
        )
        if (!renamedFrom) {
            diff.additive.push({
                type: SystemChangeType.ADD_TABLE,
                tableName: newTable.name,
                isDestructive: false,
                description: `Add table "${newTable.name}": ${newTable.description}`,
                definition: newTable
            })
            continue
        }

        const oldTable = oldByName.get(renamedFrom)!
        matchedOldTableNames.add(renamedFrom)
        tablePairs.push({ oldName: renamedFrom, oldTable, newName: newTable.name, newTable })
        diff.additive.push({
            type: SystemChangeType.RENAME_TABLE,
            tableName: newTable.name,
            fromTableName: renamedFrom,
            isDestructive: false,
            description: `Rename table "${renamedFrom}" to "${newTable.name}"`
        })
    }

    // 2. Dropped tables (DROP_TABLE) — destructive, not auto-applied
    for (const [oldName] of oldByName) {
        if (matchedOldTableNames.has(oldName)) continue
        diff.destructive.push({
            type: SystemChangeType.DROP_TABLE,
            tableName: oldName,
            isDestructive: true,
            description: `Drop table "${oldName}" (requires manual migration)`
        })
    }

    // 3. Detailed changes for matched table pairs
    for (const pair of tablePairs) {
        diffColumns(diff, pair.newName, pair.oldTable, pair.newTable)
        diffIndexes(diff, pair.newName, pair.oldTable, pair.newTable)
        diffForeignKeys(diff, pair.newName, pair.oldTable, pair.newTable)
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

        // Altered columns — compare type and nullable semantics.
        // Undefined nullable means "nullable" in our DDL model.
        const typeChanged = col.type !== oldCol.type
        const oldIsNullable = oldCol.nullable !== false
        const newIsNullable = col.nullable !== false
        const nullableChanged = oldIsNullable !== newIsNullable

        if (typeChanged || nullableChanged) {
            const details: string[] = []
            if (typeChanged) details.push(`type ${oldCol.type}→${col.type}`)
            if (nullableChanged) details.push(`nullable ${oldIsNullable}→${newIsNullable}`)

            // Type change and nullable tightening (true -> false) are destructive.
            // Nullable relaxation (false -> true) is additive.
            const isDestructive = typeChanged || (oldIsNullable && !newIsNullable)
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
    const oldByName = new Map((oldTable.indexes ?? []).map((idx) => [idx.name, idx]))
    const matchedOldIndexNames = new Set<string>()

    for (const idx of newTable.indexes ?? []) {
        if (oldByName.has(idx.name)) {
            matchedOldIndexNames.add(idx.name)
            continue
        }

        const renamedFrom = (idx.renamedFrom ?? []).find((candidate) => oldByName.has(candidate) && !matchedOldIndexNames.has(candidate))
        if (renamedFrom) {
            matchedOldIndexNames.add(renamedFrom)
            diff.additive.push({
                type: SystemChangeType.RENAME_INDEX,
                tableName,
                indexName: idx.name,
                fromIndexName: renamedFrom,
                isDestructive: false,
                description: `Rename index "${renamedFrom}" to "${idx.name}" on "${tableName}"`
            })
            continue
        }

        diff.additive.push({
            type: SystemChangeType.ADD_INDEX,
            tableName,
            indexName: idx.name,
            isDestructive: false,
            description: `Add index "${idx.name}" on "${tableName}"`,
            definition: idx
        })
    }

    for (const oldIdx of oldTable.indexes ?? []) {
        if (matchedOldIndexNames.has(oldIdx.name)) continue
        diff.destructive.push({
            type: SystemChangeType.DROP_INDEX,
            tableName,
            indexName: oldIdx.name,
            isDestructive: true,
            description: `Drop index "${oldIdx.name}" from "${tableName}" (requires manual migration)`
        })
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
