import { IconBuildingStore, IconHierarchy, IconSettings, IconUsersGroup } from '@tabler/icons-react'
import { ComponentType } from 'react'

export interface MenuItem {
    id: string
    title: string
    type: 'item' | 'group' | 'collapse'
    url?: string
    icon?: ComponentType<Record<string, unknown>>
    breadcrumbs?: boolean
    children?: MenuItem[]
}

const icons = { IconBuildingStore, IconHierarchy, IconSettings, IconUsersGroup }

// ==============================|| APPLICATION DASHBOARD MENU ITEMS ||============================== //

const applicationDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'applicationboard',
            title: 'menu:applicationboard',
            type: 'item',
            url: '', // will resolve to /a/:applicationId/admin
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'connectors',
            title: 'menu:connectors',
            type: 'item',
            url: '/connectors',
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

export default applicationDashboard
