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

// ==============================|| STORAGE DASHBOARD MENU ITEMS ||============================== //

const storageDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'storageboard',
            title: 'menu:storageboard',
            type: 'item',
            url: '', // will resolve to /storages/:storageId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'slots',
            title: 'menu:slots',
            type: 'item',
            url: '/slots',
            icon: icons.IconFolder,
            breadcrumbs: true
        },
        {
            id: 'containers',
            title: 'menu:containers',
            type: 'item',
            url: '/containers',
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

export default storageDashboard
