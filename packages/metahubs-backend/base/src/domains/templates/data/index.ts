import type { EntityTypePresetManifest, MetahubTemplateManifest, TemplateDefinitionManifest, TemplateDefinitionType } from '@universo/types'
import { basicTemplate } from './basic.template'
import { basicDemoTemplate } from './basic-demo.template'
import { emptyTemplate } from './empty.template'
import { lmsTemplate } from './lms.template'
import { catalogEntityPreset } from './linked-collection.entity-preset'
import { fixedValuesLibraryEntityPreset } from './fixed-values-library.entity-preset'
import { enumerationEntityPreset } from './option-list.entity-preset'
import { pageEntityPreset } from './page.entity-preset'
import { hubEntityPreset } from './tree-entity.entity-preset'
import { setEntityPreset } from './value-group.entity-preset'

/**
 * Registry of all built-in template manifests.
 * Add new templates here — the platform migration seeder will process them.
 */
export const builtinTemplates: MetahubTemplateManifest[] = [basicTemplate, basicDemoTemplate, emptyTemplate, lmsTemplate]

export const builtinEntityTypePresets: EntityTypePresetManifest[] = [
    hubEntityPreset,
    catalogEntityPreset,
    pageEntityPreset,
    setEntityPreset,
    enumerationEntityPreset,
    fixedValuesLibraryEntityPreset
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
