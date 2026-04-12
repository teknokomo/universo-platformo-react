import { basicTemplate } from '../../domains/templates/data/basic.template'
import { catalogV2EntityPreset } from '../../domains/templates/data/catalog-v2.entity-preset'
import { enumerationV2EntityPreset } from '../../domains/templates/data/enumeration-v2.entity-preset'
import { hubV2EntityPreset } from '../../domains/templates/data/hub-v2.entity-preset'
import { setV2EntityPreset } from '../../domains/templates/data/set-v2.entity-preset'
import { validateEntityTypePresetManifest, validateTemplateManifest } from '../../domains/templates/services/TemplateManifestValidator'

const cloneTemplate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('TemplateManifestValidator', () => {
    it('accepts the built-in basic template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(basicTemplate))).not.toThrow()
    })

    it('accepts the built-in catalog entity preset', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(catalogV2EntityPreset))).not.toThrow()
    })

    it('accepts the built-in hub, set, and enumeration entity presets', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(hubV2EntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(setV2EntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(enumerationV2EntityPreset))).not.toThrow()
    })

    it('keeps the V2 preset automation uplift enabled for hub, set, and enumeration entity presets', () => {
        const hubManifest = cloneTemplate(hubV2EntityPreset)
        const setManifest = cloneTemplate(setV2EntityPreset)
        const enumerationManifest = cloneTemplate(enumerationV2EntityPreset)

        expect(hubManifest.entityType.components.scripting).toEqual({ enabled: true })
        expect(hubManifest.entityType.components.actions).toEqual({ enabled: true })
        expect(hubManifest.entityType.components.events).toEqual({ enabled: true })

        expect(setManifest.entityType.components.scripting).toEqual({ enabled: true })
        expect(setManifest.entityType.components.actions).toEqual({ enabled: true })
        expect(setManifest.entityType.components.events).toEqual({ enabled: true })

        expect(enumerationManifest.entityType.components.scripting).toEqual({ enabled: true })
        expect(enumerationManifest.entityType.components.actions).toEqual({ enabled: true })
        expect(enumerationManifest.entityType.components.events).toEqual({ enabled: true })
    })

    it('keeps the basic template default widgets limited to app navbar, header, details title, and details table', () => {
        const manifest = cloneTemplate(basicTemplate)
        const widgets = manifest.seed.layoutZoneWidgets.main ?? []

        expect(widgets).toEqual([
            expect.objectContaining({ zone: 'left', widgetKey: 'menuWidget', sortOrder: 3 }),
            expect.objectContaining({ zone: 'top', widgetKey: 'appNavbar', sortOrder: 1 }),
            expect.objectContaining({ zone: 'top', widgetKey: 'header', sortOrder: 2 }),
            expect.objectContaining({ zone: 'center', widgetKey: 'detailsTitle', sortOrder: 5 }),
            expect.objectContaining({ zone: 'center', widgetKey: 'detailsTable', sortOrder: 6 })
        ])
        expect(widgets.some((widget) => widget.widgetKey === 'columnsContainer')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'productTree')).toBe(false)
    })

    it('rejects layoutZoneWidgets references to unknown layouts', () => {
        const manifest = cloneTemplate(basicTemplate)
        const firstWidgets = Object.values(manifest.seed.layoutZoneWidgets)[0] ?? []

        manifest.seed.layoutZoneWidgets.unknown_layout = firstWidgets

        expect(() => validateTemplateManifest(manifest)).toThrow(/unknown layout codename/i)
    })

    it('rejects ambiguous elements references when entity codename is duplicated across kinds', () => {
        const manifest = cloneTemplate(basicTemplate)
        manifest.seed.entities = [
            {
                codename: 'tags',
                kind: 'catalog',
                name: cloneTemplate(basicTemplate.name)
            }
        ]
        manifest.seed.elements = {
            tags: [{ codename: 'one', data: { label: 'One' }, sortOrder: 0 }]
        }
        const existingEntity = manifest.seed.entities[0]

        manifest.seed.entities.push({
            ...existingEntity,
            kind: existingEntity.kind === 'catalog' ? 'hub' : 'catalog'
        })

        expect(() => validateTemplateManifest(manifest)).toThrow(/ambiguous/i)
    })

    it('rejects entity presets with invalid component dependency combinations', () => {
        const manifest = cloneTemplate(catalogV2EntityPreset)
        manifest.entityType.components.events = { enabled: true }
        manifest.entityType.components.actions = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/actions/i)
    })
})
