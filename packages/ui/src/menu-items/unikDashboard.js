// Import required icons from @tabler/icons-react
import {
    IconFiles,
    IconBuildingStore
} from '@tabler/icons-react'

// Collect them in an icons object
const icons = { IconFiles, IconBuildingStore }

// ==============================|| UNIK DASHBOARD MENU ITEMS ||============================== //

const unikDashboard = {
    id: 'unik-dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'uniks',
            title: 'Uniks',
            type: 'item',
            url: '/uniks',
            icon: icons.IconFiles,
            breadcrumbs: false
        }
    ]
}

export default unikDashboard
