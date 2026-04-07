import {
    IconBuildingStore,
    IconHierarchy,
    IconUsersGroup,
    IconDatabase,
    IconFiles,
    IconFileText,
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
    IconHierarchy,
    IconUsersGroup,
    IconDatabase,
    IconApps,
    IconGitBranch,
    IconLayoutDashboard,
    IconFiles,
    IconFileText,
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
            id: 'metahub-common',
            title: 'menu:commonSection',
            type: 'item',
            url: '/common',
            icon: icons.IconLayoutDashboard,
            breadcrumbs: true
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
            id: 'sets',
            title: 'menu:sets',
            type: 'item',
            url: '/sets',
            icon: icons.IconFileText,
            breadcrumbs: true
        },
        {
            id: 'enumerations',
            title: 'menu:enumerations',
            type: 'item',
            url: '/enumerations',
            icon: icons.IconFiles,
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
