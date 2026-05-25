import type { SystemAppDefinition, SystemAppStructureCapabilities, SystemTableCapabilityOptions } from './types'

type SystemAppCapabilityStage = 'current' | 'target'

const resolveBoolean = (value: boolean): true | false => (value ? true : false)

export const resolveSystemTableCapabilityOptions = (
    capabilities: SystemAppStructureCapabilities
): Required<SystemTableCapabilityOptions> => {
    const includeComponents =
        capabilities.appCoreTables &&
        [
            capabilities.objectTables,
            capabilities.documentTables,
            capabilities.relationTables,
            capabilities.layoutTables,
            capabilities.widgetTables,
            capabilities.componentValueTables
        ].some(Boolean)

    const includeValues = capabilities.appCoreTables && capabilities.componentValueTables
    const includeLayouts = capabilities.appCoreTables && capabilities.layoutTables
    const includeWidgets = capabilities.appCoreTables && capabilities.layoutTables && capabilities.widgetTables

    return {
        includeComponents: resolveBoolean(includeComponents),
        includeValues: resolveBoolean(includeValues),
        includeLayouts: resolveBoolean(includeLayouts),
        includeWidgets: resolveBoolean(includeWidgets)
    }
}

export const resolveSystemAppDefinitionSystemTableCapabilities = (
    definition: SystemAppDefinition,
    stage: SystemAppCapabilityStage = 'target'
): Required<SystemTableCapabilityOptions> =>
    resolveSystemTableCapabilityOptions(
        stage === 'current' ? definition.currentStructureCapabilities : definition.targetStructureCapabilities
    )
