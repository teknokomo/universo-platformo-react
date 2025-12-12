import { DataSource } from 'typeorm'
import * as httpErrors from 'http-errors'
import { UnikRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource } from '@universo/admin-backend'
import { UnikUser } from '../database/entities/UnikUser'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

// Re-export UnikRole for convenience
export type { UnikRole }

// Comments in English only

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageUnik: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageUnik: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageUnik: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageUnik: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<UnikRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export interface UnikMembershipContext {
    membership: UnikUser
    unikId: string
}

// Create base guards using generic factory from auth-backend
// Includes global admin bypass for superadmin/supermoderator
const baseGuards = createAccessGuards<UnikRole, UnikUser>({
    entityName: 'unik',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, unikId: string) => {
        const repo = ds.getRepository(UnikUser)
        return repo.findOne({ where: { unik_id: unikId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as UnikRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.unik_id,
    // Global admin bypass - users with global access get owner-level access
    isSuperuser: isSuperuserByDataSource,
    getGlobalRoleName: getGlobalRoleCodenameByDataSource,
    createGlobalAdminMembership: (userId, entityId, _globalRole) =>
        ({
            user_id: userId,
            unik_id: entityId,
            role: 'owner', // Global admins get owner-level access
            created_at: new Date()
        }) as UnikUser
})

// Re-export base guards (assertPermission, hasPermission are re-exported directly)
// Note: assertNotOwner is customized below for unik-specific behavior
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getUnikMembership(ds: DataSource, userId: string, unikId: string): Promise<UnikUser | null> {
    return getMembershipSafe(ds, userId, unikId)
}

export async function ensureUnikAccess(
    ds: DataSource,
    userId: string,
    unikId: string,
    permission?: RolePermission
): Promise<UnikMembershipContext> {
    const baseContext = await ensureAccess(ds, userId, unikId, permission)
    return { ...baseContext, unikId: baseContext.entityId }
}

/**
 * Throws an error if the user is the unik owner.
 * Owners cannot be modified or removed to preserve access control integrity.
 *
 * @param membership - The UnikUser membership to check
 * @param operation - The operation type: 'modify' (default) or 'remove'
 * @throws HTTP 400 error if the user is an owner
 */
export function assertNotOwner(membership: UnikUser, operation: 'modify' | 'remove' = 'modify'): void {
    const role = (membership.role || 'member') as UnikRole
    if (role === 'owner') {
        const message = operation === 'remove' ? 'Owner cannot be removed from unik' : 'Owner role cannot be modified'
        throw createError(400, message)
    }
}
