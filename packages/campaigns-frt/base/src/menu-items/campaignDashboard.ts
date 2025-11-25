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

// ==============================|| CAMPAIGN DASHBOARD MENU ITEMS ||============================== //

const campaignDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'campaignboard',
            title: 'menu:campaignboard',
            type: 'item',
            url: '', // will resolve to /campaigns/:campaignId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'events',
            title: 'menu:events',
            type: 'item',
            url: '/events',
            icon: icons.IconHierarchy,
            breadcrumbs: true
        },
        {
            id: 'activities',
            title: 'menu:activities',
            type: 'item',
            url: '/activities',
            icon: icons.IconFolder,
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

export default campaignDashboard
