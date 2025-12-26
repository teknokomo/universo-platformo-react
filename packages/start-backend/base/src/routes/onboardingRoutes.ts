import { Router, Request, Response, RequestHandler } from 'express'
import { DataSource, In } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { AuthUser } from '@universo/auth-backend'
import { Project, ProjectUser } from '@universo/projects-backend'
import { Campaign, CampaignMember } from '@universo/campaigns-backend'
import { Cluster, ClusterUser } from '@universo/clusters-backend'

/**
 * System admin email - source of truth for onboarding items
 * This user's owned Projects, Campaigns, and Clusters are shown to new users
 * Using email (not UUID) for portability across database environments
 */
const SYSTEM_ADMIN_EMAIL = '580-39-39@mail.ru'

/**
 * Resolve user ID from request
 */
const resolveUserId = (req: Request): string | undefined => {
    const user = (req as unknown as { user?: AuthUser }).user
    if (!user) return undefined
    return user.id
}

/**
 * Onboarding item structure returned to frontend
 */
interface OnboardingItem {
    id: string
    name: string
    description?: string
    isSelected: boolean
}

/**
 * Create onboarding routes
 */
export function createOnboardingRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })

    // All onboarding routes require authentication
    router.use(ensureAuth)

    /**
     * GET /items - Get all available onboarding items
     * Returns Projects (Global Goals), Campaigns (Personal Interests), Clusters (Platform Features)
     * owned by system admin, with current user's selection status
     */
    router.get('/items', readLimiter, async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const ds = getDataSource()

        try {
            // Find system admin by email (portable across databases)
            const adminUser = await ds.manager.findOne(AuthUser, {
                where: { email: SYSTEM_ADMIN_EMAIL }
            })

            if (!adminUser) {
                console.warn('[onboarding] System admin not found:', SYSTEM_ADMIN_EMAIL)
                return res.json({
                    projects: [],
                    campaigns: [],
                    clusters: []
                })
            }

            const adminId = adminUser.id

            // Get Projects where admin is owner
            const adminProjectLinks = await ds.manager.find(ProjectUser, {
                where: { user_id: adminId, role: 'owner' }
            })
            const projectIds = adminProjectLinks.map((l) => l.project_id)
            const projects =
                projectIds.length > 0 ? await ds.manager.find(Project, { where: { id: In(projectIds) } }) : []

            // Get user's current project memberships
            const userProjectLinks =
                projectIds.length > 0
                    ? await ds.manager.find(ProjectUser, {
                          where: { user_id: userId, project_id: In(projectIds) }
                      })
                    : []
            const userProjectIds = new Set(userProjectLinks.map((l) => l.project_id))

            // Get Campaigns where admin is owner
            const adminCampaignLinks = await ds.manager.find(CampaignMember, {
                where: { user_id: adminId, role: 'owner' }
            })
            const campaignIds = adminCampaignLinks.map((l) => l.campaign_id)
            const campaigns =
                campaignIds.length > 0 ? await ds.manager.find(Campaign, { where: { id: In(campaignIds) } }) : []

            // Get user's current campaign memberships
            const userCampaignLinks =
                campaignIds.length > 0
                    ? await ds.manager.find(CampaignMember, {
                          where: { user_id: userId, campaign_id: In(campaignIds) }
                      })
                    : []
            const userCampaignIds = new Set(userCampaignLinks.map((l) => l.campaign_id))

            // Get Clusters where admin is owner
            const adminClusterLinks = await ds.manager.find(ClusterUser, {
                where: { user_id: adminId, role: 'owner' }
            })
            const clusterIds = adminClusterLinks.map((l) => l.cluster_id)
            const clusters =
                clusterIds.length > 0 ? await ds.manager.find(Cluster, { where: { id: In(clusterIds) } }) : []

            // Get user's current cluster memberships
            const userClusterLinks =
                clusterIds.length > 0
                    ? await ds.manager.find(ClusterUser, {
                          where: { user_id: userId, cluster_id: In(clusterIds) }
                      })
                    : []
            const userClusterIds = new Set(userClusterLinks.map((l) => l.cluster_id))

            // Map to response format
            const mapToItem = <T extends { id: string; name: string; description?: string | null }>(
                items: T[],
                selectedIds: Set<string>
            ): OnboardingItem[] =>
                items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    description: item.description ?? undefined,
                    isSelected: selectedIds.has(item.id)
                }))

            res.json({
                projects: mapToItem(projects, userProjectIds),
                campaigns: mapToItem(campaigns, userCampaignIds),
                clusters: mapToItem(clusters, userClusterIds)
            })
        } catch (error) {
            console.error('[onboarding] Error fetching items:', error)
            res.status(500).json({ error: 'Failed to fetch onboarding items' })
        }
    })

    /**
     * POST /join - Sync selected items (add/remove member links)
     * Synchronizes current user's membership in admin-owned Projects, Campaigns, and Clusters.
     * - Items in the request are added (if not already member)
     * - Items NOT in the request but currently selected are removed (only 'member' role, not owner/admin/editor)
     */
    router.post('/join', writeLimiter, async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' })
        }

        const schema = z.object({
            projectIds: z.array(z.string().uuid()).optional().default([]),
            campaignIds: z.array(z.string().uuid()).optional().default([]),
            clusterIds: z.array(z.string().uuid()).optional().default([])
        })

        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: parsed.error.flatten()
            })
        }

        const { projectIds, campaignIds, clusterIds } = parsed.data
        const ds = getDataSource()

        try {
            // Verify system admin exists (security check)
            const adminUser = await ds.manager.findOne(AuthUser, {
                where: { email: SYSTEM_ADMIN_EMAIL }
            })

            if (!adminUser) {
                return res.status(400).json({ error: 'System admin not found' })
            }

            const adminId = adminUser.id

            // Get all admin-owned item IDs
            const getAdminOwnedIds = async <T extends { user_id: string }>(
                EntityClass: new () => T,
                idField: keyof T
            ): Promise<Set<string>> => {
                const links = await ds.manager.find(EntityClass, {
                    where: {
                        user_id: adminId,
                        role: 'owner'
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                })
                return new Set(links.map((l) => l[idField] as string))
            }

            const adminOwnedProjects = await getAdminOwnedIds(ProjectUser, 'project_id' as keyof ProjectUser)
            const adminOwnedCampaigns = await getAdminOwnedIds(CampaignMember, 'campaign_id' as keyof CampaignMember)
            const adminOwnedClusters = await getAdminOwnedIds(ClusterUser, 'cluster_id' as keyof ClusterUser)

            // Filter requested IDs to only those owned by admin
            const validProjectIds = projectIds.filter((id) => adminOwnedProjects.has(id))
            const validCampaignIds = campaignIds.filter((id) => adminOwnedCampaigns.has(id))
            const validClusterIds = clusterIds.filter((id) => adminOwnedClusters.has(id))

            // Track changes
            const added = { projects: 0, campaigns: 0, clusters: 0 }
            const removed = { projects: 0, campaigns: 0, clusters: 0 }

            // Use transaction for atomicity
            await ds.transaction(async (manager) => {
                // Sync Projects
                const currentProjects = await manager.find(ProjectUser, {
                    where: { user_id: userId, role: 'member' }
                })
                const currentProjectIds = new Set(currentProjects.map((p) => p.project_id))

                // Batch add new selections
                const projectsToAdd = validProjectIds
                    .filter((projectId) => !currentProjectIds.has(projectId))
                    .map((projectId) =>
                        manager.create(ProjectUser, {
                            project_id: projectId,
                            user_id: userId,
                            role: 'member'
                        })
                    )
                if (projectsToAdd.length > 0) {
                    await manager.save(projectsToAdd)
                    added.projects = projectsToAdd.length
                }

                // Batch remove deselected (only if admin-owned and user is member)
                const selectedProjectSet = new Set(validProjectIds)
                const projectsToRemove = currentProjects.filter(
                    (current) =>
                        adminOwnedProjects.has(current.project_id) && !selectedProjectSet.has(current.project_id)
                )
                if (projectsToRemove.length > 0) {
                    await manager.remove(projectsToRemove)
                    removed.projects = projectsToRemove.length
                }

                // Sync Campaigns
                const currentCampaigns = await manager.find(CampaignMember, {
                    where: { user_id: userId, role: 'member' }
                })
                const currentCampaignIds = new Set(currentCampaigns.map((c) => c.campaign_id))

                // Batch add new campaign selections
                const campaignsToAdd = validCampaignIds
                    .filter((campaignId) => !currentCampaignIds.has(campaignId))
                    .map((campaignId) =>
                        manager.create(CampaignMember, {
                            campaign_id: campaignId,
                            user_id: userId,
                            role: 'member'
                        })
                    )
                if (campaignsToAdd.length > 0) {
                    await manager.save(campaignsToAdd)
                    added.campaigns = campaignsToAdd.length
                }

                // Batch remove deselected campaigns
                const selectedCampaignSet = new Set(validCampaignIds)
                const campaignsToRemove = currentCampaigns.filter(
                    (current) =>
                        adminOwnedCampaigns.has(current.campaign_id) && !selectedCampaignSet.has(current.campaign_id)
                )
                if (campaignsToRemove.length > 0) {
                    await manager.remove(campaignsToRemove)
                    removed.campaigns = campaignsToRemove.length
                }

                // Sync Clusters
                const currentClusters = await manager.find(ClusterUser, {
                    where: { user_id: userId, role: 'member' }
                })
                const currentClusterIds = new Set(currentClusters.map((c) => c.cluster_id))

                // Batch add new cluster selections
                const clustersToAdd = validClusterIds
                    .filter((clusterId) => !currentClusterIds.has(clusterId))
                    .map((clusterId) =>
                        manager.create(ClusterUser, {
                            cluster_id: clusterId,
                            user_id: userId,
                            role: 'member'
                        })
                    )
                if (clustersToAdd.length > 0) {
                    await manager.save(clustersToAdd)
                    added.clusters = clustersToAdd.length
                }

                // Batch remove deselected clusters
                const selectedClusterSet = new Set(validClusterIds)
                const clustersToRemove = currentClusters.filter(
                    (current) =>
                        adminOwnedClusters.has(current.cluster_id) && !selectedClusterSet.has(current.cluster_id)
                )
                if (clustersToRemove.length > 0) {
                    await manager.remove(clustersToRemove)
                    removed.clusters = clustersToRemove.length
                }
            })

            res.json({
                success: true,
                added,
                removed
            })
        } catch (error) {
            console.error('[onboarding] Error syncing items:', error)
            res.status(500).json({ error: 'Failed to sync selected items' })
        }
    })

    return router
}
