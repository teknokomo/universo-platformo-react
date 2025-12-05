import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
// import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
// import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
// import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { useGlobalRoleCheck } from '../../hooks/useGlobalRoleCheck'
import { rootMenuItems, getAdminMenuItems, getMetaverseMenuItems, getUnikMenuItems, getClusterMenuItems, getProjectMenuItems, getOrganizationMenuItems, getStorageMenuItems, getCampaignMenuItems, getInstanceMenuItems } from '../../navigation/menuConfigs'

// const secondaryListItems = [
//   { text: 'Settings', icon: <SettingsRoundedIcon /> },
//   { text: 'About', icon: <InfoRoundedIcon /> },
//   { text: 'Feedback', icon: <HelpRoundedIcon /> },
// ];

export default function MenuContent() {
    const { t, i18n: i18nInst } = useTranslation('menu', { i18n })
    const location = useLocation()
    const isSuperUser = useGlobalRoleCheck()

    // Check if we're in a unik context
    const isUnikContext = location.pathname.match(/^\/unik\/([^/]+)/)
    const unikId = isUnikContext ? isUnikContext[1] : null

    // Check if we're in a metaverse context (both /metaverse/:id and /metaverses/:id paths)
    const metaverseMatch = location.pathname.match(/^\/metaverses?\/([^/]+)/)
    const metaverseId = metaverseMatch ? metaverseMatch[1] : null

    // Check if we're in a cluster context (both /cluster/:id and /clusters/:id paths)
    const clusterMatch = location.pathname.match(/^\/clusters?\/([^/]+)/)
    const clusterId = clusterMatch ? clusterMatch[1] : null

    // Check if we're in a project context (both /project/:id and /projects/:id paths)
    const projectMatch = location.pathname.match(/^\/projects?\/([^/]+)/)
    const projectId = projectMatch ? projectMatch[1] : null

    // Check if we're in an organization context (both /organization/:id and /organizations/:id paths)
    const organizationMatch = location.pathname.match(/^\/organizations?\/([^/]+)/)
    const organizationId = organizationMatch ? organizationMatch[1] : null

    // Check if we're in a storage context (both /storage/:id and /storages/:id paths)
    const storageMatch = location.pathname.match(/^\/storages?\/([^/]+)/)
    const storageId = storageMatch ? storageMatch[1] : null

    // Check if we're in a campaign context (both /campaign/:id and /campaigns/:id paths)
    const campaignMatch = location.pathname.match(/^\/campaigns?\/([^/]+)/)
    const campaignId = campaignMatch ? campaignMatch[1] : null

    // Check if we're in an instance context (/admin/instance/:id)
    const instanceMatch = location.pathname.match(/^\/admin\/instance\/([^/]+)/)
    const instanceId = instanceMatch ? instanceMatch[1] : null

    // Use context-specific menu or root menu
    const menuItems = unikId
        ? getUnikMenuItems(unikId)
        : metaverseId
        ? getMetaverseMenuItems(metaverseId)
        : clusterId
        ? getClusterMenuItems(clusterId)
        : projectId
        ? getProjectMenuItems(projectId)
        : organizationId
        ? getOrganizationMenuItems(organizationId)
        : storageId
        ? getStorageMenuItems(storageId)
        : campaignId
        ? getCampaignMenuItems(campaignId)
        : instanceId
        ? getInstanceMenuItems(instanceId)
        : rootMenuItems

    // Debug diagnostics for i18n menu resolution
    try {
        // eslint-disable-next-line no-console
        console.log('[MenuContent] i18n status', {
            lang: i18nInst.language,
            resolved: i18nInst.resolvedLanguage,
            hasMenuNs: i18nInst.hasResourceBundle(i18nInst.language, 'menu'),
            sample_uniks: t('uniks'),
            sample_metaverses: t('metaverses')
        })
    } catch (e) {
        // noop
    }

    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {menuItems.map((item, index) => {
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

                {/* Admin section with divider - only for super users and not in instance context */}
                {isSuperUser && !instanceId && (
                    <>
                        <Divider sx={{ my: 1 }} />
                        {/* Admin menu items */}
                        {getAdminMenuItems().map((item) => {
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
