import type { Knex } from 'knex'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const createId = (): string => {
    const hex = (length: number) =>
        Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16))
            .join('')
            .padEnd(length, '0')
    return `${hex(8)}-${hex(4)}-7${hex(3)}-8${hex(3)}-${hex(12)}`
}

const ALIAS_FUNCTION_DENIED = '42501'

describeIntegration('application alias SECURITY DEFINER authorization (requires PostgreSQL)', () => {
    let knex: Knex
    const actorId = createId()
    const otherActorId = createId()
    const roleId = createId()
    const aliasRoleId = createId()
    const applicationId = createId()
    const suffix = Date.now().toString(36)

    const withClaims = async <T>(userId: string, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
        knex.transaction(async (trx) => {
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: userId })])
            return callback(trx)
        })

    const callCreateAlias = (trx: Knex.Transaction, alias: string, makePrimary: boolean, userId: string) =>
        trx.raw(`SELECT * FROM applications.create_application_alias(?, ?, ?, ?)`, [applicationId, alias, makePrimary, userId])

    const insertFixtureAlias = (alias: string, released?: boolean, deleted?: boolean) =>
        knex.raw(
            `
            INSERT INTO applications.obj_application_aliases (application_id, alias, released_at, _upl_deleted, _app_deleted)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
            `,
            [applicationId, alias, released === true ? new Date() : null, deleted === true, deleted === true]
        )

    const resolveAlias = (alias: string) => knex.raw(`SELECT applications.resolve_application_alias(?) AS "applicationId"`, [alias])

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 2 } })

        // Fixture actors must exist because rel_user_roles references auth.users.
        for (const id of [actorId, otherActorId]) {
            await knex.raw(
                `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
                 VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', now(), now())
                 ON CONFLICT (id) DO NOTHING`,
                [id, `alias-auth-${id.slice(0, 8)}@example.test`]
            )
        }

        await knex.raw(`INSERT INTO applications.obj_applications (id, name) VALUES (?, ?::jsonb)`, [
            applicationId,
            JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `alias auth ${suffix}` } } })
        ])

        // Role used for the shell-predicate split checks: alias read only.
        await knex.raw(
            `INSERT INTO admin.obj_roles (id, codename, name, is_superuser, is_system)
             VALUES (?, ?::jsonb, ?::jsonb, false, false)`,
            [
                roleId,
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `ShellProbe${suffix}` } } }),
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `ShellProbe ${suffix}` } } })
            ]
        )
        await knex.raw(`INSERT INTO admin.rel_role_permissions (role_id, subject, action) VALUES (?, 'applicationAliases', 'read')`, [
            roleId
        ])
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [actorId, roleId])

        // Dedicated alias-capability role granted per test through permission rows.
        await knex.raw(
            `INSERT INTO admin.obj_roles (id, codename, name, is_superuser, is_system)
             VALUES (?, ?::jsonb, ?::jsonb, false, false)`,
            [
                aliasRoleId,
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `AliasWriter${suffix}` } } }),
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `AliasWriter ${suffix}` } } })
            ]
        )
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [otherActorId, aliasRoleId])
    })

    afterAll(async () => {
        if (!knex) return
        await knex.raw(`DELETE FROM applications.obj_application_aliases WHERE application_id = ?`, [applicationId])
        await knex.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [applicationId])
        await knex.raw(`DELETE FROM admin.rel_user_roles WHERE user_id IN (?, ?)`, [actorId, otherActorId])
        await knex.raw(`DELETE FROM admin.rel_role_permissions WHERE role_id IN (?, ?)`, [roleId, aliasRoleId])
        await knex.raw(`DELETE FROM admin.obj_roles WHERE id IN (?, ?)`, [roleId, aliasRoleId])
        await knex.raw(`DELETE FROM auth.users WHERE id IN (?, ?)`, [actorId, otherActorId])
        await knex.destroy()
    })

    it('splits the strict table-policy predicate from the admin shell predicate', async () => {
        // The actor holds only applicationAliases:read.
        const strict = await knex.raw(`SELECT admin.has_admin_permission(?) AS allowed`, [actorId])
        const shell = await knex.raw(`SELECT admin.has_admin_shell_permission(?) AS allowed`, [actorId])

        expect(strict.rows[0]?.allowed).toBe(false)
        expect(shell.rows[0]?.allowed).toBe(true)
    })

    it('rejects an actor mismatch before any alias write', async () => {
        const alias = `alias-auth-mismatch-${suffix}`

        await expect(withClaims(actorId, (trx) => callCreateAlias(trx, alias, false, otherActorId))).rejects.toMatchObject({
            code: ALIAS_FUNCTION_DENIED
        })
    })

    it('rejects a caller without the create capability', async () => {
        const alias = `alias-auth-denied-${suffix}`

        await expect(withClaims(actorId, (trx) => callCreateAlias(trx, alias, false, actorId))).rejects.toMatchObject({
            code: ALIAS_FUNCTION_DENIED
        })
    })

    it('allows the intended capability and rejects makePrimary without the update capability', async () => {
        await knex.raw(`INSERT INTO admin.rel_role_permissions (role_id, subject, action) VALUES (?, 'applicationAliases', 'create')`, [
            aliasRoleId
        ])

        const allowedAlias = `alias-auth-allowed-${suffix}`
        await expect(withClaims(otherActorId, (trx) => callCreateAlias(trx, allowedAlias, false, otherActorId))).resolves.toBeDefined()

        const primaryAlias = `alias-auth-primary-${suffix}`
        await expect(withClaims(otherActorId, (trx) => callCreateAlias(trx, primaryAlias, true, otherActorId))).rejects.toMatchObject({
            code: ALIAS_FUNCTION_DENIED
        })

        await knex.raw(`INSERT INTO admin.rel_role_permissions (role_id, subject, action) VALUES (?, 'applicationAliases', 'update')`, [
            aliasRoleId
        ])

        await expect(withClaims(otherActorId, (trx) => callCreateAlias(trx, primaryAlias, true, otherActorId))).resolves.toBeDefined()
    })

    it('resolves an active alias of a closed application through the SECURITY DEFINER resolver', async () => {
        const alias = `alias-resolve-closed-${suffix}`
        await insertFixtureAlias(alias)

        const result = await resolveAlias(alias)

        expect(result.rows).toHaveLength(1)
        expect(result.rows[0]?.applicationId).toBe(applicationId)
        expect(Object.keys(result.rows[0] ?? {})).toEqual(['applicationId'])
    })

    it('does not resolve released, soft-deleted or unknown aliases', async () => {
        const released = `alias-resolve-released-${suffix}`
        await insertFixtureAlias(released, true)
        await expect(resolveAlias(released)).resolves.toMatchObject({ rows: [{ applicationId: null }] })

        const deleted = `alias-resolve-deleted-${suffix}`
        await insertFixtureAlias(deleted, false, true)
        await expect(resolveAlias(deleted)).resolves.toMatchObject({ rows: [{ applicationId: null }] })

        await expect(resolveAlias(`alias-resolve-unknown-${suffix}`)).resolves.toMatchObject({
            rows: [{ applicationId: null }]
        })
    })

    it('exposes the resolver as a SECURITY DEFINER function returning only the application id', async () => {
        const definition = await knex.raw(
            `
            SELECT p.prosecdef AS "securityDefiner",
                   p.prorettype = 'uuid'::regtype AS "returnsUuid"
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'applications'
              AND p.proname = 'resolve_application_alias'
              AND p.pronargs = 1
            `
        )

        expect(definition.rows).toHaveLength(1)
        expect(definition.rows[0]?.securityDefiner).toBe(true)
        expect(definition.rows[0]?.returnsUuid).toBe(true)

        const hasAuthenticatedRole = await knex.raw(`SELECT to_regrole('authenticated') AS role`)
        if (hasAuthenticatedRole.rows[0]?.role) {
            const privilege = await knex.raw(
                `SELECT has_function_privilege('authenticated', 'applications.resolve_application_alias(text)', 'EXECUTE') AS allowed`
            )
            expect(privilege.rows[0]?.allowed).toBe(true)
        }
    })
})
