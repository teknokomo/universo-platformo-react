import type { ApplicationDialogSettings } from '../types'

export const EDITABLE_APPLICATION_DIALOG_SETTING_KEYS = [
    'dialogSizePreset',
    'dialogAllowFullscreen',
    'dialogAllowResize',
    'dialogCloseBehavior',
    'sectionLinksEnabled',
    'dashboardDefaultMode',
    'datasourceExecutionPolicy',
    'workspaceOpenBehavior'
] as const

export const DEFAULT_APPLICATION_DIALOG_SETTINGS: ApplicationDialogSettings = {
    dialogSizePreset: 'medium',
    dialogAllowFullscreen: true,
    dialogAllowResize: true,
    dialogCloseBehavior: 'strict-modal',
    sectionLinksEnabled: true,
    dashboardDefaultMode: 'layout-default',
    datasourceExecutionPolicy: 'workspace-scoped',
    workspaceOpenBehavior: 'last-used'
}

export const sanitizeApplicationDialogSettingsForSave = (settings: ApplicationDialogSettings): ApplicationDialogSettings => ({
    dialogSizePreset: settings.dialogSizePreset,
    dialogAllowFullscreen: settings.dialogAllowFullscreen,
    dialogAllowResize: settings.dialogAllowResize,
    dialogCloseBehavior: settings.dialogCloseBehavior,
    sectionLinksEnabled: settings.sectionLinksEnabled,
    dashboardDefaultMode: settings.dashboardDefaultMode,
    datasourceExecutionPolicy: settings.datasourceExecutionPolicy,
    workspaceOpenBehavior: settings.workspaceOpenBehavior
})
