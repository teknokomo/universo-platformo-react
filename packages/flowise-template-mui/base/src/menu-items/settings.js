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
    IconTemplate,
    IconVersions
} from '@tabler/icons-react'
import i18n from '@universo/i18n'

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
    IconTemplate,
    IconVersions
}

// ==============================|| SETTINGS MENU ITEMS ||============================== //

const settings = {
    id: 'settings',
    title: '',
    type: 'group',
    children: [
        {
            id: 'viewMessages',
            title: i18n.t('canvas:contextMenu.viewMessages'),
            type: 'item',
            url: '',
            icon: icons.IconMessage
        },
        {
            id: 'viewLeads',
            title: i18n.t('canvas:contextMenu.viewLeads'),
            type: 'item',
            url: '',
            icon: icons.IconUsers
        },
        {
            id: 'viewUpsertHistory',
            title: i18n.t('canvas:contextMenu.upsertHistory'),
            type: 'item',
            url: '',
            icon: icons.IconDatabaseExport
        },
        {
            id: 'canvasVersions',
            title: i18n.t('canvas:contextMenu.canvasVersions'),
            type: 'item',
            url: '',
            icon: icons.IconVersions
        },
        {
            id: 'canvasConfiguration',
            title: i18n.t('canvas:contextMenu.configuration'),
            type: 'item',
            url: '',
            icon: icons.IconAdjustmentsHorizontal
        },
        {
            id: 'saveAsTemplate',
            title: i18n.t('canvas:contextMenu.saveAsTemplate'),
            type: 'item',
            url: '',
            icon: icons.IconTemplate
        },
        {
            id: 'duplicateCanvas',
            title: i18n.t('canvas:contextMenu.duplicateCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconCopy
        },
        {
            id: 'loadCanvas',
            title: i18n.t('canvas:contextMenu.loadCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconFileUpload
        },
        {
            id: 'exportCanvas',
            title: i18n.t('canvas:contextMenu.exportCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconFileExport
        },
        {
            id: 'deleteCanvas',
            title: i18n.t('canvas:contextMenu.deleteCanvas'),
            type: 'item',
            url: '',
            icon: icons.IconTrash
        }
    ]
}

export default settings
