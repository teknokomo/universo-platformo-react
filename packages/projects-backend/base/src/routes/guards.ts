import { DataSource } from 'typeorm'
import * as httpErrors from 'http-errors'
import { ProjectRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-backend'
import { hasGlobalAccessByDataSource, getGlobalRoleNameByDataSource } from '@universo/admin-backend'
import { ProjectUser } from '../database/entities/ProjectUser'
import { MilestoneProject } from '../database/entities/MilestoneProject'
import { TaskMilestone } from '../database/entities/TaskMilestone'
import { TaskProject } from '../database/entities/TaskProject'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

// Re-export ProjectRole for convenience
export type { ProjectRole }

// Comments in English only

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageProject: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageProject: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageProject: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageProject: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<ProjectRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export interface ProjectMembershipContext {
    membership: ProjectUser
    projectId: string
}

// Create base guards using generic factory from auth-backend
// Includes global admin bypass for superadmin/supermoderator
const baseGuards = createAccessGuards<ProjectRole, ProjectUser>({
    entityName: 'project',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, projectId: string) => {
        const repo = ds.getRepository(ProjectUser)
        return repo.findOne({ where: { project_id: projectId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as ProjectRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.project_id,
    // Global admin bypass - users with global access get owner-level access
    hasGlobalAccess: hasGlobalAccessByDataSource,
    getGlobalRoleName: getGlobalRoleNameByDataSource,
    createGlobalAdminMembership: (userId, entityId, _globalRole) =>
        ({
            user_id: userId,
            project_id: entityId,
            role: 'owner', // Global admins get owner-level access
            created_at: new Date()
        }) as ProjectUser
})

// Re-export base guards (assertPermission, hasPermission are re-exported directly)
// Note: assertNotOwner is customized below for project-specific behavior
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getProjectMembership(ds: DataSource, userId: string, projectId: string): Promise<ProjectUser | null> {
    return getMembershipSafe(ds, userId, projectId)
}

export async function ensureProjectAccess(
    ds: DataSource,
    userId: string,
    projectId: string,
    permission?: RolePermission
): Promise<ProjectMembershipContext> {
    const baseContext = await ensureAccess(ds, userId, projectId, permission)
    return { ...baseContext, projectId: baseContext.entityId }
}

export interface MilestoneAccessContext extends ProjectMembershipContext {
    milestoneLink: MilestoneProject
}

export async function ensureMilestoneAccess(
    ds: DataSource,
    userId: string,
    milestoneId: string,
    permission?: RolePermission
): Promise<MilestoneAccessContext> {
    const milestoneProjectRepo = ds.getRepository(MilestoneProject)
    // SECURITY FIX: Use find() for M2M relationships (a milestone can belong to multiple projects)
    const milestoneProjects = await milestoneProjectRepo.find({ where: { milestone: { id: milestoneId } }, relations: ['project'] })

    if (milestoneProjects.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            milestoneId,
            action: permission || 'access',
            reason: 'milestone_not_found'
        })
        throw createError(404, 'Milestone not found')
    }

    // Try to find at least ONE project where user has membership
    let lastError: any = null
    for (const milestoneProject of milestoneProjects) {
        try {
            const context = await ensureProjectAccess(ds, userId, milestoneProject.project.id, permission)
            // Success! User has access via this project
            return { ...context, milestoneLink: milestoneProject }
        } catch (err) {
            // Remember error but continue checking other projects
            lastError = err
        }
    }

    // If no project grants access, throw the last error
    throw lastError || createError(403, 'Access denied to milestone')
}

export interface TaskAccessContext extends ProjectMembershipContext {
    viaProjectIds: string[]
}

export async function ensureTaskAccess(
    ds: DataSource,
    userId: string,
    taskId: string,
    permission?: RolePermission
): Promise<TaskAccessContext> {
    const milestoneLinkRepo = ds.getRepository(TaskMilestone)
    const projectLinkRepo = ds.getRepository(TaskProject)

    const milestoneLinks = await milestoneLinkRepo.find({ where: { task: { id: taskId } }, relations: ['milestone'] })
    const milestoneIds = milestoneLinks.map((link) => link.milestone.id)

    let projectIds: string[] = []
    if (milestoneIds.length > 0) {
        const milestoneProjectRepo = ds.getRepository(MilestoneProject)
        const milestoneProjectLinks = await milestoneProjectRepo.find({
            where: milestoneIds.map((id) => ({ milestone: { id } })),
            relations: ['project']
        })
        projectIds = milestoneProjectLinks.map((link) => link.project.id)
    }

    if (projectIds.length === 0) {
        const explicitLinks = await projectLinkRepo.find({ where: { task: { id: taskId } }, relations: ['project'] })
        if (explicitLinks.length === 0) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                taskId,
                action: permission || 'access',
                reason: 'task_not_found'
            })
            throw createError(404, 'Task not found')
        }
        projectIds = explicitLinks.map((link) => link.project.id)
    }

    const uniqueProjectIds = Array.from(new Set(projectIds))
    if (uniqueProjectIds.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            taskId,
            action: permission || 'access',
            reason: 'no_project_links'
        })
        throw createError(403, 'Access denied to this task')
    }

    const membershipRepo = ds.getRepository(ProjectUser)
    const memberships = await membershipRepo.find({
        // TypeORM does not yet expose precise typings for an array of OR conditions.
        // The `as any` cast avoids false positives until the upstream types are improved.
        where: uniqueProjectIds.map((id) => ({ project_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            taskId,
            projectIds: uniqueProjectIds,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this task')
    }

    if (!permission) {
        return { membership: memberships[0], projectId: memberships[0].project_id, viaProjectIds: uniqueProjectIds }
    }

    const allowedMembership = memberships.find((membership) => ROLE_PERMISSIONS[(membership.role || 'member') as ProjectRole]?.[permission])
    if (!allowedMembership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            taskId,
            projectIds: uniqueProjectIds,
            action: permission,
            userRoles: memberships.map((m) => m.role || 'member'),
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }

    return { membership: allowedMembership, projectId: allowedMembership.project_id, viaProjectIds: uniqueProjectIds }
}

/**
 * Throws an error if the user is the project owner.
 * Owners cannot be modified or removed to preserve access control integrity.
 *
 * @param membership - The ProjectUser membership to check
 * @param operation - The operation type: 'modify' (default) or 'remove'
 * @throws HTTP 400 error if the user is an owner
 */
export function assertNotOwner(membership: ProjectUser, operation: 'modify' | 'remove' = 'modify'): void {
    const role = (membership.role || 'member') as ProjectRole
    if (role === 'owner') {
        const message = operation === 'remove' ? 'Owner cannot be removed from project' : 'Owner role cannot be modified'
        throw createError(400, message)
    }
}
