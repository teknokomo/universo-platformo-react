import { createAdminSchemaMigrationDefinition } from '..'

const adminFunctionStatements = (sql: string) => sql.includes('CREATE OR REPLACE FUNCTION admin.')

describe('admin platform migration security contracts', () => {
    it('pins SECURITY DEFINER admin functions to an explicit safe search_path in schema bootstrap', () => {
        const functionSql = createAdminSchemaMigrationDefinition.up
            .filter((statement) => adminFunctionStatements(statement.sql))
            .map((statement) => statement.sql)
        const allSql = createAdminSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n')

        expect(functionSql.length).toBeGreaterThan(0)
        for (const sql of functionSql) {
            expect(sql).toContain('SECURITY DEFINER SET search_path = admin, public, auth, pg_temp STABLE')
        }
        expect(allSql).toContain('REVOKE ALL ON FUNCTION admin.has_permission(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;')
        expect(allSql).toContain('GRANT EXECUTE ON FUNCTION admin.is_superuser(UUID) TO authenticated;')
    })

    it('prevents authenticated sessions from introspecting arbitrary users via explicit function arguments', () => {
        const allSql = createAdminSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n')

        expect(allSql).toContain('Authenticated sessions may inspect only their own permissions')
        expect(allSql).toContain('Authenticated sessions may inspect only their own superuser state')
        expect(allSql).toContain('Authenticated sessions may inspect only their own admin access')
        expect(allSql).toContain('Authenticated sessions may inspect only their own global roles')
        expect(allSql).toContain('p_user_id IS DISTINCT FROM v_auth_user_id')
    })
})
