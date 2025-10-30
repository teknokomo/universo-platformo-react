import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
// import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
// import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
// import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import { rootMenuItems, getMetaverseMenuItems } from '../../navigation/menuConfigs'

// const secondaryListItems = [
//   { text: 'Settings', icon: <SettingsRoundedIcon /> },
//   { text: 'About', icon: <InfoRoundedIcon /> },
//   { text: 'Feedback', icon: <HelpRoundedIcon /> },
// ];

export default function MenuContent() {
    const { t, i18n: i18nInst } = useTranslation('menu', { i18n })
    const location = useLocation()

    // Check if we're in a metaverse context
    const isMetaverseContext = location.pathname.match(/^\/metaverses\/([^/]+)/)
    const metaverseId = isMetaverseContext ? isMetaverseContext[1] : null

    // Use metaverse-specific menu if in metaverse context, otherwise use root menu
    const menuItems = metaverseId ? getMetaverseMenuItems(metaverseId) : rootMenuItems

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
