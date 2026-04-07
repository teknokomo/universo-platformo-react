import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import Link from '@mui/material/Link'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useLocation, NavLink } from 'react-router-dom'
import { useAuth } from '@universo/auth-frontend'
import { getVLCString } from '@universo/utils'
import { useHasGlobalAccess } from '@universo/store'
import {
    truncateMetahubName,
    truncateApplicationName,
    useMetahubPublicationName,
    useHubName,
    truncateHubName,
    useCatalogName,
    useCatalogNameStandalone,
    useSetNameStandalone,
    truncateCatalogName,
    truncateSetName,
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

const extractLocalizedString = (value: unknown): string | null => {
    const locale = (i18n.resolvedLanguage || i18n.language || 'en').split(/[-_]/)[0].toLowerCase()
    const localized = getVLCString(value as Parameters<typeof getVLCString>[0], locale).trim()
    return localized.length > 0 ? localized : null
}

type ApplicationShellDetail = Record<string, unknown> & {
    name?: unknown
    slug?: string | null
    schemaName?: string | null
}

export default function NavbarBreadcrumbs() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()
    const { client, loading: authLoading } = useAuth()

    // Extract metahubId from URL for dynamic name loading (both singular and plural routes)
    const metahubIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)/)
    const metahubId = metahubIdMatch ? metahubIdMatch[1] : null
    const metahubDetailQuery = useQuery<{ name?: unknown; codename?: unknown }, unknown, string | null>({
        queryKey: metahubId ? ['metahubs', 'detail', metahubId] : ['metahubs', 'detail', 'missing-id'],
        queryFn: async () => {
            const response = await client.get<{ name?: unknown; codename?: unknown }>(`/metahub/${metahubId}`)
            return response.data
        },
        select: (data) => extractLocalizedString(data?.name) || extractLocalizedString(data?.codename) || null,
        enabled: Boolean(metahubId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 2,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })
    const metahubName = metahubDetailQuery.data ?? null

    // Extract layoutId from URL for dynamic name loading (under metahub context)
    // Patterns: /metahub/:metahubId/layouts/:layoutId, /metahub/:metahubId/common/layouts/:layoutId,
    // /metahub/:metahubId/catalog/:catalogId/layout/:layoutId
    const layoutDetailMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/(?:common\/layouts|general\/layouts|layouts)\/([^/]+)/)
    const catalogLayoutDetailMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/catalog\/([^/]+)\/layout\/([^/]+)/)
    const layoutParentMetahubId = layoutDetailMatch ? layoutDetailMatch[1] : catalogLayoutDetailMatch ? catalogLayoutDetailMatch[1] : null
    const layoutId = layoutDetailMatch ? layoutDetailMatch[2] : catalogLayoutDetailMatch ? catalogLayoutDetailMatch[3] : null
    const layoutName = useLayoutName(layoutParentMetahubId, layoutId)

    // Extract applicationId from URL for dynamic name loading (application admin context)
    // Pattern: /a/:applicationId/admin/...
    const applicationIdMatch = location.pathname.match(/^\/a\/([^/]+)\/admin(?:\/|$)/)
    const applicationId = applicationIdMatch ? applicationIdMatch[1] : null
    const applicationDetailQuery = useQuery<ApplicationShellDetail, unknown, string | null>({
        queryKey: applicationId ? ['applications', 'detail', applicationId] : ['applications', 'detail', 'missing-id'],
        queryFn: async () => {
            const response = await client.get<ApplicationShellDetail>(`/applications/${applicationId}`)
            return response.data
        },
        select: (data) => extractLocalizedString(data?.name) || data?.slug || null,
        enabled: Boolean(applicationId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 2,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })
    const applicationName = applicationDetailQuery.data ?? null

    useEffect(() => {
        if (!metahubId || authLoading) return
        if (metahubDetailQuery.status === 'success' && !metahubName) {
            console.warn('[breadcrumbs] Empty metahub label after successful detail query', {
                path: location.pathname,
                metahubId,
                queryStatus: metahubDetailQuery.status,
                fetchStatus: metahubDetailQuery.fetchStatus
            })
        }
    }, [authLoading, location.pathname, metahubDetailQuery.fetchStatus, metahubDetailQuery.status, metahubId, metahubName])

    useEffect(() => {
        if (!applicationId || authLoading) return
        if (applicationDetailQuery.status === 'success' && !applicationName) {
            console.warn('[breadcrumbs] Empty application label after successful detail query', {
                path: location.pathname,
                applicationId,
                queryStatus: applicationDetailQuery.status,
                fetchStatus: applicationDetailQuery.fetchStatus
            })
        }
    }, [applicationDetailQuery.fetchStatus, applicationDetailQuery.status, applicationId, applicationName, authLoading, location.pathname])

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
    // Pattern: /metahub/:metahubId/hub/:hubId/catalog/:catalogId/...
    const catalogIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)\/catalogs?\/([^/]+)/)
    const catalogParentMetahubId = catalogIdMatch ? catalogIdMatch[1] : null
    const catalogParentHubId = catalogIdMatch ? catalogIdMatch[2] : null
    const catalogId = catalogIdMatch ? catalogIdMatch[3] : null
    const catalogName = useCatalogName(catalogParentMetahubId, catalogParentHubId, catalogId)

    // Extract catalogId from URL for catalog-centric navigation (without hub context)
    // Pattern: /metahub/:metahubId/catalog/:catalogId/...
    const standaloneCatalogIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/catalogs?\/([^/]+)/)
    const standaloneCatalogMetahubId = standaloneCatalogIdMatch ? standaloneCatalogIdMatch[1] : null
    const standaloneCatalogId = standaloneCatalogIdMatch ? standaloneCatalogIdMatch[2] : null
    const standaloneCatalogName = useCatalogNameStandalone(standaloneCatalogMetahubId, standaloneCatalogId)

    // Extract setId from global and hub-scoped metahub routes
    const standaloneSetIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/set\/([^/]+)/)
    const hubSetIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)\/set\/([^/]+)/)
    const setParentMetahubId = standaloneSetIdMatch ? standaloneSetIdMatch[1] : hubSetIdMatch ? hubSetIdMatch[1] : null
    const setId = standaloneSetIdMatch ? standaloneSetIdMatch[2] : hubSetIdMatch ? hubSetIdMatch[3] : null
    const setName = useSetNameStandalone(setParentMetahubId, setId)

    // Extract enumerationId from global and hub-scoped metahub routes
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
    const attributeIdMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/hub\/([^/]+)\/catalogs\/([^/]+)\/attributes\/([^/]+)/)
    const attrParentMetahubId = attributeIdMatch ? attributeIdMatch[1] : null
    const attrParentHubId = attributeIdMatch ? attributeIdMatch[2] : null
    const attrParentCatalogId = attributeIdMatch ? attributeIdMatch[3] : null
    const attributeId = attributeIdMatch ? attributeIdMatch[4] : null
    const attributeName = useAttributeName(attrParentMetahubId, attrParentHubId, attrParentCatalogId, attributeId)

    // Extract instanceId and roleId from admin routes for dynamic name loading
    const instanceIdMatch = location.pathname.match(/^\/admin\/instance\/([^/]+)/)
    const instanceId = instanceIdMatch ? instanceIdMatch[1] : null
    const instanceName = useInstanceName(instanceId)

    const roleIdMatch = location.pathname.match(/^\/admin\/instance\/[^/]+\/roles\/([^/]+)/)
    const roleId = roleIdMatch ? roleIdMatch[1] : null
    const roleName = useRoleName(roleId)

    // Check admin panel access for admin routes
    const { canAccessAdminPanel, loading: adminAccessLoading } = useHasGlobalAccess()

    // Clean keys without 'menu.' prefix since we're already using 'menu' namespace
    const menuMap: Record<string, string> = {
        applications: 'applications',
        metapanel: 'metapanel',
        metahubs: 'metahubs',
        profile: 'profile',
        docs: 'docs',
        admin: 'administration'
    }

    const segments = location.pathname.split('/').filter(Boolean)

    const crumbs = (() => {
        if (segments.length === 0) {
            return [{ label: t('metapanel'), to: '/' }]
        }

        const primary = segments[0]

        if (primary === 'metahubs') {
            return [{ label: t(menuMap.metahubs), to: '/metahubs' }]
        }

        if (primary === 'metahub') {
            const items = [{ label: t(menuMap.metahubs), to: '/metahubs' }]

            if (segments[1]) {
                items.push({
                    label: metahubName ? truncateMetahubName(metahubName) : '...',
                    to: `/metahub/${segments[1]}`
                })

                // Sub-pages: hubs, catalogs, access, members
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'catalogs') {
                    items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/catalogs` })

                    if (segments[3]) {
                        items.push({
                            label: standaloneCatalogName ? truncateCatalogName(standaloneCatalogName) : '...',
                            to: `/metahub/${segments[1]}/catalog/${segments[3]}/attributes`
                        })

                        if (segments[4] === 'attributes') {
                            items.push({ label: t('attributes'), to: location.pathname })
                        } else if (segments[4] === 'elements') {
                            items.push({ label: t('elements'), to: location.pathname })
                        }
                    }
                } else if (segments[2] === 'catalog') {
                    items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/catalogs` })

                    if (segments[3]) {
                        items.push({
                            label: standaloneCatalogName ? truncateCatalogName(standaloneCatalogName) : '...',
                            to: `/metahub/${segments[1]}/catalog/${segments[3]}/attributes`
                        })

                        if (segments[4] === 'attributes') {
                            items.push({ label: t('attributes'), to: location.pathname })
                        } else if (segments[4] === 'elements') {
                            items.push({ label: t('elements'), to: location.pathname })
                        } else if (segments[4] === 'layout' && segments[5]) {
                            items.push({
                                label: layoutName ? truncateLayoutName(layoutName) : '...',
                                to: location.pathname
                            })
                        }
                    }
                } else if (segments[2] === 'sets') {
                    items.push({ label: t('sets'), to: `/metahub/${segments[1]}/sets` })
                } else if (segments[2] === 'set') {
                    items.push({ label: t('sets'), to: `/metahub/${segments[1]}/sets` })

                    if (segments[3]) {
                        items.push({
                            label: setName ? truncateSetName(setName) : '...',
                            to: `/metahub/${segments[1]}/set/${segments[3]}/constants`
                        })
                    }

                    if (segments[4] === 'constants' && segments[3]) {
                        items.push({
                            label: t('constants'),
                            to: `/metahub/${segments[1]}/set/${segments[3]}/constants`
                        })
                    }
                } else if (segments[2] === 'enumerations') {
                    items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/enumerations` })
                } else if (segments[2] === 'enumeration') {
                    items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/enumerations` })
                    if (segments[3]) {
                        items.push({
                            label: enumerationName ? truncateEnumerationName(enumerationName) : '...',
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
                    items.push({ label: t('hubs'), to: `/metahub/${segments[1]}/hubs` })
                } else if (segments[2] === 'branches') {
                    items.push({ label: t('branches'), to: `/metahub/${segments[1]}/branches` })
                } else if (segments[2] === 'settings') {
                    items.push({ label: t('settings'), to: `/metahub/${segments[1]}/settings` })
                } else if (segments[2] === 'common' || segments[2] === 'general') {
                    items.push({ label: t('commonSection'), to: `/metahub/${segments[1]}/common` })

                    if (segments[3] === 'layouts') {
                        items.push({ label: t('layouts'), to: `/metahub/${segments[1]}/common` })

                        if (segments[4]) {
                            items.push({ label: layoutName ? truncateLayoutName(layoutName) : '...', to: location.pathname })
                        }
                    }
                } else if (segments[2] === 'layouts') {
                    items.push({ label: t('commonSection'), to: `/metahub/${segments[1]}/common` })
                    items.push({ label: t('layouts'), to: `/metahub/${segments[1]}/common` })

                    if (segments[3]) {
                        items.push({ label: layoutName ? truncateLayoutName(layoutName) : '...', to: location.pathname })
                    }
                } else if (segments[2] === 'publications') {
                    items.push({ label: t('publications'), to: `/metahub/${segments[1]}/publications` })
                } else if (segments[2] === 'publication') {
                    items.push({ label: t('publications'), to: `/metahub/${segments[1]}/publications` })

                    if (segments[3] && metahubPublicationName) {
                        items.push({
                            label: truncatePublicationName(metahubPublicationName),
                            to: `/metahub/${segments[1]}/publication/${segments[3]}/versions`
                        })
                    } else if (segments[3]) {
                        items.push({ label: '...', to: `/metahub/${segments[1]}/publication/${segments[3]}/versions` })
                    }

                    if (segments[4] === 'versions' && segments[3]) {
                        items.push({
                            label: t('versions'),
                            to: `/metahub/${segments[1]}/publication/${segments[3]}/versions`
                        })
                    } else if (segments[4] === 'applications' && segments[3]) {
                        items.push({
                            label: t('applications'),
                            to: `/metahub/${segments[1]}/publication/${segments[3]}/applications`
                        })
                    }
                } else if (segments[2] === 'hub') {
                    items.push({ label: t('hubs'), to: `/metahub/${segments[1]}/hubs` })

                    if (segments[3]) {
                        const hubLabel = hubName ? truncateHubName(hubName) : '...'

                        if (segments[4] === 'catalogs') {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })

                            items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs` })

                            if (segments[5]) {
                                items.push({
                                    label: catalogName ? truncateCatalogName(catalogName) : '...',
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/catalog/${segments[5]}/attributes`
                                })

                                if (segments[6] === 'attributes') {
                                    items.push({ label: t('attributes'), to: location.pathname })

                                    if (segments[7]) {
                                        items.push({
                                            label: attributeName ? truncateAttributeName(attributeName) : '...',
                                            to: location.pathname
                                        })
                                    }
                                } else if (segments[6] === 'elements') {
                                    items.push({ label: t('elements'), to: location.pathname })
                                }
                            }
                        } else if (segments[4] === 'enumerations') {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })
                            items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/hub/${segments[3]}/enumerations` })
                        } else if (segments[4] === 'sets') {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })
                            items.push({ label: t('sets'), to: `/metahub/${segments[1]}/hub/${segments[3]}/sets` })
                        } else if (segments[4] === 'hubs') {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })
                            items.push({ label: t('hubs'), to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs` })
                        } else if (segments[4] === 'set') {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })
                            items.push({ label: t('sets'), to: `/metahub/${segments[1]}/hub/${segments[3]}/sets` })

                            if (segments[5]) {
                                items.push({
                                    label: setName ? truncateSetName(setName) : '...',
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/set/${segments[5]}/constants`
                                })
                            }

                            if (segments[6] === 'constants' && segments[5]) {
                                items.push({
                                    label: t('constants'),
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/set/${segments[5]}/constants`
                                })
                            }
                        } else if (segments[4] === 'enumeration') {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })
                            items.push({ label: t('enumerations'), to: `/metahub/${segments[1]}/hub/${segments[3]}/enumerations` })

                            if (segments[5]) {
                                items.push({
                                    label: enumerationName ? truncateEnumerationName(enumerationName) : '...',
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
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })

                            items.push({ label: t('catalogs'), to: `/metahub/${segments[1]}/hub/${segments[3]}/catalogs` })

                            if (segments[5]) {
                                items.push({
                                    label: catalogName ? truncateCatalogName(catalogName) : '...',
                                    to: `/metahub/${segments[1]}/hub/${segments[3]}/catalog/${segments[5]}/attributes`
                                })

                                if (segments[6] === 'attributes') {
                                    items.push({ label: t('attributes'), to: location.pathname })

                                    if (segments[7]) {
                                        items.push({
                                            label: attributeName ? truncateAttributeName(attributeName) : '...',
                                            to: location.pathname
                                        })
                                    }
                                } else if (segments[6] === 'elements') {
                                    items.push({ label: t('elements'), to: location.pathname })
                                }
                            }
                        } else {
                            items.push({
                                label: hubLabel,
                                to: `/metahub/${segments[1]}/hub/${segments[3]}/hubs`
                            })

                            if (segments[4] === 'attributes') {
                                items.push({ label: t('attributes'), to: location.pathname })
                            } else if (segments[4] === 'elements') {
                                items.push({ label: t('elements'), to: location.pathname })
                            }
                        }
                    }
                } else if (segments[2] === 'migrations') {
                    items.push({ label: t('migrations'), to: `/metahub/${segments[1]}/migrations` })
                }
            }

            return items
        }

        // Standalone Applications module
        if (primary === 'applications') {
            return [{ label: t('applications'), to: '/applications' }]
        }

        if (primary === 'a') {
            const items = [{ label: t('applications'), to: '/applications' }]

            const currentApplicationId = segments[1]
            const adminSection = segments[2]

            if (currentApplicationId && adminSection === 'admin') {
                items.push({
                    label: applicationName ? truncateApplicationName(applicationName) : '...',
                    to: `/a/${currentApplicationId}/admin`
                })

                if (segments[3] === 'connectors') {
                    items.push({ label: t('connectors'), to: location.pathname })
                } else if (segments[3] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[3] === 'migrations') {
                    items.push({ label: t('migrations'), to: location.pathname })
                } else if (segments[3] === 'settings') {
                    items.push({ label: t('settings'), to: location.pathname })
                } else if (segments[3] === 'connector' && segments[4]) {
                    items.push({ label: t('connectors'), to: `/a/${currentApplicationId}/admin/connectors` })
                    if (connectorName) {
                        items.push({
                            label: truncateConnectorName(connectorName),
                            to: location.pathname
                        })
                    } else {
                        items.push({ label: '...', to: location.pathname })
                    }
                }
            } else if (currentApplicationId) {
                items.push({
                    label: '...',
                    to: `/a/${currentApplicationId}/admin`
                })
            }

            return items
        }

        // Admin routes handling
        if (primary === 'admin') {
            if (adminAccessLoading || !canAccessAdminPanel) {
                return []
            }

            const items = [{ label: t('administration'), to: '/admin' }]

            // Instance context routes
            if (segments[1] === 'instance' && segments[2]) {
                const instanceIdFromUrl = segments[2]
                const instanceLabel = instanceName ? truncateInstanceName(instanceName) : t('instance')
                items.push({ label: instanceLabel, to: `/admin/instance/${instanceIdFromUrl}` })

                if (segments[3] === 'board') {
                    items.push({ label: t('board'), to: `/admin/instance/${instanceIdFromUrl}/board` })
                } else if (segments[3] === 'users') {
                    items.push({ label: t('users'), to: `/admin/instance/${instanceIdFromUrl}/users` })
                } else if (segments[3] === 'roles') {
                    items.push({ label: t('roles'), to: `/admin/instance/${instanceIdFromUrl}/roles` })
                    if (segments[4] && segments[4] !== 'new') {
                        const roleLabel = roleName ? truncateRoleName(roleName) : t('role')
                        items.push({ label: roleLabel, to: `/admin/instance/${instanceIdFromUrl}/roles/${segments[4]}` })
                        if (segments[5] === 'users') {
                            items.push({ label: t('users'), to: location.pathname })
                        }
                    }
                } else if (segments[3] === 'locales') {
                    items.push({ label: t('locales'), to: `/admin/instance/${instanceIdFromUrl}/locales` })
                } else if (segments[3] === 'settings') {
                    items.push({ label: t('settings'), to: `/admin/instance/${instanceIdFromUrl}/settings` })
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
