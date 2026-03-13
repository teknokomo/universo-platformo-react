import type {
    MigrationExecutionContext,
    PlatformMigrationFile,
    SqlMigrationStatement,
    SqlPlatformMigrationDefinition
} from '@universo/migrations-core'

export type { SqlMigrationStatement, SqlPlatformMigrationDefinition } from '@universo/migrations-core'

const buildChecksumSource = (scopeKey: string, definition: SqlPlatformMigrationDefinition) =>
    JSON.stringify({
        kind: 'native-sql-migration',
        scopeKey,
        id: definition.id,
        version: definition.version,
        summary: definition.summary,
        up: definition.up,
        down: definition.down ?? []
    })

const executeStatements = async (
    ctx: MigrationExecutionContext,
    scopeKey: string,
    migrationId: string,
    direction: 'up' | 'down',
    statements: readonly SqlMigrationStatement[]
) => {
    for (const [index, statement] of statements.entries()) {
        if (!statement.warningMessage) {
            await ctx.raw(statement.sql)
            continue
        }

        try {
            await ctx.raw(statement.sql)
        } catch (error) {
            ctx.logger.warn(statement.warningMessage, {
                scopeKey,
                migrationId,
                direction,
                statementIndex: index,
                error: error instanceof Error ? error.message : String(error)
            })
        }
    }
}

export const createPlatformMigrationFromSqlDefinition = (
    definition: SqlPlatformMigrationDefinition,
    scopeKey: string
): PlatformMigrationFile => ({
    id: definition.id,
    version: definition.version,
    scope: {
        kind: 'platform_schema',
        key: scopeKey
    },
    sourceKind: 'file',
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: definition.summary,
    checksumSource: buildChecksumSource(scopeKey, definition),
    async up(ctx: MigrationExecutionContext) {
        await executeStatements(ctx, scopeKey, definition.id, 'up', definition.up)
    },
    down: definition.down
        ? async (ctx: MigrationExecutionContext) => {
              await executeStatements(ctx, scopeKey, definition.id, 'down', definition.down ?? [])
          }
        : undefined
})
