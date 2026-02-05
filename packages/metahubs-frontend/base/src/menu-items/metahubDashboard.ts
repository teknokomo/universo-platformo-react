import {
    IconBuildingStore,
    IconHierarchy,
    IconUsersGroup,
    IconDatabase,
    IconApps,
    IconGitBranch,
    IconLayoutDashboard
} from '@tabler/icons-react'
import { ComponentType } from 'react'

export interface MenuItem {
    id: string
    title: string
    type: 'item' | 'group' | 'collapse' | 'divider'
    url?: string
    icon?: ComponentType<any>
    breadcrumbs?: boolean
    children?: MenuItem[]
}

const icons = { IconBuildingStore, IconHierarchy, IconUsersGroup, IconDatabase, IconApps, IconGitBranch, IconLayoutDashboard }

// ==============================|| METAHUB DASHBOARD MENU ITEMS ||============================== //

const metahubDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'metahubboard',
            title: 'menu:metahubboard',
            type: 'item',
            url: '', // will resolve to /metahub/:metahubId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'branches',
            title: 'menu:branches',
            type: 'item',
            url: '/branches',
            icon: icons.IconGitBranch,
            breadcrumbs: true
        },
        {
            id: 'divider-primary',
            title: '',
            type: 'divider'
        },
        {
            id: 'hubs',
            title: 'menu:hubs',
            type: 'item',
            url: '/hubs',
            icon: icons.IconHierarchy,
            breadcrumbs: true
        },
        {
            id: 'catalogs',
            title: 'menu:catalogs',
            type: 'item',
            url: '/catalogs',
            icon: icons.IconDatabase,
            breadcrumbs: true
        },
        {
            id: 'layouts',
            title: 'menu:layouts',
            type: 'item',
            url: '/layouts',
            icon: icons.IconLayoutDashboard,
            breadcrumbs: true
        },
        {
            id: 'divider-secondary',
            title: '',
            type: 'divider'
        },
        {
            id: 'publications',
            title: 'menu:publications',
            type: 'item',
            url: '/publications',
            icon: icons.IconApps,
            breadcrumbs: true
        },
        {
            id: 'access',
            title: 'menu:access',
            type: 'item',
            url: '/access',
            icon: icons.IconUsersGroup,
            breadcrumbs: true
        }
    ]
}

export default metahubDashboard
