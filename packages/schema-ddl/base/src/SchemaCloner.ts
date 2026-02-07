import type { Knex } from 'knex'
import { isValidSchemaName } from './naming'

const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/

const quoteIdentifier = (identifier: string): string => {
    if (!IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(`Unsafe identifier: ${identifier}`)
    }
    return `"${identifier}"`
}

const toRows = <T>(result: unknown): T[] => {
    if (Array.isArray(result)) return result as T[]
    if (result && typeof result === 'object') {
        const asObject = result as { rows?: unknown; 0?: unknown }
        if (Array.isArray(asObject.rows)) return asObject.rows as T[]
        if (Array.isArray(asObject[0])) return asObject[0] as T[]
    }
    return []
}

const ensureSafeSchemaName = (schemaName: string): void => {
    if (!isValidSchemaName(schemaName) || !IDENTIFIER_REGEX.test(schemaName)) {
        throw new Error(`Invalid schema name format: ${schemaName}`)
    }
}

const mapPgBindingsToKnex = (sql: string, params: unknown[]): { sql: string; params: unknown[] } => {
    if (params.length === 0 || !/\$\d+/.test(sql)) {
        return { sql, params }
    }

    const mappedParams: unknown[] = []
    const mappedSql = sql.replace(/\$(\d+)/g, (_match, group: string) => {
        const index = Number(group) - 1
        if (!Number.isInteger(index) || index < 0 || index >= params.length) {
            throw new Error(`Invalid SQL binding index: $${group}`)
        }
        mappedParams.push(params[index])
        return '?'
    })

    return { sql: mappedSql, params: mappedParams }
}

const IDENTIFIER_TOKEN_PATTERN = `(?:"(?:[^"]|"")+"|[a-z_][a-z0-9_]*)`
const REFERENCES_CLAUSE_REGEX = new RegExp(
    `REFERENCES\\s+(ONLY\\s+)?(?:(${IDENTIFIER_TOKEN_PATTERN})\\s*\\.\\s*)?(${IDENTIFIER_TOKEN_PATTERN})`,
    'gi'
)

const normalizeIdentifierToken = (token: string): string => {
    if (token.startsWith('"') && token.endsWith('"')) {
        return token.slice(1, -1).replace(/""/g, '"')
    }
    return token
}

const qualifyForeignKeyConstraint = (constraintDefinition: string, sourceSchema: string, targetSchema: string): string => {
    return constraintDefinition.replace(
        REFERENCES_CLAUSE_REGEX,
        (_fullMatch, onlyClause: string | undefined, schemaToken: string | undefined, tableToken: string) => {
            const referencedSchema = schemaToken ? normalizeIdentifierToken(schemaToken) : undefined

            // Keep explicit cross-schema references that do not point to the source/target runtime schema.
            if (referencedSchema && referencedSchema !== sourceSchema && referencedSchema !== targetSchema) {
                return _fullMatch
            }

            const normalizedOnly = onlyClause ?? ''
            return `REFERENCES ${normalizedOnly}"${targetSchema}".${tableToken}`
        }
    )
}

export interface SchemaCloneExecutor {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface CloneSchemaOptions {
    sourceSchema: string
    targetSchema: string
    dropTargetSchemaIfExists?: boolean
    createTargetSchema?: boolean
    copyData?: boolean
}

/**
 * Clones all base tables and data from source schema to target schema.
 * Foreign keys are recreated after data copy to avoid ordering issues on INSERT.
 */
export async function cloneSchemaWithExecutor(executor: SchemaCloneExecutor, options: CloneSchemaOptions): Promise<void> {
    const { sourceSchema, targetSchema, dropTargetSchemaIfExists = false, createTargetSchema = true, copyData = true } = options

    ensureSafeSchemaName(sourceSchema)
    ensureSafeSchemaName(targetSchema)

    const sourceSchemaIdent = quoteIdentifier(sourceSchema)
    const targetSchemaIdent = quoteIdentifier(targetSchema)

    if (dropTargetSchemaIfExists) {
        await executor.query(`DROP SCHEMA IF EXISTS ${targetSchemaIdent} CASCADE`)
    }

    if (createTargetSchema) {
        await executor.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchemaIdent}`)
    }

    const sourceTables = await executor.query<{ table_name: string }>(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
        `,
        [sourceSchema]
    )

    for (const table of sourceTables) {
        const tableName = table.table_name
        const tableIdent = quoteIdentifier(tableName)

        await executor.query(`
            CREATE TABLE ${targetSchemaIdent}.${tableIdent}
            (LIKE ${sourceSchemaIdent}.${tableIdent} INCLUDING ALL)
        `)

        if (copyData) {
            await executor.query(`
                INSERT INTO ${targetSchemaIdent}.${tableIdent}
                SELECT * FROM ${sourceSchemaIdent}.${tableIdent}
            `)
        }
    }

    const foreignKeys = await executor.query<{
        table_name: string
        constraint_name: string
        constraint_definition: string
    }>(
        `
        SELECT
            rel.relname AS table_name,
            con.conname AS constraint_name,
            pg_get_constraintdef(con.oid, true) AS constraint_definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = $1
          AND con.contype = 'f'
        ORDER BY rel.relname, con.conname
        `,
        [sourceSchema]
    )

    for (const fk of foreignKeys) {
        const tableName = fk.table_name
        const constraintName = fk.constraint_name
        const tableIdent = quoteIdentifier(tableName)
        const constraintIdent = quoteIdentifier(constraintName)

        const existing = await executor.query<{ exists: boolean }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
                WHERE nsp.nspname = $1
                  AND rel.relname = $2
                  AND con.conname = $3
            ) AS exists
            `,
            [targetSchema, tableName, constraintName]
        )

        if (existing[0]?.exists) {
            continue
        }

        const definition = qualifyForeignKeyConstraint(fk.constraint_definition, sourceSchema, targetSchema)
        await executor.query(`ALTER TABLE ${targetSchemaIdent}.${tableIdent} ADD CONSTRAINT ${constraintIdent} ${definition}`)
    }
}

/**
 * Knex-backed schema cloner adapter.
 */
export class SchemaCloner {
    private executor: SchemaCloneExecutor

    constructor(private knex: Knex) {
        this.executor = {
            query: async <T>(sql: string, params: unknown[] = []) => {
                const mapped = mapPgBindingsToKnex(sql, params)
                const rawResult = await this.knex.raw(mapped.sql, mapped.params)
                return toRows<T>(rawResult)
            }
        }
    }

    async clone(options: CloneSchemaOptions): Promise<void> {
        await cloneSchemaWithExecutor(this.executor, options)
    }
}
