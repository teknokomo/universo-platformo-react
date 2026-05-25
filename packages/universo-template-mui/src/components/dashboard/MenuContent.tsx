import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import { useQuery } from '@tanstack/react-query'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, type AuthClient } from '@universo/auth-frontend'
import i18n from '@universo/i18n'
import { isBuiltinEntityKind, type MetahubMenuEntityType } from '@universo/types'
import { getVLCString } from '@universo/utils'
import { useHasGlobalAccess } from '@universo/store'
import { resolveShellAccess } from '../../navigation/roleAccess'
import {
    rootMenuItems,
    getMetahubsMenuItem,
    getAdminMenuItems,
    getMetahubMenuItems,
    getApplicationMenuItems,
    getInstanceMenuItems,
    resolveTemplateMenuLabel
} from '../../navigation/menuConfigs'

type ApplicationShellDetail = Record<string, unknown> & {
    name?: unknown
    slug?: string | null
    schemaName?: string | null
}

type MetahubShellDetail = Record<string, unknown> & {
    permissions?: {
        manageMetahub?: boolean
        manageMembers?: boolean
    }
}

type MenuEntityTypeSummary = {
    kindKey: string
    published?: boolean
    codename?: unknown
    presentation?: {
        name?: unknown
    }
    ui?: {
        iconName?: string | null
        nameKey?: string | null
        sidebarSection?: 'objects' | 'admin'
        sidebarOrder?: number | null
    }
}

type MenuEntityTypesResponse = {
    items?: MenuEntityTypeSummary[]
}

const resolveEntityTypeMenuTitle = (item: MenuEntityTypeSummary, t: (key: string, options?: Record<string, unknown>) => string): string => {
    const uiNameKey = item.ui?.nameKey?.trim() || ''
    const translatedUiName =
        uiNameKey.length > 0 && isBuiltinEntityKind(item.kindKey) ? t(uiNameKey, { defaultValue: uiNameKey }).trim() : uiNameKey

    return (
        resolveLocalizedText(item.presentation?.name) ||
        (translatedUiName.length > 0 ? translatedUiName : null) ||
        resolveLocalizedText(item.codename) ||
        item.kindKey
    )
}

const resolveLocalizedText = (value: unknown): string | null => {
    const locale = (i18n.resolvedLanguage || i18n.language || 'en').split(/[-_]/)[0].toLowerCase()
    const localized = getVLCString(value as Parameters<typeof getVLCString>[0], locale).trim()
    return localized.length > 0 ? localized : null
}

async function loadMenuResource<T>(client: AuthClient, path: string): Promise<T> {
    const response = await client.get<T>(path)
    return response.data
}

export default function MenuContent() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()
    const { client, loading: authLoading } = useAuth()

    const { isSuperuser, canAccessAdminPanel, globalRoles, ability } = useHasGlobalAccess() as ReturnType<typeof useHasGlobalAccess> & {
        ability?: { can(action: string, subject: string): boolean } | null
    }
    const shellAccess = resolveShellAccess({
        globalRoles,
        isSuperuser,
        ability
    })

    // Check if we're in a metahub context (/metahub/:id)
    const metahubMatch = location.pathname.match(/^\/metahub\/([^/]+)/)
    const metahubId = metahubMatch ? metahubMatch[1] : null

    const metahubDetailQuery = useQuery<MetahubShellDetail>({
        queryKey: metahubId ? ['metahubs', 'detail', metahubId] : ['metahubs', 'detail', 'missing-id'],
        queryFn: () => loadMenuResource(client, `/metahub/${metahubId}`),
        enabled: Boolean(metahubId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnMount: false,
        refetchOnWindowFocus: false
    })

    const canManageMetahub = metahubDetailQuery.data?.permissions?.manageMetahub === true
    const canManageMembers = metahubDetailQuery.data?.permissions?.manageMembers === true

    const metahubEntityTypesQuery = useQuery<MenuEntityTypesResponse>({
        queryKey: metahubId
            ? ['metahubs', 'detail', metahubId, 'entityTypes', 'menu']
            : ['metahubs', 'detail', 'missing-id', 'entityTypes', 'menu'],
        queryFn: () => loadMenuResource(client, `/metahub/${metahubId}/entity-types?limit=1000&offset=0`),
        enabled: Boolean(metahubId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnMount: false,
        refetchOnWindowFocus: false
    })

    const menuEntityTypes: MetahubMenuEntityType[] = (metahubEntityTypesQuery.data?.items ?? [])
        .filter((item) => item.published === true)
        .map((item) => ({
            kindKey: item.kindKey,
            title: resolveEntityTypeMenuTitle(item, t),
            iconName: item.ui?.iconName ?? 'IconBox',
            sidebarSection: item.ui?.sidebarSection ?? 'objects',
            sidebarOrder: typeof item.ui?.sidebarOrder === 'number' ? item.ui.sidebarOrder : undefined
        }))

    // Check if we're in an application admin context (/a/:id/admin...)
    const applicationAdminMatch = location.pathname.match(/^\/a\/([^/]+)\/admin(?:\/|$)/)
    const applicationId = applicationAdminMatch ? applicationAdminMatch[1] : null

    const applicationDetailQuery = useQuery<ApplicationShellDetail>({
        queryKey: applicationId ? ['applications', 'detail', applicationId] : ['applications', 'detail', 'missing-id'],
        queryFn: () => loadMenuResource(client, `/applications/${applicationId}`),
        enabled: Boolean(applicationId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: 2,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    // Check if we're in an instance context (/admin/instance/:id)
    const instanceMatch = location.pathname.match(/^\/admin\/instance\/([^/]+)/)
    const instanceId = instanceMatch ? instanceMatch[1] : null

    const shouldHideApplicationSettingsItem =
        Boolean(applicationId) && applicationDetailQuery.isSuccess && !applicationDetailQuery.data?.schemaName

    // Use context-specific menu or root menu
    const menuItems = applicationId
        ? getApplicationMenuItems(applicationId).filter((item) =>
              item.id === 'application-settings' ? !shouldHideApplicationSettingsItem : true
          )
        : metahubId
        ? getMetahubMenuItems(metahubId, {
              canManageMetahub,
              canManageMembers,
              menuEntityTypes
          })
        : instanceId
        ? getInstanceMenuItems(instanceId)
        : rootMenuItems.filter((item) => shellAccess.visibility.rootMenuIds.includes(item.id))

    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {menuItems.map((item) => {
                    if (item.type === 'divider') {
                        return <Divider key={item.id} sx={{ my: 1 }} />
                    }
                    const Icon = item.icon
                    const isApplicationSettingsItem = item.id === 'application-settings' && Boolean(applicationId)
                    const isApplicationSettingsDisabled =
                        isApplicationSettingsItem && !applicationDetailQuery.isSuccess && !applicationDetailQuery.data?.schemaName
                    const buttonProps = isApplicationSettingsDisabled
                        ? { component: 'div' as const }
                        : item.external
                        ? { component: 'a', href: item.url, target: item.target ?? '_blank', rel: 'noopener noreferrer' }
                        : { component: NavLink, to: item.url }

                    // Smart match logic: applications highlights on /applications/* and /a/*/admin/*
                    const isSelected =
                        !item.external &&
                        (location.pathname === item.url ||
                            (item.id === 'applications' &&
                                (location.pathname.startsWith('/applications') || /^\/a\/[^/]+\/admin(?:\/|$)/.test(location.pathname))))

                    return (
                        <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton selected={isSelected} disabled={isApplicationSettingsDisabled} {...buttonProps}>
                                <ListItemIcon>{<Icon size={20} stroke={1.5} />}</ListItemIcon>
                                <ListItemText primary={resolveTemplateMenuLabel(item, t)} />
                            </ListItemButton>
                        </ListItem>
                    )
                })}

                {/* Applications, Metahubs, Admin sections — only in root context */}
                {!instanceId && !applicationId && !metahubId && (shellAccess.visibility.showMetahubsSection || canAccessAdminPanel) && (
                    <>
                        <Divider sx={{ my: 1 }} />
                        {shellAccess.visibility.showMetahubsSection &&
                            getMetahubsMenuItem().map((item) => {
                                if (item.type === 'divider') return null
                                const Icon = item.icon
                                const isSelected =
                                    location.pathname === item.url ||
                                    location.pathname.startsWith('/metahubs') ||
                                    location.pathname.startsWith('/metahub/')
                                return (
                                    <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                                        <ListItemButton component={NavLink} to={item.url} selected={isSelected}>
                                            <ListItemIcon>
                                                <Icon size={20} stroke={1.5} />
                                            </ListItemIcon>
                                            <ListItemText primary={resolveTemplateMenuLabel(item, t)} />
                                        </ListItemButton>
                                    </ListItem>
                                )
                            })}
                        {canAccessAdminPanel &&
                            getAdminMenuItems().map((item) => {
                                if (item.type === 'divider') return null
                                const Icon = item.icon
                                const isSelected = location.pathname === item.url || location.pathname.startsWith('/admin')
                                return (
                                    <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                                        <ListItemButton component={NavLink} to={item.url} selected={isSelected}>
                                            <ListItemIcon>
                                                <Icon size={20} stroke={1.5} />
                                            </ListItemIcon>
                                            <ListItemText primary={resolveTemplateMenuLabel(item, t)} />
                                        </ListItemButton>
                                    </ListItem>
                                )
                            })}
                    </>
                )}
            </List>
        </Stack>
    )
}
