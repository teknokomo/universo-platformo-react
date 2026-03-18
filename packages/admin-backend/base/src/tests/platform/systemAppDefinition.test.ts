import { createAdminSchemaMigrationDefinition } from '../../platform/migrations'
import { adminSystemAppDefinition } from '../../platform/systemAppDefinition'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()
const expectedSafePolicyDrop = (policyName: string, schemaName: string, tableName: string): string =>
    normalizeSql(`
DO $$
BEGIN
    IF to_regclass('${schemaName}.${tableName}') IS NOT NULL THEN
        BEGIN
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON %I.%I',
                '${policyName}',
                '${schemaName}',
                '${tableName}'
            );
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
    END IF;
END $$;
    `)

describe('admin system-app definition', () => {
    it('keeps the migration chain stable for admin fixed-schema bootstrap and reconciliation', () => {
        expect(
            adminSystemAppDefinition.migrations.map((entry) => (entry.kind === 'file' ? entry.migration.id : entry.definition.id))
        ).toEqual([
            'PrepareAdminSchemaSupport1733400000000',
            'FinalizeAdminSchemaSupport1733400000001',
            'SeedAdminLifecycleRoles1733400000002'
        ])
    })

    it('keeps manifest validation limits aligned with the physical fixed-schema contract', () => {
        const rolesTable = adminSystemAppDefinition.currentBusinessTables.find((table) => table.codename === 'roles')
        const codenameField = rolesTable?.fields?.find((field) => field.codename === 'codename')

        expect(codenameField).toEqual(
            expect.objectContaining({
                physicalDataType: 'VARCHAR(50)',
                validationRules: expect.objectContaining({
                    maxLength: 50,
                    pattern: '^[a-z0-9:_-]+$'
                })
            })
        )
    })

    it('keeps the reference admin SQL contract for fresh-schema parity checks', () => {
        const upSql = normalizeSql(createAdminSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        for (const fragment of [
            'CREATE TABLE IF NOT EXISTS admin.cfg_instances',
            'CREATE TABLE IF NOT EXISTS admin.cat_roles',
            'CREATE TABLE IF NOT EXISTS admin.rel_role_permissions',
            'CREATE TABLE IF NOT EXISTS admin.rel_user_roles',
            'CREATE TABLE IF NOT EXISTS admin.cfg_locales',
            'CREATE TABLE IF NOT EXISTS admin.cfg_settings'
        ]) {
            expect(upSql).toContain(normalizeSql(fragment))
        }

        for (const fragment of [
            expectedSafePolicyDrop('authenticated_read_roles', 'admin', 'cat_roles'),
            expectedSafePolicyDrop('admin_access_manage_roles', 'admin', 'cat_roles'),
            expectedSafePolicyDrop('authenticated_read_locales', 'admin', 'cfg_locales'),
            expectedSafePolicyDrop('admin_access_manage_locales', 'admin', 'cfg_locales'),
            expectedSafePolicyDrop('authenticated_read_settings', 'admin', 'cfg_settings'),
            expectedSafePolicyDrop('admin_access_manage_settings', 'admin', 'cfg_settings')
        ]) {
            expect(upSql).toContain(normalizeSql(fragment))
        }

        expect(upSql).not.toMatch(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/)
        expect(upSql).not.toMatch(/CREATE INDEX(?! IF NOT EXISTS)/)
    })
})
