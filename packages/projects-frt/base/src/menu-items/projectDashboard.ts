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

// ==============================|| Project DASHBOARD MENU ITEMS ||============================== //

const ProjectDashboard: MenuItem = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'Projectboard',
            title: 'menu:Projectboard',
            type: 'item',
            url: '', // will resolve to /Projects/:ProjectId
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'Tasks',
            title: 'menu:Tasks',
            type: 'item',
            url: '/Tasks',
            icon: icons.IconFolder,
            breadcrumbs: true
        },
        {
            id: 'Milestones',
            title: 'menu:Milestones',
            type: 'item',
            url: '/Milestones',
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

export default ProjectDashboard
