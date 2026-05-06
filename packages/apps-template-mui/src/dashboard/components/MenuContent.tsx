import { Fragment, useState } from 'react'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded'
import AppsRoundedIcon from '@mui/icons-material/AppsRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { sanitizeMenuHref } from '@universo/utils'
import type { DashboardMenuSlot } from '../Dashboard'

export const sanitizeHref = sanitizeMenuHref

const resolveIcon = (iconName?: string | null) => {
    const normalized = iconName?.trim().toLowerCase()
    switch (normalized) {
        case 'home':
            return <HomeRoundedIcon />
        case 'analytics':
            return <AnalyticsRoundedIcon />
        case 'users':
        case 'people':
            return <PeopleRoundedIcon />
        case 'tasks':
            return <AssignmentRoundedIcon />
        case 'database':
        case 'catalog':
            return <TableRowsRoundedIcon />
        case 'folder':
            return <FolderRoundedIcon />
        case 'apps':
            return <AppsRoundedIcon />
        case 'dashboard':
            return <DashboardRoundedIcon />
        case 'school':
        case 'learning':
            return <SchoolRoundedIcon />
        case 'more':
            return <MoreHorizRoundedIcon />
        default:
            return <LinkRoundedIcon />
    }
}

interface MenuContentProps {
    menu?: DashboardMenuSlot
}

export default function MenuContent({ menu }: MenuContentProps) {
    const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null)
    const items = menu?.items ?? []
    const overflowItems = menu?.overflowItems ?? []
    const isWorkspaceRootItem = (item: DashboardMenuSlot['items'][number]) =>
        item.id === 'runtime-workspaces' || item.id === 'workspaces' || /\/workspaces(?:$|\?)/.test(item.href ?? '')
    const firstWorkspaceRootIndex = items.findIndex(isWorkspaceRootItem)
    const handleItemSelect = (item: DashboardMenuSlot['items'][number]) => {
        if (item.kind !== 'catalog' && item.kind !== 'section' && item.kind !== 'page') {
            return
        }

        const targetSectionId = item.sectionId ?? item.linkedCollectionId
        if (!targetSectionId) {
            return
        }

        if (menu?.onSelectSection) {
            menu.onSelectSection(targetSectionId)
            return
        }

        if (menu?.onSelectLinkedCollection) {
            menu.onSelectLinkedCollection(targetSectionId)
        }
    }

    return (
        <List dense sx={{ p: 1 }}>
            {menu?.showTitle && menu.title ? (
                <Typography
                    variant='caption'
                    sx={{ px: 1.5, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700, letterSpacing: 0.4 }}
                >
                    {menu.title}
                </Typography>
            ) : null}
            {items.map((item, index) => {
                const isHubLabel = item.kind === 'hub'
                const isInertLink = item.kind === 'link' && !sanitizeHref(item.href)
                const needsWorkspaceDivider = index === firstWorkspaceRootIndex
                return (
                    <Fragment key={item.id}>
                        {needsWorkspaceDivider ? <Divider sx={{ my: 0.5 }} /> : null}
                        <ListItem disablePadding sx={{ display: 'block' }}>
                            <ListItemButton
                                disabled={isHubLabel || isInertLink}
                                selected={Boolean(item.selected)}
                                {...(item.kind === 'link' && sanitizeHref(item.href)
                                    ? { component: 'a' as const, href: sanitizeHref(item.href) }
                                    : {})}
                                onClick={() => handleItemSelect(item)}
                            >
                                <ListItemIcon>{resolveIcon(item.icon)}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        </ListItem>
                    </Fragment>
                )
            })}
            {overflowItems.length > 0 ? (
                <ListItem disablePadding sx={{ display: 'block' }}>
                    <ListItemButton onClick={(event) => setOverflowAnchor(event.currentTarget)}>
                        <ListItemIcon>{resolveIcon('more')}</ListItemIcon>
                        <ListItemText primary={menu?.overflowLabel || 'More'} />
                    </ListItemButton>
                    <Menu anchorEl={overflowAnchor} open={Boolean(overflowAnchor)} onClose={() => setOverflowAnchor(null)}>
                        {overflowItems.map((item) => (
                            <MenuItem
                                key={item.id}
                                selected={Boolean(item.selected)}
                                disabled={item.kind === 'hub' || (item.kind === 'link' && !sanitizeHref(item.href))}
                                {...(item.kind === 'link' && sanitizeHref(item.href)
                                    ? { component: 'a' as const, href: sanitizeHref(item.href) }
                                    : {})}
                                onClick={() => {
                                    handleItemSelect(item)
                                    setOverflowAnchor(null)
                                }}
                            >
                                <ListItemIcon>{resolveIcon(item.icon)}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </MenuItem>
                        ))}
                    </Menu>
                </ListItem>
            ) : null}
        </List>
    )
}
