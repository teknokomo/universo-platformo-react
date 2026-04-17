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
import { isBuiltinEntityKind, type BuiltinEntityKind } from '@universo/types'
import { getVLCString } from '@universo/utils'
import { useHasGlobalAccess } from '@universo/store'
import {
    truncateMetahubName,
    truncateApplicationName,
    useMetahubPublicationName,
    useTreeEntityName,
    useLinkedCollectionName,
    useLinkedCollectionNameStandalone,
    useValueGroupNameStandalone,
    truncateLinkedCollectionName,
    truncateValueGroupName,
    useOptionListName,
    truncateOptionListName,
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

type BreadcrumbEntityTypeRecord = Record<string, unknown> & {
    kindKey?: string | null
    codename?: unknown
    config?: unknown
    presentation?: { name?: unknown } | null
    ui?: { nameKey?: string | null } | null
}

type BreadcrumbEntityTypesResponse = {
    items?: BreadcrumbEntityTypeRecord[] | null
}

type BreadcrumbEntityDetail = Record<string, unknown> & {
    name?: unknown
    codename?: unknown
}

const LEGACY_COMPATIBLE_ENTITY_LABEL_KEYS: Record<BuiltinEntityKind, string> = {
    catalog: 'catalogs',
    hub: 'hubs',
    set: 'sets',
    enumeration: 'enumerations'
}

const truncateEntityBreadcrumbLabel = (value: string): string => (value.length > 36 ? `${value.slice(0, 33)}...` : value)

const buildEntityInstancesPath = (metahubId: string, kindSegment: string): string =>
    `/metahub/${metahubId}/entities/${kindSegment}/instances`
const ENTITY_METADATA_TAB_SEGMENTS: Record<'attributes' | 'system' | 'elements', string> = {
    attributes: 'field-definitions',
    system: 'system',
    elements: 'records'
}

const buildEntityInstanceDefaultPath = (
    metahubId: string,
    kindSegment: string,
    entityId: string,
    legacyCompatibleKind: BuiltinEntityKind | null
): string => {
    if (legacyCompatibleKind === 'hub') {
        return `/metahub/${metahubId}/entities/${kindSegment}/instance/${entityId}/hubs`
    }

    if (legacyCompatibleKind === 'set') {
        return `/metahub/${metahubId}/entities/${kindSegment}/instance/${entityId}/fixed-values`
    }

    if (legacyCompatibleKind === 'enumeration') {
        return `/metahub/${metahubId}/entities/${kindSegment}/instance/${entityId}/values`
    }

    return `/metahub/${metahubId}/entities/${kindSegment}/instance/${entityId}/field-definitions`
}

const buildEntityTreeEntityScopePath = (
    metahubId: string,
    kindSegment: string,
    treeEntityId: string,
    tab: 'hubs' | 'catalogs' | 'sets' | 'enumerations'
) => `/metahub/${metahubId}/entities/${kindSegment}/instance/${treeEntityId}/${tab}`

const buildEntityTreeEntityLinkedCollectionPath = (
    metahubId: string,
    kindSegment: string,
    treeEntityId: string,
    linkedCollectionId: string,
    tab: 'attributes' | 'system' | 'elements'
) =>
    `/metahub/${metahubId}/entities/${kindSegment}/instance/${treeEntityId}/catalog/${linkedCollectionId}/${ENTITY_METADATA_TAB_SEGMENTS[tab]}`

const buildEntityTreeEntityValueGroupPath = (metahubId: string, kindSegment: string, treeEntityId: string, valueGroupId: string) =>
    `/metahub/${metahubId}/entities/${kindSegment}/instance/${treeEntityId}/set/${valueGroupId}/fixed-values`

const buildEntityTreeEntityOptionListPath = (metahubId: string, kindSegment: string, treeEntityId: string, optionListId: string) =>
    `/metahub/${metahubId}/entities/${kindSegment}/instance/${treeEntityId}/enumeration/${optionListId}/values`

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
    // Patterns: /metahub/:metahubId/resources/layouts/:layoutId,
    // /metahub/:metahubId/entities/:kindKey/instance/:entityId/layout/:layoutId
    const layoutDetailMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/resources\/layouts\/([^/]+)/)
    const entityLayoutDetailMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/entities\/[^/]+\/instance\/[^/]+\/layout\/([^/]+)/)
    const layoutParentMetahubId = layoutDetailMatch ? layoutDetailMatch[1] : entityLayoutDetailMatch ? entityLayoutDetailMatch[1] : null
    const layoutId = layoutDetailMatch ? layoutDetailMatch[2] : entityLayoutDetailMatch ? entityLayoutDetailMatch[2] : null
    const layoutName = useLayoutName(layoutParentMetahubId, layoutId)

    const entityRouteMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/entities\/([^/]+)(?:\/|$)/)
    const entityRouteMetahubId = entityRouteMatch ? entityRouteMatch[1] : null
    const entityRouteKindSegment = entityRouteMatch ? entityRouteMatch[2] : null
    const entityRouteKindKey = entityRouteKindSegment ? decodeURIComponent(entityRouteKindSegment) : null
    const entityRouteDetailMatch = location.pathname.match(/^\/metahubs?\/([^/]+)\/entities\/[^/]+\/instance\/([^/]+)(?:\/|$)/)
    const entityRouteEntityId = entityRouteDetailMatch ? entityRouteDetailMatch[2] : null
    const entityRouteTreeEntityLinkedCollectionMatch = location.pathname.match(
        /^\/metahubs?\/([^/]+)\/entities\/[^/]+\/instance\/([^/]+)\/catalog\/([^/]+)(?:\/|$)/
    )
    const entityRouteTreeEntityValueGroupMatch = location.pathname.match(
        /^\/metahubs?\/([^/]+)\/entities\/[^/]+\/instance\/([^/]+)\/set\/([^/]+)(?:\/|$)/
    )
    const entityRouteTreeEntityOptionListMatch = location.pathname.match(
        /^\/metahubs?\/([^/]+)\/entities\/[^/]+\/instance\/([^/]+)\/enumeration\/([^/]+)(?:\/|$)/
    )
    const entityTypeRouteQuery = useQuery<BreadcrumbEntityTypesResponse>({
        queryKey:
            entityRouteMetahubId && entityRouteKindKey
                ? ['entity-types', 'breadcrumbs', entityRouteMetahubId, entityRouteKindKey]
                : ['entity-types', 'breadcrumbs', 'missing-route'],
        queryFn: async () => {
            const response = await client.get<BreadcrumbEntityTypesResponse>(`/metahub/${entityRouteMetahubId}/entity-types`, {
                params: {
                    limit: 1000,
                    offset: 0,
                    search: entityRouteKindKey
                }
            })
            return response.data
        },
        enabled: Boolean(entityRouteMetahubId && entityRouteKindKey) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 2,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })
    const matchedEntityType = (entityTypeRouteQuery.data?.items ?? []).find((item) => item.kindKey === entityRouteKindKey) ?? null
    const resolvedEntityRouteKind = matchedEntityType?.kindKey ?? entityRouteKindKey ?? ''
    const entityRouteLegacyCompatibleKind = isBuiltinEntityKind(resolvedEntityRouteKind) ? resolvedEntityRouteKind : null
    const entityRouteLinkedCollectionName = useLinkedCollectionNameStandalone(
        entityRouteMetahubId,
        entityRouteLegacyCompatibleKind === 'catalog' ? entityRouteEntityId : null
    )
    const entityRouteTreeEntityName = useTreeEntityName(
        entityRouteMetahubId,
        entityRouteLegacyCompatibleKind === 'hub'
            ? entityRouteEntityId
            : entityRouteTreeEntityLinkedCollectionMatch
            ? entityRouteTreeEntityLinkedCollectionMatch[2]
            : entityRouteTreeEntityValueGroupMatch
            ? entityRouteTreeEntityValueGroupMatch[2]
            : entityRouteTreeEntityOptionListMatch
            ? entityRouteTreeEntityOptionListMatch[2]
            : null
    )
    const entityRouteTreeEntityLinkedCollectionName = useLinkedCollectionName(
        entityRouteMetahubId,
        entityRouteTreeEntityLinkedCollectionMatch ? entityRouteTreeEntityLinkedCollectionMatch[2] : null,
        entityRouteTreeEntityLinkedCollectionMatch ? entityRouteTreeEntityLinkedCollectionMatch[3] : null
    )
    const entityRouteValueGroupName = useValueGroupNameStandalone(
        entityRouteMetahubId,
        entityRouteLegacyCompatibleKind === 'set'
            ? entityRouteEntityId
            : entityRouteTreeEntityValueGroupMatch
            ? entityRouteTreeEntityValueGroupMatch[3]
            : null
    )
    const entityRouteOptionListName = useOptionListName(
        entityRouteMetahubId,
        entityRouteLegacyCompatibleKind === 'enumeration'
            ? entityRouteEntityId
            : entityRouteTreeEntityOptionListMatch
            ? entityRouteTreeEntityOptionListMatch[3]
            : null
    )
    const entityTypeBreadcrumbLabel = (() => {
        if (entityRouteLegacyCompatibleKind) {
            return t(LEGACY_COMPATIBLE_ENTITY_LABEL_KEYS[entityRouteLegacyCompatibleKind])
        }

        if (!matchedEntityType) {
            return entityRouteKindKey ? truncateEntityBreadcrumbLabel(entityRouteKindKey) : null
        }

        const uiNameKey = typeof matchedEntityType.ui?.nameKey === 'string' ? matchedEntityType.ui.nameKey.trim() : ''
        const translatedUiLabel =
            uiNameKey.length > 0 && isBuiltinEntityKind(matchedEntityType.kindKey ?? entityRouteKindKey ?? '')
                ? t(uiNameKey, { defaultValue: uiNameKey })
                : uiNameKey
        const resolvedLabel =
            extractLocalizedString(matchedEntityType.presentation?.name) ||
            (translatedUiLabel && translatedUiLabel.trim().length > 0 ? translatedUiLabel.trim() : null) ||
            extractLocalizedString(matchedEntityType.codename) ||
            matchedEntityType.kindKey ||
            entityRouteKindKey

        return resolvedLabel ? truncateEntityBreadcrumbLabel(resolvedLabel) : null
    })()
    const entityRouteDetailQuery = useQuery<BreadcrumbEntityDetail>({
        queryKey:
            entityRouteMetahubId && entityRouteEntityId && !entityRouteLegacyCompatibleKind
                ? ['entities', 'breadcrumbs', entityRouteMetahubId, entityRouteEntityId]
                : ['entities', 'breadcrumbs', 'missing-detail'],
        queryFn: async () => {
            const response = await client.get<BreadcrumbEntityDetail>(`/metahub/${entityRouteMetahubId}/entity/${entityRouteEntityId}`)
            return response.data
        },
        enabled: Boolean(entityRouteMetahubId && entityRouteEntityId && !entityRouteLegacyCompatibleKind) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 2,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })
    const entityInstanceBreadcrumbLabel = (() => {
        const resolvedLabel =
            (entityRouteLegacyCompatibleKind === 'catalog'
                ? entityRouteLinkedCollectionName
                : entityRouteLegacyCompatibleKind === 'hub'
                ? entityRouteTreeEntityName
                : entityRouteLegacyCompatibleKind === 'set'
                ? entityRouteValueGroupName
                : entityRouteLegacyCompatibleKind === 'enumeration'
                ? entityRouteOptionListName
                : null) ||
            extractLocalizedString(entityRouteDetailQuery.data?.name) ||
            extractLocalizedString(entityRouteDetailQuery.data?.codename)
        return resolvedLabel ? truncateEntityBreadcrumbLabel(resolvedLabel) : null
    })()

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

                // Sub-pages: tree-entities, linked-collections, access, members
                if (segments[2] === 'access') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'members') {
                    items.push({ label: t('access'), to: location.pathname })
                } else if (segments[2] === 'entities') {
                    items.push({ label: t('entities'), to: `/metahub/${segments[1]}/entities` })

                    if (segments[3] && (segments[4] === 'instances' || segments[4] === 'instance')) {
                        const entityInstancesPath = buildEntityInstancesPath(segments[1], segments[3])
                        items.push({
                            label: entityTypeBreadcrumbLabel ?? truncateEntityBreadcrumbLabel(decodeURIComponent(segments[3])),
                            to: entityInstancesPath
                        })

                        if (segments[4] === 'instance' && segments[5]) {
                            const defaultEntityInstancePath = buildEntityInstanceDefaultPath(
                                segments[1],
                                segments[3],
                                segments[5],
                                entityRouteLegacyCompatibleKind
                            )
                            items.push({
                                label: entityInstanceBreadcrumbLabel ?? '...',
                                to: defaultEntityInstancePath
                            })

                            if (entityRouteLegacyCompatibleKind === 'hub') {
                                if (
                                    segments[6] === 'hubs' ||
                                    segments[6] === 'catalogs' ||
                                    segments[6] === 'sets' ||
                                    segments[6] === 'enumerations'
                                ) {
                                    items.push({
                                        label: t(segments[6]),
                                        to: buildEntityTreeEntityScopePath(segments[1], segments[3], segments[5], segments[6])
                                    })
                                } else if (segments[6] === 'catalog' && segments[7]) {
                                    items.push({
                                        label: t('catalogs'),
                                        to: buildEntityTreeEntityScopePath(segments[1], segments[3], segments[5], 'catalogs')
                                    })
                                    items.push({
                                        label: entityRouteTreeEntityLinkedCollectionName
                                            ? truncateLinkedCollectionName(entityRouteTreeEntityLinkedCollectionName)
                                            : '...',
                                        to: buildEntityTreeEntityLinkedCollectionPath(
                                            segments[1],
                                            segments[3],
                                            segments[5],
                                            segments[7],
                                            'attributes'
                                        )
                                    })

                                    if (segments[8] === 'attributes') {
                                        items.push({ label: t('attributes'), to: location.pathname })
                                    } else if (segments[8] === 'system') {
                                        items.push({
                                            label: i18n.t('metahubs:attributes.system.title', { defaultValue: 'System Attributes' }),
                                            to: location.pathname
                                        })
                                    } else if (segments[8] === 'elements') {
                                        items.push({ label: t('elements'), to: location.pathname })
                                    }
                                } else if (segments[6] === 'set' && segments[7]) {
                                    items.push({
                                        label: t('sets'),
                                        to: buildEntityTreeEntityScopePath(segments[1], segments[3], segments[5], 'sets')
                                    })
                                    items.push({
                                        label: entityRouteValueGroupName ? truncateValueGroupName(entityRouteValueGroupName) : '...',
                                        to: buildEntityTreeEntityValueGroupPath(segments[1], segments[3], segments[5], segments[7])
                                    })

                                    if (segments[8] === 'fixed-values') {
                                        items.push({
                                            label: t('fixedValues'),
                                            to: buildEntityTreeEntityValueGroupPath(segments[1], segments[3], segments[5], segments[7])
                                        })
                                    }
                                } else if (segments[6] === 'enumeration' && segments[7]) {
                                    items.push({
                                        label: t('enumerations'),
                                        to: buildEntityTreeEntityScopePath(segments[1], segments[3], segments[5], 'enumerations')
                                    })
                                    items.push({
                                        label: entityRouteOptionListName ? truncateOptionListName(entityRouteOptionListName) : '...',
                                        to: buildEntityTreeEntityOptionListPath(segments[1], segments[3], segments[5], segments[7])
                                    })

                                    if (segments[8] === 'values') {
                                        items.push({
                                            label: t('values'),
                                            to: buildEntityTreeEntityOptionListPath(segments[1], segments[3], segments[5], segments[7])
                                        })
                                    }
                                }
                            } else if (entityRouteLegacyCompatibleKind === 'set') {
                                if (segments[6] === 'fixed-values') {
                                    items.push({ label: t('fixedValues'), to: defaultEntityInstancePath })
                                }
                            } else if (entityRouteLegacyCompatibleKind === 'enumeration') {
                                if (segments[6] === 'values') {
                                    items.push({ label: t('values'), to: defaultEntityInstancePath })
                                }
                            } else if (segments[6] === 'attributes') {
                                items.push({ label: t('attributes'), to: location.pathname })
                            } else if (segments[6] === 'system') {
                                items.push({
                                    label: i18n.t('metahubs:attributes.system.title', { defaultValue: 'System Attributes' }),
                                    to: location.pathname
                                })
                            } else if (segments[6] === 'elements') {
                                items.push({ label: t('elements'), to: location.pathname })
                            } else if (segments[6] === 'layout' && segments[7]) {
                                items.push({
                                    label: layoutName ? truncateLayoutName(layoutName) : t('layouts'),
                                    to: location.pathname
                                })
                            }
                        }
                    }
                } else if (segments[2] === 'branches') {
                    items.push({ label: t('branches'), to: `/metahub/${segments[1]}/branches` })
                } else if (segments[2] === 'settings') {
                    items.push({ label: t('settings'), to: `/metahub/${segments[1]}/settings` })
                } else if (segments[2] === 'resources') {
                    items.push({ label: t('commonSection'), to: `/metahub/${segments[1]}/resources` })

                    if (segments[3] === 'layouts') {
                        items.push({ label: t('layouts'), to: `/metahub/${segments[1]}/resources` })

                        if (segments[4]) {
                            items.push({ label: layoutName ? truncateLayoutName(layoutName) : '...', to: location.pathname })
                        }
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
