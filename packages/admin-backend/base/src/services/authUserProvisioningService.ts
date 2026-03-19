import type { SupabaseClient } from '@supabase/supabase-js'
import { ProfileService } from '@universo/profile-backend'
import type { GlobalUserRoleAssignment } from '@universo/types'
import { activeAppRowCondition, softDeleteSetClause, type DbExecutor, type DbSession } from '@universo/utils'
import type { GlobalAccessService } from './globalAccessService'

type CleanupQueryable = Pick<DbExecutor, 'query'> | DbSession

export interface ProvisionAuthUserWithRoleIdsInput {
    email: string
    password?: string
    roleIds: string[]
    grantedBy: string | null
    comment?: string
}

export interface ProvisionAuthUserWithRoleIdsResult {
    userId: string
    email: string
    roles: GlobalUserRoleAssignment[]
    createdAuthUser: boolean
    profileEnsured: boolean
}

export interface EnsureBootstrapSuperuserInput {
    email: string
    password: string
}

export interface EnsureBootstrapSuperuserResult {
    userId: string
    email: string
    createdAuthUser: boolean
    profileEnsured: boolean
    status: 'created' | 'noop_existing_superuser'
}

export interface AuthUserProvisioningServiceDeps {
    getDbExecutor: () => DbExecutor
    globalAccessService: Pick<GlobalAccessService, 'findUserIdByEmail' | 'getGlobalAccessInfo' | 'setUserRoles'>
    supabaseAdmin: SupabaseClient
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

export function createAuthUserProvisioningService({ getDbExecutor, globalAccessService, supabaseAdmin }: AuthUserProvisioningServiceDeps) {
    const profileService = new ProfileService(getDbExecutor())

    const resolveRoleIdsByCodenames = async (roleCodenames: string[]): Promise<string[]> => {
        const requested = Array.from(new Set(roleCodenames.map((value) => value.trim()).filter(Boolean)))
        if (requested.length === 0) {
            return []
        }

        const rows = await getDbExecutor().query<{ id: string; codename: string }>(
            `SELECT id, codename
             FROM admin.cat_roles
             WHERE codename = ANY($1::text[])
               AND ${activeAppRowCondition()}`,
            [requested]
        )

        if (rows.length !== requested.length) {
            const found = new Set(rows.map((row) => row.codename))
            const missing = requested.filter((codename) => !found.has(codename))
            throw Object.assign(new Error(`One or more role codenames are invalid: ${missing.join(', ')}`), { statusCode: 400 })
        }

        const roleIdByCodename = new Map(rows.map((row) => [row.codename, row.id]))
        return requested.map((codename) => roleIdByCodename.get(codename) as string)
    }

    const cleanupProvisionedUser = async (userId: string): Promise<{ cleaned: boolean; cleanupErrors: string[] }> => {
        const cleanupErrors: string[] = []
        const queryable: CleanupQueryable = getDbExecutor()

        try {
            await queryable.query(
                `UPDATE profiles.cat_profiles
                 SET ${softDeleteSetClause('$2')}
                 WHERE user_id = $1 AND ${activeAppRowCondition()}`,
                [userId, null]
            )
        } catch (profileCleanupError) {
            cleanupErrors.push(
                `profile cleanup failed: ${
                    profileCleanupError instanceof Error ? profileCleanupError.message : String(profileCleanupError)
                }`
            )
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) {
            cleanupErrors.push(`auth cleanup failed: ${error.message}`)
        }

        return {
            cleaned: cleanupErrors.length === 0,
            cleanupErrors
        }
    }

    const ensureProfile = async (userId: string, email: string): Promise<void> => {
        await profileService.getOrCreateProfile(userId, email)
    }

    const syncRoles = async (
        userId: string,
        roleIds: string[],
        grantedBy: string | null,
        comment?: string
    ): Promise<GlobalUserRoleAssignment[]> => {
        return globalAccessService.setUserRoles(userId, roleIds, grantedBy, comment)
    }

    const finalizeProvisionedUser = async (
        userId: string,
        email: string,
        roleIds: string[],
        grantedBy: string | null,
        comment?: string
    ): Promise<{ roles: GlobalUserRoleAssignment[]; profileEnsured: boolean }> => {
        await ensureProfile(userId, email)
        const roles = await syncRoles(userId, roleIds, grantedBy, comment)
        return { roles, profileEnsured: true }
    }

    const createAuthUser = async (email: string, password?: string): Promise<{ id: string; email: string }> => {
        const adminResponse = password
            ? await supabaseAdmin.auth.admin.createUser({
                  email,
                  password,
                  email_confirm: true
              })
            : await supabaseAdmin.auth.admin.inviteUserByEmail(email)

        if (adminResponse.error || !adminResponse.data.user) {
            throw Object.assign(new Error(adminResponse.error?.message || 'Failed to create user'), { statusCode: 400 })
        }

        return {
            id: adminResponse.data.user.id,
            email: adminResponse.data.user.email ?? email
        }
    }

    async function provisionAuthUserWithRoleIds({
        email,
        password,
        roleIds,
        grantedBy,
        comment
    }: ProvisionAuthUserWithRoleIdsInput): Promise<ProvisionAuthUserWithRoleIdsResult> {
        const normalizedEmail = normalizeEmail(email)
        const createdUser = await createAuthUser(normalizedEmail, password)

        try {
            const { roles, profileEnsured } = await finalizeProvisionedUser(
                createdUser.id,
                normalizedEmail,
                roleIds,
                grantedBy,
                comment ?? 'created from admin panel'
            )

            return {
                userId: createdUser.id,
                email: createdUser.email,
                roles,
                createdAuthUser: true,
                profileEnsured
            }
        } catch (provisioningError) {
            const cleanupResult = await cleanupProvisionedUser(createdUser.id)
            const cleanupSuffix = cleanupResult.cleaned
                ? ' Newly created auth account was rolled back.'
                : ` Cleanup failed: ${cleanupResult.cleanupErrors.join('; ')}`

            const wrappedError = new Error(`Failed to assign roles to the newly created user.${cleanupSuffix}`)
            ;(wrappedError as Error & { cause?: unknown }).cause = provisioningError
            throw wrappedError
        }
    }

    async function ensureBootstrapSuperuser({ email, password }: EnsureBootstrapSuperuserInput): Promise<EnsureBootstrapSuperuserResult> {
        const normalizedEmail = normalizeEmail(email)
        const existingUserId = await globalAccessService.findUserIdByEmail(normalizedEmail)

        if (existingUserId) {
            const accessInfo = await globalAccessService.getGlobalAccessInfo(existingUserId)
            if (!accessInfo.isSuperuser) {
                throw new Error(
                    `Bootstrap email ${normalizedEmail} already belongs to an existing non-superuser account. Refusing automatic privilege escalation.`
                )
            }

            await ensureProfile(existingUserId, normalizedEmail)

            return {
                userId: existingUserId,
                email: normalizedEmail,
                createdAuthUser: false,
                profileEnsured: true,
                status: 'noop_existing_superuser'
            }
        }

        const createdUser = await createAuthUser(normalizedEmail, password)
        const superuserRoleIds = await resolveRoleIdsByCodenames(['superuser'])

        try {
            await finalizeProvisionedUser(createdUser.id, normalizedEmail, superuserRoleIds, null, 'startup bootstrap superuser')

            return {
                userId: createdUser.id,
                email: createdUser.email,
                createdAuthUser: true,
                profileEnsured: true,
                status: 'created'
            }
        } catch (provisioningError) {
            const cleanupResult = await cleanupProvisionedUser(createdUser.id)
            const cleanupSuffix = cleanupResult.cleaned
                ? ' Newly created auth account was rolled back.'
                : ` Cleanup failed: ${cleanupResult.cleanupErrors.join('; ')}`

            const wrappedError = new Error(`Bootstrap superuser provisioning failed.${cleanupSuffix}`)
            ;(wrappedError as Error & { cause?: unknown }).cause = provisioningError
            throw wrappedError
        }
    }

    return {
        provisionAuthUserWithRoleIds,
        ensureBootstrapSuperuser
    }
}

export type AuthUserProvisioningService = ReturnType<typeof createAuthUserProvisioningService>
