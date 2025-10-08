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

// ==============================|| METAVERSE DASHBOARD MENU ITEMS ||============================== //

const metaverseDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'metaverseboard',
            title: 'menu.metaverseboard',
            type: 'item',
            url: '', // will resolve to /metaverses/:metaverseId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'entities',
            title: 'menu.entities',
            type: 'item',
            url: '/entities',
            icon: icons.IconFolder,
            breadcrumbs: true
        },
        {
            id: 'sections',
            title: 'menu.sections',
            type: 'item',
            url: '/sections',
            icon: icons.IconHierarchy,
            breadcrumbs: true
        },
        {
            id: 'access',
            title: 'menu.access',
            type: 'item',
            url: '/access',
            icon: icons.IconUsersGroup,
            breadcrumbs: true
        }
    ]
}

export default metaverseDashboard
