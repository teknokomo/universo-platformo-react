import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
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
import type { DashboardMenuSlot } from '../Dashboard'

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
        default:
            return <LinkRoundedIcon />
    }
}

interface MenuContentProps {
    menu?: DashboardMenuSlot
}

export default function MenuContent({ menu }: MenuContentProps) {
    const items = menu?.items ?? []

    return (
        <List dense sx={{ p: 1 }}>
            {menu?.showTitle && menu.title ? (
                <Typography variant='caption' sx={{ px: 1.5, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700, letterSpacing: 0.4 }}>
                    {menu.title}
                </Typography>
            ) : null}
            {items.map((item) => (
                <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                        selected={Boolean(item.selected)}
                        {...(item.kind === 'link' && item.href
                            ? { component: 'a' as const, href: item.href, target: '_self', rel: 'noreferrer' }
                            : {})}
                        onClick={() => {
                            if (item.kind === 'catalog' && item.catalogId && menu?.onSelectCatalog) {
                                menu.onSelectCatalog(item.catalogId)
                            }
                        }}
                    >
                        <ListItemIcon>{resolveIcon(item.icon)}</ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>
                </ListItem>
            ))}
        </List>
    )
}
