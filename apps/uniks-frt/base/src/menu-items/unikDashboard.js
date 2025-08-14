// Import required icons from @tabler/icons-react
import { IconFiles, IconBuildingStore, IconFileText, IconUser, IconExternalLink } from '@tabler/icons-react'

// Collect them in an icons object
const icons = { IconFiles, IconBuildingStore, IconFileText, IconUser, IconExternalLink }

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
            id: 'metaverses',
            title: 'menu.metaverses',
            type: 'item',
            url: '/metaverses',
            icon: icons.IconBuildingStore,
            breadcrumbs: false
        },
        {
            id: 'profile',
            title: 'menu.profile',
            type: 'item',
            url: '/profile',
            icon: icons.IconUser,
            breadcrumbs: false
        },
        {
            id: 'docs',
            title: 'menu.docs',
            type: 'item',
            url: 'https://docs.universo.pro',
            icon: icons.IconFileText,
            breadcrumbs: false,
            external: true,
            target: '_blank',
            chip: {
                color: 'primary',
                variant: 'outlined',
                size: 'small',
                label: '⧉',
                avatar: null
            }
        }
    ]
}

export default unikDashboard
