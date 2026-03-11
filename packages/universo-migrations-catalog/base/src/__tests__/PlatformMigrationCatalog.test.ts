import { catalogBootstrapMigrations } from '../catalogBootstrapMigrations'
import { PlatformMigrationCatalog } from '../PlatformMigrationCatalog'

type StoredRow = Record<string, unknown>

const matchesWhere = (row: StoredRow, criteria: Record<string, unknown>) =>
    Object.entries(criteria).every(([key, value]) => row[key] === value)

const createCallableKnex = (options?: { migrationRunsTableExists?: boolean }) => {
    const rows: StoredRow[] = []
    let migrationRunsTableExists = options?.migrationRunsTableExists ?? false

    const createQueryBuilder = () => {
        let filteredRows = rows

        return {
            where(criteria: Record<string, unknown>) {
                filteredRows = rows.filter((row) => matchesWhere(row, criteria))
                return this
            },
            orderBy() {
                return this
            },
            async first() {
                return filteredRows.at(-1)
            },
            async insert(row: StoredRow) {
                rows.push(row)
            },
            async update(patch: StoredRow) {
                for (const row of filteredRows) {
                    Object.assign(row, patch)
                }
            }
        }
    }

    const raw = jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.tables') && sql.includes("table_name = 'migration_runs'")) {
            return { rows: [{ exists: migrationRunsTableExists }] }
        }

        if (sql.includes('CREATE TABLE IF NOT EXISTS upl_migrations.migration_runs')) {
            migrationRunsTableExists = true
        }

        return { rows: [] }
    })

    const trx = Object.assign(
        jest.fn(() => createQueryBuilder()),
        {
            raw,
            isTransaction: true
        }
    )

    const knex = Object.assign(
        jest.fn(() => createQueryBuilder()),
        {
            raw,
            transaction: jest.fn(async (callback: (trxArg: typeof trx) => Promise<void>) => callback(trx))
        }
    )

    return {
        knex,
        rows,
        raw
    }
}

describe('PlatformMigrationCatalog', () => {
    it('bootstraps and records all catalog support migrations in migration_runs', async () => {
        const { knex, rows, raw } = createCallableKnex()
        const catalog = new PlatformMigrationCatalog(knex as never)

        await catalog.ensureStorage()

        const appliedBootstrapRows = rows.filter((row) => row.status === 'applied')
        expect(appliedBootstrapRows).toHaveLength(catalogBootstrapMigrations.length)
        expect(appliedBootstrapRows.map((row) => row.migration_name)).toEqual(catalogBootstrapMigrations.map((migration) => migration.id))
        expect(raw).toHaveBeenCalledWith(expect.stringContaining('upl_migration_runs_applied_unique_idx'))
        expect(raw).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS upl_migrations.definition_registry'))
    })

    it('stores migration run identifiers as UUID v7 values', async () => {
        const { knex, rows } = createCallableKnex({ migrationRunsTableExists: true })
        const catalog = new PlatformMigrationCatalog(knex as never)

        await catalog.beginRun({
            migration: {
                id: 'CreateMetahubsSchema1766351182000',
                version: '1766351182000',
                scope: {
                    kind: 'platform_schema',
                    key: 'metahubs'
                },
                up: async () => Promise.resolve()
            },
            checksum: 'checksum'
        })

        expect(rows).toHaveLength(1)
        expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('backfills bootstrap run history for legacy precreated storage', async () => {
        const { knex, rows } = createCallableKnex({ migrationRunsTableExists: true })
        const catalog = new PlatformMigrationCatalog(knex as never)

        await catalog.ensureStorage()

        expect(rows.filter((row) => row.status === 'applied')).toHaveLength(catalogBootstrapMigrations.length)
    })
})
