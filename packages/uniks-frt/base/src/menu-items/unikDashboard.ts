import {
    IconBuildingStore,
    IconMap,
    IconTool,
    IconKey,
    IconVariable,
    IconApi,
    IconDatabase,
    IconRobot,
    IconChartBar,
    IconUsersGroup
} from '@tabler/icons-react'
import { ComponentType } from 'react'

export interface MenuItem {
    id: string
    title: string
    type: 'item' | 'group' | 'collapse'
    url?: string
    icon?: ComponentType<any>
    breadcrumbs?: boolean
    children?: MenuItem[]
}

const icons = {
    IconBuildingStore,
    IconMap,
    IconTool,
    IconKey,
    IconVariable,
    IconApi,
    IconDatabase,
    IconRobot,
    IconChartBar,
    IconUsersGroup
}

// ==============================|| UNIK DASHBOARD MENU ITEMS ||============================== //

const unikDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'unikboard',
            title: 'menu:unikboard',
            type: 'item',
            url: '', // will resolve to /uniks/:unikId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'spaces',
            title: 'menu:spaces',
            type: 'item',
            url: '/spaces',
            icon: icons.IconMap,
            breadcrumbs: true
        },
        {
            id: 'tools',
            title: 'menu:tools',
            type: 'item',
            url: '/tools',
            icon: icons.IconTool,
            breadcrumbs: true
        },
        {
            id: 'credentials',
            title: 'menu:credentials',
            type: 'item',
            url: '/credentials',
            icon: icons.IconKey,
            breadcrumbs: true
        },
        {
            id: 'variables',
            title: 'menu:variables',
            type: 'item',
            url: '/variables',
            icon: icons.IconVariable,
            breadcrumbs: true
        },
        {
            id: 'apikey',
            title: 'menu:apiKeys',
            type: 'item',
            url: '/apikey',
            icon: icons.IconApi,
            breadcrumbs: true
        },
        {
            id: 'document-stores',
            title: 'menu:documentStores',
            type: 'item',
            url: '/document-stores',
            icon: icons.IconDatabase,
            breadcrumbs: true
        },
        // TEMPORARILY DISABLED: Assistants functionality is under refactoring
        // User can still access via direct URL /assistants
        // Uncomment when refactoring is complete
        // {
        //     id: 'assistants',
        //     title: 'menu:assistants',
        //     type: 'item',
        //     url: '/assistants',
        //     icon: icons.IconRobot,
        //     breadcrumbs: true
        // },
        {
            id: 'analytics',
            title: 'menu:analytics',
            type: 'item',
            url: '/analytics',
            icon: icons.IconChartBar,
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

export default unikDashboard
