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
import { builtinTemplates } from '../domains/templates/data'
import { resolveEntityRecordPolicy } from '@universo-react/types'

const findWidget = (widgets: Array<{ widgetKey: string }>, key: string) => widgets.find((w) => w.widgetKey === key)

describe('interpretation-network template shape', () => {
    it('keeps the built-in metahub template registry ordered', () => {
        expect(builtinTemplates.map((template) => template.codename)).toEqual([
            'basic',
            'basic-demo',
            'empty',
            'lms',
            '1c-compatible',
            'playcanvas',
            'interpretation-network',
            'marketing-page'
        ])
    })

    it('declares a single default main layout with templateKey dashboard', () => {
        const layouts = interpretationNetworkTemplate.seed.layouts ?? []
        const main = layouts.find((layout) => layout.codename === 'main')
        expect(main).toBeDefined()
        expect(main?.templateKey).toBe('dashboard')
        expect(main?.isDefault).toBe(true)
        expect(main?.isActive).toBe(true)
    })

    it('keeps the global shell on Start and scopes the interpretation workspace to Structures', () => {
        const globalWidgets = interpretationNetworkTemplate.seed.layoutZoneWidgets?.main ?? []
        const structureWidgets = interpretationNetworkTemplate.seed.layoutZoneWidgets?.structures ?? []

        const top = globalWidgets.filter((w) => w.zone === 'top')
        const left = globalWidgets.filter((w) => w.zone === 'left')
        const workspace = findWidget(structureWidgets, 'interpretationNetworkWorkspace') as
            | {
                  rendererConfig?: {
                      conceptCodename?: string
                      interpretationCodename?: string
                      interpretationTitleField?: string
                      materialTitleField?: string
                      tableTemplateCodename?: string
                      tableProjection?: string
                      structureMode?: string
                      templatePanel?: {
                          showInStructureList?: boolean
                          showInMatrix?: boolean
                      }
                      breadcrumbDepth?: { mode?: string }
                      toolbarLayout?: string
                      showHierarchicalTableHeaders?: boolean
                      showHierarchicalTableHeaderCard?: boolean
                      showMatrixTreeTotalCells?: boolean
                      colorBreadcrumbsByCell?: boolean
                      splitPane?: { enabled?: boolean }
                  }
              }
            | undefined

        expect(
            top.map(({ widgetKey, instanceKey, parentInstanceKey, slotKey }) => ({
                widgetKey,
                instanceKey,
                parentInstanceKey,
                slotKey
            }))
        ).toEqual([
            {
                widgetKey: 'appNavbar',
                instanceKey: 'application-navbar',
                parentInstanceKey: null,
                slotKey: null
            },
            {
                widgetKey: 'header',
                instanceKey: 'application-header',
                parentInstanceKey: null,
                slotKey: null
            },
            {
                widgetKey: 'languageSwitcher',
                instanceKey: 'language-switcher',
                parentInstanceKey: null,
                slotKey: null
            },
            {
                widgetKey: 'colorModeSwitcher',
                instanceKey: 'color-mode-switcher',
                parentInstanceKey: null,
                slotKey: null
            }
        ])
        expect(findWidget(left, 'menuWidget')).toBeDefined()
        expect(findWidget(left, 'workspaceSwitcher')).toBeDefined()
        expect(globalWidgets.filter(({ zone }) => zone === 'center')).toEqual([])
        expect(structureWidgets).toHaveLength(1)
        expect(structureWidgets[0]).toMatchObject({ zone: 'center', isActive: true })
        expect(interpretationNetworkTemplate.seed.scopedLayouts).toEqual([
            expect.objectContaining({
                codename: 'structures',
                templateKey: 'dashboard',
                baseLayoutCodename: 'main',
                scopeEntityCodename: 'Structure',
                scopeEntityKind: 'object',
                isDefault: true,
                isActive: true
            })
        ])
        expect(workspace?.rendererConfig).toMatchObject({
            matrixMode: 'hierarchicalCells',
            structureMode: 'multiple',
            templatePanel: {
                showInStructureList: true,
                showInMatrix: true
            },
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true,
            splitPane: { enabled: true },
            allowNewAxesInCellDialog: false,
            positionNumbering: {
                enabled: true,
                includeRoot: true,
                startIndex: 1
            },
            conceptCodename: 'Structure',
            interpretationCodename: 'Interpretation',
            interpretationTitleField: 'Title',
            materialTitleField: 'Title',
            tableTemplateCodename: 'TableTemplate',
            conceptNameField: 'Name',
            conceptDescriptionField: 'Description',
            interpretationParentField: 'ParentStructure'
        })
        expect(workspace?.rendererConfig).not.toHaveProperty('visibleFor')
        const menu = findWidget(left, 'menuWidget') as { rendererConfig?: { variant?: string } } | undefined
        expect(menu?.rendererConfig).toEqual({ variant: 'generated' })
    })

    it('stores Dashboard chrome as explicit placements instead of legacy layout flags', () => {
        const main = interpretationNetworkTemplate.seed.layouts?.find((layout) => layout.codename === 'main')
        expect(main?.config).toBeUndefined()
    })

    it('includes the base Set preset by default', () => {
        const setPreset = interpretationNetworkTemplate.presets.find((preset) => preset.presetCodename === 'set')
        expect(setPreset?.includedByDefault).toBe(true)
    })

    it('keeps the specialized Start page without the generic Page preset instance', () => {
        const pagePreset = interpretationNetworkTemplate.presets.find((preset) => preset.presetCodename === 'page')
        const startPage = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((entity) => entity.codename === 'InterpretationNetworkIntro')

        expect(pagePreset?.includedByDefault).toBe(false)
        expect(INTERPRETATION_NETWORK_STAGE2.seedEntities.some((entity) => entity.codename === 'WelcomePage')).toBe(false)
        expect(startPage).toMatchObject({
            kind: 'page',
            name: {
                locales: {
                    en: { content: 'Start' },
                    ru: { content: 'Начало' }
                }
            }
        })
    })

    it('activates the Interpretation Network entity definitions in the template seed', () => {
        expect(interpretationNetworkTemplate.seed.entities).toBe(INTERPRETATION_NETWORK_STAGE2.seedEntities)
        const codenames = (interpretationNetworkTemplate.seed.entities ?? []).map((e) => e.codename).sort()
        expect(codenames).toEqual([
            'Context',
            'Favorite',
            'Interpretation',
            'InterpretationNetworkIntro',
            'Material',
            'Relation',
            'RelationType',
            'Structure',
            'TableTemplate'
        ])
    })

    it('does not preserve a CellColor enumeration or legacy colour picker metadata', () => {
        expect(interpretationNetworkTemplate.seed.optionValues?.CellColor).toBeUndefined()
        expect(JSON.stringify(interpretationNetworkTemplate)).not.toContain('cellStylePicker')
        expect(JSON.stringify(interpretationNetworkTemplate)).not.toContain('CellColor')
    })

    it('does not seed user-authored runtime rows into the product fixture path', () => {
        expect(interpretationNetworkTemplate.seed.elements).toBeUndefined()
    })

    it('Structure carries a hidden server-owned SystemKey for single-system runtime mode', () => {
        const structure = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Structure')
        const systemKey = structure?.components?.find((c) => c.codename === 'SystemKey')
        expect(systemKey?.dataType).toBe('STRING')
        expect(systemKey?.validationRules).toMatchObject({ maxLength: 64 })
        expect(systemKey?.uiConfig).toMatchObject({
            hidden: true,
            gridHidden: true,
            formHidden: true,
            serverOwned: true
        })
    })

    it('TableTemplate is a workspace-authored Object with a TABLE TemplateMatrix', () => {
        const tableTemplate = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'TableTemplate')
        expect(tableTemplate?.kind).toBe('object')
        expect(tableTemplate?.config).toEqual(expect.objectContaining({ recordBehavior: 'reference' }))
        expect(tableTemplate?.components?.find((c) => c.codename === 'Name')?.isDisplayComponent).toBe(true)
        expect(tableTemplate?.components?.find((c) => c.codename === 'MaterialPolicy')?.uiConfig).toMatchObject({
            hidden: true,
            gridHidden: true,
            formHidden: true,
            serverOwned: true
        })
        const matrix = tableTemplate?.components?.find((c) => c.codename === 'TemplateMatrix')
        expect(matrix?.dataType).toBe('TABLE')
        expect(matrix?.childComponents?.map((c) => c.codename)).toEqual(
            expect.arrayContaining(['CellId', 'ParentCellId', 'RowLabel', 'ColLabel', 'CellValue', 'CellFillColor', 'MaterialRef'])
        )
        expect(Number(matrix?.validationRules?.maxChildComponents ?? 0)).toBe(matrix?.childComponents?.length ?? 0)
    })

    it('Favorite is a hidden owner-only entity excluded from generic writes and Workspace copy', () => {
        const favorite = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((entity) => entity.codename === 'Favorite')
        expect(favorite).toMatchObject({ kind: 'object', hubs: [] })
        expect(favorite?.name).toMatchObject({
            locales: {
                en: { content: 'Favorites' },
                ru: { content: 'Избранное' }
            }
        })
        expect(favorite?.config).toMatchObject({
            recordBehavior: 'reference',
            runtimeRecordAccess: { mode: 'ownerOnly', ownerFieldCodename: 'OwnerUserId' },
            recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' },
            runtime: { menuVisibility: 'hidden' }
        })
        expect(favorite?.components?.map((component) => component.codename)).toEqual([
            'OwnerUserId',
            'TargetInterpretationId',
            'TargetCellId'
        ])
        for (const component of favorite?.components ?? []) {
            expect(component).toMatchObject({
                dataType: 'STRING',
                uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
            })
        }
        expect(() => resolveEntityRecordPolicy(favorite?.config)).not.toThrow()
    })

    it('Material is hidden from generic navigation and writes use the dedicated Interpretation Network aggregate', () => {
        const material = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((entity) => entity.codename === 'Material')
        expect(material?.config).toMatchObject({
            recordBehavior: 'reference',
            recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' },
            runtime: { menuVisibility: 'hidden' }
        })
        expect(material?.components?.map((component) => component.codename)).toEqual(
            expect.arrayContaining(['Title', 'Description', 'Body', 'CellId', 'TemplateOwnerId'])
        )
        expect(material?.components?.find((component) => component.codename === 'CellId')?.uiConfig).toMatchObject({ serverOwned: true })
        expect(material?.components?.find((component) => component.codename === 'TemplateOwnerId')?.uiConfig).toMatchObject({
            serverOwned: true
        })
        expect(() => resolveEntityRecordPolicy(material?.config)).not.toThrow()
    })

    it('validates each protected Interpretation Network Object policy against the shared strict schema', () => {
        for (const entity of INTERPRETATION_NETWORK_STAGE2.seedEntities.filter((candidate) => candidate.kind === 'object')) {
            if (entity.config && Object.prototype.hasOwnProperty.call(entity.config, 'recordPolicy')) {
                expect(() => resolveEntityRecordPolicy(entity.config)).not.toThrow()
            }
        }
    })

    it('includes a localized intro Page with Editor.js-compatible block content', () => {
        const intro = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'InterpretationNetworkIntro')
        const blockContent = intro?.config?.blockContent as { format?: string; blocks?: unknown[] } | undefined
        expect(intro?.kind).toBe('page')
        expect(blockContent?.format).toBe('editorjs')
        expect(blockContent?.blocks).toHaveLength(1)
        expect((blockContent?.blocks?.[0] as { type?: string } | undefined)?.type).toBe('paragraph')
        expect(JSON.stringify(blockContent)).toContain('helps build a hierarchy of structures')
        expect(JSON.stringify(blockContent)).toContain('помогает создавать иерархию структур')
        expect(JSON.stringify(blockContent)).not.toContain('interpretationNetwork-intro-title')
        expect(JSON.stringify(blockContent)).not.toMatch(/"text":"(?:Interpretation Network|Трактовочная сеть)"/u)
        expect(JSON.stringify(blockContent)).not.toMatch(/workspace below|рабочей области ниже/iu)
        expect(JSON.stringify(blockContent)).not.toContain('Open Structures')
    })

    it('seeds bilingual top-level Start and Structures navigation', () => {
        const entities = INTERPRETATION_NETWORK_STAGE2.seedEntities
        const startPage = entities.find((entity) => entity.codename === 'InterpretationNetworkIntro')
        const structures = entities.find((entity) => entity.codename === 'Structure')

        expect(startPage).toMatchObject({
            kind: 'page',
            name: { locales: { en: { content: 'Start' }, ru: { content: 'Начало' } } },
            hubs: [],
            config: { runtime: { menuVisibility: 'primary', routeSegment: 'home', icon: 'home' } }
        })
        expect(structures).toMatchObject({
            kind: 'object',
            name: { locales: { en: { content: 'Structures' }, ru: { content: 'Структуры' } } },
            hubs: [],
            config: { runtime: { menuVisibility: 'primary', icon: 'object' } }
        })
        const menu = interpretationNetworkTemplate.seed.layoutZoneWidgets?.main?.find((widget) => widget.widgetKey === 'menuWidget')
        expect(menu?.rendererConfig).toEqual({ variant: 'generated' })
    })

    it('Material remains a read-capable Object with an Editor.js Body component', () => {
        const material = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Material')
        expect(material?.kind).toBe('object')
        expect(material?.config).toEqual(expect.objectContaining({ recordBehavior: 'reference' }))
        const title = material?.components?.find((c) => c.codename === 'Title')
        const body = material?.components?.find((c) => c.codename === 'Body')
        const templateOwnerId = material?.components?.find((c) => c.codename === 'TemplateOwnerId')
        expect(title?.isDisplayComponent).toBe(true)
        expect(title?.validationRules).toMatchObject({ localized: true, versioned: true })
        expect(body?.dataType).toBe('JSON')
        expect(body?.uiConfig).toMatchObject({ widget: 'editorjsBlockContent', gridHidden: true })
        expect(templateOwnerId).toMatchObject({
            dataType: 'STRING',
            validationRules: { maxLength: 64 },
            uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
        })
    })

    it('Interpretation entity specifies the TABLE InterpretationMatrix with 23 child components', () => {
        const interp = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Interpretation')
        expect(interp).toBeDefined()
        const matrix = interp?.components?.find((c) => c.codename === 'InterpretationMatrix')
        expect(matrix?.dataType).toBe('TABLE')
        expect(matrix?.childComponents?.length).toBe(23)
        expect(Number(matrix?.validationRules?.maxChildComponents ?? 0)).toBe(matrix?.childComponents?.length ?? 0)
        const codenames = matrix?.childComponents?.map((c) => c.codename) ?? []
        expect(codenames).toContain('CellId')
        expect(codenames).toContain('ParentCellId')
        expect(codenames).toContain('CellDescription')
        expect(codenames).toContain('CellFillColor')
        expect(codenames).toContain('TextColor')
        expect(codenames).toContain('MaterialRef')
        expect(matrix?.childComponents?.find((c) => c.codename === 'MaterialRef')).toMatchObject({
            targetEntityCodename: 'Material',
            targetEntityKind: 'object',
            uiConfig: { serverOwned: true }
        })
        for (const codename of [
            'CellFillColor',
            'TextColor',
            'BorderTopColor',
            'BorderRightColor',
            'BorderBottomColor',
            'BorderLeftColor'
        ]) {
            expect(matrix?.childComponents?.find((c) => c.codename === codename)).toMatchObject({
                dataType: 'STRING',
                validationRules: {
                    format: 'hexColor',
                    maxLength: 7,
                    pattern: '^#[0-9A-F]{6}$'
                }
            })
        }
        expect(matrix?.childComponents?.find((c) => c.codename === 'CellValue')?.uiConfig).toMatchObject({
            widget: 'textarea',
            cellStylePreview: {
                fillColorField: 'CellFillColor',
                textColorField: 'TextColor',
                borderTopColorField: 'BorderTopColor',
                borderTopWidthField: 'BorderTopWidth',
                borderTopStyleField: 'BorderTopStyle'
            }
        })
        expect(matrix?.childComponents?.find((c) => c.codename === 'BorderTopWidth')?.uiConfig).toMatchObject({
            interpretationNetworkStyleRole: 'borderTopWidth'
        })
    })

    it('marks localized runtime string values as JSONB-backed VLC fields', () => {
        const structure = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Structure')
        const interpretation = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Interpretation')
        const relation = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Relation')
        const material = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((e) => e.codename === 'Material')
        const matrix = interpretation?.components?.find((c) => c.codename === 'InterpretationMatrix')

        expect(structure?.components?.map((c) => c.codename)).toEqual(['Name', 'Description', 'SystemKey'])
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
        expect(structure?.components?.find((c) => c.codename === 'SystemKey')).toMatchObject({
            dataType: 'STRING',
            validationRules: { maxLength: 64 },
            uiConfig: {
                hidden: true,
                gridHidden: true,
                formHidden: true,
                serverOwned: true
            }
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
        for (const codename of ['CellId', 'ParentCellId', 'ColKey', 'RowKey']) {
            expect(matrix?.childComponents?.find((c) => c.codename === codename)?.uiConfig).toMatchObject({
                hidden: true,
                gridHidden: true,
                formHidden: true
            })
        }
    })

    it('scopes each Material attachment to its owning Interpretation while keeping template provenance separate', () => {
        const material = INTERPRETATION_NETWORK_STAGE2.seedEntities.find((entity) => entity.codename === 'Material')
        const interpretationId = material?.components?.find((component) => component.codename === 'InterpretationId')
        const templateOwnerId = material?.components?.find((component) => component.codename === 'TemplateOwnerId')

        expect(interpretationId).toMatchObject({
            dataType: 'STRING',
            validationRules: { maxLength: 36 },
            uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
        })
        expect(templateOwnerId?.uiConfig).toMatchObject({
            hidden: true,
            gridHidden: true,
            formHidden: true,
            serverOwned: true
        })
    })
})
