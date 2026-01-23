import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { styled } from '@mui/material/styles'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { useTranslation } from 'react-i18next'

import type { TemplateMenuItem } from '../../navigation/menuConfigs'

const drawerWidth = 240

const StyledDrawer = styled(Drawer)(({ theme }) => ({
    width: drawerWidth,
    flexShrink: 0,
    boxSizing: 'border-box',
    [`& .${drawerClasses.paper}`]: {
        width: drawerWidth,
        boxSizing: 'border-box',
        backgroundColor: theme.palette.background.paper
    }
}))

interface TemplateSideMenuProps {
    items: TemplateMenuItem[]
}

const TemplateSideMenu: React.FC<TemplateSideMenuProps> = ({ items }) => {
    const { t } = useTranslation('menu')
    const location = useLocation()

    const isActive = React.useCallback(
        (item: TemplateMenuItem) => {
            if (item.type === 'divider') return false
            if (item.external) return false
            if (!item.url) return false
            return location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)
        },
        [location.pathname]
    )

    return (
        <StyledDrawer
            variant='permanent'
            sx={{
                display: { xs: 'none', md: 'block' }
            }}
        >
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 1 }}>
                <List sx={{ flexGrow: 1 }}>
                    {items.map((item) => {
                        if (item.type === 'divider') {
                            return <Divider key={item.id} sx={{ my: 1 }} />
                        }
                        const Icon = item.icon
                        const selected = isActive(item)
                        const buttonProps = item.external
                            ? { component: 'a', href: item.url, target: item.target ?? '_blank', rel: 'noopener noreferrer' }
                            : {
                                  component: NavLink,
                                  to: item.url,
                                  style: { textDecoration: 'none' }
                              }
                        return (
                            <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                                <ListItemButton
                                    {...buttonProps}
                                    selected={selected}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.5,
                                        alignItems: 'center',
                                        py: 1.25,
                                        px: 1.5
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        {React.createElement(Icon, { size: 18, stroke: 1.5 })}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography variant={selected ? 'h6' : 'body1'} color='inherit'>
                                                {t(item.titleKey)}
                                            </Typography>
                                        }
                                    />
                                    {item.chip && <Chip label={item.chip.label} size='small' color='primary' variant='outlined' />}
                                </ListItemButton>
                            </ListItem>
                        )
                    })}
                </List>
            </Box>
        </StyledDrawer>
    )
}

export default TemplateSideMenu
