import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import Link from '@mui/material/Link'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useLocation, NavLink } from 'react-router-dom'
import { useHasGlobalAccess } from '@flowise/store'
import {
    useMetaverseName,
    truncateMetaverseName,
    useMetahubName,
    truncateMetahubName,
    useClusterName,
    truncateClusterName,
    useProjectName,
    truncateProjectName,
    useCampaignName,
    truncateCampaignName,
    useUnikName,
    truncateUnikName,
    useOrganizationName,
    truncateOrganizationName,
    useStorageName,
    truncateStorageName,
    useApplicationName,
    truncateApplicationName,
    useMetahubPublicationName,
    useHubName,
    truncateHubName,
    useCatalogName,
    useCatalogNameStandalone,
    truncateCatalogName,
    useEnumerationName,
    truncateEnumerationName,
    useAttributeName,
    truncateAttributeName,
    truncatePublicationName,
    useConnectorName,
    truncateConnectorName,
    useLayoutName,
    truncateLayoutName
} from '../../hooks'
import { useInstanceName, truncateInstanceName, useRoleName, truncateRoleName } from '@universo/admin-frontend'

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

    // Extract metahubId from URL for dynamic name loading (both singular and plural routes)
    const metahubIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)/)
    const metahubId = metahubIdMatch ? metahubIdMatch[1] : null
    const metahubName = useMetahubName(metahubId)

    // Extract layoutId from URL for dynamic name loading (under metahub context)
    // Pattern: /metahub/:metahubId/layouts/:layoutId
    const layoutIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/layouts\/([^/]+)/)
    const layoutParentMetahubId = layoutIdMatch ? layoutIdMatch[1] : null
    const layoutId = layoutIdMatch ? layoutIdMatch[2] : null
    const layoutName = useLayoutName(layoutParentMetahubId, layoutId)

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

    // Extract applicationId from URL for dynamic name loading (application admin context)
    // Pattern: /a/:applicationId/admin/...
    const applicationIdMatch = location.pathname.match(/^\/a\/([^/]+)\/admin(?:\/|$)/)
    const applicationId = applicationIdMatch ? applicationIdMatch[1] : null
    const applicationName = useApplicationName(applicationId)

    // Extract connectorId from URL for dynamic name loading (under application admin context)
    // Pattern: /a/:applicationId/admin/connector/:connectorId
    const connectorIdMatch = location.pathname.match(/^\/a\/([^/]+)\/admin\/connector\/([^/]+)/)
    const connectorParentApplicationId = connectorIdMatch ? connectorIdMatch[1] : null
    const connectorId = connectorIdMatch ? connectorIdMatch[2] : null
    const connectorName = useConnectorName(connectorParentApplicationId, connectorId)

    // Extract publicationId from URL for dynamic name loading (under metahub context)
    // Pattern: /metahub/:metahubId/publication/:publicationId/...
    const metahubPublicationIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/(?:application|publication)\/([^/]+)/)
    const metahubPublicationParentId = metahubPublicationIdMatch ? metahubPublicationIdMatch[1] : null
    const metahubPublicationId = metahubPublicationIdMatch ? metahubPublicationIdMatch[2] : null
    const metahubPublicationName = useMetahubPublicationName(metahubPublicationParentId, metahubPublicationId)

    // Extract hubId from URL for dynamic name loading (under metahub context)
    // Pattern: /metahub/:metahubId/hub/:hubId/...
    const hubIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)/)
    const hubParentMetahubId = hubIdMatch ? hubIdMatch[1] : null
    const hubId = hubIdMatch ? hubIdMatch[2] : null
    const hubName = useHubName(hubParentMetahubId, hubId)

    // Extract catalogId from URL for dynamic name loading (under hub context)
    // Pattern: /metahub/:metahubId/hub/:hubId/catalog/:catalogId/... (singular 'catalog' for specific catalog)
    const catalogIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)\/catalogs?\/([^/]+)/)
    const catalogParentMetahubId = catalogIdMatch ? catalogIdMatch[1] : null
    const catalogParentHubId = catalogIdMatch ? catalogIdMatch[2] : null
    const catalogId = catalogIdMatch ? catalogIdMatch[3] : null
    const catalogName = useCatalogName(catalogParentMetahubId, catalogParentHubId, catalogId)

    // Extract catalogId from URL for catalog-centric navigation (without hub context)
    // Pattern: /metahub/:metahubId/catalog/:catalogId/... (NOT /hub/) - singular 'catalog' for specific catalog
    const standaloneCatalogIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/catalogs?\/([^/]+)/)
    const standaloneCatalogMetahubId = standaloneCatalogIdMatch ? standaloneCatalogIdMatch[1] : null
    const standaloneCatalogId = standaloneCatalogIdMatch ? standaloneCatalogIdMatch[2] : null
    const standaloneCatalogName = useCatalogNameStandalone(standaloneCatalogMetahubId, standaloneCatalogId)

    // Extract enumerationId from global and hub-scoped metahub routes
    // Patterns:
    // - /metahub/:metahubId/enumeration/:enumerationId/values
    // - /metahub/:metahubId/hub/:hubId/enumeration/:enumerationId/values
    const standaloneEnumerationIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/enumeration\/([^/]+)/)
    const hubEnumerationIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)\/enumeration\/([^/]+)/)
    const enumerationParentMetahubId = standaloneEnumerationIdMatch
        ? standaloneEnumerationIdMatch[1]
        : hubEnumerationIdMatch
        ? hubEnumerationIdMatch[1]
        : null
    const enumerationId = standaloneEnumerationIdMatch
        ? standaloneEnumerationIdMatch[2]
        : hubEnumerationIdMatch
        ? hubEnumerationIdMatch[3]
        : null
    const enumerationName = useEnumerationName(enumerationParentMetahubId, enumerationId)

    // Extract attributeId from URL for dynamic name loading (under catalog context)
    // Pattern: /metahub/:metahubId/hub/:hubId/catalogs/:catalogId/attributes/:attributeId
    const attributeIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)\/catalogs\/([^/]+)\/attributes\/([^/]+)/)
    const attrParentMetahubId = attributeIdMatch ? attributeIdMatch[1] : null
    const attrParentHubId = attributeIdMatch ? attributeIdMatch[2] : null
    const attrParentCatalogId = attributeIdMatch ? attributeIdMatch[3] : null
    const attributeId = attributeIdMatch ? attributeIdMatch[4] : null
    const attributeName = useAttributeName(attrParentMetahubId, attrParentHubId, attrParentCatalogId, attributeId)
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
        metahubs: 'metahubs',
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

        if (primary === 'metahubs') {
            return [{ label: t(menuMap.metahubs), to: '/metahubs' }]
        }

        if (primary === 'metahub') {
            const items = [{ label: t(menuMap.metahubs), to: '/metahubs' }]

            if (segments[1] && metahubName) {
                // Use actual metahub name with truncation for long names
                items.push({
                    label: truncateMetahubName(metahubName),
                    to: `/metahub/${segments[1]}`
                })

                // Sub-pages: hubs, catalogs, access, members
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'catalogs') {
                    // Catalog list navigation (without hub context)
                    items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/catalogs` })

                    // If a specific catalog is selected via list route (segments[3])
                    if (segments[3] && standaloneCatalogName) {
                        // Link to attributes page (default view for catalog)
                        items.push({
                            label: truncateCatalogName(standaloneCatalogName),
                            to: `/metahub/${segments[1]}/catalog/${segments[3]}/attributes`
                        })

                        // Nested under catalog: attributes or elements
                        if (segments[4] === 'attributes') {
                            items.push({ label: t('attributes'), to: location.pathname })
                        } else if (segments[4] === 'elements') {
                            items.push({ label: t('elements'), to: location.pathname })
                        }
                    }
                } else if (segments[2] === 'catalog') {
                    // Catalog-centric navigation - singular 'catalog' route for specific catalog view
                    items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/catalogs` })

                    // segments[3] is catalogId
                    if (segments[3] && standaloneCatalogName) {
                        // Link to attributes page (default view for catalog)
                        items.push({
                            label: truncateCatalogName(standaloneCatalogName),
                            to: `/metahub/${segments[1]}/catalog/${segments[3]}/attributes`
                        })

                        // Nested under catalog: attributes or elements
                        if (segments[4] === 'attributes') {
                            items.push({ label: t('attributes'), to: location.pathname })
                        } else if (segments[4] === 'elements') {
                            items.push({ label: t('elements'), to: location.pathname })
                        }
                    }
                } else if (segments[2] === 'enumerations') {
                    items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/enumerations` })
                } else if (segments[2] === 'enumeration') {
                    items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/enumerations` })
                    if (segments[3] && enumerationName) {
                        items.push({
                            label: truncateEnumerationName(enumerationName),
                            to: `/metahub/${segments[1]}/enumeration/${segments[3]}/values`
                        })
                    } else if (segments[3]) {
                        items.push({
                            label: segments[3],
                            to: `/metahub/${segments[1]}/enumeration/${segments[3]}/values`
                        })
                    }
                    if (segments[4] === 'values' && segments[3]) {
                        items.push({
                            label: t('values'),
                            to: `/metahub/${segments[1]}/enumeration/${segments[3]}/values`
                        })
                    }
                } else if (segments[2] === 'hubs') {
                    // Hubs list
                    items.push({ label: t('hubs'), to: `/metahub/${segments[1]}/hubs` })
                } else if (segments[2] === 'branches') {
                    items.push({ label: t('branches'), to: `/metahub/${segments[1]}/branches` })
                } else if (segments[2] === 'layouts') {
                    items.push({ label: t('layouts'), to: `/metahub/${segments[1]}/layouts` })

                    if (segments[3] && layoutName) {
                        items.push({ label: truncateLayoutName(layoutName), to: location.pathname })
                    } else if (segments[3]) {
                        items.push({ label: segments[3], to: location.pathname })
                    }
                } else if (segments[2] === 'publications') {
                    // Publications list
                    items.push({ label: t('publications'), to: `/metahub/${segments[1]}/publications` })
                } else if (segments[2] === 'publication') {
                    // Publication details (singular route)
                    items.push({ label: t('publications'), to: `/metahub/${segments[1]}/publications` })

                    if (segments[3] && metahubPublicationName) {
                        items.push({ label: truncatePublicationName(metahubPublicationName), to: location.pathname })
                    } else if (segments[3]) {
                        // Fallback to UUID while loading
                        items.push({ label: segments[3], to: location.pathname })
                    }
                } else if (segments[2] === 'hub') {
                    // Specific hub selected - use singular 'hub' in URL
                    items.push({ label: t('hubs'), to: `/metahub/${segments[1]}/hubs` })

                    // If we have a specific hub selected (segments[3])
                    if (segments[3] && hubName) {
                        // Check if we're in catalogs context (list view)
                        if (segments[4] === 'catalogs') {
                            // Hub name links to catalogs list (as default hub view)
                            items.push({
                                label: truncateHubName(hubName),
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs`
                            })

                            // Catalogs list under hub
                            items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs` })

                            // If a specific catalog is selected via list route (segments[5])
                            if (segments[5] && catalogName) {
                                items.push({
                                    label: truncateCatalogName(catalogName),
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/catalog/${segments[5]}/attributes`
                                })

                                // Nested under catalog: attributes or elements
                                if (segments[6] === 'attributes') {
                                    items.push({ label: t('attributes'), to: location.pathname })

                                    // If a specific attribute is selected
                                    if (segments[7] && attributeName) {
                                        items.push({
                                            label: truncateAttributeName(attributeName),
                                            to: location.pathname
                                        })
                                    }
                                } else if (segments[6] === 'elements') {
                                    items.push({ label: t('elements'), to: location.pathname })
                                }
                            }
                        } else if (segments[4] === 'enumerations') {
                            items.push({
                                label: truncateHubName(hubName),
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs`
                            })
                            items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/hub/${segments[3]}/enumerations` })
                        } else if (segments[4] === 'enumeration') {
                            items.push({
                                label: truncateHubName(hubName),
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs`
                            })
                            items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/hub/${segments[3]}/enumerations` })

                            if (segments[5] && enumerationName) {
                                items.push({
                                    label: truncateEnumerationName(enumerationName),
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/enumeration/${segments[5]}/values`
                                })
                            } else if (segments[5]) {
                                items.push({
                                    label: segments[5],
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/enumeration/${segments[5]}/values`
                                })
                            }

                            if (segments[6] === 'values' && segments[5]) {
                                items.push({
                                    label: t('values'),
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/enumeration/${segments[5]}/values`
                                })
                            }
                        } else if (segments[4] === 'catalog') {
                            // Singular 'catalog' route - specific catalog view
                            items.push({
                                label: truncateHubName(hubName),
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs`
                            })

                            // Catalogs list link
                            items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs` })

                            // segments[5] is catalogId
                            if (segments[5] && catalogName) {
                                items.push({
                                    label: truncateCatalogName(catalogName),
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/catalog/${segments[5]}/attributes`
                                })

                                // Nested under catalog: attributes or elements
                                if (segments[6] === 'attributes') {
                                    items.push({ label: t('attributes'), to: location.pathname })

                                    // If a specific attribute is selected
                                    if (segments[7] && attributeName) {
                                        items.push({
                                            label: truncateAttributeName(attributeName),
                                            to: location.pathname
                                        })
                                    }
                                } else if (segments[6] === 'elements') {
                                    items.push({ label: t('elements'), to: location.pathname })
                                }
                            }
                        } else {
                            // Other hub sub-pages (fallback)
                            items.push({
                                label: truncateHubName(hubName),
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs`
                            })

                            if (segments[4] === 'attributes') {
                                items.push({ label: t('attributes'), to: location.pathname })
                            } else if (segments[4] === 'elements') {
                                items.push({ label: t('elements'), to: location.pathname })
                            }
                        }
                    }
                }
            } else if (segments[1]) {
                items.push({
                    label: '...',
                    to: `/metahub/${segments[1]}`
                })
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

        // Standalone Applications module (not metahub applications)
        if (primary === 'applications') {
            return [{ label: t('applications'), to: '/applications' }]
        }

        if (primary === 'a') {
            const items = [{ label: t('applications'), to: '/applications' }]

            const currentApplicationId = segments[1]
            const adminSection = segments[2]

            if (currentApplicationId && applicationName && adminSection === 'admin') {
                // Use actual application name with truncation for long names
                items.push({
                    label: truncateApplicationName(applicationName),
                    to: `/a/${currentApplicationId}/admin`
                })

                // Sub-pages (connectors, access, connector) - use keys from menu namespace
                if (segments[3] === 'connectors') {
                    items.push({ label: t('connectors'), to: location.pathname })
                } else if (segments[3] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[3] === 'connector' && segments[4]) {
                    // Connector detail page: Application > Connectors > [Connector Name]
                    items.push({ label: t('connectors'), to: `/a/${currentApplicationId}/admin/connectors` })
                    if (connectorName) {
                        items.push({
                            label: truncateConnectorName(connectorName),
                            to: location.pathname
                        })
                    } else {
                        // Fallback while loading connector name
                        items.push({ label: '...', to: location.pathname })
                    }
                }
            } else if (currentApplicationId) {
                // Fallback while loading name
                items.push({
                    label: '...',
                    to: `/a/${currentApplicationId}/admin`
                })
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
                } else if (segments[3] === 'users') {
                    items.push({ label: t('users'), to: `/admin/instance/${instanceIdFromUrl}/users` })
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
            <Link
                component={NavLink}
                to='/'
                underline='none'
                color='text.secondary'
                sx={{
                    fontSize: '1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                    verticalAlign: 'middle',
                    transform: 'translateY(-0.02rem)',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'none' }
                }}
                aria-label='Home'
            >
                <HomeRoundedIcon sx={{ fontSize: '1.2rem', verticalAlign: 'middle', transform: 'translateY(-0.04rem)' }} />
            </Link>
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
