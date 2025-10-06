import { IconBuildingStore, IconHierarchy, IconFolder } from '@tabler/icons-react'
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

const icons = { IconBuildingStore, IconHierarchy, IconFolder }

// ==============================|| CLUSTER DASHBOARD MENU ITEMS ||============================== //

const clusterDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'clusterboard',
            title: 'menu.clusterboard',
            type: 'item',
            url: '', // will resolve to /clusters/:clusterId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'resources',
            title: 'menu.resources',
            type: 'item',
            url: '/resources',
            icon: icons.IconFolder,
            breadcrumbs: true
        },
        {
            id: 'domains',
            title: 'menu.domains',
            type: 'item',
            url: '/domains',
            icon: icons.IconHierarchy,
            breadcrumbs: true
        }
    ]
}

export default clusterDashboard
