import { DataSource, QueryRunner } from 'typeorm'
import * as httpErrors from 'http-errors'
import { OrganizationRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { isSuperuserByDataSource, getGlobalRoleCodenameByDataSource } from '@universo/admin-backend'
import { OrganizationUser } from '../database/entities/OrganizationUser'
import { DepartmentOrganization } from '../database/entities/DepartmentOrganization'
import { PositionDepartment } from '../database/entities/PositionDepartment'
import { PositionOrganization } from '../database/entities/PositionOrganization'

const createError = (httpErrors as any).default || httpErrors

// Re-export OrganizationRole for convenience
export type { OrganizationRole }

// Comments in English only

// Helper to get manager from DataSource or QueryRunner
const getManager = (ds: DataSource, queryRunner?: QueryRunner) => {
    if (queryRunner && !queryRunner.isReleased) {
        return queryRunner.manager
    }
    return ds.manager
}

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageOrganization: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageOrganization: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageOrganization: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageOrganization: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<OrganizationRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

// Create base guards using generic factory from auth-backend
// Includes global admin bypass for superadmin/supermoderator
const baseGuards = createAccessGuards<OrganizationRole, OrganizationUser>({
    entityName: 'organization',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds, userId, organizationId, queryRunner) => {
        const repo = getManager(ds, queryRunner).getRepository(OrganizationUser)
        return repo.findOne({ where: { organization_id: organizationId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as OrganizationRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.organization_id,
    // Global admin bypass - users with global access get owner-level access
    isSuperuser: isSuperuserByDataSource,
    getGlobalRoleName: getGlobalRoleCodenameByDataSource,
    createGlobalAdminMembership: (userId, entityId, _globalRole) =>
        ({
            user_id: userId,
            organization_id: entityId,
            role: 'owner', // Global admins get owner-level access
            created_at: new Date()
        }) as OrganizationUser
})

// Export base guards
export const { ensureAccess: ensureOrganizationAccess, assertNotOwner } = baseGuards

// Department access guard (M2M security fix - use find() not findOne())
export interface DepartmentAccessContext {
    membership: OrganizationUser
    organizationId: string
    departmentLink: DepartmentOrganization
}

export async function ensureDepartmentAccess(
    ds: DataSource,
    userId: string,
    departmentId: string,
    permission?: RolePermission
): Promise<DepartmentAccessContext> {
    const departmentOrganizationRepo = ds.getRepository(DepartmentOrganization)

    // CRITICAL: Use find() for M2M relationships (security fix from Clusters)
    const departmentOrganizations = await departmentOrganizationRepo.find({
        where: { department: { id: departmentId } },
        relations: ['organization']
    })

    if (departmentOrganizations.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            departmentId,
            action: permission || 'access',
            reason: 'department_not_found'
        })
        throw createError(404, 'Department not found')
    }

    // Check access to ANY linked organization
    for (const link of departmentOrganizations) {
        try {
            const context = await ensureOrganizationAccess(ds, userId, link.organization.id, permission)
            return {
                membership: context.membership,
                organizationId: context.entityId,
                departmentLink: link
            }
        } catch {
            // Try next organization
            continue
        }
    }

    // No access to any organization
    console.warn('[SECURITY] Permission denied', {
        timestamp: new Date().toISOString(),
        userId,
        departmentId,
        organizationIds: departmentOrganizations.map((l) => l.organization.id),
        action: permission || 'access',
        reason: 'not_member_of_any_organization'
    })
    throw createError(403, 'Access denied to this department')
}

// Position access guard (M2M security fix)
export interface PositionAccessContext {
    membership: OrganizationUser
    organizationId: string
    viaOrganizationIds: string[]
}

export async function ensurePositionAccess(
    ds: DataSource,
    userId: string,
    positionId: string,
    permission?: RolePermission
): Promise<PositionAccessContext> {
    const departmentLinkRepo = ds.getRepository(PositionDepartment)
    const organizationLinkRepo = ds.getRepository(PositionOrganization)

    // Get all department links (M2M)
    const departmentLinks = await departmentLinkRepo.find({
        where: { position: { id: positionId } },
        relations: ['department']
    })
    const departmentIds = departmentLinks.map((link) => link.department.id)

    let organizationIds: string[] = []
    if (departmentIds.length > 0) {
        const departmentOrganizationRepo = ds.getRepository(DepartmentOrganization)
        const departmentOrganizationLinks = await departmentOrganizationRepo.find({
            where: departmentIds.map((id) => ({ department: { id } })),
            relations: ['organization']
        })
        organizationIds = departmentOrganizationLinks.map((link) => link.organization.id)
    }

    // Fallback to direct organization links
    if (organizationIds.length === 0) {
        const explicitLinks = await organizationLinkRepo.find({
            where: { position: { id: positionId } },
            relations: ['organization']
        })
        if (explicitLinks.length === 0) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                positionId,
                action: permission || 'access',
                reason: 'position_not_found'
            })
            throw createError(404, 'Position not found')
        }
        organizationIds = explicitLinks.map((link) => link.organization.id)
    }

    const uniqueOrganizationIds = Array.from(new Set(organizationIds))
    if (uniqueOrganizationIds.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            positionId,
            action: permission || 'access',
            reason: 'no_organization_links'
        })
        throw createError(403, 'Access denied to this position')
    }

    // Check membership in ANY organization (M2M security)
    const membershipRepo = ds.getRepository(OrganizationUser)
    const memberships = await membershipRepo.find({
        where: uniqueOrganizationIds.map((id) => ({ organization_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            positionId,
            organizationIds: uniqueOrganizationIds,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this position')
    }

    if (!permission) {
        return {
            membership: memberships[0],
            organizationId: memberships[0].organization_id,
            viaOrganizationIds: uniqueOrganizationIds
        }
    }

    // Check permission in ANY organization
    const allowedMembership = memberships.find(
        (membership) => ROLE_PERMISSIONS[(membership.role || 'member') as OrganizationRole]?.[permission]
    )

    if (!allowedMembership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            positionId,
            organizationIds: uniqueOrganizationIds,
            action: permission,
            userRoles: memberships.map((m) => m.role || 'member'),
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }

    return {
        membership: allowedMembership,
        organizationId: allowedMembership.organization_id,
        viaOrganizationIds: uniqueOrganizationIds
    }
}
