import { randomUUID } from 'node:crypto'
import { jest } from '@jest/globals'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createKnexExecutor } from '@universo/database'
import { activeAppRowCondition } from '@universo/utils'
import type { Knex } from 'knex'
import { createAuthUserProvisioningService } from '../../services/authUserProvisioningService'
import { createGlobalAccessService } from '../../services/globalAccessService'

const { createClient } = jest.requireActual('@supabase/supabase-js') as typeof import('@supabase/supabase-js')

/**
 * Integration tests for auth-user provisioning against a real Supabase project.
 * Requires DATABASE_TEST_URL, SUPABASE_URL, and SERVICE_ROLE_KEY.
 *
 * Run:
 * DATABASE_TEST_URL=postgresql://... \
 * SUPABASE_URL=https://<project>.supabase.co \
 * SERVICE_ROLE_KEY=<service-role> \
 * pnpm --filter @universo/admin-backend test
 */

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY

const describeIntegration = DATABASE_TEST_URL && SUPABASE_URL && SERVICE_ROLE_KEY ? describe : describe.skip

describeIntegration('createAuthUserProvisioningService integration (requires Supabase)', () => {
    let knex: Knex
    let supabaseAdmin: SupabaseClient
    let createdUserIds: string[] = []
    let trackedEmails: string[] = []
    let trackedProfilePrefixes: string[] = []

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL
        })

        supabaseAdmin = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        })
    })

    afterEach(async () => {
        if (!knex) {
            return
        }

        const executor = createKnexExecutor(knex)
        const userIds = new Set(createdUserIds)
        createdUserIds = []

        if (trackedEmails.length > 0) {
            const authRows = await executor.query<{ id: string }>(
                `SELECT id
                 FROM auth.users
                 WHERE LOWER(email) = ANY($1::text[])`,
                [Array.from(new Set(trackedEmails.map((email) => email.toLowerCase())))]
            )
            for (const row of authRows) {
                userIds.add(row.id)
            }
        }

        if (userIds.size > 0) {
            const normalizedUserIds = Array.from(userIds)
            await executor.query(`DELETE FROM admin.rel_user_roles WHERE user_id = ANY($1::uuid[])`, [normalizedUserIds])
            await executor.query(`DELETE FROM profiles.cat_profiles WHERE user_id = ANY($1::uuid[])`, [normalizedUserIds])

            for (const userId of normalizedUserIds) {
                await supabaseAdmin.auth.admin.deleteUser(userId)
            }
        }

        for (const profilePrefix of Array.from(new Set(trackedProfilePrefixes))) {
            await executor.query(`DELETE FROM profiles.cat_profiles WHERE POSITION($1 IN nickname) = 1`, [profilePrefix])
        }

        trackedEmails = []
        trackedProfilePrefixes = []
    })

    afterAll(async () => {
        if (knex) {
            await knex.destroy()
        }
    })

    it('creates a real bootstrap superuser with auth row, profile row, and exclusive role state', async () => {
        const executor = createKnexExecutor(knex)
        const globalAccessService = createGlobalAccessService({ getDbExecutor: () => executor })
        const provisioningService = createAuthUserProvisioningService({
            getDbExecutor: () => executor,
            globalAccessService,
            supabaseAdmin
        })

        const email = `bootstrap-int-${randomUUID()}@example.com`
        trackedEmails.push(email)
        const result = await provisioningService.ensureBootstrapSuperuser({
            email,
            password: 'ChangeMe_123456!'
        })
        createdUserIds.push(result.userId)

        expect(result).toEqual(
            expect.objectContaining({
                email,
                createdAuthUser: true,
                profileEnsured: true,
                status: 'created'
            })
        )

        const authUserResult = await supabaseAdmin.auth.admin.getUserById(result.userId)
        expect(authUserResult.error).toBeNull()
        expect(authUserResult.data.user?.email).toBe(email)

        const profileRows = await executor.query<{ user_id: string }>(
            `SELECT user_id
             FROM profiles.cat_profiles
             WHERE user_id = $1
               AND ${activeAppRowCondition()}`,
            [result.userId]
        )
        expect(profileRows).toHaveLength(1)

        const accessInfo = await globalAccessService.getGlobalAccessInfo(result.userId)
        expect(accessInfo.isSuperuser).toBe(true)
        expect(accessInfo.globalRoles).toHaveLength(1)
        expect(accessInfo.globalRoles[0]).toEqual(
            expect.objectContaining({
                codename: 'superuser',
                metadata: expect.objectContaining({
                    isSuperuser: true
                })
            })
        )
    })

    it('rolls back real auth and profile rows when role synchronization fails after user creation', async () => {
        const executor = createKnexExecutor(knex)
        const globalAccessService = createGlobalAccessService({ getDbExecutor: () => executor })
        const provisioningService = createAuthUserProvisioningService({
            getDbExecutor: () => executor,
            globalAccessService,
            supabaseAdmin
        })

        const localPart = `rollbackint${randomUUID().replace(/-/g, '').slice(0, 8)}`
        const email = `${localPart}@example.com`
        const profilePrefix = `${localPart}_`
        trackedEmails.push(email)
        trackedProfilePrefixes.push(profilePrefix)

        await expect(
            provisioningService.provisionAuthUserWithRoleIds({
                email,
                password: 'ChangeMe_123456!',
                roleIds: [randomUUID()],
                grantedBy: null,
                comment: 'integration rollback verification'
            })
        ).rejects.toThrow('Failed to assign roles to the newly created user. Newly created auth account was rolled back.')

        const authRows = await executor.query<{ id: string }>(`SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1)`, [email])
        expect(authRows).toHaveLength(0)

        const profileRows = await executor.query<{ user_id: string; nickname: string }>(
            `SELECT user_id, nickname
             FROM profiles.cat_profiles
             WHERE POSITION($1 IN nickname) = 1
               AND ${activeAppRowCondition()}`,
            [profilePrefix]
        )
        expect(profileRows).toHaveLength(0)
    })
})
