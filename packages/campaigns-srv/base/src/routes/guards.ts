import { DataSource } from 'typeorm'
import * as httpErrors from 'http-errors'
import { CampaignRole } from '@universo/types'
import { createAccessGuards } from '@universo/auth-srv'
import { CampaignMember } from '../database/entities/CampaignMember'
import { EventCampaign } from '../database/entities/EventCampaign'
import { ActivityEvent } from '../database/entities/ActivityEvent'
import { ActivityCampaign } from '../database/entities/ActivityCampaign'

// Handle both ESM and CJS imports
const createError = (httpErrors as any).default || httpErrors

// Re-export CampaignRole for convenience
export type { CampaignRole }

// Comments in English only

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageCampaign: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageCampaign: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageCampaign: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageCampaign: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<CampaignRole, Record<string, boolean>>

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export interface CampaignMembershipContext {
    membership: CampaignMember
    campaignId: string
}

// Create base guards using generic factory from auth-srv
const baseGuards = createAccessGuards<CampaignRole, CampaignMember>({
    entityName: 'campaign',
    roles: ['owner', 'admin', 'editor', 'member'] as const,
    permissions: ROLE_PERMISSIONS,
    getMembership: async (ds: DataSource, userId: string, campaignId: string) => {
        const repo = ds.getRepository(CampaignMember)
        return repo.findOne({ where: { campaign_id: campaignId, user_id: userId } })
    },
    extractRole: (m) => (m.role || 'member') as CampaignRole,
    extractUserId: (m) => m.user_id,
    extractEntityId: (m) => m.campaign_id
})

// Re-export base guards (assertPermission, hasPermission are re-exported directly)
// Note: assertNotOwner is customized below for campaign-specific behavior
const { getMembershipSafe, assertPermission, hasPermission, ensureAccess } = baseGuards
export { assertPermission, hasPermission }

// Helpers for external use
export async function getCampaignMembership(ds: DataSource, userId: string, campaignId: string): Promise<CampaignMember | null> {
    return getMembershipSafe(ds, userId, campaignId)
}

export async function ensureCampaignAccess(
    ds: DataSource,
    userId: string,
    campaignId: string,
    permission?: RolePermission
): Promise<CampaignMembershipContext> {
    const baseContext = await ensureAccess(ds, userId, campaignId, permission)
    return { ...baseContext, campaignId: baseContext.entityId }
}

export interface EventAccessContext extends CampaignMembershipContext {
    eventLink: EventCampaign
}

export async function ensureEventAccess(
    ds: DataSource,
    userId: string,
    eventId: string,
    permission?: RolePermission
): Promise<EventAccessContext> {
    const eventCampaignRepo = ds.getRepository(EventCampaign)
    // Find ALL campaign links for this event (M2M relationship)
    const eventCampaigns = await eventCampaignRepo.find({ where: { event: { id: eventId } }, relations: ['campaign'] })

    if (eventCampaigns.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            eventId,
            action: permission || 'access',
            reason: 'event_not_found'
        })
        throw createError(404, 'Event not found')
    }

    // Try to find at least ONE campaign where user has membership
    let lastError: any = null
    for (const eventCampaign of eventCampaigns) {
        try {
            const context = await ensureCampaignAccess(ds, userId, eventCampaign.campaign.id, permission)
            // Success! User has access via this campaign
            return { ...context, eventLink: eventCampaign }
        } catch (err) {
            // Remember error but continue checking other campaigns
            lastError = err
        }
    }

    // If no campaign grants access, throw the last error
    throw lastError || createError(403, 'Access denied to event')
}

export interface ActivityAccessContext extends CampaignMembershipContext {
    viaCampaignIds: string[]
}

export async function ensureActivityAccess(
    ds: DataSource,
    userId: string,
    activityId: string,
    permission?: RolePermission
): Promise<ActivityAccessContext> {
    const eventLinkRepo = ds.getRepository(ActivityEvent)
    const campaignLinkRepo = ds.getRepository(ActivityCampaign)

    const eventLinks = await eventLinkRepo.find({ where: { activity: { id: activityId } }, relations: ['event'] })
    const eventIds = eventLinks.map((link) => link.event.id)

    let campaignIds: string[] = []
    if (eventIds.length > 0) {
        const eventCampaignRepo = ds.getRepository(EventCampaign)
        const eventCampaignLinks = await eventCampaignRepo.find({
            where: eventIds.map((id) => ({ event: { id } })),
            relations: ['campaign']
        })
        campaignIds = eventCampaignLinks.map((link) => link.campaign.id)
    }

    if (campaignIds.length === 0) {
        const explicitLinks = await campaignLinkRepo.find({ where: { activity: { id: activityId } }, relations: ['campaign'] })
        if (explicitLinks.length === 0) {
            console.warn('[SECURITY] Permission denied', {
                timestamp: new Date().toISOString(),
                userId,
                activityId,
                action: permission || 'access',
                reason: 'activity_not_found'
            })
            throw createError(404, 'Activity not found')
        }
        campaignIds = explicitLinks.map((link) => link.campaign.id)
    }

    const uniqueCampaignIds = Array.from(new Set(campaignIds))
    if (uniqueCampaignIds.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            activityId,
            action: permission || 'access',
            reason: 'no_campaign_links'
        })
        throw createError(403, 'Access denied to this activity')
    }

    const membershipRepo = ds.getRepository(CampaignMember)
    const memberships = await membershipRepo.find({
        // TypeORM does not yet expose precise typings for an array of OR conditions.
        // The `as any` cast avoids false positives until the upstream types are improved.
        where: uniqueCampaignIds.map((id) => ({ campaign_id: id, user_id: userId })) as any
    })

    if (memberships.length === 0) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            activityId,
            campaignIds: uniqueCampaignIds,
            action: permission || 'access',
            reason: 'not_member'
        })
        throw createError(403, 'Access denied to this activity')
    }

    if (!permission) {
        return { membership: memberships[0], campaignId: memberships[0].campaign_id, viaCampaignIds: uniqueCampaignIds }
    }

    const allowedMembership = memberships.find(
        (membership) => ROLE_PERMISSIONS[(membership.role || 'member') as CampaignRole]?.[permission]
    )
    if (!allowedMembership) {
        console.warn('[SECURITY] Permission denied', {
            timestamp: new Date().toISOString(),
            userId,
            activityId,
            campaignIds: uniqueCampaignIds,
            action: permission,
            userRoles: memberships.map((m) => m.role || 'member'),
            reason: 'insufficient_permissions'
        })
        throw createError(403, 'Forbidden for this role')
    }

    return { membership: allowedMembership, campaignId: allowedMembership.campaign_id, viaCampaignIds: uniqueCampaignIds }
}

/**
 * Throws an error if the user is the campaign owner.
 * Owners cannot be modified or removed to preserve access control integrity.
 *
 * @param membership - The CampaignMember membership to check
 * @param operation - The operation type: 'modify' (default) or 'remove'
 * @throws HTTP 400 error if the user is an owner
 */
export function assertNotOwner(membership: CampaignMember, operation: 'modify' | 'remove' = 'modify'): void {
    const role = (membership.role || 'member') as CampaignRole
    if (role === 'owner') {
        const message = operation === 'remove' ? 'Owner cannot be removed from campaign' : 'Owner role cannot be modified'
        throw createError(400, message)
    }
}
