import { basicTemplate } from '../../domains/templates/data/basic.template'
import { emptyTemplate } from '../../domains/templates/data/empty.template'
import { catalogEntityPreset } from '../../domains/templates/data/linked-collection.entity-preset'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { enumerationEntityPreset } from '../../domains/templates/data/option-list.entity-preset'
import { hubEntityPreset } from '../../domains/templates/data/tree-entity.entity-preset'
import { setEntityPreset } from '../../domains/templates/data/value-group.entity-preset'
import { validateEntityTypePresetManifest, validateTemplateManifest } from '../../domains/templates/services/TemplateManifestValidator'

const cloneTemplate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('TemplateManifestValidator', () => {
    it('accepts the built-in basic template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(basicTemplate))).not.toThrow()
    })

    it('accepts the built-in empty template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(emptyTemplate))).not.toThrow()
    })

    it('accepts the built-in lms template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(lmsTemplate))).not.toThrow()
    })

    it('accepts the built-in catalog entity preset', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(catalogEntityPreset))).not.toThrow()
    })

    it('accepts the built-in hub, set, and enumeration entity presets', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(hubEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(setEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(enumerationEntityPreset))).not.toThrow()
    })

    it('keeps standard resource surface definitions aligned with component capabilities', () => {
        const catalogManifest = cloneTemplate(catalogEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        expect(catalogManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'fieldDefinitions',
                capability: 'dataSchema',
                routeSegment: 'field-definitions',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Attributes'
            })
        ])
        expect(setManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'fixedValues',
                capability: 'fixedValues',
                routeSegment: 'fixed-values',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Constants'
            })
        ])
        expect(enumerationManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'optionValues',
                capability: 'optionValues',
                routeSegment: 'values',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Values'
            })
        ])
    })

    it('keeps the standard preset automation uplift enabled for hub, set, and enumeration entity presets', () => {
        const hubManifest = cloneTemplate(hubEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

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

    it('keeps the lms template aligned with curated navigation and canonical entities', () => {
        const manifest = cloneTemplate(lmsTemplate)
        const widgets = manifest.seed.layoutZoneWidgets.main ?? []
        const entityCodenames = manifest.seed.entities.map((entity) => entity.codename)
        const menuWidget = widgets.find((widget) => widget.widgetKey === 'menuWidget')

        expect(widgets.some((widget) => widget.widgetKey === 'moduleViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'statsViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'qrCodeWidget')).toBe(false)
        expect(menuWidget?.config).toEqual(
            expect.objectContaining({
                autoShowAllCatalogs: false,
                maxPrimaryItems: 6,
                overflowLabelKey: 'runtime.menu.more',
                startPage: 'Modules',
                workspacePlacement: 'primary'
            })
        )
        const menuItems = Array.isArray(menuWidget?.config?.items) ? menuWidget.config.items : []
        expect(menuItems).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'link', href: null })]))
        expect(menuItems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'lms-nav-catalog', kind: 'catalog', catalogId: 'Modules' }),
                expect.objectContaining({ id: 'lms-nav-knowledge', kind: 'catalog', catalogId: 'Quizzes' }),
                expect.objectContaining({ id: 'lms-nav-development', kind: 'catalog', catalogId: 'Classes' }),
                expect.objectContaining({ id: 'lms-nav-reports', kind: 'catalog', catalogId: 'ModuleProgress' })
            ])
        )
        expect(entityCodenames).toEqual(
            expect.arrayContaining([
                'Learning',
                'Classes',
                'Students',
                'Modules',
                'Quizzes',
                'QuizResponses',
                'ModuleProgress',
                'AccessLinks',
                'ModuleStatus',
                'QuestionType',
                'ContentType'
            ])
        )
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
        const manifest = cloneTemplate(catalogEntityPreset)
        manifest.entityType.components.events = { enabled: true }
        manifest.entityType.components.actions = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/actions/i)
    })

    it('accepts custom resource surface keys when the capability contract stays valid', () => {
        const manifest = cloneTemplate(catalogEntityPreset)
        manifest.entityType.ui.resourceSurfaces = [
            {
                key: 'attributes',
                capability: 'dataSchema',
                routeSegment: 'attributes',
                fallbackTitle: 'Attributes'
            }
        ]

        expect(() => validateEntityTypePresetManifest(manifest)).not.toThrow()
    })

    it('rejects resource surfaces that target disabled capabilities', () => {
        const manifest = cloneTemplate(catalogEntityPreset)
        manifest.entityType.components.dataSchema = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/requires the matching entity component/i)
    })

    it('rejects duplicate resource surface route segments in entity presets', () => {
        const manifest = cloneTemplate(catalogEntityPreset)
        manifest.entityType.components.optionValues = { enabled: true }
        manifest.entityType.ui.resourceSurfaces = [
            {
                key: 'attributes',
                capability: 'dataSchema',
                routeSegment: 'shared-tab',
                fallbackTitle: 'Attributes'
            },
            {
                key: 'values',
                capability: 'optionValues',
                routeSegment: 'shared-tab',
                fallbackTitle: 'Values'
            }
        ]

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/Duplicate resource surface routeSegment/i)
    })
})
