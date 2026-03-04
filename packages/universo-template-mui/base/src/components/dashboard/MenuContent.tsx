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
import {
    rootMenuItems,
    getApplicationsMenuItem,
    getMetahubsMenuItem,
    getAdminMenuItems,
    getMetahubMenuItems,
    getApplicationMenuItems,
    getInstanceMenuItems
} from '../../navigation/menuConfigs'

export default function MenuContent() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()

    // Check if user has admin access (for showing Admin menu in root sidebar)
    const { isSuperuser, hasAnyGlobalRole } = useHasGlobalAccess()
    const canAccessAdmin = isSuperuser || hasAnyGlobalRole

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
        : rootMenuItems

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

                    // Exact match logic: selected only if pathname exactly matches item.url
                    const isSelected = !item.external && location.pathname === item.url

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
                {!instanceId && !applicationId && !metahubId && (
                    <>
                        <Divider sx={{ my: 1 }} />
                        {/* Applications menu items */}
                        {getApplicationsMenuItem().map((item) => {
                            if (item.type === 'divider') return null
                            const Icon = item.icon
                            const isSelected =
                                location.pathname === item.url ||
                                location.pathname.startsWith('/applications') ||
                                location.pathname.match(/^\/a\/[^/]+\/admin(?:\/|$)/) !== null
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
                        {/* Metahubs menu items */}
                        {getMetahubsMenuItem().map((item) => {
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
                        {/* Admin menu items - only for users with admin access */}
                        {canAccessAdmin && (
                            <>
                                <Divider sx={{ my: 1 }} />
                                {getAdminMenuItems().map((item) => {
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
                    </>
                )}
            </List>
        </Stack>
    )
}
