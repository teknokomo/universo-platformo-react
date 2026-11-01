import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import { listApplications } from '../../persistence/applicationsStore'
import { updateApplicationInTransaction } from '../../persistence/applicationMutationStore'
import {
    expectPostgresError,
    insertApplication,
    insertApplicationMember,
    withDatabaseRole
} from './applicationBotBindings.integrationSupport'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Application catalog visibility PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const rollbackSignal = new Error('rollback Application catalog visibility integration fixture')

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

const applicationName = (name: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: { en: { content: name } }
})

describeIntegration('Application public catalog visibility PostgreSQL behavior', () => {
    let knex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 2 } })
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('filters rows before totals and pagination while preserving member and privileged visibility', async () => {
        await withRollback(knex, async (trx) => {
            const nonMemberId = generateUuidV7()
            const ownerId = generateUuidV7()
            const listedPublicId = generateUuidV7()
            const unlistedPublicId = generateUuidV7()
            const closedListedId = generateUuidV7()
            const memberUnlistedId = generateUuidV7()
            const marker = `catalog-visibility-${generateUuidV7().slice(-8)}`

            for (const [id, emailPrefix] of [
                [nonMemberId, 'catalog-nonmember'],
                [ownerId, 'catalog-owner']
            ] as const) {
                await trx.raw(
                    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
                     VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', now(), now())`,
                    [id, `${emailPrefix}-${id.slice(0, 8)}@example.test`]
                )
            }

            await trx.raw(
                `INSERT INTO applications.obj_applications (id, name, is_public, show_in_app_list)
                 VALUES
                    (?, ?::jsonb, true, true),
                    (?, ?::jsonb, true, false),
                    (?, ?::jsonb, false, true),
                    (?, ?::jsonb, true, false)`,
                [
                    listedPublicId,
                    JSON.stringify(applicationName(`${marker} listed public`)),
                    unlistedPublicId,
                    JSON.stringify(applicationName(`${marker} unlisted public`)),
                    closedListedId,
                    JSON.stringify(applicationName(`${marker} closed listed`)),
                    memberUnlistedId,
                    JSON.stringify(applicationName(`${marker} member unlisted`))
                ]
            )
            await trx.raw(
                `INSERT INTO applications.rel_application_users (id, application_id, user_id, role)
                 VALUES (?, ?, ?, 'owner')`,
                [generateUuidV7(), memberUnlistedId, ownerId]
            )

            const executor = createKnexExecutor(trx)
            const baseInput = {
                limit: 10,
                offset: 0,
                sortBy: 'name' as const,
                sortOrder: 'asc' as const,
                search: marker
            }
            const nonMemberRows = await listApplications(executor, { ...baseInput, userId: nonMemberId, showAll: false })
            expect(nonMemberRows.total).toBe(1)
            expect(nonMemberRows.items.map(({ id }) => id)).toEqual([listedPublicId])

            const hiddenSearch = await listApplications(executor, {
                ...baseInput,
                userId: nonMemberId,
                showAll: false,
                search: `${marker} unlisted public`
            })
            expect(hiddenSearch).toEqual({ items: [], total: 0 })

            const ownerRows = await listApplications(executor, { ...baseInput, userId: ownerId, showAll: false })
            expect(ownerRows.total).toBe(2)
            expect(ownerRows.items.map(({ id }) => id).sort()).toEqual([listedPublicId, memberUnlistedId].sort())

            const privilegedPage = await listApplications(executor, {
                ...baseInput,
                userId: nonMemberId,
                showAll: true,
                limit: 2,
                offset: 1
            })
            expect(privilegedPage.total).toBe(4)
            expect(privilegedPage.items).toHaveLength(2)
            expect(privilegedPage.items.map(({ id }) => id)).toEqual([listedPublicId, memberUnlistedId])

            const privilegedAll = await listApplications(executor, { ...baseInput, userId: nonMemberId, showAll: true })
            expect(privilegedAll.total).toBe(4)
            expect(privilegedAll.items.map(({ id }) => id).sort()).toEqual(
                [listedPublicId, unlistedPublicId, closedListedId, memberUnlistedId].sort()
            )
        })
    })

    it('does not allow an authenticated member to promote their own membership through direct SQL', async () => {
        await withRollback(knex, async (trx) => {
            const memberId = generateUuidV7()
            const applicationId = generateUuidV7()
            const selfJoinTargetApplicationId = generateUuidV7()
            const publicJoinTargetApplicationId = generateUuidV7()

            await trx.raw(
                `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
                 VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', now(), now())`,
                [memberId, `catalog-member-${memberId.slice(0, 8)}@example.test`]
            )
            await trx.raw(
                `INSERT INTO applications.obj_applications (id, name, is_public, show_in_app_list)
                 VALUES (?, ?::jsonb, false, false)`,
                [applicationId, JSON.stringify(applicationName(`membership-rls-${applicationId}`))]
            )
            await trx.raw(
                `INSERT INTO applications.obj_applications (id, name, is_public, show_in_app_list)
                 VALUES (?, ?::jsonb, false, true)`,
                [selfJoinTargetApplicationId, JSON.stringify(applicationName(`membership-self-join-${selfJoinTargetApplicationId}`))]
            )
            await trx.raw(
                `INSERT INTO applications.obj_applications (id, name, is_public, show_in_app_list)
                 VALUES (?, ?::jsonb, true, true)`,
                [publicJoinTargetApplicationId, JSON.stringify(applicationName(`membership-public-join-${publicJoinTargetApplicationId}`))]
            )
            await trx.raw(
                `INSERT INTO applications.rel_application_users (id, application_id, user_id, role)
                 VALUES (?, ?, ?, 'member')`,
                [generateUuidV7(), applicationId, memberId]
            )
            await trx.raw(`GRANT USAGE ON SCHEMA applications TO authenticated`)
            await trx.raw(`GRANT SELECT, INSERT, UPDATE (role) ON TABLE applications.rel_application_users TO authenticated`)
            await trx.raw(`GRANT SELECT ON TABLE applications.obj_applications TO authenticated`)

            const legacyPolicy = await trx.raw(
                `SELECT 1
                 FROM pg_policies
                 WHERE schemaname = 'applications'
                   AND (
                       (tablename = 'rel_application_users' AND policyname = 'Allow users to manage their application memberships')
                       OR (tablename = 'obj_applications' AND policyname = 'Allow users to manage their own applications')
                   )`
            )
            expect(legacyPolicy.rows).toHaveLength(0)

            await trx.raw('SET LOCAL ROLE authenticated')
            await trx.raw(`SELECT set_config('request.jwt.claim.sub', ?, true)`, [memberId])
            const callerContext = await trx.raw(
                `SELECT auth.uid()::text AS user_id,
                        has_table_privilege(current_user, 'applications.rel_application_users', 'SELECT, INSERT') AS can_manage_memberships,
                        has_table_privilege(current_user, 'applications.obj_applications', 'SELECT') AS can_read_applications`
            )
            expect(callerContext.rows[0]).toEqual({
                user_id: memberId,
                can_manage_memberships: true,
                can_read_applications: true
            })

            const privateApplicationRead = await trx.raw(`SELECT id FROM applications.obj_applications WHERE id = ?`, [
                selfJoinTargetApplicationId
            ])
            expect(privateApplicationRead.rows).toHaveLength(0)

            await trx.raw('SAVEPOINT reject_member_role_escalation')
            await expect(
                trx.raw(
                    `UPDATE applications.rel_application_users
                     SET role = 'owner'
                     WHERE application_id = ? AND user_id = ?`,
                    [applicationId, memberId]
                )
            ).rejects.toMatchObject({ code: '42501' })
            await trx.raw('ROLLBACK TO SAVEPOINT reject_member_role_escalation')
            await trx.raw('RELEASE SAVEPOINT reject_member_role_escalation')

            await trx.raw('SAVEPOINT reject_self_owner_insert')
            await expect(
                trx.raw(
                    `INSERT INTO applications.rel_application_users (id, application_id, user_id, role)
                     VALUES (?, ?, ?, 'owner')`,
                    [generateUuidV7(), selfJoinTargetApplicationId, memberId]
                )
            ).rejects.toMatchObject({ code: '42501' })
            await trx.raw('ROLLBACK TO SAVEPOINT reject_self_owner_insert')
            await trx.raw('RELEASE SAVEPOINT reject_self_owner_insert')

            const publicJoinMembershipId = generateUuidV7()
            const publicJoin = await trx.raw(
                `INSERT INTO applications.rel_application_users (id, application_id, user_id, role)
                 VALUES (?, ?, ?, 'member')
                 RETURNING id`,
                [publicJoinMembershipId, publicJoinTargetApplicationId, memberId]
            )
            expect(publicJoin.rows).toEqual([{ id: publicJoinMembershipId }])

            await trx.raw('RESET ROLE')
            const escalatedMembership = await trx.raw(
                `SELECT id
                 FROM applications.rel_application_users
                 WHERE application_id = ? AND user_id = ? AND role = 'owner'`,
                [selfJoinTargetApplicationId, memberId]
            )
            expect(escalatedMembership.rows).toHaveLength(0)

            const persistedPublicJoin = await trx.raw(
                `SELECT id, role
                 FROM applications.rel_application_users
                 WHERE application_id = ? AND user_id = ?`,
                [publicJoinTargetApplicationId, memberId]
            )
            expect(persistedPublicJoin.rows).toEqual([{ id: publicJoinMembershipId, role: 'member' }])
        })
    })

    it('audits only database-observed visibility transitions and rejects forged history or actors', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            const forgedActorId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: actorUserId })])

            const renamed = await updateApplicationInTransaction(executor, {
                applicationId,
                name: applicationName('Renamed application'),
                userId: actorUserId
            })
            expect(renamed?.version).toBe(2)

            await withDatabaseRole(trx, 'authenticated', actorUserId, async () => {
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(
                        `SELECT applications.record_application_catalog_visibility_audit(
                            ?, 'catalog_visibility_changed', 1, 2, false, true
                        )`,
                        [applicationId]
                    )
                )
            })

            const changed = await updateApplicationInTransaction(executor, {
                applicationId,
                showInAppList: false,
                userId: actorUserId,
                expectedVersion: 2
            })
            expect(changed?.version).toBe(3)

            const audits = await trx.raw(
                `SELECT event_type, previous_version, new_version,
                        previous_show_in_app_list, new_show_in_app_list,
                        _upl_created_by::text AS actor
                 FROM applications.rel_application_control_audits
                 WHERE application_id = ? AND event_type = 'catalog_visibility_changed'`,
                [applicationId]
            )
            expect(audits.rows).toEqual([
                {
                    event_type: 'catalog_visibility_changed',
                    previous_version: 2,
                    new_version: 3,
                    previous_show_in_app_list: true,
                    new_show_in_app_list: false,
                    actor: actorUserId
                }
            ])

            await expectPostgresError(trx, '42501', (savepoint) =>
                updateApplicationInTransaction(createKnexExecutor(savepoint), {
                    applicationId,
                    showInAppList: true,
                    userId: forgedActorId,
                    expectedVersion: 3
                })
            )

            const unchanged = await trx.raw(`SELECT show_in_app_list, _upl_version FROM applications.obj_applications WHERE id = ?`, [
                applicationId
            ])
            expect(unchanged.rows).toEqual([{ show_in_app_list: false, _upl_version: 3 }])
        })
    })
})
