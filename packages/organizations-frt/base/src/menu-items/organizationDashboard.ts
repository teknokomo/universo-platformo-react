import { IconBuildingStore, IconHierarchy, IconFolder, IconUsersGroup } from '@tabler/icons-react'
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

const icons = { IconBuildingStore, IconHierarchy, IconFolder, IconUsersGroup }

// ==============================|| ORGANIZATION DASHBOARD MENU ITEMS ||============================== //

const organizationDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'organizationboard',
            title: 'menu:organizationboard',
            type: 'item',
            url: '', // will resolve to /organizations/:organizationId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'positions',
            title: 'menu:positions',
            type: 'item',
            url: '/positions',
            icon: icons.IconFolder,
            breadcrumbs: true
        },
        {
            id: 'departments',
            title: 'menu:departments',
            type: 'item',
            url: '/departments',
            icon: icons.IconHierarchy,
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

export default organizationDashboard
