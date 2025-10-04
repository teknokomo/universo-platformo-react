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
import i18n from '@ui/i18n'
import { rootMenuItems } from '../../navigation/menuConfigs'

// const secondaryListItems = [
//   { text: 'Settings', icon: <SettingsRoundedIcon /> },
//   { text: 'About', icon: <InfoRoundedIcon /> },
//   { text: 'Feedback', icon: <HelpRoundedIcon /> },
// ];

export default function MenuContent() {
    const { t } = useTranslation('menu', { i18n })
    const location = useLocation()
    return (
        <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
            <List dense>
                {rootMenuItems.map((item, index) => {
                    const Icon = item.icon
                    const buttonProps = item.external
                        ? { component: 'a', href: item.url, target: item.target ?? '_blank', rel: 'noopener noreferrer' }
                        : { component: NavLink, to: item.url }
                    const isSelected = !item.external && (location.pathname === item.url || location.pathname.startsWith(`${item.url}/`))
                    return (
                        <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton selected={isSelected} {...buttonProps}>
                                <ListItemIcon>{<Icon size={20} stroke={1.5} />}</ListItemIcon>
                                <ListItemText primary={t(`menu.${item.titleKey}`)} />
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
