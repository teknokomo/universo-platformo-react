import {
    createAdminSchemaMigrationDefinition,
    prepareAdminSchemaSupportMigrationDefinition,
    finalizeAdminSchemaSupportMigrationDefinition,
    seedAdminLifecycleRolesMigrationDefinition,
    type SqlMigrationDefinition
} from '../../platform/migrations'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const allDefinitions: SqlMigrationDefinition[] = [
    createAdminSchemaMigrationDefinition,
    prepareAdminSchemaSupportMigrationDefinition,
    finalizeAdminSchemaSupportMigrationDefinition,
    seedAdminLifecycleRolesMigrationDefinition
]

describe('admin migration definitions structural integrity', () => {
    it('every definition has a non-empty id', () => {
        for (const def of allDefinitions) {
            expect(def.id.length).toBeGreaterThan(0)
        }
    })

    it('every definition has a unique id', () => {
        const ids = allDefinitions.map((d) => d.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('every definition has a non-empty version', () => {
        for (const def of allDefinitions) {
            expect(def.version.length).toBeGreaterThan(0)
        }
    })

    it('support definitions have ordered versions', () => {
        const supportDefs = [
            prepareAdminSchemaSupportMigrationDefinition,
            finalizeAdminSchemaSupportMigrationDefinition,
            seedAdminLifecycleRolesMigrationDefinition
        ]
        for (let i = 1; i < supportDefs.length; i++) {
            expect(Number(supportDefs[i].version)).toBeGreaterThan(Number(supportDefs[i - 1].version))
        }
    })

    it('every definition has a non-empty summary', () => {
        for (const def of allDefinitions) {
            expect(def.summary.length).toBeGreaterThan(0)
        }
    })

    it('every definition has at least one up statement', () => {
        for (const def of allDefinitions) {
            expect(def.up.length).toBeGreaterThan(0)
        }
    })

    it('every up statement has non-empty SQL', () => {
        for (const def of allDefinitions) {
            for (const stmt of def.up) {
                expect(stmt.sql.trim().length).toBeGreaterThan(0)
            }
        }
    })
})

describe('createAdminSchemaMigrationDefinition SQL contract', () => {
    const upSql = () => normalizeSql(createAdminSchemaMigrationDefinition.up.map((s) => s.sql).join('\n'))

    it('creates all required admin tables', () => {
        const sql = upSql()
        for (const table of ['cfg_instances', 'obj_roles', 'rel_role_permissions', 'rel_user_roles', 'cfg_locales', 'cfg_settings']) {
            expect(sql).toContain(`admin.${table}`)
        }
    })

    it('uses IF NOT EXISTS for all CREATE TABLE statements', () => {
        const sql = upSql()
        const createTableMatches = sql.match(/CREATE TABLE\b/g) ?? []
        const createTableIfNotExistsMatches = sql.match(/CREATE TABLE IF NOT EXISTS\b/g) ?? []
        expect(createTableMatches.length).toBe(createTableIfNotExistsMatches.length)
    })

    it('uses IF NOT EXISTS for all CREATE INDEX statements', () => {
        const sql = upSql()
        expect(sql).not.toMatch(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/)
        expect(sql).not.toMatch(/CREATE INDEX(?! IF NOT EXISTS)/)
    })

    it('includes RLS policies for core tables', () => {
        const sql = upSql()
        expect(sql).toContain('CREATE POLICY')
        expect(sql).toContain('authenticated_read_roles')
        expect(sql).toContain('authenticated_read_locales')
        expect(sql).toContain('authenticated_read_settings')
    })

    it('codename columns use jsonb type', () => {
        const sql = upSql()
        expect(sql).toMatch(/codename\s+jsonb/i)
    })
})

describe('seedAdminLifecycleRolesMigrationDefinition VLC integrity', () => {
    const seedSql = () => normalizeSql(seedAdminLifecycleRolesMigrationDefinition.up.map((s) => s.sql).join('\n'))

    it('seeds role codenames as valid VLC JSON with ::jsonb cast', () => {
        const sql = seedSql()
        expect(sql).toContain('::jsonb')
        expect(sql).toContain('"_schema": "1"')
    })

    it('VLC codenames contain _schema, _primary, and locales fields', () => {
        const sql = seedSql()
        // Each VLC literal must have the structural keys
        expect(sql).toContain('"_schema"')
        expect(sql).toContain('"_primary"')
        expect(sql).toContain('"locales"')
    })

    it('seed SQL uses idempotent WHERE NOT EXISTS pattern', () => {
        const sql = seedSql()
        expect(sql).toContain('WHERE NOT EXISTS')
    })

    it('permission seed uses ON CONFLICT for idempotency', () => {
        const sql = seedSql()
        expect(sql).toContain('ON CONFLICT')
    })

    it('seeds both Registered and User roles', () => {
        const sql = seedSql()
        expect(sql).toContain('Registered')
        expect(sql).toContain('User')
    })
})
