// assets
import {
    IconTrash,
    IconFileUpload,
    IconFileExport,
    IconCopy,
    IconMessage,
    IconDatabaseExport,
    IconAdjustmentsHorizontal,
    IconUsers,
    IconTemplate
} from '@tabler/icons-react'
import i18n from '@/i18n'

// constant
const icons = {
    IconTrash,
    IconFileUpload,
    IconFileExport,
    IconCopy,
    IconMessage,
    IconDatabaseExport,
    IconAdjustmentsHorizontal,
    IconUsers,
    IconTemplate
}

// ==============================|| SETTINGS MENU ITEMS ||============================== //

const agent_settings = {
    id: 'settings',
    title: '',
    type: 'group',
    children: [
        {
            id: 'viewMessages',
            title: i18n.t('canvas.contextMenu.viewMessages'),
            type: 'item',
            url: '',
            icon: icons.IconMessage
        },
        {
            id: 'viewLeads',
            title: i18n.t('canvas.contextMenu.viewLeads'),
            type: 'item',
            url: '',
            icon: icons.IconUsers
        },
        {
            id: 'chatflowConfiguration',
            title: i18n.t('canvas.contextMenu.configuration'),
            type: 'item',
            url: '',
            icon: icons.IconAdjustmentsHorizontal
        },
        {
            id: 'saveAsTemplate',
            title: i18n.t('canvas.contextMenu.saveAsTemplate'),
            type: 'item',
            url: '',
            icon: icons.IconTemplate
        },
        {
            id: 'duplicateChatflow',
            title: i18n.t('canvas.contextMenu.duplicateChatflow'),
            type: 'item',
            url: '',
            icon: icons.IconCopy
        },
        {
            id: 'loadChatflow',
            title: i18n.t('canvas.contextMenu.loadChatflow'),
            type: 'item',
            url: '',
            icon: icons.IconFileUpload
        },
        {
            id: 'exportChatflow',
            title: i18n.t('canvas.contextMenu.exportChatflow'),
            type: 'item',
            url: '',
            icon: icons.IconFileExport
        },
        {
            id: 'deleteChatflow',
            title: i18n.t('canvas.contextMenu.deleteChatflow'),
            type: 'item',
            url: '',
            icon: icons.IconTrash
        }
    ]
}

export default agent_settings
