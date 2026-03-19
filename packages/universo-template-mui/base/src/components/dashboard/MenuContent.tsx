import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useHasGlobalAccess } from '@universo/store'
import { resolveShellAccess } from '../../navigation/roleAccess'
import {
    rootMenuItems,
    getMetahubsMenuItem,
    getAdminMenuItems,
    getMetahubMenuItems,
    getApplicationMenuItems,
    getInstanceMenuItems
} from '../../navigation/menuConfigs'

export default function MenuContent() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()

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

    // Check if we're in an application admin context (/a/:id/admin...)
    const applicationAdminMatch = location.pathname.match(/^\/a\/([^/]+)\/admin(?:\/|$)/)
    const applicationId = applicationAdminMatch ? applicationAdminMatch[1] : null

    // Check if we're in an instance context (/admin/instance/:id)
    const instanceMatch = location.pathname.match(/^\/admin\/instance\/([^/]+)/)
    const instanceId = instanceMatch ? instanceMatch[1] : null

    // Use context-specific menu or root menu
    const menuItems = applicationId
        ? getApplicationMenuItems(applicationId)
        : metahubId
        ? getMetahubMenuItems(metahubId)
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
                    const buttonProps = item.external
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
                            <ListItemButton selected={isSelected} {...buttonProps}>
                                <ListItemIcon>{<Icon size={20} stroke={1.5} />}</ListItemIcon>
                                <ListItemText primary={t(item.titleKey)} />
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
                                            <ListItemText primary={t(item.titleKey)} />
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
                                            <ListItemText primary={t(item.titleKey)} />
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
