import {
    IconBuildingStore,
    IconBox,
    IconUsersGroup,
    IconApps,
    IconGitBranch,
    IconLayoutDashboard,
    IconHistory,
    IconSettings
} from '@tabler/icons-react'
import { ComponentType } from 'react'

export interface MenuItem {
    id: string
    title: string
    type: 'item' | 'group' | 'collapse' | 'divider'
    url?: string
    icon?: ComponentType<unknown>
    breadcrumbs?: boolean
    children?: MenuItem[]
}

const icons = {
    IconBuildingStore,
    IconBox,
    IconUsersGroup,
    IconApps,
    IconGitBranch,
    IconLayoutDashboard,
    IconHistory,
    IconSettings
}

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
            id: 'metahub-resources',
            title: 'menu:commonSection',
            type: 'item',
            url: '/resources',
            icon: icons.IconLayoutDashboard,
            breadcrumbs: true
        },
        // Dynamic entity-type items (Hubs, Catalogs, Sets, Enumerations) appear here
        {
            id: 'divider-secondary',
            title: '',
            type: 'divider'
        },
        {
            id: 'entities',
            title: 'menu:entityTypes',
            type: 'item',
            url: '/entities',
            icon: icons.IconBox,
            breadcrumbs: true
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
            id: 'migrations',
            title: 'menu:migrations',
            type: 'item',
            url: '/migrations',
            icon: icons.IconHistory,
            breadcrumbs: true
        },
        {
            id: 'access',
            title: 'menu:access',
            type: 'item',
            url: '/access',
            icon: icons.IconUsersGroup,
            breadcrumbs: true
        },
        {
            id: 'divider-footer',
            title: '',
            type: 'divider'
        },
        {
            id: 'settings',
            title: 'menu:settings',
            type: 'item',
            url: '/settings',
            icon: icons.IconSettings,
            breadcrumbs: true
        }
    ]
}

export default metahubDashboard
