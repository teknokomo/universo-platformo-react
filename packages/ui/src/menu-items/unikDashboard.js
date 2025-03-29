// Import required icons from @tabler/icons-react
import {
    IconFiles,
    IconBuildingStore,
    IconFileText,
    IconUser
} from '@tabler/icons-react'

// Collect them in an icons object
const icons = { IconFiles, IconBuildingStore, IconFileText, IconUser }

// ==============================|| UNIK DASHBOARD MENU ITEMS ||============================== //

const unikDashboard = {
    id: 'unik-dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'uniks',
            title: 'menu.uniks',
            type: 'item',
            url: '/uniks',
            icon: icons.IconFiles,
            breadcrumbs: false
        },
        {
            id: 'docs',
            title: 'menu.docs',
            type: 'item',
            url: '/docs',
            icon: icons.IconFileText,
            breadcrumbs: false
        },
        {
            id: 'profile',
            title: 'menu.profile',
            type: 'item',
            url: '/profile',
            icon: icons.IconUser,
            breadcrumbs: false
        }
    ]
}

export default unikDashboard
