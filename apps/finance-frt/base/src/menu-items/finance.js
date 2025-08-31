// assets
import { IconCurrencyDollar, IconWallet } from '@tabler/icons-react'

// icons
const icons = { IconCurrencyDollar, IconWallet }

// ==============================|| FINANCE MENU ITEMS ||============================== //

const financeMenu = {
    id: 'finance',
    title: '',
    type: 'group',
    children: [
        {
            id: 'currencies',
            title: 'menu.currencies',
            type: 'item',
            url: '/currencies',
            icon: icons.IconCurrencyDollar,
            breadcrumbs: true
        },
        {
            id: 'accounts',
            title: 'menu.accounts',
            type: 'item',
            url: '/accounts',
            icon: icons.IconWallet,
            breadcrumbs: true
        }
    ]
}

export default financeMenu
