import type { Knex } from 'knex'
import { generateUuidV7, type DbExecutor, type SqlQueryable } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import {
    createGlobalShortLink,
    lockActiveGlobalShortLinkApplication,
    releaseActiveGlobalShortLinksForApplication,
    releaseGlobalShortLink
} from '../../persistence/globalShortLinksStore'
import { deleteApplicationWithSchema } from '../../persistence/applicationsStore'
import {
    lockApplicationForPublicGuestWithdrawal,
    lockPublicApplicationForGuestAssessment
} from '../../persistence/publicGuestApplicationStore'
import { lockPublicWorkspaceForMutation, setPublicWorkspaceContext } from '../../shared/publicRuntimeAccess'
import { lockActiveRuntimeWorkspaceContext } from '../../services/applicationWorkspaces'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const createId = generateUuidV7

const waitForLockWait = async (knex: Knex, pid: number, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const result = await knex.raw(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?`, [pid])
        if (result.rows[0]?.wait_event_type === 'Lock') return true
        await new Promise((resolve) => setTimeout(resolve, 10))
    }

    return false
}

const toSqlQueryable = (trx: Knex.Transaction): SqlQueryable => ({
    query: async <T>(sql: string, parameters: unknown[] = []): Promise<T[]> => {
        const orderedParameters: unknown[] = []
        const knexSql = sql.replace(/\$(\d+)/gu, (_placeholder, position: string) => {
            orderedParameters.push(parameters[Number(position) - 1])
            return '?'
        })
        const result = await trx.raw(knexSql, orderedParameters)
        return result.rows as T[]
    }
})

const toDbExecutor = (trx: Knex.Transaction): DbExecutor => {
    const queryable = toSqlQueryable(trx)
    const executor: DbExecutor = {
        query: queryable.query,
        transaction: (callback) => callback(executor),
        isReleased: () => false
    }
    return executor
}

describeIntegration('global short-link application RLS (requires PostgreSQL)', () => {
    let knex: Knex
    const ownerA = createId()
    const ownerB = createId()
    const unrelatedOwner = createId()
    const editorUser = createId()
    const aliasOnlyUser = createId()
    const superuser = createId()
    const aliasRoleId = createId()
    const superuserRoleId = createId()
    const applicationA = createId()
    const applicationB = createId()
    const unrelatedApplication = createId()
    const applicationCreateDeleteRace = createId()
    const applicationPublicGuestRace = createId()
    const linkA = createId()
    const linkB = createId()
    const suffix = Date.now().toString(36)
    const reusableSlug = `qa-${suffix}`
    const raceSlug = `qa-race-${suffix}`

    const withClaims = <T>(userId: string, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
        knex.transaction(async (trx) => {
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: userId })])
            await trx.raw('SET LOCAL ROLE authenticated')
            return callback(trx)
        })

    const withActorClaims = <T>(userId: string, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
        knex.transaction(async (trx) => {
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: userId })])
            return callback(trx)
        })

    const insertUser = (id: string) =>
        knex.raw(
            `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, confirmation_token, created_at, updated_at)
             VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', '', now(), now())
             ON CONFLICT (id) DO NOTHING`,
            [id, `short-link-rls-${id}@example.test`]
        )

    const insertLink = (id: string, applicationId: string, slug: string) =>
        knex.raw(
            `INSERT INTO applications.obj_global_short_links (id, slug, target_kind, application_id)
             VALUES (?, ?, 'application-entry', ?)`,
            [id, slug, applicationId]
        )

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 3 } })

        for (const userId of [ownerA, ownerB, unrelatedOwner, editorUser, aliasOnlyUser, superuser]) await insertUser(userId)

        for (const applicationId of [
            applicationA,
            applicationB,
            unrelatedApplication,
            applicationCreateDeleteRace,
            applicationPublicGuestRace
        ]) {
            await knex.raw(`INSERT INTO applications.obj_applications (id, name) VALUES (?, ?::jsonb)`, [
                applicationId,
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `short-link-rls-${applicationId}` } } })
            ])
        }
        await knex.raw(`UPDATE applications.obj_applications SET is_public = true WHERE id = ?`, [applicationPublicGuestRace])

        for (const [applicationId, userId, role] of [
            [applicationA, ownerA, 'owner'],
            [applicationA, editorUser, 'editor'],
            [applicationB, ownerB, 'owner'],
            [unrelatedApplication, unrelatedOwner, 'owner'],
            [applicationCreateDeleteRace, ownerA, 'owner']
        ]) {
            await knex.raw(`INSERT INTO applications.rel_application_users (application_id, user_id, role) VALUES (?, ?, ?)`, [
                applicationId,
                userId,
                role
            ])
        }

        const localizedRole = (value: string) => JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: value } } })
        await knex.raw(
            `INSERT INTO admin.obj_roles (id, codename, name, is_superuser, is_system)
             VALUES (?, ?::jsonb, ?::jsonb, false, false)`,
            [aliasRoleId, localizedRole(`ShortLinkAliasOnly${suffix}`), localizedRole(`Short link alias only ${suffix}`)]
        )
        await knex.raw(
            `INSERT INTO admin.rel_role_permissions (role_id, subject, action)
             SELECT ?, 'applicationAliases', action FROM unnest(ARRAY['read', 'create', 'update', 'delete', 'manage']) AS action`,
            [aliasRoleId]
        )
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [aliasOnlyUser, aliasRoleId])

        await knex.raw(
            `INSERT INTO admin.obj_roles (id, codename, name, is_superuser, is_system)
             VALUES (?, ?::jsonb, ?::jsonb, true, true)`,
            [superuserRoleId, localizedRole(`ShortLinkSuperuser${suffix}`), localizedRole(`Short link superuser ${suffix}`)]
        )
        await knex.raw(`INSERT INTO admin.rel_user_roles (user_id, role_id, granted_by) VALUES (?, ?, NULL)`, [superuser, superuserRoleId])

        await insertLink(linkA, applicationA, reusableSlug)
        await insertLink(linkB, applicationB, `other-${suffix}`)
    })

    afterAll(async () => {
        if (!knex) return
        try {
            await knex.raw(`DELETE FROM applications.obj_global_short_links WHERE application_id IN (?, ?, ?, ?, ?)`, [
                applicationA,
                applicationB,
                unrelatedApplication,
                applicationCreateDeleteRace,
                applicationPublicGuestRace
            ])
            await knex.raw(`DELETE FROM applications.rel_application_users WHERE application_id IN (?, ?, ?, ?)`, [
                applicationA,
                applicationB,
                unrelatedApplication,
                applicationCreateDeleteRace
            ])
            await knex.raw(`DELETE FROM applications.obj_applications WHERE id IN (?, ?, ?, ?, ?)`, [
                applicationA,
                applicationB,
                unrelatedApplication,
                applicationCreateDeleteRace,
                applicationPublicGuestRace
            ])
            await knex.raw(`DELETE FROM admin.rel_user_roles WHERE user_id IN (?, ?, ?, ?, ?, ?)`, [
                ownerA,
                ownerB,
                unrelatedOwner,
                editorUser,
                aliasOnlyUser,
                superuser
            ])
            await knex.raw(`DELETE FROM admin.rel_role_permissions WHERE role_id = ?`, [aliasRoleId])
            await knex.raw(`DELETE FROM admin.obj_roles WHERE id IN (?, ?)`, [aliasRoleId, superuserRoleId])
            await knex.raw(`DELETE FROM auth.users WHERE id IN (?, ?, ?, ?, ?, ?)`, [
                ownerA,
                ownerB,
                unrelatedOwner,
                editorUser,
                aliasOnlyUser,
                superuser
            ])
        } finally {
            await knex.destroy()
        }
    })

    it('lets an application owner manage only that application and reuse a released slug', async () => {
        const ownerVisibleRows = await withClaims(ownerA, (trx) =>
            trx.raw(`SELECT id FROM applications.obj_global_short_links WHERE application_id IN (?, ?) ORDER BY application_id`, [
                applicationA,
                applicationB
            ])
        )
        expect(ownerVisibleRows.rows.map((row: { id: string }) => row.id)).toEqual([linkA])

        const released = await withClaims(ownerA, (trx) => releaseGlobalShortLink(toSqlQueryable(trx), linkA, applicationA, ownerA))
        expect(released).toMatchObject({ id: linkA, releasedAt: expect.any(String) })

        const replacementId = createId()
        const replacement = await withClaims(ownerA, (trx) =>
            trx.raw(
                `INSERT INTO applications.obj_global_short_links
                    (id, slug, target_kind, application_id, _upl_created_by, _upl_updated_by)
                 VALUES (?, ?, 'application-entry', ?, ?, ?)
                 RETURNING id, slug`,
                [replacementId, reusableSlug, applicationA, ownerA, ownerA]
            )
        )
        expect(replacement.rows).toEqual([{ id: replacementId, slug: reusableSlug }])
    })

    it('rolls back global link release when the containing application transaction fails', async () => {
        await expect(
            withClaims(ownerB, async (trx) => {
                await releaseActiveGlobalShortLinksForApplication(toSqlQueryable(trx), applicationB, ownerB)
                throw new Error('force transaction rollback')
            })
        ).rejects.toThrow('force transaction rollback')

        const persisted = await knex.raw(`SELECT released_at AS "releasedAt" FROM applications.obj_global_short_links WHERE id = ?`, [
            linkB
        ])
        expect(persisted.rows).toEqual([{ releasedAt: null }])
    })

    it('hides another application link and denies its release to a non-member', async () => {
        const crossApplicationRead = await withClaims(ownerA, (trx) =>
            trx.raw(`SELECT id FROM applications.obj_global_short_links WHERE id = ?`, [linkB])
        )
        expect(crossApplicationRead.rows).toEqual([])

        const crossApplicationRelease = await withClaims(ownerA, (trx) =>
            trx.raw(
                `UPDATE applications.obj_global_short_links
                 SET released_at = now(), released_by = ?, _upl_updated_by = ?
                 WHERE id = ?
                 RETURNING id`,
                [ownerA, ownerA, linkB]
            )
        )
        expect(crossApplicationRelease.rows).toEqual([])

        const unrelatedRead = await withClaims(unrelatedOwner, (trx) =>
            trx.raw(`SELECT id FROM applications.obj_global_short_links WHERE application_id = ?`, [applicationA])
        )
        expect(unrelatedRead.rows).toEqual([])
    })

    it('does not let global applicationAliases permission substitute for target-application membership', async () => {
        const aliasOnlyRead = await withClaims(aliasOnlyUser, (trx) =>
            trx.raw(`SELECT id FROM applications.obj_global_short_links WHERE application_id = ?`, [applicationA])
        )
        expect(aliasOnlyRead.rows).toEqual([])

        await expect(
            withClaims(aliasOnlyUser, (trx) =>
                trx.raw(
                    `INSERT INTO applications.obj_global_short_links
                        (id, slug, target_kind, application_id, _upl_created_by, _upl_updated_by)
                     VALUES (?, ?, 'application-entry', ?, ?, ?)`,
                    [createId(), `denied-${suffix}`, applicationA, aliasOnlyUser, aliasOnlyUser]
                )
            )
        ).rejects.toMatchObject({ code: '42501' })
    })

    it('denies an application editor link-management access without granting direct application-table reads', async () => {
        const editorRead = await withClaims(editorUser, (trx) =>
            trx.raw(`SELECT id FROM applications.obj_global_short_links WHERE id = ?`, [linkA])
        )
        expect(editorRead.rows).toEqual([])

        await expect(
            withClaims(editorUser, (trx) =>
                trx.raw(
                    `INSERT INTO applications.obj_global_short_links
                        (id, slug, target_kind, application_id, _upl_created_by, _upl_updated_by)
                     VALUES (?, ?, 'application-entry', ?, ?, ?)`,
                    [createId(), `editor-denied-${suffix}`, applicationA, editorUser, editorUser]
                )
            )
        ).rejects.toMatchObject({ code: '42501' })

        const applicationReadPrivilege = await knex.raw(
            `SELECT has_table_privilege('authenticated', 'applications.obj_applications', 'SELECT') AS "canReadApplications"`
        )
        expect(applicationReadPrivilege.rows).toEqual([{ canReadApplications: false }])

        await expect(withClaims(ownerA, (trx) => lockActiveGlobalShortLinkApplication(toSqlQueryable(trx), applicationA))).resolves.toBe(
            true
        )
    })

    it('preserves the superuser RLS bypass across applications', async () => {
        const visibleRows = await withClaims(superuser, (trx) =>
            trx.raw(`SELECT id FROM applications.obj_global_short_links WHERE id = ?`, [linkB])
        )
        expect(visibleRows.rows.map((row: { id: string }) => row.id)).toEqual([linkB])
    })

    it('serializes every public guest transaction with application access withdrawal', async () => {
        let signalPublicReadLocked!: () => void
        const publicReadLocked = new Promise<void>((resolve) => {
            signalPublicReadLocked = resolve
        })
        let releasePublicRead!: () => void
        const publicReadGate = new Promise<void>((resolve) => {
            releasePublicRead = resolve
        })

        const publicRead = knex.transaction(async (trx) => {
            expect(await lockPublicApplicationForGuestAssessment(toSqlQueryable(trx), applicationPublicGuestRace)).toBe(true)
            signalPublicReadLocked()
            await publicReadGate
        })
        await publicReadLocked

        let signalWithdrawalStarted!: (pid: number) => void
        const withdrawalStarted = new Promise<number>((resolve) => {
            signalWithdrawalStarted = resolve
        })
        let withdrawalCompleted = false
        const withdrawal = knex.transaction(async (trx) => {
            const [{ pid }] = (await trx.raw(`SELECT pg_backend_pid() AS pid`)).rows as Array<{ pid: number }>
            signalWithdrawalStarted(pid)
            const application = await lockApplicationForPublicGuestWithdrawal(toSqlQueryable(trx), applicationPublicGuestRace)
            expect(application?.isPublic).toBe(true)
            await trx.raw(`UPDATE applications.obj_applications SET is_public = false WHERE id = ?`, [applicationPublicGuestRace])
            withdrawalCompleted = true
        })

        const withdrawalPid = await withdrawalStarted
        try {
            expect(await waitForLockWait(knex, withdrawalPid, 2000)).toBe(true)
            expect(withdrawalCompleted).toBe(false)
        } finally {
            releasePublicRead()
        }

        await Promise.all([publicRead, withdrawal])
        expect(withdrawalCompleted).toBe(true)
        await expect(
            knex.transaction((trx) => lockPublicApplicationForGuestAssessment(toSqlQueryable(trx), applicationPublicGuestRace))
        ).resolves.toBe(false)
    }, 15000)

    it('avoids guest workspace lock-upgrade deadlocks while archival is in progress', async () => {
        const schemaName = `app_${createId().replace(/-/gu, '')}`
        const workspaceId = createId()
        const workspaceTable = qSchemaTable(schemaName, '_app_workspaces')
        await knex.raw('CREATE SCHEMA ??', [schemaName])
        try {
            await knex.raw(
                `CREATE TABLE ${workspaceTable} (
                    id uuid PRIMARY KEY,
                    status text NOT NULL,
                    workspace_type text NOT NULL,
                    personal_user_id uuid,
                    _upl_deleted boolean NOT NULL,
                    _app_deleted boolean NOT NULL
                )`
            )
            await knex.raw(
                `INSERT INTO ${workspaceTable} (id, status, workspace_type, personal_user_id, _upl_deleted, _app_deleted)
                 VALUES (?, 'active', 'shared', NULL, false, false)`,
                [workspaceId]
            )

            let signalGuestContextSet!: () => void
            const guestContextSet = new Promise<void>((resolve) => {
                signalGuestContextSet = resolve
            })
            let signalGuestPid!: (pid: number) => void
            const guestPidReady = new Promise<number>((resolve) => {
                signalGuestPid = resolve
            })
            let releaseGuestMutation!: () => void
            const guestMutationGate = new Promise<void>((resolve) => {
                releaseGuestMutation = resolve
            })
            let guestMutationCompleted = false
            let guestMutationResult: boolean | null = null
            const guestRequest = knex.transaction(async (trx) => {
                expect(await setPublicWorkspaceContext(toDbExecutor(trx), schemaName, workspaceId)).toBe(true)
                signalGuestContextSet()
                const [{ pid }] = (await trx.raw(`SELECT pg_backend_pid() AS pid`)).rows as Array<{ pid: number }>
                signalGuestPid(pid)
                await guestMutationGate
                guestMutationResult = await lockPublicWorkspaceForMutation(toDbExecutor(trx), schemaName, workspaceId)
                guestMutationCompleted = true
            })
            await guestContextSet

            let signalArchivalLockAcquired!: () => void
            const archivalLockAcquired = new Promise<void>((resolve) => {
                signalArchivalLockAcquired = resolve
            })
            let releaseArchival!: () => void
            const archivalGate = new Promise<void>((resolve) => {
                releaseArchival = resolve
            })
            let archivalCompleted = false
            const archival = knex.transaction(async (trx) => {
                await trx.raw(`SELECT id FROM ${workspaceTable} WHERE id = ? AND status = 'active' FOR UPDATE`, [workspaceId])
                signalArchivalLockAcquired()
                await archivalGate
                await trx.raw(`UPDATE ${workspaceTable} SET status = 'archived', _upl_deleted = true WHERE id = ?`, [workspaceId])
                archivalCompleted = true
            })

            try {
                const acquired = await Promise.race([
                    archivalLockAcquired.then(() => true),
                    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
                ])
                expect(acquired).toBe(true)

                releaseGuestMutation()
                const guestPid = await guestPidReady
                expect(await waitForLockWait(knex, guestPid, 2000)).toBe(true)
                expect(archivalCompleted).toBe(false)
            } finally {
                releaseGuestMutation()
                releaseArchival()
            }

            await Promise.all([guestRequest, archival])
            expect(archivalCompleted).toBe(true)
            expect(guestMutationCompleted).toBe(true)
            expect(guestMutationResult).toBe(false)
            await expect(knex.transaction((trx) => setPublicWorkspaceContext(toDbExecutor(trx), schemaName, workspaceId))).resolves.toBe(
                false
            )
        } finally {
            await knex.raw('DROP SCHEMA IF EXISTS ?? CASCADE', [schemaName])
        }
    }, 15000)

    it('serializes authenticated assessment reports with workspace archival, including personal workspaces', async () => {
        const schemaName = `app_${createId().replace(/-/gu, '')}`
        const workspaceId = createId()
        const workspaceTable = qSchemaTable(schemaName, '_app_workspaces')
        await knex.raw('CREATE SCHEMA ??', [schemaName])
        try {
            await knex.raw(
                `CREATE TABLE ${workspaceTable} (
                    id uuid PRIMARY KEY,
                    status text NOT NULL,
                    workspace_type text NOT NULL,
                    personal_user_id uuid,
                    _upl_deleted boolean NOT NULL,
                    _app_deleted boolean NOT NULL
                )`
            )
            await knex.raw(
                `INSERT INTO ${workspaceTable} (id, status, workspace_type, personal_user_id, _upl_deleted, _app_deleted)
                 VALUES (?, 'active', 'personal', ?, false, false)`,
                [workspaceId, ownerA]
            )

            let signalReportScopeLocked!: () => void
            const reportScopeLocked = new Promise<void>((resolve) => {
                signalReportScopeLocked = resolve
            })
            let releaseReportScope!: () => void
            const reportScopeGate = new Promise<void>((resolve) => {
                releaseReportScope = resolve
            })
            const report = knex.transaction(async (trx) => {
                expect(await lockActiveRuntimeWorkspaceContext(toDbExecutor(trx), schemaName, workspaceId)).toBe(true)
                signalReportScopeLocked()
                await reportScopeGate
            })
            await reportScopeLocked

            let signalArchivalStarted!: (pid: number) => void
            const archivalStarted = new Promise<number>((resolve) => {
                signalArchivalStarted = resolve
            })
            let archivalCompleted = false
            const archival = knex.transaction(async (trx) => {
                const [{ pid }] = (await trx.raw(`SELECT pg_backend_pid() AS pid`)).rows as Array<{ pid: number }>
                signalArchivalStarted(pid)
                await trx.raw(`SELECT id FROM ${workspaceTable} WHERE id = ? AND status = 'active' FOR UPDATE`, [workspaceId])
                await trx.raw(`UPDATE ${workspaceTable} SET status = 'archived', _upl_deleted = true WHERE id = ?`, [workspaceId])
                archivalCompleted = true
            })

            const archivalPid = await archivalStarted
            try {
                expect(await waitForLockWait(knex, archivalPid, 2000)).toBe(true)
                expect(archivalCompleted).toBe(false)
            } finally {
                releaseReportScope()
            }

            await Promise.all([report, archival])
            expect(archivalCompleted).toBe(true)
            await expect(
                knex.transaction((trx) => lockActiveRuntimeWorkspaceContext(toDbExecutor(trx), schemaName, workspaceId))
            ).resolves.toBe(false)
        } finally {
            await knex.raw('DROP SCHEMA IF EXISTS ?? CASCADE', [schemaName])
        }
    }, 15000)

    it('serializes target-link creation with application deletion and releases the committed link', async () => {
        let signalLockAcquired!: () => void
        let continueCreation!: () => void
        const lockAcquired = new Promise<void>((resolve) => {
            signalLockAcquired = resolve
        })
        const creationGate = new Promise<void>((resolve) => {
            continueCreation = resolve
        })

        const creation = withClaims(ownerA, async (trx) => {
            const queryable = toSqlQueryable(trx)
            expect(await lockActiveGlobalShortLinkApplication(queryable, applicationCreateDeleteRace)).toBe(true)
            signalLockAcquired()
            await creationGate
            return createGlobalShortLink(
                queryable,
                { slug: raceSlug, target: { kind: 'application-entry', applicationId: applicationCreateDeleteRace } },
                ownerA
            )
        })
        await lockAcquired

        let signalDeletionStarted!: (pid: number) => void
        const deletionStarted = new Promise<number>((resolve) => {
            signalDeletionStarted = resolve
        })
        let deletionCompleted = false
        const deletion = withActorClaims(ownerA, async (trx) => {
            const [{ pid }] = (await trx.raw(`SELECT pg_backend_pid() AS pid`)).rows as Array<{ pid: number }>
            signalDeletionStarted(pid)
            await deleteApplicationWithSchema(toDbExecutor(trx), {
                applicationId: applicationCreateDeleteRace,
                schemaName: null,
                userId: ownerA
            })
            deletionCompleted = true
        })

        const deletionPid = await deletionStarted
        try {
            expect(await waitForLockWait(knex, deletionPid, 2000)).toBe(true)
            expect(deletionCompleted).toBe(false)
        } finally {
            continueCreation()
        }

        const created = await creation
        await deletion
        expect(created).toMatchObject({ slug: raceSlug, target: { applicationId: applicationCreateDeleteRace } })
        expect(deletionCompleted).toBe(true)

        const persisted = await knex.raw(
            `SELECT link.released_at AS "releasedAt", application._app_deleted AS "applicationDeleted"
             FROM applications.obj_global_short_links link
             INNER JOIN applications.obj_applications application ON application.id = link.application_id
             WHERE link.slug = ?`,
            [raceSlug]
        )
        expect(persisted.rows).toEqual([{ releasedAt: expect.any(Date), applicationDeleted: true }])

        await expect(
            withClaims(ownerA, (trx) => lockActiveGlobalShortLinkApplication(toSqlQueryable(trx), applicationCreateDeleteRace))
        ).resolves.toBe(false)
    }, 15000)

    it('rolls back link release with application deletion and permits slug reuse after commit', async () => {
        await expect(
            withActorClaims(ownerB, async (trx) => {
                await deleteApplicationWithSchema(toDbExecutor(trx), {
                    applicationId: applicationB,
                    schemaName: null,
                    userId: ownerB
                })
                throw new Error('force application deletion rollback')
            })
        ).rejects.toThrow('force application deletion rollback')

        const rolledBackState = await knex.raw(
            `SELECT application._app_deleted AS "applicationDeleted", link.released_at AS "releasedAt"
             FROM applications.obj_applications application
             INNER JOIN applications.obj_global_short_links link ON link.application_id = application.id
             WHERE application.id = ? AND link.id = ?`,
            [applicationB, linkB]
        )
        expect(rolledBackState.rows).toEqual([{ applicationDeleted: false, releasedAt: null }])

        await withActorClaims(ownerB, (trx) =>
            deleteApplicationWithSchema(toDbExecutor(trx), {
                applicationId: applicationB,
                schemaName: null,
                userId: ownerB
            })
        )

        const deletedState = await knex.raw(
            `SELECT application._app_deleted AS "applicationDeleted", link.released_at AS "releasedAt", link.slug
             FROM applications.obj_applications application
             INNER JOIN applications.obj_global_short_links link ON link.application_id = application.id
             WHERE application.id = ? AND link.id = ?`,
            [applicationB, linkB]
        )
        expect(deletedState.rows).toEqual([{ applicationDeleted: true, releasedAt: expect.any(Date), slug: `other-${suffix}` }])

        const replacement = await withClaims(ownerA, (trx) =>
            createGlobalShortLink(
                toSqlQueryable(trx),
                { slug: `other-${suffix}`, target: { kind: 'application-entry', applicationId: applicationA } },
                ownerA
            )
        )
        expect(replacement).toMatchObject({ slug: `other-${suffix}`, target: { applicationId: applicationA } })
    }, 15000)
})
