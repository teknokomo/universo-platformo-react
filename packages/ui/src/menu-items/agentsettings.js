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
            id: 'canvasConfiguration',
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
            id: 'duplicateCanvas',
            title: i18n.t('canvas.contextMenu.duplicateCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconCopy
        },
        {
            id: 'loadCanvas',
            title: i18n.t('canvas.contextMenu.loadCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconFileUpload
        },
        {
            id: 'exportCanvas',
            title: i18n.t('canvas.contextMenu.exportCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconFileExport
        },
        {
            id: 'deleteCanvas',
            title: i18n.t('canvas.contextMenu.deleteCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconTrash
        }
    ]
}

export default agent_settings
