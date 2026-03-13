import type { SystemAppDefinition, SystemAppStructureCapabilities, SystemTableCapabilityOptions } from './types'

type SystemAppCapabilityStage = 'current' | 'target'

const resolveBoolean = (value: boolean): true | false => (value ? true : false)

export const resolveSystemTableCapabilityOptions = (
    capabilities: SystemAppStructureCapabilities
): Required<SystemTableCapabilityOptions> => {
    const includeAttributes =
        capabilities.appCoreTables &&
        [
            capabilities.catalogTables,
            capabilities.documentTables,
            capabilities.relationTables,
            capabilities.layoutTables,
            capabilities.widgetTables,
            capabilities.attributeValueTables
        ].some(Boolean)

    const includeValues = capabilities.appCoreTables && capabilities.attributeValueTables
    const includeLayouts = capabilities.appCoreTables && capabilities.layoutTables
    const includeWidgets = capabilities.appCoreTables && capabilities.layoutTables && capabilities.widgetTables

    return {
        includeAttributes: resolveBoolean(includeAttributes),
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
