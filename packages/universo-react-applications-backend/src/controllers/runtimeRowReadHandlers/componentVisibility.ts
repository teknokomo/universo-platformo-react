type RuntimeComponentVisibilityMetadata = {
    ui_config?: unknown
}

export const isRuntimeComponentHidden = (component: RuntimeComponentVisibilityMetadata): boolean => {
    const config = component.ui_config
    return typeof config === 'object' && config !== null && !Array.isArray(config) && (config as Record<string, unknown>).hidden === true
}
