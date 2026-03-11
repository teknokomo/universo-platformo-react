import { createPlatformMigrationFromSqlDefinition } from '../sqlAdapter'

describe('createPlatformMigrationFromSqlDefinition', () => {
    it('wraps native SQL definitions into the platform migration contract', async () => {
        const migration = createPlatformMigrationFromSqlDefinition(
            {
                id: 'ExampleSqlMigration1800000000000',
                version: '1800000000000',
                summary: 'Example SQL migration',
                up: [
                    {
                        sql: 'CREATE TABLE example(id uuid)'
                    }
                ],
                down: [
                    {
                        sql: 'DROP TABLE example'
                    }
                ]
            },
            'metahubs'
        )
        const raw = jest.fn().mockResolvedValue(undefined)

        await migration.up({
            knex: { raw } as never,
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            },
            scope: migration.scope,
            runId: 'run-1',
            raw
        })

        expect(migration.scope).toEqual({
            kind: 'platform_schema',
            key: 'metahubs'
        })
        expect(migration.transactionMode).toBe('single')
        expect(raw).toHaveBeenCalledWith('CREATE TABLE example(id uuid)')
    })

    it('logs and continues for warning-tolerant statements', async () => {
        const warn = jest.fn()
        const raw = jest.fn().mockRejectedValueOnce(new Error('fk missing')).mockResolvedValueOnce(undefined)
        const migration = createPlatformMigrationFromSqlDefinition(
            {
                id: 'WarningSqlMigration1800000000001',
                version: '1800000000001',
                summary: 'Warning SQL migration',
                up: [
                    {
                        sql: 'ALTER TABLE example ADD CONSTRAINT fk_example FOREIGN KEY (id) REFERENCES missing(id)',
                        warningMessage: 'Optional FK failed'
                    },
                    {
                        sql: 'CREATE INDEX example_idx ON example(id)'
                    }
                ]
            },
            'applications'
        )

        await migration.up({
            knex: { raw } as never,
            logger: {
                info: jest.fn(),
                warn,
                error: jest.fn()
            },
            scope: migration.scope,
            runId: 'run-2',
            raw
        })

        expect(warn).toHaveBeenCalledWith(
            'Optional FK failed',
            expect.objectContaining({
                scopeKey: 'applications',
                migrationId: 'WarningSqlMigration1800000000001',
                direction: 'up',
                statementIndex: 0
            })
        )
        expect(raw).toHaveBeenNthCalledWith(2, 'CREATE INDEX example_idx ON example(id)')
    })
})
