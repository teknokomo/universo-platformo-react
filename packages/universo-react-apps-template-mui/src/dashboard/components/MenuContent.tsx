import { Fragment, useId, useState, type ReactElement } from 'react'
import Box from '@mui/material/Box'
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
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
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
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { sanitizeMenuHref } from '@universo-react/utils'
import { useTranslation } from 'react-i18next'
import i18n from '@universo-react/i18n'

export const sanitizeHref = sanitizeMenuHref

export interface RuntimeMenuViewItem {
    key: string
    label: string
    icon?: string | null
    kind?: 'group' | 'section' | 'link' | 'workspaces'
    href?: string
    selected?: boolean
    disabled?: boolean
    dividerBefore?: boolean
}

export interface RuntimeMenuViewModel {
    title: string
    showTitle: boolean
    overflowLabel: string
    items: RuntimeMenuViewItem[]
    overflowItems: RuntimeMenuViewItem[]
}

interface MenuContentProps {
    viewModel: RuntimeMenuViewModel
    variant?: 'wide' | 'compact'
    onNavigate?: (href: string) => void
}

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
        case 'page':
        case 'article':
            return <ArticleRoundedIcon />
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
        case 'settings':
            return <SettingsRoundedIcon />
        case 'more':
            return <MoreHorizRoundedIcon />
        default:
            return <LinkRoundedIcon />
    }
}

const readCurrentRuntimeUrl = (): URL | undefined => {
    if (typeof window === 'undefined') return undefined
    const hashRoute = window.location.hash.startsWith('#/a/') ? window.location.hash.slice(1) : undefined
    try {
        return new URL(hashRoute ?? `${window.location.pathname}${window.location.search}${window.location.hash}`, window.location.origin)
    } catch {
        return undefined
    }
}

const isCurrentHref = (href?: string): boolean => {
    const safeHref = sanitizeHref(href)
    const currentUrl = readCurrentRuntimeUrl()
    if (!safeHref || !currentUrl || typeof window === 'undefined') return false

    try {
        const targetUrl = new URL(safeHref, window.location.origin)
        return (
            targetUrl.origin === window.location.origin &&
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search === currentUrl.search &&
            targetUrl.hash === currentUrl.hash
        )
    } catch {
        return false
    }
}

const tryNavigateRuntimeLink = (href?: string, onNavigate?: (href: string) => void): 'unhandled' | 'same-route' | 'navigated' => {
    const safeHref = sanitizeHref(href)
    if (!safeHref || typeof window === 'undefined') return 'unhandled'

    try {
        const targetUrl = new URL(safeHref, window.location.origin)
        if (targetUrl.origin !== window.location.origin || !targetUrl.pathname.startsWith('/a/')) return 'unhandled'

        const nextRoute = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
        const currentUrl = readCurrentRuntimeUrl()
        if (!currentUrl) return 'unhandled'
        const currentRoute = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
        if (nextRoute === currentRoute) return 'same-route'

        if (onNavigate) {
            onNavigate(nextRoute)
            return 'navigated'
        }

        if (window.location.hash.startsWith('#/a/')) {
            window.location.hash = nextRoute
            return 'navigated'
        }

        window.history.pushState(null, '', nextRoute)
        window.dispatchEvent(new PopStateEvent('popstate'))
        return 'navigated'
    } catch {
        return 'unhandled'
    }
}

export default function MenuContent({ viewModel, variant = 'wide', onNavigate }: MenuContentProps) {
    const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null)
    const overflowButtonId = useId()
    const overflowMenuId = useId()
    const { t } = useTranslation('apps', { i18n })
    const isCompact = variant === 'compact'
    const overflowLabel = viewModel.overflowLabel || t('runtime.menu.more')

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
        <List component='nav' aria-label={t('runtime.menu.navigation', 'Application navigation')} dense sx={{ p: 1 }}>
            {viewModel.showTitle && viewModel.title && !isCompact ? (
                <Typography
                    variant='caption'
                    sx={{ px: 1.5, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700, letterSpacing: 0.4 }}
                >
                    {viewModel.title}
                </Typography>
            ) : null}
            {viewModel.items.map((item) => {
                const safeHref = sanitizeHref(item.href)
                const disabled = item.disabled === true || !safeHref
                const selected = item.selected ?? (!disabled && isCurrentHref(safeHref))

                return (
                    <Fragment key={item.key}>
                        {item.dividerBefore ? <Divider sx={{ my: 0.5 }} /> : null}
                        {item.kind === 'group' ? (
                            <ListItem disablePadding sx={{ display: 'block' }}>
                                {wrapCompactTooltip(
                                    item.label,
                                    <Box
                                        role='heading'
                                        aria-level={2}
                                        aria-label={item.label}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            minHeight: 36,
                                            justifyContent: isCompact ? 'center' : 'flex-start',
                                            gap: 1,
                                            px: isCompact ? 1 : 2,
                                            color: 'text.secondary',
                                            fontWeight: 600
                                        }}
                                    >
                                        <ListItemIcon aria-hidden='true' sx={{ minWidth: 0 }}>
                                            {resolveIcon(item.icon)}
                                        </ListItemIcon>
                                        {renderText(item.label)}
                                    </Box>
                                )}
                            </ListItem>
                        ) : (
                            <ListItem disablePadding sx={{ display: 'block' }}>
                                {wrapCompactTooltip(
                                    item.label,
                                    <ListItemButton
                                        disabled={disabled}
                                        selected={selected}
                                        aria-label={item.label}
                                        aria-current={selected ? 'page' : undefined}
                                        {...(!disabled && safeHref
                                            ? { component: 'a' as const, href: safeHref, 'data-runtime-navigation-link': '' }
                                            : {})}
                                        onClick={(event) => {
                                            const modifiedClick =
                                                event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
                                            const runtimeLinkResult =
                                                disabled || modifiedClick ? 'unhandled' : tryNavigateRuntimeLink(safeHref, onNavigate)
                                            if (runtimeLinkResult !== 'unhandled') event.preventDefault()
                                        }}
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
                                        <ListItemIcon sx={{ minWidth: 0 }}>{resolveIcon(item.icon)}</ListItemIcon>
                                        {renderText(item.label)}
                                    </ListItemButton>
                                )}
                            </ListItem>
                        )}
                    </Fragment>
                )
            })}
            {viewModel.overflowItems.length > 0 ? (
                <ListItem disablePadding sx={{ display: 'block' }}>
                    {wrapCompactTooltip(
                        overflowLabel,
                        <ListItemButton
                            id={overflowButtonId}
                            aria-label={overflowLabel}
                            aria-haspopup='menu'
                            aria-expanded={Boolean(overflowAnchor)}
                            aria-controls={overflowAnchor ? overflowMenuId : undefined}
                            onClick={(event) => setOverflowAnchor(event.currentTarget)}
                            sx={{ justifyContent: isCompact ? 'center' : 'flex-start', px: isCompact ? 1 : undefined }}
                        >
                            <ListItemIcon sx={{ minWidth: 0 }}>{resolveIcon('more')}</ListItemIcon>
                            {renderText(overflowLabel)}
                        </ListItemButton>
                    )}
                    <Menu
                        anchorEl={overflowAnchor}
                        open={Boolean(overflowAnchor)}
                        onClose={() => setOverflowAnchor(null)}
                        slotProps={{ list: { id: overflowMenuId, 'aria-labelledby': overflowButtonId } }}
                    >
                        {viewModel.overflowItems.map((item) => {
                            const safeHref = sanitizeHref(item.href)
                            const disabled = item.disabled === true || !safeHref
                            const selected = item.selected ?? (!disabled && isCurrentHref(safeHref))

                            return (
                                <MenuItem
                                    key={item.key}
                                    selected={selected}
                                    disabled={disabled}
                                    aria-current={selected ? 'page' : undefined}
                                    {...(!disabled && safeHref
                                        ? { component: 'a' as const, href: safeHref, 'data-runtime-navigation-link': '' }
                                        : {})}
                                    onClick={(event) => {
                                        const modifiedClick =
                                            event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
                                        const runtimeLinkResult =
                                            disabled || modifiedClick ? 'unhandled' : tryNavigateRuntimeLink(safeHref, onNavigate)
                                        if (runtimeLinkResult !== 'unhandled') event.preventDefault()
                                        setOverflowAnchor(null)
                                    }}
                                >
                                    <ListItemIcon>{resolveIcon(item.icon)}</ListItemIcon>
                                    <ListItemText primary={item.label} />
                                </MenuItem>
                            )
                        })}
                    </Menu>
                </ListItem>
            ) : null}
        </List>
    )
}
