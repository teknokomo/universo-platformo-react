import type { Knex } from 'knex'
import { addApplicationCatalogVisibilityAndMembershipRlsMigrationDefinition } from '../../platform/migrations/1800000000340-ApplicationCatalogVisibilityAndMembershipRls.sql'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for application alias authorization PostgreSQL integration tests')
}
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const rollbackSignal = new Error('rollback application alias authorization integration fixture')
const activeMembershipHelperMigrationSql = addApplicationCatalogVisibilityAndMembershipRlsMigrationDefinition.up.find((statement) =>
    statement.sql.includes('CREATE OR REPLACE FUNCTION applications.has_active_application_membership')
)?.sql

const withRollback = async (knex: Knex, callback: (trx: Knex.Transaction) => Promise<void>): Promise<void> => {
    try {
        await knex.transaction(async (trx) => {
            await callback(trx)
            throw rollbackSignal
        })
    } catch (error) {
        if (error !== rollbackSignal) throw error
    }
}

const createId = (): string => {
    const hex = (length: number) =>
        Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16))
            .join('')
            .padEnd(length, '0')
    return `${hex(8)}-${hex(4)}-7${hex(3)}-8${hex(3)}-${hex(12)}`
}

const ALIAS_FUNCTION_DENIED = '42501'
const inactiveMembershipColumns = ['_upl_archived', '_upl_deleted', '_app_archived', '_app_deleted'] as const
const ALIAS_FUNCTION_RETURN_COLUMNS = `
    id,
    application_id AS "applicationId",
    alias,
    is_primary AS "isPrimary",
    released_at AS "releasedAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
`

describeIntegration('application alias SECURITY DEFINER authorization (requires PostgreSQL)', () => {
    let knex: Knex
    const actorId = createId()
    const otherActorId = createId()
    const nonMemberId = createId()
    const roleId = createId()
    const aliasRoleId = createId()
    const applicationId = createId()
    const suffix = Date.now().toString(36)

    const withClaims = async <T>(userId: string, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
        knex.transaction(async (trx) => {
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: userId })])
            return callback(trx)
        })

    const withAuthenticatedClaims = async <T>(userId: string, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
        knex.transaction(async (trx) => {
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: userId })])
            await trx.raw('SET LOCAL ROLE authenticated')
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

    it('grants management function execution only to authenticated callers', async () => {
        const privileges = await knex.raw(`
            SELECT
                has_function_privilege('anon', 'applications.get_application_alias_for_management(uuid,uuid,text)', 'EXECUTE') AS anon_can_read,
                has_function_privilege('authenticated', 'applications.get_application_alias_for_management(uuid,uuid,text)', 'EXECUTE') AS authenticated_can_read,
                has_function_privilege('anon', 'applications.mutate_application_alias(uuid,text,text,uuid)', 'EXECUTE') AS anon_can_mutate,
                has_function_privilege('authenticated', 'applications.mutate_application_alias(uuid,text,text,uuid)', 'EXECUTE') AS authenticated_can_mutate,
                has_function_privilege('anon', 'applications.ensure_application_alias_primary(uuid,uuid)', 'EXECUTE') AS anon_can_ensure_primary,
                has_function_privilege('authenticated', 'applications.ensure_application_alias_primary(uuid,uuid)', 'EXECUTE') AS authenticated_can_ensure_primary
        `)

        expect(privileges.rows[0]).toEqual({
            anon_can_read: false,
            authenticated_can_read: true,
            anon_can_mutate: false,
            authenticated_can_mutate: true,
            anon_can_ensure_primary: false,
            authenticated_can_ensure_primary: true
        })
    })

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 2 } })

        // Fixture actors must exist because rel_user_roles references auth.users.
        for (const id of [actorId, otherActorId, nonMemberId]) {
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
        await knex.raw(`INSERT INTO applications.rel_application_users (application_id, user_id, role) VALUES (?, ?, 'owner')`, [
            applicationId,
            otherActorId
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
        await knex.raw(`DELETE FROM applications.rel_application_users WHERE application_id = ?`, [applicationId])
        await knex.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [applicationId])
        await knex.raw(`DELETE FROM admin.rel_user_roles WHERE user_id IN (?, ?, ?)`, [actorId, otherActorId, nonMemberId])
        await knex.raw(`DELETE FROM admin.rel_role_permissions WHERE role_id IN (?, ?)`, [roleId, aliasRoleId])
        await knex.raw(`DELETE FROM admin.obj_roles WHERE id IN (?, ?)`, [roleId, aliasRoleId])
        await knex.raw(`DELETE FROM auth.users WHERE id IN (?, ?, ?)`, [actorId, otherActorId, nonMemberId])
        await knex.destroy()
    })

    it('splits the strict table-policy predicate from the admin shell predicate', async () => {
        // The actor holds only applicationAliases:read.
        const strict = await knex.raw(`SELECT admin.has_admin_permission(?) AS allowed`, [actorId])
        const shell = await knex.raw(`SELECT admin.has_admin_shell_permission(?) AS allowed`, [actorId])

        expect(strict.rows[0]?.allowed).toBe(false)
        expect(shell.rows[0]?.allowed).toBe(true)
    })

    it('limits application alias reads to owners and admins of that application', async () => {
        const scopedAlias = `alias-auth-scoped-${suffix}`
        await insertFixtureAlias(scopedAlias)

        const privileges = await knex.raw(`
            SELECT has_table_privilege('authenticated', 'applications.obj_application_aliases', 'SELECT') AS authenticated_can_select,
                   has_table_privilege('anon', 'applications.obj_application_aliases', 'SELECT') AS anonymous_can_select
        `)
        expect(privileges.rows[0]).toEqual({ authenticated_can_select: true, anonymous_can_select: false })

        const ownerRows = await withAuthenticatedClaims(otherActorId, (trx) =>
            trx.raw(`SELECT alias FROM applications.obj_application_aliases WHERE application_id = ?`, [applicationId])
        )
        const nonMemberRows = await withAuthenticatedClaims(nonMemberId, (trx) =>
            trx.raw(`SELECT alias FROM applications.obj_application_aliases WHERE application_id = ?`, [applicationId])
        )

        expect(ownerRows.rows).toEqual([{ alias: scopedAlias }])
        expect(nonMemberRows.rows).toEqual([])
    })

    it('uses a hardened SECURITY DEFINER membership lookup for non-recursive row policies', async () => {
        const result = await knex.raw(
            `
            SELECT p.prosecdef AS "securityDefiner",
                   p.proconfig AS "functionConfig",
                   has_function_privilege('authenticated', 'applications.has_active_application_membership(uuid,text[])', 'EXECUTE') AS "authenticatedCanExecute",
                   has_function_privilege('anon', 'applications.has_active_application_membership(uuid,text[])', 'EXECUTE') AS "anonymousCanExecute"
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'applications'
              AND p.proname = 'has_active_application_membership'
              AND p.pronargs = 2
            `
        )

        expect(result.rows).toHaveLength(1)
        expect(result.rows[0]?.securityDefiner).toBe(true)
        expect(result.rows[0]?.functionConfig).toEqual(expect.arrayContaining(['search_path=pg_catalog', 'row_security=off']))
        expect(result.rows[0]?.authenticatedCanExecute).toBe(true)
        expect(result.rows[0]?.anonymousCanExecute).toBe(false)
    })

    it('excludes archived and deleted owner, admin and member memberships from helper-backed RLS access', async () => {
        await withRollback(knex, async (trx) => {
            if (!activeMembershipHelperMigrationSql) {
                throw new Error('The application membership helper definition is missing from its migration')
            }
            await trx.raw(activeMembershipHelperMigrationSql)

            const actors = [
                { userId: createId(), role: 'owner' },
                { userId: createId(), role: 'admin' },
                { userId: createId(), role: 'member' }
            ] as const
            const fixtureApplicationId = createId()
            const fixtureAlias = `alias-auth-archived-membership-${suffix}`
            const allActorIds = actors.map(({ userId }) => userId).sort()

            for (const { userId } of actors) {
                await trx.raw(
                    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
                     VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', now(), now())`,
                    [userId, `alias-auth-${userId.slice(0, 8)}@example.test`]
                )
            }
            await trx.raw(`INSERT INTO applications.obj_applications (id, name) VALUES (?, ?::jsonb)`, [
                fixtureApplicationId,
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `archived membership auth ${suffix}` } } })
            ])
            for (const actor of actors) {
                await trx.raw(`INSERT INTO applications.rel_application_users (application_id, user_id, role) VALUES (?, ?, ?)`, [
                    fixtureApplicationId,
                    actor.userId,
                    actor.role
                ])
            }
            await trx.raw(`INSERT INTO applications.obj_application_aliases (application_id, alias) VALUES (?, ?)`, [
                fixtureApplicationId,
                fixtureAlias
            ])

            // These grants are transaction-scoped test setup for exercising RLS directly.
            // withRollback restores the database privileges and removes all fixture rows.
            await trx.raw(`GRANT USAGE ON SCHEMA applications TO authenticated`)
            await trx.raw(`GRANT SELECT ON TABLE applications.obj_applications TO authenticated`)
            await trx.raw(`GRANT SELECT ON TABLE applications.rel_application_users TO authenticated`)

            const readAccess = async (actor: (typeof actors)[number]) => {
                await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: actor.userId })])
                await trx.raw('SET LOCAL ROLE authenticated')
                const helper = await trx.raw(
                    `
                    SELECT applications.has_active_application_membership(?, ARRAY[?]::text[]) AS "roleMembershipActive",
                           applications.has_active_application_membership(?, NULL::text[]) AS "anyMembershipActive"
                    `,
                    [fixtureApplicationId, actor.role, fixtureApplicationId]
                )
                const applicationRows = await trx.raw(`SELECT id FROM applications.obj_applications WHERE id = ?`, [fixtureApplicationId])
                const aliasRows = await trx.raw(`SELECT alias FROM applications.obj_application_aliases WHERE application_id = ?`, [
                    fixtureApplicationId
                ])
                const membershipRows = await trx.raw(
                    `SELECT user_id AS "userId" FROM applications.rel_application_users WHERE application_id = ? ORDER BY user_id`,
                    [fixtureApplicationId]
                )
                await trx.raw('RESET ROLE')

                return { helper: helper.rows[0], applicationRows, aliasRows, membershipRows }
            }

            for (const actor of actors) {
                const activeAccess = await readAccess(actor)

                expect(activeAccess.helper).toEqual({ roleMembershipActive: true, anyMembershipActive: true })
                expect(activeAccess.applicationRows.rows).toEqual([{ id: fixtureApplicationId }])
                expect(activeAccess.aliasRows.rows).toEqual(
                    actor.role === 'owner' || actor.role === 'admin' ? [{ alias: fixtureAlias }] : []
                )
                expect(activeAccess.membershipRows.rows.map((row: { userId: string }) => row.userId)).toEqual(allActorIds)

                for (const inactiveColumn of inactiveMembershipColumns) {
                    await trx.raw(
                        `UPDATE applications.rel_application_users
                         SET ${inactiveColumn} = true
                         WHERE application_id = ? AND user_id = ?`,
                        [fixtureApplicationId, actor.userId]
                    )

                    const inactiveAccess = await readAccess(actor)

                    expect(inactiveAccess.helper).toEqual({ roleMembershipActive: false, anyMembershipActive: false })
                    expect(inactiveAccess.applicationRows.rows).toEqual([])
                    expect(inactiveAccess.aliasRows.rows).toEqual([])
                    expect(inactiveAccess.membershipRows.rows).toEqual([{ userId: actor.userId }])

                    await trx.raw(
                        `UPDATE applications.rel_application_users
                         SET ${inactiveColumn} = false
                         WHERE application_id = ? AND user_id = ?`,
                        [fixtureApplicationId, actor.userId]
                    )
                }
            }
        })
    })

    it('admits a write-only alias role into the admin shell without granting read', async () => {
        await knex.raw(`INSERT INTO admin.rel_role_permissions (role_id, subject, action) VALUES (?, 'applicationAliases', 'update')`, [
            aliasRoleId
        ])
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [nonMemberId, aliasRoleId])

        try {
            const strict = await knex.raw(`SELECT admin.has_admin_permission(?) AS allowed`, [nonMemberId])
            const shell = await knex.raw(`SELECT admin.has_admin_shell_permission(?) AS allowed`, [nonMemberId])
            const visibleAliases = await withAuthenticatedClaims(nonMemberId, (trx) =>
                trx.raw(`SELECT alias FROM applications.obj_application_aliases WHERE application_id = ?`, [applicationId])
            )

            expect(strict.rows[0]?.allowed).toBe(false)
            expect(shell.rows[0]?.allowed).toBe(true)
            expect(visibleAliases.rows).toEqual([])
        } finally {
            // This role is reused by later cases; remove the write-only grant
            // and temporary non-member assignment to keep their matrices isolated.
            await knex.raw(
                `DELETE FROM admin.rel_role_permissions WHERE role_id = ? AND subject = 'applicationAliases' AND action = 'update'`,
                [aliasRoleId]
            )
            await knex.raw(`DELETE FROM admin.rel_user_roles WHERE user_id = ? AND role_id = ?`, [nonMemberId, aliasRoleId])
        }
    })

    it('allows update-only alias mutations through the guarded function without granting direct SELECT', async () => {
        await knex.raw(`INSERT INTO admin.rel_role_permissions (role_id, subject, action) VALUES (?, 'applicationAliases', 'update')`, [
            aliasRoleId
        ])
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [nonMemberId, aliasRoleId])
        const alias = `alias-auth-update-only-${suffix}`
        const inserted = await insertFixtureAlias(alias)
        const writeOnlyAliasId = inserted.rows[0]?.id as string

        try {
            await expect(
                withAuthenticatedClaims(nonMemberId, (trx) =>
                    trx.raw(`SELECT * FROM applications.get_application_alias_for_management(?, ?, 'delete')`, [
                        writeOnlyAliasId,
                        nonMemberId
                    ])
                )
            ).rejects.toMatchObject({ code: ALIAS_FUNCTION_DENIED })

            await withAuthenticatedClaims(nonMemberId, async (trx) => {
                const before = await trx.raw(
                    `
                    SELECT ${ALIAS_FUNCTION_RETURN_COLUMNS}
                    FROM applications.get_application_alias_for_management(?, ?, 'update')
                    `,
                    [writeOnlyAliasId, nonMemberId]
                )
                expect(before.rows[0]).toMatchObject({ id: writeOnlyAliasId, applicationId, alias })

                const renamed = await trx.raw(
                    `
                    SELECT ${ALIAS_FUNCTION_RETURN_COLUMNS}
                    FROM applications.mutate_application_alias(?, ?, 'rename', ?)
                    `,
                    [writeOnlyAliasId, `renamed-${suffix}`, nonMemberId]
                )
                expect(renamed.rows[0]).toMatchObject({ id: writeOnlyAliasId, applicationId, alias: `renamed-${suffix}` })

                const promoted = await trx.raw(
                    `
                    SELECT ${ALIAS_FUNCTION_RETURN_COLUMNS}
                    FROM applications.mutate_application_alias(?, NULL, 'set_primary', ?)
                    `,
                    [writeOnlyAliasId, nonMemberId]
                )
                expect(promoted.rows[0]).toMatchObject({ id: writeOnlyAliasId, applicationId, isPrimary: true })

                const directRead = await trx.raw(`SELECT alias FROM applications.obj_application_aliases WHERE id = ?`, [writeOnlyAliasId])
                expect(directRead.rows).toEqual([])
            })
        } finally {
            await knex.raw(
                `DELETE FROM admin.rel_role_permissions WHERE role_id = ? AND subject = 'applicationAliases' AND action = 'update'`,
                [aliasRoleId]
            )
            await knex.raw(`DELETE FROM admin.rel_user_roles WHERE user_id = ? AND role_id = ?`, [nonMemberId, aliasRoleId])
        }
    })

    it('allows delete-only alias release through the guarded function without granting direct SELECT', async () => {
        await knex.raw(`INSERT INTO admin.rel_role_permissions (role_id, subject, action) VALUES (?, 'applicationAliases', 'delete')`, [
            aliasRoleId
        ])
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [nonMemberId, aliasRoleId])
        const alias = `alias-auth-delete-only-${suffix}`
        const inserted = await insertFixtureAlias(alias)
        const deleteOnlyAliasId = inserted.rows[0]?.id as string

        try {
            await expect(
                withAuthenticatedClaims(nonMemberId, (trx) =>
                    trx.raw(`SELECT * FROM applications.mutate_application_alias(?, ?, 'rename', ?)`, [
                        deleteOnlyAliasId,
                        `renamed-${suffix}`,
                        nonMemberId
                    ])
                )
            ).rejects.toMatchObject({ code: ALIAS_FUNCTION_DENIED })

            await withAuthenticatedClaims(nonMemberId, async (trx) => {
                const accessible = await trx.raw(
                    `SELECT ${ALIAS_FUNCTION_RETURN_COLUMNS} FROM applications.get_application_alias_for_management(?, ?, 'delete')`,
                    [deleteOnlyAliasId, nonMemberId]
                )
                expect(accessible.rows[0]).toMatchObject({ id: deleteOnlyAliasId, applicationId, alias })

                const released = await trx.raw(
                    `SELECT ${ALIAS_FUNCTION_RETURN_COLUMNS} FROM applications.mutate_application_alias(?, NULL, 'release', ?)`,
                    [deleteOnlyAliasId, nonMemberId]
                )
                expect(released.rows[0]).toMatchObject({ id: deleteOnlyAliasId, applicationId, alias, releasedAt: expect.any(Date) })

                const directRead = await trx.raw(`SELECT alias FROM applications.obj_application_aliases WHERE id = ?`, [deleteOnlyAliasId])
                expect(directRead.rows).toEqual([])
            })
        } finally {
            await knex.raw(
                `DELETE FROM admin.rel_role_permissions WHERE role_id = ? AND subject = 'applicationAliases' AND action = 'delete'`,
                [aliasRoleId]
            )
            await knex.raw(`DELETE FROM admin.rel_user_roles WHERE user_id = ? AND role_id = ?`, [nonMemberId, aliasRoleId])
        }
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
