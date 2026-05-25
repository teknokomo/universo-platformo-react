import type { DialogCloseBehavior, DialogSizePreset } from '@universo-react/types'

export interface AdminDialogSettings {
    dialogSizePreset: DialogSizePreset
    dialogAllowFullscreen: boolean
    dialogAllowResize: boolean
    dialogCloseBehavior: DialogCloseBehavior
}

export const DEFAULT_ADMIN_DIALOG_SETTINGS: AdminDialogSettings = {
    dialogSizePreset: 'medium',
    dialogAllowFullscreen: true,
    dialogAllowResize: true,
    dialogCloseBehavior: 'strict-modal'
}
