// Импортируем нужные иконки из @tabler/icons-react
import {
    IconFiles,
    IconBuildingStore
} from '@tabler/icons-react'

// Собираем их в объект icons
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
            icon: icons.IconFiles,       // <-- используем icons.IconFiles
            breadcrumbs: false
        },
        {
            id: 'marketplace',
            title: 'Marketplace',
            type: 'item',
            url: '/marketplace',
            icon: icons.IconBuildingStore, // <-- используем icons.IconBuildingStore
            breadcrumbs: false
        }
        // При необходимости можно добавить «Common» или другие пункты
        // {
        //   id: 'common',
        //   title: 'Common',
        //   type: 'item',
        //   url: '/common',
        //   icon: icons.IconSomeOther,
        //   breadcrumbs: false
        // }
    ]
}

export default unikDashboard
