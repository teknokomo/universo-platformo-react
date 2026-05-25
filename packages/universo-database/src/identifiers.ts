import { assertCanonicalSchemaName, assertCanonicalIdentifier, quoteIdentifier, quoteQualifiedIdentifier } from '@universo/migrations-core'

/**
 * Quote a validated schema name for use in SQL.
 */
export function qSchema(schema: string): string {
    assertCanonicalSchemaName(schema)
    return quoteIdentifier(schema)
}

/**
 * Quote a validated table name for use in SQL.
 */
export function qTable(table: string): string {
    assertCanonicalIdentifier(table)
    return quoteIdentifier(table)
}

/**
 * Return "schema"."table" with both identifiers validated.
 */
export function qSchemaTable(schema: string, table: string): string {
    return quoteQualifiedIdentifier(schema, table)
}

/**
 * Quote a validated column name for use in SQL.
 */
export function qColumn(column: string): string {
    assertCanonicalIdentifier(column)
    return quoteIdentifier(column)
}
