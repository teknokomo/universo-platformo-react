import { Fragment, useState, type ReactElement } from 'react'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
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
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import { sanitizeMenuHref } from '@universo-react/utils'
import { useTranslation } from 'react-i18next'
import i18n from '@universo-react/i18n'
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
        case 'object':
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
        case 'recent':
        case 'history':
            return <HistoryRoundedIcon />
        case 'star':
        case 'starred':
            return <StarRoundedIcon />
        case 'delete':
        case 'trash':
            return <DeleteRoundedIcon />
        case 'more':
            return <MoreHorizRoundedIcon />
        default:
            return <LinkRoundedIcon />
    }
}

const isCurrentHref = (href?: string | null): boolean => {
    const safeHref = sanitizeHref(href)
    if (!safeHref || typeof window === 'undefined') return false

    try {
        const targetUrl = new URL(safeHref, window.location.origin)
        return targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search
    } catch {
        return safeHref === `${window.location.pathname}${window.location.search}`
    }
}

const isRootApplicationStartHref = (href?: string | null): boolean => {
    const safeHref = sanitizeHref(href)
    if (!safeHref || typeof window === 'undefined') return false

    try {
        const currentUrl = new URL(window.location.href)
        const targetUrl = new URL(safeHref, window.location.origin)
        const currentParts = currentUrl.pathname.split('/').filter(Boolean)
        const targetParts = targetUrl.pathname.split('/').filter(Boolean)

        return (
            currentParts.length === 2 &&
            targetParts.length >= 3 &&
            currentParts[0] === 'a' &&
            targetParts[0] === 'a' &&
            currentParts[1] === targetParts[1] &&
            targetUrl.search === currentUrl.search
        )
    } catch {
        return false
    }
}

interface MenuContentProps {
    menu?: DashboardMenuSlot
    variant?: 'wide' | 'compact'
}

type DashboardMenuItem = DashboardMenuSlot['items'][number]

const hasUsableTarget = (item: DashboardMenuItem): boolean => {
    if (item.kind === 'section') {
        return Boolean(item.sectionId ?? item.objectCollectionId)
    }

    if (item.kind === 'hub') {
        return Boolean(item.treeEntityId ?? item.hubId)
    }

    return true
}

export default function MenuContent({ menu, variant = 'wide' }: MenuContentProps) {
    const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null)
    const { t } = useTranslation('apps', { i18n })
    const isCompact = variant === 'compact'
    const items = (menu?.items ?? []).filter(hasUsableTarget)
    const overflowItems = (menu?.overflowItems ?? []).filter(hasUsableTarget)
    const overflowLabel = menu?.overflowLabel || t('runtime.menu.more')
    const isWorkspaceRootItem = (item: DashboardMenuItem) =>
        item.id === 'runtime-workspaces' || item.id === 'workspaces' || /\/workspaces(?:$|\?)/.test(item.href ?? '')
    const firstWorkspaceRootIndex = items.findIndex(isWorkspaceRootItem)
    const handleItemSelect = (item: DashboardMenuItem) => {
        if (item.kind !== 'section') {
            return
        }

        if (item.objectCollectionId) {
            if (menu?.onSelectObjectCollection) {
                menu.onSelectObjectCollection(item.objectCollectionId)
                return
            }

            if (menu?.onSelectSection) {
                menu.onSelectSection(item.objectCollectionId)
            }
            return
        }

        if (item.sectionId && menu?.onSelectSection) {
            menu.onSelectSection(item.sectionId)
        }
    }

    const renderText = (label: string) => (isCompact ? null : <ListItemText primary={label} />)
    const wrapCompactTooltip = (label: string, child: ReactElement) =>
        isCompact ? (
            <Tooltip title={label} placement='right'>
                {child}
            </Tooltip>
        ) : (
            child
        )

    return (
        <List component='nav' aria-label={menu?.title || t('runtime.menu.navigation', 'Application navigation')} dense sx={{ p: 1 }}>
            {menu?.showTitle && menu.title && !isCompact ? (
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
                const isSelected =
                    Boolean(item.selected) ||
                    (item.kind === 'link' && (isCurrentHref(item.href) || (index === 0 && isRootApplicationStartHref(item.href))))
                const needsWorkspaceDivider = index === firstWorkspaceRootIndex
                return (
                    <Fragment key={item.id}>
                        {needsWorkspaceDivider ? <Divider sx={{ my: 0.5 }} /> : null}
                        <ListItem disablePadding sx={{ display: 'block' }}>
                            {wrapCompactTooltip(
                                item.label,
                                <ListItemButton
                                    disabled={isHubLabel || isInertLink}
                                    selected={isSelected}
                                    aria-label={item.label}
                                    aria-current={isSelected ? 'page' : undefined}
                                    {...(item.kind === 'link' && sanitizeHref(item.href)
                                        ? { component: 'a' as const, href: sanitizeHref(item.href) }
                                        : {})}
                                    onClick={() => handleItemSelect(item)}
                                    sx={{
                                        borderRadius: 1,
                                        minHeight: 36,
                                        justifyContent: isCompact ? 'center' : 'flex-start',
                                        px: isCompact ? 1 : undefined,
                                        '&.Mui-selected': {
                                            bgcolor: 'action.selected',
                                            color: 'text.primary',
                                            '& .MuiListItemIcon-root': {
                                                color: 'text.primary'
                                            },
                                            '& .MuiListItemText-primary': {
                                                fontWeight: 700
                                            },
                                            '&:hover': {
                                                bgcolor: 'action.selected'
                                            }
                                        }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: isCompact ? 0 : 40 }}>{resolveIcon(item.icon)}</ListItemIcon>
                                    {renderText(item.label)}
                                </ListItemButton>
                            )}
                        </ListItem>
                    </Fragment>
                )
            })}
            {overflowItems.length > 0 ? (
                <ListItem disablePadding sx={{ display: 'block' }}>
                    {wrapCompactTooltip(
                        overflowLabel,
                        <ListItemButton
                            aria-label={overflowLabel}
                            onClick={(event) => setOverflowAnchor(event.currentTarget)}
                            sx={{ justifyContent: isCompact ? 'center' : 'flex-start', px: isCompact ? 1 : undefined }}
                        >
                            <ListItemIcon sx={{ minWidth: isCompact ? 0 : 40 }}>{resolveIcon('more')}</ListItemIcon>
                            {renderText(overflowLabel)}
                        </ListItemButton>
                    )}
                    <Menu anchorEl={overflowAnchor} open={Boolean(overflowAnchor)} onClose={() => setOverflowAnchor(null)}>
                        {overflowItems.map((item) => (
                            <MenuItem
                                key={item.id}
                                selected={Boolean(item.selected) || (item.kind === 'link' && isCurrentHref(item.href))}
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
