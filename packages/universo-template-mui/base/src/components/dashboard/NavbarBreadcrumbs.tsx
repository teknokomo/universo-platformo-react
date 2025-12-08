import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import Link from '@mui/material/Link'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useLocation, NavLink } from 'react-router-dom'
import { useHasGlobalAccess } from '@flowise/store'
import { useMetaverseName, truncateMetaverseName } from '../../hooks/useMetaverseName'
import { useClusterName, truncateClusterName } from '../../hooks/useClusterName'
import { useProjectName, truncateProjectName } from '../../hooks/useProjectName'
import { useCampaignName, truncateCampaignName } from '../../hooks/useCampaignName'
import { useUnikName, truncateUnikName } from '../../hooks/useUnikName'
import { useOrganizationName, truncateOrganizationName } from '../../hooks/useOrganizationName'
import { useStorageName, truncateStorageName } from '../../hooks/useStorageName'
import { useInstanceName, truncateInstanceName } from '../../hooks/useInstanceName'
import { useRoleName, truncateRoleName } from '../../hooks/useRoleName'

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
    margin: theme.spacing(1, 0),
    [`& .${breadcrumbsClasses.separator}`]: {
        color: (theme.vars || theme).palette.action.disabled,
        margin: 1
    },
    [`& .${breadcrumbsClasses.ol}`]: {
        alignItems: 'center'
    }
}))

export default function NavbarBreadcrumbs() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()

    // Extract metaverseId from URL for dynamic name loading (both singular and plural routes)
    const metaverseIdMatch = location.pathname.match(/^\/metaverses?\/([^/]+)/)
    const metaverseId = metaverseIdMatch ? metaverseIdMatch[1] : null
    const metaverseName = useMetaverseName(metaverseId)

    // Extract clusterId from URL for dynamic name loading (both singular and plural routes)
    const clusterIdMatch = location.pathname.match(/^\/clusters?\/([^/]+)/)
    const clusterId = clusterIdMatch ? clusterIdMatch[1] : null
    const clusterName = useClusterName(clusterId)

    // Extract projectId from URL for dynamic name loading (both singular and plural routes)
    const projectIdMatch = location.pathname.match(/^\/projects?\/([^/]+)/)
    const projectId = projectIdMatch ? projectIdMatch[1] : null
    const projectName = useProjectName(projectId)

    // Extract campaignId from URL for dynamic name loading (both singular and plural routes)
    const campaignIdMatch = location.pathname.match(/^\/campaigns?\/([^/]+)/)
    const campaignId = campaignIdMatch ? campaignIdMatch[1] : null
    const campaignName = useCampaignName(campaignId)

    // Extract organizationId from URL for dynamic name loading (both singular and plural routes)
    const organizationIdMatch = location.pathname.match(/^\/organizations?\/([^/]+)/)
    const organizationId = organizationIdMatch ? organizationIdMatch[1] : null
    const organizationName = useOrganizationName(organizationId)

    // Extract storageId from URL for dynamic name loading (both singular and plural routes)
    const storageIdMatch = location.pathname.match(/^\/storages?\/([^/]+)/)
    const storageId = storageIdMatch ? storageIdMatch[1] : null
    const storageName = useStorageName(storageId)

    // Extract unikId from URL for dynamic name loading
    const unikIdMatch = location.pathname.match(/^\/unik\/([^/]+)/)
    const unikId = unikIdMatch ? unikIdMatch[1] : null
    const unikName = useUnikName(unikId)

    // Extract instanceId and roleId from admin routes for dynamic name loading
    const instanceIdMatch = location.pathname.match(/^\/admin\/instance\/([^/]+)/)
    const instanceId = instanceIdMatch ? instanceIdMatch[1] : null
    const instanceName = useInstanceName(instanceId)

    const roleIdMatch = location.pathname.match(/^\/admin\/instance\/[^/]+\/roles\/([^/]+)/)
    const roleId = roleIdMatch ? roleIdMatch[1] : null
    const roleName = useRoleName(roleId)

    // Check admin panel access for admin routes
    // This prevents breadcrumbs from showing "Администрирование" before redirect
    const { canAccessAdminPanel, loading: adminAccessLoading } = useHasGlobalAccess()

    // Clean keys without 'menu.' prefix since we're already using 'menu' namespace
    const menuMap: Record<string, string> = {
        uniks: 'uniks',
        metaverses: 'metaverses',
        clusters: 'clusters',
        projects: 'projects',
        campaigns: 'campaigns',
        organizations: 'organizations',
        storages: 'storages',
        profile: 'profile',
        docs: 'docs',
        spaces: 'spaces',
        admin: 'administration'
    }

    const segments = location.pathname.split('/').filter(Boolean)

    const crumbs = (() => {
        if (segments.length === 0) {
            return [{ label: t(menuMap.uniks), to: '/uniks' }]
        }

        const primary = segments[0]

        // Early return for metaverse context routes when access is not yet verified
        // This prevents UI flicker before MetaverseGuard redirects unauthorized users
        const isMetaverseContextRoute = (primary === 'metaverses' || primary === 'metaverse') && segments.length > 1
        if (isMetaverseContextRoute && !metaverseName) {
            return []
        }
        if (primary === 'unik') {
            const items = [{ label: t(menuMap.uniks), to: '/uniks' }]

            if (segments[1] && unikName) {
                // Use actual unik name with truncation for long names
                items.push({
                    label: truncateUnikName(unikName),
                    to: `/unik/${segments[1]}`
                })

                // Sub-pages (spaces, tools, credentials, etc.) - use keys from menu namespace
                if (segments[2] === 'spaces') {
                    items.push({ label: t('spaces'), to: location.pathname })
                } else if (segments[2] === 'tools') {
                    items.push({ label: t('tools'), to: location.pathname })
                } else if (segments[2] === 'credentials') {
                    items.push({ label: t('credentials'), to: location.pathname })
                } else if (segments[2] === 'variables') {
                    items.push({ label: t('variables'), to: location.pathname })
                } else if (segments[2] === 'apikeys') {
                    items.push({ label: t('apiKeys'), to: location.pathname })
                } else if (segments[2] === 'documents') {
                    items.push({ label: t('documents'), to: location.pathname })
                } else if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'analytics') {
                    items.push({ label: t('analytics'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'metaverses') {
            const items = [{ label: t(menuMap.metaverses), to: '/metaverses' }]

            // Handle nested routes like /metaverses/:id/sections or /metaverses/:id/entities
            if (segments[1] && metaverseName) {
                items.push({
                    label: truncateMetaverseName(metaverseName),
                    to: `/metaverse/${segments[1]}`
                })

                // Sub-pages (sections, entities) - use keys from menu namespace
                if (segments[2] === 'sections') {
                    items.push({ label: t('sections'), to: location.pathname })
                } else if (segments[2] === 'entities') {
                    items.push({ label: t('entities'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'metaverse') {
            const items = [{ label: t(menuMap.metaverses), to: '/metaverses' }]

            if (segments[1] && metaverseName) {
                // Use actual metaverse name with truncation for long names
                items.push({
                    label: truncateMetaverseName(metaverseName),
                    to: `/metaverse/${segments[1]}`
                })

                // Sub-pages (access, sections, entities) - use keys from menu namespace
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'sections') {
                    items.push({ label: t('sections'), to: location.pathname })
                } else if (segments[2] === 'entities') {
                    items.push({ label: t('entities'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'clusters') {
            const items = [{ label: t(menuMap.clusters), to: '/clusters' }]

            // Handle nested routes like /clusters/:id/domains or /clusters/:id/resources
            if (segments[1] && clusterName) {
                items.push({
                    label: truncateClusterName(clusterName),
                    to: `/cluster/${segments[1]}`
                })

                // Sub-pages (domains, resources) - use keys from menu namespace
                if (segments[2] === 'domains') {
                    items.push({ label: t('domains'), to: location.pathname })
                } else if (segments[2] === 'resources') {
                    items.push({ label: t('resources'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'cluster') {
            const items = [{ label: t(menuMap.clusters), to: '/clusters' }]

            if (segments[1] && clusterName) {
                // Use actual cluster name with truncation for long names
                items.push({
                    label: truncateClusterName(clusterName),
                    to: `/cluster/${segments[1]}`
                })

                // Sub-pages (access, resources, domains) - use keys from menu namespace
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'resources') {
                    items.push({ label: t('resources'), to: location.pathname })
                } else if (segments[2] === 'domains') {
                    items.push({ label: t('domains'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'projects') {
            const items = [{ label: t(menuMap.projects), to: '/projects' }]

            // Handle nested routes like /projects/:id/milestones or /projects/:id/tasks
            if (segments[1] && projectName) {
                items.push({
                    label: truncateProjectName(projectName),
                    to: `/project/${segments[1]}`
                })

                // Sub-pages (milestones, tasks) - use keys from menu namespace
                if (segments[2] === 'milestones') {
                    items.push({ label: t('milestones'), to: location.pathname })
                } else if (segments[2] === 'tasks') {
                    items.push({ label: t('tasks'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'project') {
            const items = [{ label: t(menuMap.projects), to: '/projects' }]

            if (segments[1] && projectName) {
                // Use actual project name with truncation for long names
                items.push({
                    label: truncateProjectName(projectName),
                    to: `/project/${segments[1]}`
                })

                // Sub-pages (access, milestones, tasks) - use keys from menu namespace
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'milestones') {
                    items.push({ label: t('milestones'), to: location.pathname })
                } else if (segments[2] === 'tasks') {
                    items.push({ label: t('tasks'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'campaigns') {
            const items = [{ label: t(menuMap.campaigns), to: '/campaigns' }]

            // Handle nested routes like /campaigns/:id/events or /campaigns/:id/activities
            if (segments[1] && campaignName) {
                items.push({
                    label: truncateCampaignName(campaignName),
                    to: `/campaign/${segments[1]}`
                })

                // Sub-pages (events, activities) - use keys from menu namespace
                if (segments[2] === 'events') {
                    items.push({ label: t('events'), to: location.pathname })
                } else if (segments[2] === 'activities') {
                    items.push({ label: t('activities'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'campaign') {
            const items = [{ label: t(menuMap.campaigns), to: '/campaigns' }]

            if (segments[1] && campaignName) {
                // Use actual campaign name with truncation for long names
                items.push({
                    label: truncateCampaignName(campaignName),
                    to: `/campaign/${segments[1]}`
                })

                // Sub-pages (access, events, activities) - use keys from menu namespace
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'events') {
                    items.push({ label: t('events'), to: location.pathname })
                } else if (segments[2] === 'activities') {
                    items.push({ label: t('activities'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'organizations') {
            const items = [{ label: t(menuMap.organizations), to: '/organizations' }]

            // Handle nested routes like /organizations/:id/departments or /organizations/:id/positions
            if (segments[1] && organizationName) {
                items.push({
                    label: truncateOrganizationName(organizationName),
                    to: `/organization/${segments[1]}`
                })

                // Sub-pages (departments, positions) - use keys from menu namespace
                if (segments[2] === 'departments') {
                    items.push({ label: t('departments'), to: location.pathname })
                } else if (segments[2] === 'positions') {
                    items.push({ label: t('positions'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'organization') {
            const items = [{ label: t(menuMap.organizations), to: '/organizations' }]

            if (segments[1] && organizationName) {
                // Use actual organization name with truncation for long names
                items.push({
                    label: truncateOrganizationName(organizationName),
                    to: `/organization/${segments[1]}`
                })

                // Sub-pages (access, departments, positions) - use keys from menu namespace
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'departments') {
                    items.push({ label: t('departments'), to: location.pathname })
                } else if (segments[2] === 'positions') {
                    items.push({ label: t('positions'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'storages') {
            const items = [{ label: t(menuMap.storages), to: '/storages' }]

            // Handle nested routes like /storages/:id/containers or /storages/:id/slots
            if (segments[1] && storageName) {
                items.push({
                    label: truncateStorageName(storageName),
                    to: `/storage/${segments[1]}/board`
                })

                // Sub-pages (containers, slots) - use keys from menu namespace
                if (segments[2] === 'containers') {
                    items.push({ label: t('containers'), to: location.pathname })
                } else if (segments[2] === 'slots') {
                    items.push({ label: t('slots'), to: location.pathname })
                }
            }

            return items
        }

        if (primary === 'storage') {
            const items = [{ label: t(menuMap.storages), to: '/storages' }]

            if (segments[1] && storageName) {
                // Use actual storage name with truncation for long names
                items.push({
                    label: truncateStorageName(storageName),
                    to: `/storage/${segments[1]}/board`
                })

                // Sub-pages (board, members) - use keys from menu namespace
                if (segments[2] === 'board') {
                    items.push({ label: t('storageboard'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('members'), to: location.pathname })
                }
            }

            return items
        }

        // Admin routes handling
        // Don't show admin breadcrumbs while checking access or if user doesn't have access
        // This prevents UI flicker before AdminGuard redirects unauthorized users
        if (primary === 'admin') {
            if (adminAccessLoading || !canAccessAdminPanel) {
                return []
            }

            const items = [{ label: t('administration'), to: '/admin' }]

            // Instance context routes
            if (segments[1] === 'instance' && segments[2]) {
                const instanceIdFromUrl = segments[2]
                // Use dynamic instance name or fallback to static label
                const instanceLabel = instanceName ? truncateInstanceName(instanceName) : t('instance')
                items.push({ label: instanceLabel, to: `/admin/instance/${instanceIdFromUrl}` })

                // Sub-pages within instance
                if (segments[3] === 'board') {
                    items.push({ label: t('board'), to: `/admin/instance/${instanceIdFromUrl}/board` })
                } else if (segments[3] === 'access') {
                    items.push({ label: t('superusers'), to: `/admin/instance/${instanceIdFromUrl}/access` })
                } else if (segments[3] === 'roles') {
                    items.push({ label: t('roles'), to: `/admin/instance/${instanceIdFromUrl}/roles` })
                    // Role detail page
                    if (segments[4] && segments[4] !== 'new') {
                        // Use dynamic role name or fallback to static label
                        const roleLabel = roleName ? truncateRoleName(roleName) : t('role')
                        items.push({ label: roleLabel, to: `/admin/instance/${instanceIdFromUrl}/roles/${segments[4]}` })
                        // Users sub-page within role
                        if (segments[5] === 'users') {
                            items.push({ label: t('users'), to: location.pathname })
                        }
                    }
                }
            }
            // Legacy routes
            else if (segments[1] === 'access') {
                items.push({ label: t('access'), to: '/admin/access' })
            } else if (segments[1] === 'board') {
                items.push({ label: t('board'), to: '/admin/board' })
            }

            return items
        }

        if (menuMap[primary]) {
            return [{ label: t(menuMap[primary]), to: `/${primary}` }]
        }

        return segments.map((segment, index) => ({
            label: segment,
            to: '/' + segments.slice(0, index + 1).join('/')
        }))
    })()

    return (
        <StyledBreadcrumbs aria-label='breadcrumb' separator={<NavigateNextRoundedIcon fontSize='small' />}>
            {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1
                return isLast ? (
                    <Typography key={crumb.to} variant='body1' sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {crumb.label}
                    </Typography>
                ) : (
                    <Link
                        component={NavLink}
                        key={crumb.to}
                        to={crumb.to}
                        underline='none'
                        color='text.secondary'
                        sx={{ fontSize: '1rem' }}
                    >
                        {crumb.label}
                    </Link>
                )
            })}
        </StyledBreadcrumbs>
    )
}
