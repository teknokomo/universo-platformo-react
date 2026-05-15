import {
    applyStartSchemaPoliciesMigrationDefinition,
    prepareStartSchemaSupportMigrationDefinition,
    finalizeStartSchemaSupportMigrationDefinition
} from '@universo/start-backend/platform-migrations'
import { startSystemAppDefinition } from '@universo/start-backend/platform-definition'
import { loadPlatformMigrationsFromSystemApps } from '../systemAppDefinitions'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

describe('start system app migration integration', () => {
    describe('prepare migration', () => {
        it('has correct id and version', () => {
            expect(prepareStartSchemaSupportMigrationDefinition.id).toBe('PrepareStartSchemaSupport1710000000000')
            expect(prepareStartSchemaSupportMigrationDefinition.version).toBe('1710000000000')
        })

        it('creates the start schema as the only prelude statement', () => {
            const { up } = prepareStartSchemaSupportMigrationDefinition

            expect(up.length).toBe(1)
            expect(normalizeSql(up[0].sql)).toBe('CREATE SCHEMA IF NOT EXISTS start')
        })
    })

    describe('finalize migration', () => {
        it('has correct id and version sequenced after prepare', () => {
            expect(finalizeStartSchemaSupportMigrationDefinition.id).toBe('FinalizeStartSchemaSupport1710000000001')
            expect(finalizeStartSchemaSupportMigrationDefinition.version).toBe('1710000000001')
            expect(Number(finalizeStartSchemaSupportMigrationDefinition.version)).toBeGreaterThan(
                Number(prepareStartSchemaSupportMigrationDefinition.version)
            )
        })

        it('does not include CREATE TABLE statements (those are compiler-generated)', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition

            for (const statement of up) {
                expect(normalizeSql(statement.sql)).not.toMatch(/^CREATE TABLE IF NOT EXISTS start\./i)
            }
        })

        it('does not include CREATE SCHEMA (that belongs to prelude)', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition

            for (const statement of up) {
                expect(normalizeSql(statement.sql)).not.toBe('CREATE SCHEMA IF NOT EXISTS start')
            }
        })

        it('includes unique indexes for object codenames and user selections', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const indexSql = up.map((s) => normalizeSql(s.sql))

            expect(indexSql).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('idx_goals_codename_active'),
                    expect.stringContaining('idx_topics_codename_active'),
                    expect.stringContaining('idx_features_codename_active'),
                    expect.stringContaining('idx_user_selections_unique')
                ])
            )
        })

        it('reapplies the object_kind CHECK constraint after table generation', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const constraintSql = up.map((s) => normalizeSql(s.sql))

            expect(constraintSql).toEqual(
                expect.arrayContaining([
                    'ALTER TABLE IF EXISTS start.rel_user_selections DROP CONSTRAINT IF EXISTS user_selections_object_kind_check',
                    "ALTER TABLE IF EXISTS start.rel_user_selections ADD CONSTRAINT user_selections_object_kind_check CHECK (object_kind IN ('goals', 'topics', 'features'))"
                ])
            )
        })

        it('enables RLS on all 4 tables', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const rlsSql = up.filter((s) => normalizeSql(s.sql).includes('ENABLE ROW LEVEL SECURITY'))

            expect(rlsSql).toHaveLength(4)

            const tables = rlsSql.map((s) => normalizeSql(s.sql))
            expect(tables).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('start.obj_goals'),
                    expect.stringContaining('start.obj_topics'),
                    expect.stringContaining('start.obj_features'),
                    expect.stringContaining('start.rel_user_selections')
                ])
            )
        })

        it('does not create RLS policies directly before admin permission helpers exist', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const policySql = up.filter((s) => normalizeSql(s.sql).startsWith('CREATE POLICY'))

            expect(policySql).toHaveLength(0)
        })
    })

    describe('policy migration', () => {
        it('has correct id and version placed after admin bootstrap support', () => {
            expect(applyStartSchemaPoliciesMigrationDefinition.id).toBe('ApplyStartSchemaPolicies1733400000500')
            expect(applyStartSchemaPoliciesMigrationDefinition.version).toBe('1733400000500')
            expect(Number(applyStartSchemaPoliciesMigrationDefinition.version)).toBeGreaterThan(1733400000001)
        })

        it('creates 9 RLS policies with correct naming convention', () => {
            const { up } = applyStartSchemaPoliciesMigrationDefinition
            const policySql = up.filter((s) => normalizeSql(s.sql).startsWith('CREATE POLICY'))

            expect(policySql).toHaveLength(9)

            const policyNames = policySql.map((s) => {
                const match = normalizeSql(s.sql).match(/CREATE POLICY (\S+) ON/)
                return match?.[1]
            })

            expect(policyNames).toEqual(
                expect.arrayContaining([
                    'authenticated_read_goals',
                    'admin_manage_goals',
                    'authenticated_read_topics',
                    'admin_manage_topics',
                    'authenticated_read_features',
                    'admin_manage_features',
                    'users_read_own_selections',
                    'users_manage_own_selections',
                    'admin_manage_all_selections'
                ])
            )
        })

        it('applies WITH CHECK on user self-management policy', () => {
            const { up } = applyStartSchemaPoliciesMigrationDefinition
            const userManagePolicy = up.find((s) => normalizeSql(s.sql).includes('CREATE POLICY users_manage_own_selections ON'))

            expect(userManagePolicy).toBeDefined()
            expect(normalizeSql(userManagePolicy!.sql)).toContain('WITH CHECK')
            expect(normalizeSql(userManagePolicy!.sql)).toContain('user_id = (select auth.uid())')
        })
    })

    describe('finalize migration', () => {
        it('seeds exactly 30 items (10 goals + 10 topics + 10 features)', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const insertStatements = up.filter((s) => normalizeSql(s.sql).startsWith('INSERT INTO start.'))

            const goalInserts = insertStatements.filter((s) => s.sql.includes('start.obj_goals'))
            const topicInserts = insertStatements.filter((s) => s.sql.includes('start.obj_topics'))
            const featureInserts = insertStatements.filter((s) => s.sql.includes('start.obj_features'))

            expect(goalInserts).toHaveLength(10)
            expect(topicInserts).toHaveLength(10)
            expect(featureInserts).toHaveLength(10)
            expect(insertStatements).toHaveLength(30)
        })

        it('uses ON CONFLICT for idempotent seed inserts', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const insertStatements = up.filter((s) => normalizeSql(s.sql).startsWith('INSERT INTO start.'))

            for (const statement of insertStatements) {
                expect(normalizeSql(statement.sql)).toContain('ON CONFLICT')
            }
        })

        it('uses VLC format with 2024-12-06 seed date for all seed items', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const insertStatements = up.filter((s) => normalizeSql(s.sql).startsWith('INSERT INTO start.'))

            for (const statement of insertStatements) {
                expect(statement.sql).toContain('2024-12-06T00:00:00.000Z')
                expect(statement.sql).toContain('"_schema":"1"')
                expect(statement.sql).toContain('"_primary":"en"')
            }
        })

        it('includes both en and ru locales in every seed item', () => {
            const { up } = finalizeStartSchemaSupportMigrationDefinition
            const insertStatements = up.filter((s) => normalizeSql(s.sql).startsWith('INSERT INTO start.'))

            for (const statement of insertStatements) {
                expect(statement.sql).toContain('"en":{')
                expect(statement.sql).toContain('"ru":{')
            }
        })
    })

    describe('definition manifest integration', () => {
        it('wires prepare/finalize/policies into the start system app definition migrations array', () => {
            expect(startSystemAppDefinition.migrations).toHaveLength(3)
            expect(startSystemAppDefinition.migrations[0].kind).toBe('sql')
            expect(startSystemAppDefinition.migrations[0].bootstrapPhase).toBe('pre_schema_generation')
            expect(startSystemAppDefinition.migrations[1].kind).toBe('sql')
            expect(startSystemAppDefinition.migrations[1].bootstrapPhase).toBe('post_schema_generation')
            expect(startSystemAppDefinition.migrations[2].kind).toBe('sql')
            expect(startSystemAppDefinition.migrations[2].bootstrapPhase).toBe('post_schema_generation')
        })

        it('loadPlatformMigrationsFromSystemApps includes start migrations with correct scope', () => {
            const allMigrations = loadPlatformMigrationsFromSystemApps()
            const startMigrations = allMigrations.filter((m) => m.scope.key === 'start')

            expect(startMigrations.length).toBeGreaterThanOrEqual(3)

            for (const migration of startMigrations) {
                expect(migration.scope).toEqual({
                    kind: 'platform_schema',
                    key: 'start'
                })
            }
        })

        it('pre_schema_generation phase includes start prepare migration', () => {
            const prelude = loadPlatformMigrationsFromSystemApps(undefined, ['pre_schema_generation'])
            const startPrelude = prelude.filter((m) => m.scope.key === 'start')

            expect(startPrelude).toHaveLength(1)
            expect(startPrelude[0].id).toBe('PrepareStartSchemaSupport1710000000000')
        })

        it('post_schema_generation phase includes start finalize and policy migrations', () => {
            const postGen = loadPlatformMigrationsFromSystemApps(undefined, ['post_schema_generation'])
            const startPostGen = postGen.filter((m) => m.scope.key === 'start')

            expect(startPostGen).toHaveLength(2)
            expect(startPostGen[0].id).toBe('FinalizeStartSchemaSupport1710000000001')
            expect(startPostGen[1].id).toBe('ApplyStartSchemaPolicies1733400000500')
        })
    })
})
