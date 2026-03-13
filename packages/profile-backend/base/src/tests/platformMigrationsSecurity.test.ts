import { addProfileMigrationDefinition } from '..'

describe('profile platform migration security contracts', () => {
    it('pins SECURITY DEFINER helper functions to explicit search_path values', () => {
        const sqlStatements = addProfileMigrationDefinition.up.map((statement) => statement.sql)

        expect(sqlStatements.some((sql) => sql.includes('FUNCTION update_user_email'))).toBe(true)
        expect(sqlStatements.some((sql) => sql.includes('FUNCTION update_user_password'))).toBe(true)
        expect(sqlStatements.some((sql) => sql.includes('FUNCTION create_user_profile'))).toBe(true)

        expect(sqlStatements.join('\n')).toContain('FUNCTION update_user_email(user_id uuid, new_email text)')
        expect(sqlStatements.join('\n')).toContain('SET search_path = profiles, public, auth, pg_temp')
        expect(sqlStatements.join('\n')).toContain('SET search_path = extensions, public, auth, pg_temp')
        expect(sqlStatements.join('\n')).toContain('REVOKE ALL ON FUNCTION create_user_profile() FROM PUBLIC;')
        expect(sqlStatements.join('\n')).toContain('GRANT EXECUTE ON FUNCTION change_user_password_secure(text, text) TO authenticated;')
    })

    it('keeps direct profile creation self-scoped under RLS', () => {
        const sql = addProfileMigrationDefinition.up.map((statement) => statement.sql).join('\n')

        expect(sql).toContain("'Allow profile creation for existing users'")
        expect(sql).toContain('CREATE POLICY "Allow users to insert own profile"')
        expect(sql).toContain('WITH CHECK ((select auth.uid()) = user_id)')
    })
})
