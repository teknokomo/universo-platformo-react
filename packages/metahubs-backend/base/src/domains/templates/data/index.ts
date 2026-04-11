import type { EntityTypePresetManifest, MetahubTemplateManifest, TemplateDefinitionManifest, TemplateDefinitionType } from '@universo/types'
import { basicTemplate } from './basic.template'
import { basicDemoTemplate } from './basic-demo.template'
import { catalogV2EntityPreset } from './catalog-v2.entity-preset'
import { constantsLibraryEntityPreset } from './constants-library.entity-preset'
import { documentWorkspaceEntityPreset } from './document-workspace.entity-preset'

/**
 * Registry of all built-in template manifests.
 * Add new templates here — the platform migration seeder will process them.
 */
export const builtinTemplates: MetahubTemplateManifest[] = [basicTemplate, basicDemoTemplate]

export const builtinEntityTypePresets: EntityTypePresetManifest[] = [
    catalogV2EntityPreset,
    documentWorkspaceEntityPreset,
    constantsLibraryEntityPreset
]

export interface BuiltinTemplateDefinitionSeed {
    definitionType: TemplateDefinitionType
    manifest: TemplateDefinitionManifest
}

export const builtinTemplateDefinitions: BuiltinTemplateDefinitionSeed[] = [
    ...builtinTemplates.map((manifest) => ({ definitionType: 'metahub_template' as const, manifest })),
    ...builtinEntityTypePresets.map((manifest) => ({ definitionType: 'entity_type_preset' as const, manifest }))
]

/** Default template codename used when no template is explicitly chosen. */
export const DEFAULT_TEMPLATE_CODENAME = 'basic'
