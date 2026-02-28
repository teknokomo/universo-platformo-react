import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
// import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
// import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
// import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useHasGlobalAccess } from '@flowise/store'
import { useMetaverseName } from '../../hooks'
import {
    rootMenuItems,
    getApplicationsMenuItem,
    getMetahubsMenuItem,
    getAdminMenuItems,
    getMetaverseMenuItems,
    getMetahubMenuItems,
    getApplicationMenuItems,
    getUnikMenuItems,
    getInstanceMenuItems
} from '../../navigation/menuConfigs'

// const secondaryListItems = [
//   { text: 'Settings', icon: <SettingsRoundedIcon /> },
//   { text: 'About', icon: <InfoRoundedIcon /> },
//   { text: 'Feedback', icon: <HelpRoundedIcon /> },
// ];

export default function MenuContent() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()

    // Check if user has admin access (for showing Admin menu in root sidebar)
    const { isSuperuser, hasAnyGlobalRole } = useHasGlobalAccess()
    const canAccessAdmin = isSuperuser || hasAnyGlobalRole

    // Check if we're in a unik context
    const isUnikContext = location.pathname.match(/^\/unik\/([^/]+)/)
    const unikId = isUnikContext ? isUnikContext[1] : null

    // Check if we're in a metaverse context (both /metaverse/:id and /metaverses/:id paths)
    const metaverseMatch = location.pathname.match(/^\/metaverses?\/([^/]+)/)
    const metaverseId = metaverseMatch ? metaverseMatch[1] : null
    // Verify metaverse access by checking if name loads successfully
    // If null (loading/error), don't show metaverse-specific menu to prevent flicker
    const metaverseName = useMetaverseName(metaverseId)

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
    // For metaverse context, only show context menu if resource access is verified (name loaded)
    const menuItems = unikId
        ? getUnikMenuItems(unikId)
        : metaverseId && metaverseName
        ? getMetaverseMenuItems(metaverseId)
        : applicationId
        ? getApplicationMenuItems(applicationId)
        : metahubId
        ? getMetahubMenuItems(metahubId)
        : instanceId
        ? getInstanceMenuItems(instanceId)
        : rootMenuItems

    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {menuItems.map((item, index) => {
                    if (item.type === 'divider') {
                        return <Divider key={item.id} sx={{ my: 1 }} />
                    }
                    const Icon = item.icon
                    const buttonProps = item.external
                        ? { component: 'a', href: item.url, target: item.target ?? '_blank', rel: 'noopener noreferrer' }
                        : { component: NavLink, to: item.url }

                    // Exact match logic: selected only if pathname exactly matches item.url
                    // This prevents metaverse board from being highlighted when on /entities or /sections
                    const isSelected = !item.external && location.pathname === item.url

                    // Debug per-item translation
                    let translated = t(item.titleKey)
                    try {
                        // eslint-disable-next-line no-console
                        console.log('[MenuContent] item', {
                            id: item.id,
                            titleKey: item.titleKey,
                            translated
                        })
                    } catch (e) {
                        // noop
                    }

                    return (
                        <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton selected={isSelected} {...buttonProps}>
                                <ListItemIcon>{<Icon size={20} stroke={1.5} />}</ListItemIcon>
                                <ListItemText primary={translated} />
                            </ListItemButton>
                        </ListItem>
                    )
                })}

                {/* Metahubs section with divider - only if not in any entity context */}
                {!instanceId && !metaverseId && !applicationId && !metahubId && !unikId && (
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
            {/* TODO: restore settings/about/feedback once backed by real data */}
            {/*
      <List dense>
        {secondaryListItems.map((item, index) => (
          <ListItem key={index} disablePadding sx={{ display: 'block' }}>
            <ListItemButton>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      */}
        </Stack>
    )
}
