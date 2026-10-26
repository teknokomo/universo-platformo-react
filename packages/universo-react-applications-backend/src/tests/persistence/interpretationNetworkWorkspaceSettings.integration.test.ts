import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import {
    acquireWorkspaceBaselineLock,
    lockApplicationMembershipForRuntimeMutation,
    lockActiveRuntimeWorkspaceContext,
    validateActiveRuntimeWorkspaceContext
} from '../../services/runtimeWorkspaceContext'
import { tombstoneApplicationLayoutWorkspaceSettings } from '../../persistence/applicationLayoutWorkspaceSettingsStore'
import { lockInterpretationNetworkCellStylePolicy } from '../../persistence/workspaceSettingsStore'
import {
    resetWorkspaceSettingOverride,
    upsertWorkspaceSettingOverride,
    WORKSPACE_SETTINGS_ERROR_CODES,
    WorkspaceSettingsError
} from '../../services/workspaceSettingsService'
import { updateWorkspace } from '../../services/runtimeWorkspaceLifecycleService'
import { lockWorkspaceMembershipForMutation } from '../../services/runtimeWorkspaceMembershipService'
import { createInterpretationNetworkWorkspaceSettingsFixture } from './interpretationNetworkWorkspaceSettingsFixture'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Interpretation Network PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const fixture = createInterpretationNetworkWorkspaceSettingsFixture(DATABASE_TEST_URL)
const { schemaName, layoutId, workspaceIds, actorUserId, applicationId, settingKey, widgetTarget, applicationSettings } = fixture

describeIntegration('Interpretation Network workspace settings PostgreSQL invariants (requires PostgreSQL)', () => {
    let knex: Knex
    let competingKnex: Knex

    beforeAll(async () => {
        ;({ knex, competingKnex } = await fixture.setup())
    })

    afterAll(async () => {
        await fixture.teardown()
    })

    it('serializes concurrent lifecycle updates without upgrading a shared preflight lock', async () => {
        let readyCount = 0
        let releaseReady!: () => void
        const ready = new Promise<void>((resolve) => {
            releaseReady = resolve
        })
        const updateInTransaction = (name: string) =>
            knex.transaction(async (transaction) => {
                const executor = createKnexExecutor(transaction)
                expect(await validateActiveRuntimeWorkspaceContext(executor, schemaName, workspaceIds[0]!)).toBe(true)
                readyCount += 1
                if (readyCount === 2) releaseReady()
                await ready
                await updateWorkspace(executor, {
                    schemaName,
                    applicationId,
                    workspaceId: workspaceIds[0]!,
                    name: { _schema: '1', _primary: 'en', locales: { en: { content: name } } },
                    actorUserId
                })
            })

        await expect(Promise.all([updateInTransaction('Concurrent A'), updateInTransaction('Concurrent B')])).resolves.toHaveLength(2)

        const updatedWorkspace = await knex.raw(
            `SELECT name->'locales'->'en'->>'content' AS name FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`,
            [workspaceIds[0]]
        )
        expect(['Concurrent A', 'Concurrent B']).toContain(updatedWorkspace.rows[0]?.name)
    })

    it('serializes workspace-owner authorization with concurrent role revocation', async () => {
        const waitForSignal = async <T>(signal: Promise<T>, operation: string, timeoutMs = 10_000): Promise<T> => {
            let timeout: ReturnType<typeof setTimeout> | undefined
            try {
                return await Promise.race([
                    signal,
                    new Promise<T>((_, reject) => {
                        timeout = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
                    })
                ])
            } finally {
                if (timeout) clearTimeout(timeout)
            }
        }

        const rolesQt = qSchemaTable(schemaName, '_app_workspace_roles')
        const membershipsQt = qSchemaTable(schemaName, '_app_workspace_user_roles')
        const workspacesQt = qSchemaTable(schemaName, '_app_workspaces')
        const roleId = generateUuidV7()
        const firstMembershipId = generateUuidV7()
        const secondMembershipId = generateUuidV7()
        const firstUserId = generateUuidV7()
        const secondUserId = generateUuidV7()
        const firstWorkspaceId = workspaceIds[4]!
        const secondWorkspaceId = workspaceIds[2]!

        await knex.raw(`INSERT INTO ${rolesQt} (id, codename, name) VALUES (?, 'owner', '{}'::jsonb)`, [roleId])
        await knex.raw(
            `INSERT INTO ${membershipsQt} (id, workspace_id, user_id, role_id)
             VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
            [firstMembershipId, firstWorkspaceId, firstUserId, roleId, secondMembershipId, secondWorkspaceId, secondUserId, roleId]
        )

        let signalFirstOwnerLocked!: () => void
        let releaseFirstOwner!: () => void
        let signalFirstOwnerPid!: (pid: number) => void
        let signalFirstRevocationPid!: (pid: number) => void
        const firstOwnerLocked = new Promise<void>((resolve) => {
            signalFirstOwnerLocked = resolve
        })
        const firstOwnerMayCommit = new Promise<void>((resolve) => {
            releaseFirstOwner = resolve
        })
        const firstOwnerPid = new Promise<number>((resolve) => {
            signalFirstOwnerPid = resolve
        })
        const firstRevocationPid = new Promise<number>((resolve) => {
            signalFirstRevocationPid = resolve
        })

        const firstOwnerMutation = createKnexExecutor(knex).transaction(async (tx) => {
            const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            signalFirstOwnerPid(rows[0]!.pid)
            await acquireWorkspaceBaselineLock(tx, schemaName, applicationId)
            const membership = await lockWorkspaceMembershipForMutation(tx, {
                schemaName,
                applicationId,
                workspaceId: firstWorkspaceId,
                userId: firstUserId
            })
            expect(membership?.roleCodename).toBe('owner')
            await updateWorkspace(tx, {
                schemaName,
                applicationId,
                workspaceId: firstWorkspaceId,
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Authorized update' } } },
                actorUserId: firstUserId
            })
            signalFirstOwnerLocked()
            await firstOwnerMayCommit
        })

        let firstRevocation: Promise<void> | undefined
        let firstBlockingError: unknown
        try {
            await waitForSignal(firstOwnerLocked, 'Owner mutation did not reach its locked state')
            firstRevocation = createKnexExecutor(competingKnex).transaction(async (tx) => {
                const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                signalFirstRevocationPid(rows[0]!.pid)
                await acquireWorkspaceBaselineLock(tx, schemaName, applicationId)
                await tx.query(
                    `UPDATE ${membershipsQt}
                     SET _upl_deleted = true, _app_deleted = true
                     WHERE id = $1`,
                    [firstMembershipId]
                )
            })
            await waitForBlockingPid(
                await waitForSignal(firstRevocationPid, 'Owner revocation did not acquire a database connection'),
                await waitForSignal(firstOwnerPid, 'Owner mutation did not acquire a database connection'),
                'Owner revocation'
            )
        } catch (error) {
            firstBlockingError = error
        } finally {
            releaseFirstOwner()
        }
        const firstResults = await Promise.allSettled([firstOwnerMutation, ...(firstRevocation ? [firstRevocation] : [])])
        const firstFailure = firstResults.find((result) => result.status === 'rejected')
        if (firstFailure?.status === 'rejected') throw firstFailure.reason
        if (firstBlockingError) throw firstBlockingError

        const firstWorkspace = await knex.raw(`SELECT name->'locales'->'en'->>'content' AS name FROM ${workspacesQt} WHERE id = ?`, [
            firstWorkspaceId
        ])
        expect(firstWorkspace.rows[0]?.name).toBe('Authorized update')

        let signalRevocationLocked!: () => void
        let releaseRevocation!: () => void
        let signalSecondRevocationPid!: (pid: number) => void
        let signalSecondOwnerPid!: (pid: number) => void
        const revocationLocked = new Promise<void>((resolve) => {
            signalRevocationLocked = resolve
        })
        const revocationMayCommit = new Promise<void>((resolve) => {
            releaseRevocation = resolve
        })
        const secondRevocationPid = new Promise<number>((resolve) => {
            signalSecondRevocationPid = resolve
        })
        const secondOwnerPid = new Promise<number>((resolve) => {
            signalSecondOwnerPid = resolve
        })

        const secondRevocation = createKnexExecutor(competingKnex).transaction(async (tx) => {
            const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            signalSecondRevocationPid(rows[0]!.pid)
            await acquireWorkspaceBaselineLock(tx, schemaName, applicationId)
            await tx.query(
                `UPDATE ${membershipsQt}
                 SET _upl_deleted = true, _app_deleted = true
                 WHERE id = $1`,
                [secondMembershipId]
            )
            signalRevocationLocked()
            await revocationMayCommit
        })

        let secondOwnerMutation: Promise<boolean> | undefined
        let secondBlockingError: unknown
        try {
            await waitForSignal(revocationLocked, 'Role revocation did not reach its locked state')
            secondOwnerMutation = createKnexExecutor(knex).transaction(async (tx) => {
                const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                signalSecondOwnerPid(rows[0]!.pid)
                await acquireWorkspaceBaselineLock(tx, schemaName, applicationId)
                const membership = await lockWorkspaceMembershipForMutation(tx, {
                    schemaName,
                    applicationId,
                    workspaceId: secondWorkspaceId,
                    userId: secondUserId
                })
                if (!membership || membership.roleCodename !== 'owner') return false
                await updateWorkspace(tx, {
                    schemaName,
                    applicationId,
                    workspaceId: secondWorkspaceId,
                    name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Must not be written' } } },
                    actorUserId: secondUserId
                })
                return true
            })
            await waitForBlockingPid(
                await waitForSignal(secondOwnerPid, 'Owner mutation did not acquire a database connection'),
                await waitForSignal(secondRevocationPid, 'Role revocation did not acquire a database connection'),
                'Owner mutation'
            )
        } catch (error) {
            secondBlockingError = error
        } finally {
            releaseRevocation()
        }
        const secondResults = await Promise.allSettled([secondRevocation, ...(secondOwnerMutation ? [secondOwnerMutation] : [])])
        const secondFailure = secondResults.find((result) => result.status === 'rejected')
        if (secondFailure?.status === 'rejected') throw secondFailure.reason
        if (secondBlockingError) throw secondBlockingError
        expect(secondResults.find((result) => result.status === 'fulfilled' && result.value === false)).toBeDefined()

        const secondWorkspace = await knex.raw(`SELECT name->'locales'->'en'->>'content' AS name FROM ${workspacesQt} WHERE id = ?`, [
            secondWorkspaceId
        ])
        expect(secondWorkspace.rows[0]?.name).not.toBe('Must not be written')

        async function waitForBlockingPid(pid: number, expectedBlockerPid: number, operation: string): Promise<void> {
            const deadline = Date.now() + 10_000
            while (Date.now() < deadline) {
                const result = await knex.raw('SELECT ?::integer = ANY(pg_blocking_pids(?::integer)) AS blocked', [expectedBlockerPid, pid])
                if (result.rows[0]?.blocked === true) return
                await new Promise((resolve) => setTimeout(resolve, 20))
            }
            throw new Error(`${operation} was not blocked by the expected PostgreSQL backend ${expectedBlockerPid}`)
        }
    }, 60_000)

    it('holds an active application membership through a runtime mutation and fails closed after revocation', async () => {
        const waitForSignal = async <T>(signal: Promise<T>, operation: string, timeoutMs = 10_000): Promise<T> => {
            let timeout: ReturnType<typeof setTimeout> | undefined
            try {
                return await Promise.race([
                    signal,
                    new Promise<T>((_, reject) => {
                        timeout = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
                    })
                ])
            } finally {
                if (timeout) clearTimeout(timeout)
            }
        }
        const waitForBlockingPid = async (pid: number, expectedBlockerPid: number, operation: string): Promise<void> => {
            const deadline = Date.now() + 10_000
            while (Date.now() < deadline) {
                const result = await knex.raw('SELECT ?::integer = ANY(pg_blocking_pids(?::integer)) AS blocked', [expectedBlockerPid, pid])
                if (result.rows[0]?.blocked === true) return
                await new Promise((resolve) => setTimeout(resolve, 20))
            }
            throw new Error(`${operation} was not blocked by the expected PostgreSQL backend ${expectedBlockerPid}`)
        }
        const testApplicationId = generateUuidV7()
        const firstUserId = generateUuidV7()
        const secondUserId = generateUuidV7()
        const firstMembershipId = generateUuidV7()
        const secondMembershipId = generateUuidV7()
        const emailFor = (userId: string) => `runtime-membership-lock-${userId}@example.test`
        const displayName = JSON.stringify({
            _schema: '1',
            _primary: 'en',
            locales: { en: { content: `Membership lock ${testApplicationId}` } }
        })

        try {
            await knex.raw(`INSERT INTO applications.obj_applications (id, name) VALUES (?, ?::jsonb)`, [testApplicationId, displayName])
            for (const userId of [firstUserId, secondUserId]) {
                await knex.raw(
                    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, confirmation_token, created_at, updated_at)
                     VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', '', NOW(), NOW())`,
                    [userId, emailFor(userId)]
                )
            }
            await knex.raw(
                `INSERT INTO applications.rel_application_users (id, application_id, user_id, role)
                 VALUES (?, ?, ?, 'editor'), (?, ?, ?, 'editor')`,
                [firstMembershipId, testApplicationId, firstUserId, secondMembershipId, testApplicationId, secondUserId]
            )

            let signalRequestLocked!: (pid: number) => void
            let releaseRequest!: () => void
            const requestLocked = new Promise<number>((resolve) => {
                signalRequestLocked = resolve
            })
            const requestMayCommit = new Promise<void>((resolve) => {
                releaseRequest = resolve
            })
            let mutation: Promise<boolean> | undefined
            let revocation: Promise<void> | undefined
            let blockingError: unknown

            try {
                mutation = createKnexExecutor(knex).transaction(async (tx) => {
                    const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                    expect(await lockApplicationMembershipForRuntimeMutation(tx, testApplicationId, firstUserId)).toBe(true)
                    signalRequestLocked(rows[0]!.pid)
                    await requestMayCommit
                    return true
                })

                const mutationPid = await waitForSignal(requestLocked, 'Runtime mutation did not acquire its membership row')
                let signalRevocationPid!: (pid: number) => void
                const revocationPid = new Promise<number>((resolve) => {
                    signalRevocationPid = resolve
                })
                revocation = createKnexExecutor(competingKnex).transaction(async (tx) => {
                    const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                    signalRevocationPid(rows[0]!.pid)
                    await tx.query(
                        `UPDATE applications.rel_application_users
                     SET _upl_deleted = true, _app_deleted = true
                     WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
                        [firstMembershipId]
                    )
                })
                await waitForBlockingPid(
                    await waitForSignal(revocationPid, 'Application revocation did not acquire a database connection'),
                    mutationPid,
                    'Application revocation'
                )
            } catch (error) {
                blockingError = error
            } finally {
                releaseRequest()
            }

            const firstResults = await Promise.allSettled([...(mutation ? [mutation] : []), ...(revocation ? [revocation] : [])])
            const firstFailure = firstResults.find((result) => result.status === 'rejected')
            if (firstFailure?.status === 'rejected') throw firstFailure.reason
            if (blockingError) throw blockingError
            expect(await lockApplicationMembershipForRuntimeMutation(createKnexExecutor(knex), testApplicationId, firstUserId)).toBe(false)

            let signalRevocationLocked!: (pid: number) => void
            let releaseRevocation!: () => void
            const revocationLocked = new Promise<number>((resolve) => {
                signalRevocationLocked = resolve
            })
            const revocationMayCommit = new Promise<void>((resolve) => {
                releaseRevocation = resolve
            })
            const secondRevocation = createKnexExecutor(competingKnex).transaction(async (tx) => {
                const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                await tx.query(
                    `UPDATE applications.rel_application_users
                 SET _upl_deleted = true, _app_deleted = true
                 WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
                    [secondMembershipId]
                )
                signalRevocationLocked(rows[0]!.pid)
                await revocationMayCommit
            })
            let secondMutation: Promise<boolean> | undefined
            let secondBlockingError: unknown
            try {
                const revocationPid = await waitForSignal(revocationLocked, 'Application revocation did not lock its membership row')
                let signalSecondMutationPid!: (pid: number) => void
                const secondMutationPid = new Promise<number>((resolve) => {
                    signalSecondMutationPid = resolve
                })
                secondMutation = createKnexExecutor(knex).transaction(async (tx) => {
                    const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                    signalSecondMutationPid(rows[0]!.pid)
                    return lockApplicationMembershipForRuntimeMutation(tx, testApplicationId, secondUserId)
                })
                await waitForBlockingPid(
                    await waitForSignal(secondMutationPid, 'Second runtime mutation did not acquire a database connection'),
                    revocationPid,
                    'Runtime mutation after revocation'
                )
            } catch (error) {
                secondBlockingError = error
            } finally {
                releaseRevocation()
            }
            const secondResults = await Promise.allSettled([secondRevocation, ...(secondMutation ? [secondMutation] : [])])
            const secondFailure = secondResults.find((result) => result.status === 'rejected')
            if (secondFailure?.status === 'rejected') throw secondFailure.reason
            if (secondBlockingError) throw secondBlockingError
            expect(secondResults.find((result) => result.status === 'fulfilled' && result.value === false)).toBeDefined()
        } finally {
            await knex.raw(`DELETE FROM applications.rel_application_users WHERE application_id = ?`, [testApplicationId])
            await knex.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [testApplicationId])
            await knex.raw(`DELETE FROM auth.users WHERE id IN (?, ?)`, [firstUserId, secondUserId])
        }
    }, 60_000)

    it('holds the active workspace lock until a concurrent archival transaction can archive its writes', async () => {
        let signalLocked!: () => void
        let releaseWriter!: () => void
        let signalDeletePid!: (pid: number) => void
        const locked = new Promise<void>((resolve) => {
            signalLocked = resolve
        })
        const writerMayCommit = new Promise<void>((resolve) => {
            releaseWriter = resolve
        })
        const deletePid = new Promise<number>((resolve) => {
            signalDeletePid = resolve
        })
        const raceWorkspaceId = workspaceIds[3]!
        const settingsQt = qSchemaTable(schemaName, '_app_workspace_settings')
        const workspacesQt = qSchemaTable(schemaName, '_app_workspaces')

        const writer = createKnexExecutor(knex).transaction(async (tx) => {
            expect(await lockActiveRuntimeWorkspaceContext(tx, schemaName, raceWorkspaceId)).toBe(true)
            signalLocked()
            await writerMayCommit
            await tx.query(
                `INSERT INTO ${settingsQt}
                    (id, workspace_id, target_kind, target_owner_id, target_key, key, value)
                 VALUES ($1, $2, 'global', $2, '', $3, 'true'::jsonb)`,
                [generateUuidV7(), raceWorkspaceId, 'race.write']
            )
        })

        await locked

        const archival = createKnexExecutor(competingKnex).transaction(async (tx) => {
            const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            signalDeletePid(rows[0]!.pid)
            await tx.query(
                `UPDATE ${workspacesQt}
                 SET status = 'archived', _upl_deleted = true, _app_deleted = true
                 WHERE id = $1`,
                [raceWorkspaceId]
            )
            await tx.query(
                `UPDATE ${settingsQt}
                 SET _upl_deleted = true, _app_deleted = true
                 WHERE workspace_id = $1 AND key = 'race.write'
                   AND _upl_deleted = false AND _app_deleted = false`,
                [raceWorkspaceId]
            )
        })

        const pid = await deletePid
        const waitForBlockingPid = async () => {
            const deadline = Date.now() + 5000
            while (Date.now() < deadline) {
                const result = await knex.raw('SELECT pg_blocking_pids(?::integer) AS blockers', [pid])
                if ((result.rows[0]?.blockers as number[] | undefined)?.length) return
                await new Promise((resolve) => setTimeout(resolve, 10))
            }
            throw new Error('Archival transaction did not block on the active workspace lock')
        }

        let blockingError: unknown
        try {
            await waitForBlockingPid()
        } catch (error) {
            blockingError = error
        } finally {
            releaseWriter()
        }
        const transactionResults = await Promise.allSettled([writer, archival])
        const rejectedTransaction = transactionResults.find((result) => result.status === 'rejected')
        if (rejectedTransaction?.status === 'rejected') throw rejectedTransaction.reason
        if (blockingError) throw blockingError

        const archivedRows = await knex.raw(
            `SELECT _upl_deleted, _app_deleted
             FROM ${settingsQt}
             WHERE workspace_id = ? AND key = 'race.write'`,
            [raceWorkspaceId]
        )
        expect(archivedRows.rows).toEqual([{ _upl_deleted: true, _app_deleted: true }])
        await expect(lockActiveRuntimeWorkspaceContext(createKnexExecutor(knex), schemaName, raceWorkspaceId)).resolves.toBe(false)
    })

    it('resolves semantic widget settings, enforces versions, and resets by soft deletion', async () => {
        const executor = createKnexExecutor(knex)
        const first = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[0]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            value: false,
            actorUserId
        })

        expect(first).toMatchObject({
            key: settingKey,
            target: widgetTarget,
            value: false,
            version: 1
        })
        const persistedFirst = await knex.raw(
            `SELECT workspace_id, target_kind, target_owner_id, target_key
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE workspace_id = ? AND key = ? AND _upl_deleted = false AND _app_deleted = false`,
            [workspaceIds[0], settingKey]
        )
        expect(persistedFirst.rows[0]).toEqual({
            workspace_id: workspaceIds[0],
            target_kind: 'widget',
            target_owner_id: layoutId,
            target_key: widgetTarget.instanceKey
        })

        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId: workspaceIds[0]!,
                applicationSettings,
                key: settingKey,
                target: widgetTarget,
                value: true,
                actorUserId
            })
        ).rejects.toMatchObject<Partial<WorkspaceSettingsError>>({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict })

        const updated = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[0]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            value: true,
            expectedVersion: 1,
            actorUserId
        })
        expect(updated.version).toBe(2)

        await expect(
            resetWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId: workspaceIds[0]!,
                applicationSettings,
                key: settingKey,
                target: widgetTarget,
                actorUserId
            })
        ).rejects.toMatchObject<Partial<WorkspaceSettingsError>>({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict })

        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId: workspaceIds[0]!,
                applicationSettings,
                key: settingKey,
                target: widgetTarget,
                value: false,
                expectedVersion: 1,
                actorUserId
            })
        ).rejects.toMatchObject<Partial<WorkspaceSettingsError>>({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict })

        await resetWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[0]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            expectedVersion: 2,
            actorUserId
        })

        const deleted = await knex.raw(
            `SELECT _upl_deleted, _app_deleted, _upl_version AS version
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE workspace_id = ? AND key = ?`,
            [workspaceIds[0], settingKey]
        )
        expect(deleted.rows).toEqual([{ _upl_deleted: true, _app_deleted: true, version: '3' }])

        const recreated = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[0]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            value: true,
            actorUserId
        })
        expect(recreated.version).toBe(4)
        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId: workspaceIds[0]!,
                applicationSettings,
                key: settingKey,
                target: widgetTarget,
                value: false,
                expectedVersion: 1,
                actorUserId
            })
        ).rejects.toMatchObject<Partial<WorkspaceSettingsError>>({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict })

        const otherWorkspaceValue = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[1]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            value: false,
            actorUserId
        })
        expect(otherWorkspaceValue).toMatchObject({ target: widgetTarget, value: false, version: 1 })
        const persistedOtherWorkspace = await knex.raw(
            `SELECT workspace_id, target_owner_id
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE workspace_id = ? AND key = ? AND _upl_deleted = false AND _app_deleted = false`,
            [workspaceIds[1], settingKey]
        )
        expect(persistedOtherWorkspace.rows[0]).toEqual({ workspace_id: workspaceIds[1], target_owner_id: layoutId })
    })

    it('rejects widget targets that are configured but absent from the active layout', async () => {
        await expect(
            upsertWorkspaceSettingOverride(createKnexExecutor(knex), {
                schemaName,
                workspaceId: workspaceIds[1]!,
                applicationSettings: {
                    ...applicationSettings,
                    workspaceOverrides: {
                        ...applicationSettings.workspaceOverrides,
                        allowedAddresses: [
                            ...applicationSettings.workspaceOverrides.allowedAddresses,
                            { key: settingKey, target: { kind: 'widget', instanceKey: 'matrix-retired' } }
                        ]
                    }
                },
                key: settingKey,
                target: { kind: 'widget', instanceKey: 'matrix-retired' },
                value: false,
                actorUserId
            })
        ).rejects.toMatchObject<Partial<WorkspaceSettingsError>>({
            code: WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound
        })
    })

    it('serializes simultaneous first writes and rejects the blind stale update', async () => {
        const input = {
            schemaName,
            workspaceId: workspaceIds[2]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            actorUserId
        }
        const results = await Promise.allSettled([
            upsertWorkspaceSettingOverride(createKnexExecutor(knex), { ...input, value: false }),
            upsertWorkspaceSettingOverride(createKnexExecutor(competingKnex), { ...input, value: true })
        ])

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
        const rejected = results.find((result) => result.status === 'rejected')
        expect(rejected).toMatchObject({ reason: { code: WORKSPACE_SETTINGS_ERROR_CODES.settingConflict } })
        const activeRows = await knex.raw(
            `SELECT COUNT(*)::integer AS count
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE workspace_id = ? AND key = ? AND _upl_deleted = false AND _app_deleted = false`,
            [workspaceIds[2], settingKey]
        )
        expect(activeRows.rows[0]?.count).toBe(1)
    })

    it('serializes Matrix policy reads with a concurrent color-policy override write', async () => {
        const waitForSignal = async <T>(signal: Promise<T>, operation: string): Promise<T> => {
            let timeout: ReturnType<typeof setTimeout> | undefined
            try {
                return await Promise.race([
                    signal,
                    new Promise<T>((_, reject) => {
                        timeout = setTimeout(() => reject(new Error(`${operation} timed out`)), 5_000)
                    })
                ])
            } finally {
                if (timeout) clearTimeout(timeout)
            }
        }

        const targetWorkspaceId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id, name, description, workspace_type)
             VALUES (?, ?::jsonb, ?::jsonb, 'shared')`,
            [targetWorkspaceId, JSON.stringify({ en: 'Style policy lock test' }), JSON.stringify({ en: 'Integration fixture' })]
        )

        let releasePolicyWriter!: () => void
        let signalWriterPid!: (pid: number) => void
        let signalReaderPid!: (pid: number) => void
        const writerMayCommit = new Promise<void>((resolve) => {
            releasePolicyWriter = resolve
        })
        const writerPid = new Promise<number>((resolve) => {
            signalWriterPid = resolve
        })
        const readerPid = new Promise<number>((resolve) => {
            signalReaderPid = resolve
        })

        const writer = createKnexExecutor(knex).transaction(async (tx) => {
            const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            await lockInterpretationNetworkCellStylePolicy(tx, schemaName, targetWorkspaceId)
            await upsertWorkspaceSettingOverride(tx, {
                schemaName,
                workspaceId: targetWorkspaceId,
                applicationSettings,
                key: settingKey,
                target: widgetTarget,
                value: false,
                actorUserId
            })
            signalWriterPid(rows[0]!.pid)
            await writerMayCommit
        })

        let writerBackendPid: number
        let reader: Promise<boolean> | undefined
        let blockingError: unknown
        try {
            writerBackendPid = await waitForSignal(writerPid, 'Style policy writer did not acquire a database connection')
            reader = createKnexExecutor(competingKnex).transaction(async (tx) => {
                const beforeLock = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::integer AS count
                     FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
                     WHERE workspace_id = $1 AND key = $2 AND _upl_deleted = false AND _app_deleted = false`,
                    [targetWorkspaceId, settingKey]
                )
                expect(beforeLock[0]?.count).toBe(0)
                const rows = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                signalReaderPid(rows[0]!.pid)
                await lockInterpretationNetworkCellStylePolicy(tx, schemaName, targetWorkspaceId)
                const policyRows = await tx.query<{ value: boolean }>(
                    `SELECT value
                     FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
                     WHERE workspace_id = $1 AND key = $2 AND target_kind = 'widget'
                       AND target_owner_id = $3 AND target_key = $4
                       AND _upl_deleted = false AND _app_deleted = false`,
                    [targetWorkspaceId, settingKey, layoutId, widgetTarget.instanceKey]
                )
                return policyRows[0]?.value === false
            })

            const readerBackendPid = await waitForSignal(readerPid, 'Matrix policy reader did not acquire a database connection')
            const deadline = Date.now() + 5_000
            let waitingOnWriter = false
            while (Date.now() < deadline) {
                const blockingState = await knex.raw(
                    `SELECT wait_event_type, ? = ANY(pg_blocking_pids(pid)) AS blocked
                     FROM pg_stat_activity
                     WHERE pid = ?`,
                    [writerBackendPid, readerBackendPid]
                )
                if (blockingState.rows[0]?.wait_event_type === 'Lock' && blockingState.rows[0]?.blocked === true) {
                    waitingOnWriter = true
                    break
                }
                await new Promise((resolve) => setTimeout(resolve, 25))
            }
            expect(waitingOnWriter).toBe(true)
        } catch (error) {
            blockingError = error
        } finally {
            releasePolicyWriter()
        }

        const results = await Promise.allSettled([writer, ...(reader ? [reader] : [])])
        const failure = results.find((result) => result.status === 'rejected')
        if (failure?.status === 'rejected') throw failure.reason
        if (blockingError) throw blockingError
        expect(results[1]).toEqual({ status: 'fulfilled', value: true })
    })

    it('tombstones overrides for a retired layout without affecting another layout', async () => {
        const otherLayoutId = generateUuidV7()
        const overrideIds = [generateUuidV7(), generateUuidV7(), generateUuidV7()]
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_workspace_settings')}
                (id, workspace_id, target_kind, target_owner_id, target_key, key, value)
             VALUES
                (?, ?, 'widget', ?, ?, ?, 'false'::jsonb),
                (?, ?, 'widget', ?, ?, ?, 'true'::jsonb),
                (?, ?, 'widget', ?, ?, ?, 'true'::jsonb)`,
            [
                overrideIds[0],
                workspaceIds[3],
                layoutId,
                widgetTarget.instanceKey,
                settingKey,
                overrideIds[1],
                workspaceIds[4],
                layoutId,
                widgetTarget.instanceKey,
                settingKey,
                overrideIds[2],
                workspaceIds[3],
                otherLayoutId,
                widgetTarget.instanceKey,
                settingKey
            ]
        )

        await tombstoneApplicationLayoutWorkspaceSettings(createKnexExecutor(knex), schemaName, layoutId, actorUserId, false)

        const rows = await knex.raw(
            `SELECT id, target_owner_id, _upl_deleted, _app_deleted, _upl_version AS version
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE id = ANY(?::uuid[])
             ORDER BY id`,
            [overrideIds]
        )
        const retiredRows = rows.rows.filter((row: { target_owner_id: string }) => row.target_owner_id === layoutId)
        expect(retiredRows).toHaveLength(2)
        expect(
            retiredRows.every(
                (row: { _upl_deleted: boolean; _app_deleted: boolean; version: string }) =>
                    row._upl_deleted && !row._app_deleted && row.version === '2'
            )
        ).toBe(true)
        expect(rows.rows.find((row: { target_owner_id: string }) => row.target_owner_id === otherLayoutId)).toMatchObject({
            _upl_deleted: false,
            _app_deleted: false,
            version: '1'
        })
    })
})
