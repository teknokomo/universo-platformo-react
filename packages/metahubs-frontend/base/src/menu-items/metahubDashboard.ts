import { IconBuildingStore, IconHierarchy, IconUsersGroup, IconDatabase, IconApps } from '@tabler/icons-react'
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

const icons = { IconBuildingStore, IconHierarchy, IconUsersGroup, IconDatabase, IconApps }

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
            id: 'publications',
            title: 'menu:publications',
            type: 'item',
            url: '/publications',
            icon: icons.IconApps,
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
