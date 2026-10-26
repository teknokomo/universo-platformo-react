/** Semantic widget settings that an Application may explicitly delegate to a Workspace. */
export const WORKSPACE_WIDGET_SETTING_REGISTRY = {
    interpretationNetwork: {
        widgetKey: 'interpretationNetworkWorkspace',
        settingPaths: {
            'interpretationNetwork.cellStylePolicy.allowedColors': ['cellStylePolicy', 'allowedColors'],
            'interpretationNetwork.cellStylePolicy.allowCustomColors': ['cellStylePolicy', 'allowCustomColors'],
            'interpretationNetwork.cellStylePolicy.editable.fillColor': ['cellStylePolicy', 'editable', 'fillColor'],
            'interpretationNetwork.cellStylePolicy.editable.textColor': ['cellStylePolicy', 'editable', 'textColor'],
            'interpretationNetwork.cellStylePolicy.editable.borderColor': ['cellStylePolicy', 'editable', 'borderColor'],
            'interpretationNetwork.cellStylePolicy.editable.borderWidth': ['cellStylePolicy', 'editable', 'borderWidth'],
            'interpretationNetwork.cellStylePolicy.editable.borderStyle': ['cellStylePolicy', 'editable', 'borderStyle']
        }
    }
} as const

export const isRegisteredWorkspaceWidgetSettingKey = (key: string): boolean =>
    Object.values(WORKSPACE_WIDGET_SETTING_REGISTRY).some(({ settingPaths }) => Object.prototype.hasOwnProperty.call(settingPaths, key))
