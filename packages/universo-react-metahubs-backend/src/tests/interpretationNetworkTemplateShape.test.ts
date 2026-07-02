// Interpretation Network seed shape test.
//
// The `interpretation-network` metahub template ships the intro Page, two-pane
// dashboard layout, base presets, and interpretation-network definitions.
// User-authored runtime rows are intentionally empty in the product seed.
//
// Lives in the metahubs-backend package because the interpretation-network template
// is owned by this package — placing the test here avoids pulling
// backend source into apps-template-mui (which would trip the
// apps-template-isolation guard).

import { interpretationNetworkTemplate } from '../domains/templates/data/interpretation-network.template'
import { INTERPRETATION_NETWORK_STAGE2 } from '../domains/templates/data/interpretation-network.stage2'

const findWidget = (widgets: Array<{ widgetKey: string }>, key: string) => widgets.find((w) => w.widgetKey === key)

describe('interpretation-network template shape', () => {
    it('declares a single default main layout with templateKey dashboard', () => {
        const layouts = interpretationNetworkTemplate.seed.layouts ?? []
        const main = layouts.find((layout) => layout.codename === 'main')
        expect(main).toBeDefined()
        expect(main?.templateKey).toBe('dashboard')
        expect(main?.isDefault).toBe(true)
        expect(main?.isActive).toBe(true)
    })

    it('seeds the main layout with the interpretation workspace widget and no generic dashboard clutter', () => {
        const widgets = interpretationNetworkTemplate.seed.layoutZoneWidgets?.main ?? []

        const top = widgets.filter((w) => w.zone === 'top')
        const left = widgets.filter((w) => w.zone === 'left')
        const center = widgets.filter((w) => w.zone === 'center')
        const workspace = findWidget(center, 'interpretationNetworkWorkspace') as
            | { config?: { conceptCodename?: string; interpretationCodename?: string; tableTemplateCodename?: string } }
            | undefined

        expect(top).toEqual([])
        expect(findWidget(left, 'menuWidget')).toBeDefined()
        expect(findWidget(left, 'workspaceSwitcher')).toBeDefined()
        expect(workspace?.config).toMatchObject({
            conceptCodename: 'Structure',
            interpretationCodename: 'Interpretation',
            tableTemplateCodename: 'TableTemplate',
            conceptNameField: 'Name',
            conceptDescriptionField: 'Description',
            interpretationParentField: 'ParentStructure'
        })
        const menu = findWidget(left, 'menuWidget') as { config?: { startPage?: string; items?: Array<{ id?: string }> } } | undefined
        expect(menu?.config?.startPage).toBe('InterpretationNetworkIntro')
        expect(menu?.config?.items?.map((item) => item.id)).toEqual([
            'interpretationNetwork-nav-intro',
            'interpretationNetwork-nav-structures'
        ])
    })

    it('the main layout disables default overview, header, details table, and footer chrome', () => {
        const main = interpretationNetworkTemplate.seed.layouts?.find((layout) => layout.codename === 'main')
        expect(main?.config).toMatchObject({
            showOverviewTitle: false,
            showOverviewCards: false,
            showSessionsChart: false,
            showPageViewsChart: false,
            showDetailsTitle: false,
            showDetailsTable: false,
            showColumnsContainer: false,
            showHeader: false,
            showFooter: false
        })
    })

    it('includes the base Set preset by default', () => {
        const setPreset = interpretationNetworkTemplate.presets.find((preset) => preset.presetCodename === 'set')
        expect(setPreset?.includedByDefault).toBe(true)
    })

    it('activates the Interpretation Network entity definitions in the template seed', () => {
        expect(interpretationNetworkTemplate.seed.entities).toBe(INTERPRETATION_NETWORK_STAGE2.seedEntities)
        const codenames = (interpretationNetworkTemplate.seed.entities ?? []).map((e) => e.codename).sort()
        expect(codenames).toEqual([
            'CellColor',
            'Context',
            'Interpretation',
            'InterpretationNetworkIntro',
            'Material',
            'Relation',
            'RelationType',
            'Structure',
            'TableTemplate'
        ])
    })

    it('specifies all twelve CellColor values in the active template seed', () => {
        const codenames = interpretationNetworkTemplate.seed.optionValues?.CellColor?.map((v) => v.codename).sort()
        expect(codenames).toEqual(['black', 'blue', 'gray', 'green', 'indigo', 'none', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow'])
    })

    it('does not seed user-authored runtime rows into the product fixture path', () => {
        expect(interpretationNetworkTemplate.seed.elements).toBeUndefined()
    })

    it('TableTemplate is a workspace-authored Object with a TABLE TemplateMatrix', () => {
        const tableTemplate = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'TableTemplate')
        expect(tableTemplate?.kind).toBe('object')
        expect(tableTemplate?.config).toEqual(expect.objectContaining({ recordBehavior: 'reference' }))
        expect(tableTemplate?.components?.find((c) => c.codename === 'Name')?.isDisplayComponent).toBe(true)
        const matrix = tableTemplate?.components?.find((c) => c.codename === 'TemplateMatrix')
        expect(matrix?.dataType).toBe('TABLE')
        expect(matrix?.childComponents?.map((c) => c.codename)).toEqual(
            expect.arrayContaining(['CellId', 'RowLabel', 'ColLabel', 'CellValue', 'CellFillColor', 'MaterialRef'])
        )
        expect(Number(matrix?.validationRules?.maxChildComponents ?? 0)).toBe(matrix?.childComponents?.length ?? 0)
    })

    it('includes a localized intro Page with Editor.js-compatible block content', () => {
        const intro = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'InterpretationNetworkIntro')
        const blockContent = intro?.config?.blockContent as { format?: string; blocks?: unknown[] } | undefined
        expect(intro?.kind).toBe('page')
        expect(blockContent?.format).toBe('editorjs')
        expect(blockContent?.blocks?.length).toBeGreaterThanOrEqual(2)
        expect(JSON.stringify(blockContent)).toContain('Interpretation Network')
        expect(JSON.stringify(blockContent)).toContain('Трактовочная сеть')
    })

    it('Material is a record-capable Object with an Editor.js Body component', () => {
        const material = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Material')
        expect(material?.kind).toBe('object')
        expect(material?.config).toEqual(expect.objectContaining({ recordBehavior: 'reference' }))
        const title = material?.components?.find((c) => c.codename === 'Title')
        const body = material?.components?.find((c) => c.codename === 'Body')
        expect(title?.isDisplayComponent).toBe(true)
        expect(title?.validationRules).toMatchObject({ localized: true, versioned: true })
        expect(body?.dataType).toBe('JSON')
        expect(body?.uiConfig).toMatchObject({ widget: 'editorjsBlockContent', gridHidden: true })
    })

    it('Interpretation entity specifies the TABLE InterpretationMatrix with 21 child components', () => {
        const interp = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Interpretation')
        expect(interp).toBeDefined()
        const matrix = interp?.components?.find((c) => c.codename === 'InterpretationMatrix')
        expect(matrix?.dataType).toBe('TABLE')
        expect(matrix?.childComponents?.length).toBe(21)
        expect(Number(matrix?.validationRules?.maxChildComponents ?? 0)).toBe(matrix?.childComponents?.length ?? 0)
        const codenames = matrix?.childComponents?.map((c) => c.codename) ?? []
        expect(codenames).toContain('CellId')
        expect(codenames).toContain('CellDescription')
        expect(codenames).toContain('CellFillColor')
        expect(codenames).toContain('MaterialRef')
        expect(matrix?.childComponents?.find((c) => c.codename === 'MaterialRef')).toMatchObject({
            targetEntityCodename: 'Material',
            targetEntityKind: 'object'
        })
        expect(matrix?.childComponents?.find((c) => c.codename === 'CellFillColor')?.uiConfig).toMatchObject({
            widget: 'cellStylePicker',
            cellStyleFor: 'fill'
        })
        expect(matrix?.childComponents?.find((c) => c.codename === 'CellValue')?.uiConfig).toMatchObject({
            widget: 'textarea',
            cellStylePreview: {
                fillColorField: 'CellFillColor',
                borderTopColorField: 'BorderTopColor',
                borderTopWidthField: 'BorderTopWidth',
                borderTopStyleField: 'BorderTopStyle'
            }
        })
        expect(matrix?.childComponents?.find((c) => c.codename === 'BorderTopWidth')?.uiConfig).toMatchObject({
            widget: 'cellStylePicker',
            cellStyleFor: 'top'
        })
    })

    it('marks localized runtime string values as JSONB-backed VLC fields', () => {
        const structure = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Structure')
        const interpretation = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Interpretation')
        const relation = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Relation')
        const material = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Material')
        const matrix = interpretation?.components?.find((c) => c.codename === 'InterpretationMatrix')

        expect(structure?.components?.map((c) => c.codename)).toEqual(['Name', 'Description'])
        expect(structure?.components?.find((c) => c.codename === 'Name')).toMatchObject({
            name: expect.objectContaining({
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'Name' }),
                    ru: expect.objectContaining({ content: 'Название' })
                })
            }),
            isDisplayComponent: true
        })
        expect(structure?.components?.find((c) => c.codename === 'Name')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        expect(structure?.components?.find((c) => c.codename === 'Description')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        expect(structure?.components?.find((c) => c.codename === 'Context')).toBeUndefined()
        expect(interpretation?.components?.find((c) => c.codename === 'Title')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        expect(interpretation?.components?.find((c) => c.codename === 'ParentStructure')).toMatchObject({
            targetEntityCodename: 'Structure',
            targetEntityKind: 'object'
        })
        expect(relation?.components?.find((c) => c.codename === 'Description')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        expect(relation?.components?.find((c) => c.codename === 'SourceLabel')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        expect(relation?.components?.find((c) => c.codename === 'TargetLabel')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        expect(material?.components?.find((c) => c.codename === 'Title')?.validationRules).toMatchObject({
            localized: true,
            versioned: true
        })
        for (const codename of ['SourceKind', 'SourceId', 'TargetKind', 'TargetId']) {
            expect(relation?.components?.find((c) => c.codename === codename)?.uiConfig).toMatchObject({
                hidden: true,
                gridHidden: true,
                formHidden: true
            })
        }
        for (const codename of ['ColLabel', 'RowLabel', 'CellValue']) {
            expect(matrix?.childComponents?.find((c) => c.codename === codename)?.validationRules).toMatchObject({
                localized: true,
                versioned: true
            })
        }
        for (const codename of ['CellId', 'ColKey', 'RowKey']) {
            expect(matrix?.childComponents?.find((c) => c.codename === codename)?.uiConfig).toMatchObject({
                hidden: true,
                gridHidden: true,
                formHidden: true
            })
        }
    })
})
