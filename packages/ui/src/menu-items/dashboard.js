// Import required icons from @tabler/icons-react
import { IconFiles, IconWorld, IconUser, IconFileText } from '@tabler/icons-react'

// Collect them in an icons object
const icons = { IconFiles, IconWorld, IconUser, IconFileText }

// ==============================|| MAIN DASHBOARD MENU ITEMS ||============================== //

const dashboard = {
    id: 'main-dashboard',
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
            icon: icons.IconWorld,
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

export default dashboard
