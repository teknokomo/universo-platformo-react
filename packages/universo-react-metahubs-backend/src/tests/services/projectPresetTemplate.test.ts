import {
    TEMPLATE_MANAGED_ENTITY_TYPE_CONFIG_KEY,
    isEnabledCapabilityConfig,
    validateCapabilityDependencies,
    type ResolvedEntityType
} from '@universo-react/types'
import { builtinEntityTypePresets, builtinTemplates } from '../../domains/templates/data'
import { projectEntityPreset } from '../../domains/templates/data/project.entity-preset'
import { playcanvasTemplate } from '../../domains/templates/data/playcanvas.template'
import { validateTemplateManifest, validateEntityTypePresetManifest } from '../../domains/templates/services/TemplateManifestValidator'
import { resolveEntityMetadataKindFromType } from '../../domains/shared/entityMetadataKinds'

describe('project preset and PlayCanvas template registration', () => {
    it('registers the project preset and PlayCanvas template in the builtin registries', () => {
        expect(builtinEntityTypePresets.some((preset) => preset.codename === 'project')).toBe(true)
        expect(builtinTemplates.some((template) => template.codename === 'playcanvas')).toBe(true)
    })

    it('places the Projects section above Hubs via sidebarOrder', () => {
        const projectUi = projectEntityPreset.entityType.ui
        expect(projectUi.sidebarSection).toBe('objects')
        // Hub uses sidebarOrder 10; Projects must be lower to render above it.
        expect(projectUi.sidebarOrder).toBeLessThan(10)
    })

    it('exposes a projectBinding resource surface bound to the projectBinding capability', () => {
        const surfaces = projectEntityPreset.entityType.ui.resourceSurfaces ?? []
        const bindingSurface = surfaces.find((surface) => surface.capability === 'projectBinding')
        expect(bindingSurface).toBeDefined()
        expect(bindingSurface?.routeSegment).toBe('project')
        expect(projectEntityPreset.entityType.capabilities.projectBinding).toMatchObject({
            enabled: true,
            provider: 'playcanvasEditor',
            cardinality: 'single'
        })
    })

    it('is a dedicated (non-object-like) kind: only treeAssignment + projectBinding, no Components/records/layout', () => {
        const capabilities = projectEntityPreset.entityType.capabilities

        // Dedicated external-authoring anchor — NOT object-like, so it has no
        // Components (dataSchema) / records / physical table / hierarchy.
        expect(isEnabledCapabilityConfig(capabilities.dataSchema)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.records)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.physicalTable)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.hierarchy)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.layoutConfig)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.modules)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.actions)).toBe(false)
        expect(isEnabledCapabilityConfig(capabilities.events)).toBe(false)
        // The two it DOES enable — Hubs assignment + the PlayCanvas binding.
        expect(isEnabledCapabilityConfig(capabilities.treeAssignment)).toBe(true)
        expect(isEnabledCapabilityConfig(capabilities.projectBinding)).toBe(true)

        // The capability set is dependency-consistent — i.e. exactly what a user
        // could configure through the Entity Type Constructor without errors.
        expect(validateCapabilityDependencies(capabilities)).toEqual([])

        // Being non-object-like, it does NOT map to the OBJECT metadata kind.
        const resolvedType: ResolvedEntityType = {
            kindKey: projectEntityPreset.entityType.kindKey,
            capabilities,
            ui: projectEntityPreset.entityType.ui,
            config: {
                [TEMPLATE_MANAGED_ENTITY_TYPE_CONFIG_KEY]: {
                    managed: true,
                    presetCodename: 'project',
                    source: 'entity_type_preset'
                }
            }
        }
        expect(resolveEntityMetadataKindFromType(resolvedType)).toBeNull()
    })

    it('passes manifest validation for the project preset and PlayCanvas template', () => {
        expect(() => validateEntityTypePresetManifest(projectEntityPreset)).not.toThrow()
        expect(() => validateTemplateManifest(playcanvasTemplate)).not.toThrow()
    })

    it('includes the project preset and base presets in the PlayCanvas template', () => {
        const presetCodenames = (playcanvasTemplate.presets ?? []).map((preset) => preset.presetCodename)
        expect(presetCodenames).toEqual(expect.arrayContaining(['project', 'hub', 'page', 'object', 'set', 'enumeration']))
        expect(presetCodenames[0]).toBe('project')
    })
})
