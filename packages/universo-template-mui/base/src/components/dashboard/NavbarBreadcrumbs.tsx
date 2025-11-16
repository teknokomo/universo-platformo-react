import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import Link from '@mui/material/Link'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useLocation, NavLink } from 'react-router-dom'
import { useMetaverseName, truncateMetaverseName } from '../../hooks/useMetaverseName'
import { useClusterName, truncateClusterName } from '../../hooks/useClusterName'
import { useProjectName, truncateProjectName } from '../../hooks/useProjectName'
import { useUnikName, truncateUnikName } from '../../hooks/useUnikName'

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

    // Extract unikId from URL for dynamic name loading
    const unikIdMatch = location.pathname.match(/^\/unik\/([^/]+)/)
    const unikId = unikIdMatch ? unikIdMatch[1] : null
    const unikName = useUnikName(unikId)

    // Clean keys without 'menu.' prefix since we're already using 'menu' namespace
    const menuMap: Record<string, string> = {
        uniks: 'uniks',
        metaverses: 'metaverses',
        clusters: 'clusters',
        projects: 'projects',
        profile: 'profile',
        docs: 'docs',
        spaces: 'spaces'
    }

    const segments = location.pathname.split('/').filter(Boolean)

    const crumbs = (() => {
        if (segments.length === 0) {
            return [{ label: t(menuMap.uniks), to: '/uniks' }]
        }

        const primary = segments[0]
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
