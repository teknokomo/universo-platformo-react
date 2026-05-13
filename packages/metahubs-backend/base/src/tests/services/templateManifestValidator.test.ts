import { basicTemplate } from '../../domains/templates/data/basic.template'
import { basicDemoTemplate } from '../../domains/templates/data/basic-demo.template'
import { emptyTemplate } from '../../domains/templates/data/empty.template'
import { catalogEntityPreset } from '../../domains/templates/data/linked-collection.entity-preset'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { enumerationEntityPreset } from '../../domains/templates/data/option-list.entity-preset'
import { pageEntityPreset } from '../../domains/templates/data/page.entity-preset'
import { ledgerEntityPreset } from '../../domains/templates/data/ledger.entity-preset'
import { hubEntityPreset } from '../../domains/templates/data/tree-entity.entity-preset'
import { setEntityPreset } from '../../domains/templates/data/value-group.entity-preset'
import { parseApplicationLayoutWidgetConfig } from '@universo/types'
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

    it('preserves record behavior component flags in the built-in catalog entity preset', () => {
        const validated = validateEntityTypePresetManifest(cloneTemplate(catalogEntityPreset))

        expect(validated.entityType.ui.tabs).toContain('behavior')
        expect(validated.entityType.components.identityFields).toEqual({
            enabled: true,
            allowNumber: true,
            allowEffectiveDate: true
        })
        expect(validated.entityType.components.recordLifecycle).toEqual({
            enabled: true,
            allowCustomStates: true
        })
        expect(validated.entityType.components.posting).toEqual({
            enabled: true,
            allowManualPosting: true,
            allowAutomaticPosting: true
        })
    })

    it('accepts the built-in hub, set, and enumeration entity presets', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(hubEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(pageEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(setEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(enumerationEntityPreset))).not.toThrow()
    })

    it('keeps standard metadata menu order and excludes optional ledgers from default starter templates', () => {
        const orderedKinds = [
            hubEntityPreset,
            pageEntityPreset,
            catalogEntityPreset,
            setEntityPreset,
            enumerationEntityPreset,
            ledgerEntityPreset
        ]
            .map((preset) => ({
                kindKey: preset.entityType.kindKey,
                sidebarOrder: preset.entityType.ui.sidebarOrder
            }))
            .sort((left, right) => Number(left.sidebarOrder ?? 0) - Number(right.sidebarOrder ?? 0))
            .map((item) => item.kindKey)

        expect(orderedKinds).toEqual(['hub', 'page', 'catalog', 'set', 'enumeration', 'ledger'])
        expect(basicTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'catalog', 'set', 'enumeration'])
        expect(basicDemoTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'catalog', 'set', 'enumeration'])
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
        const homeWidgets = manifest.seed.layoutZoneWidgets.learnerHome ?? []
        const entityCodenames = manifest.seed.entities.map((entity) => entity.codename)
        const entityByCodename = new Map(manifest.seed.entities.map((entity) => [entity.codename, entity]))
        const menuWidget = widgets.find((widget) => widget.widgetKey === 'menuWidget')

        expect(widgets.some((widget) => widget.widgetKey === 'moduleViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'statsViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'qrCodeWidget')).toBe(false)
        expect(manifest.seed.scopedLayouts).toEqual([
            expect.objectContaining({
                codename: 'learnerHome',
                scopeEntityCodename: 'LearnerHome',
                scopeEntityKind: 'page',
                baseLayoutCodename: 'main'
            })
        ])
        expect(widgets).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ zone: 'center', widgetKey: 'overviewCards' }),
                expect.objectContaining({ zone: 'center', widgetKey: 'sessionsChart' }),
                expect.objectContaining({ zone: 'center', widgetKey: 'pageViewsChart' }),
                expect.objectContaining({ zone: 'center', widgetKey: 'columnsContainer' })
            ])
        )
        expect(homeWidgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ zone: 'center', widgetKey: 'overviewCards' }),
                expect.objectContaining({ zone: 'center', widgetKey: 'sessionsChart' }),
                expect.objectContaining({ zone: 'center', widgetKey: 'pageViewsChart' })
            ])
        )
        expect(homeWidgets.some((widget) => widget.widgetKey === 'columnsContainer')).toBe(false)
        for (const widget of homeWidgets.filter((item) => ['overviewCards', 'sessionsChart', 'pageViewsChart'].includes(item.widgetKey))) {
            expect(() => parseApplicationLayoutWidgetConfig(widget.widgetKey, widget.config ?? {})).not.toThrow()
        }
        expect(menuWidget?.config).toMatchObject(
            expect.objectContaining({
                autoShowAllSections: false,
                maxPrimaryItems: 6,
                overflowLabelKey: 'runtime.menu.more',
                startPage: 'LearnerHome',
                workspacePlacement: 'primary'
            })
        )
        const menuItems = Array.isArray(menuWidget?.config?.items) ? menuWidget.config.items : []
        expect(menuItems).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'link', href: null })]))
        expect(menuItems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'lms-nav-home', kind: 'section', sectionId: 'LearnerHome' }),
                expect.objectContaining({ id: 'lms-nav-catalog', kind: 'section', sectionId: 'Modules' }),
                expect.objectContaining({ id: 'lms-nav-knowledge', kind: 'section', sectionId: 'Quizzes' }),
                expect.objectContaining({ id: 'lms-nav-development', kind: 'section', sectionId: 'Classes' }),
                expect.objectContaining({ id: 'lms-nav-reports', kind: 'section', sectionId: 'Reports' })
            ])
        )
        expect(entityCodenames).toEqual(
            expect.arrayContaining([
                'Learning',
                'LmsConfiguration',
                'LearnerHome',
                'CourseOverview',
                'KnowledgeArticle',
                'AssignmentInstructions',
                'CertificatePolicy',
                'Classes',
                'Students',
                'Modules',
                'Quizzes',
                'QuizResponses',
                'QuizAttempts',
                'LearningActivityLedger',
                'ProgressLedger',
                'ScoreLedger',
                'EnrollmentLedger',
                'AttendanceLedger',
                'CertificateLedger',
                'PointsLedger',
                'NotificationLedger',
                'ModuleProgress',
                'AccessLinks',
                'AssignmentSubmissions',
                'TrainingAttendance',
                'CertificateIssues',
                'ModuleStatus',
                'QuestionType',
                'ContentType'
            ])
        )
        expect(manifest.presets).toEqual([
            { presetCodename: 'hub', includedByDefault: true },
            { presetCodename: 'page', includedByDefault: false },
            { presetCodename: 'catalog', includedByDefault: true },
            { presetCodename: 'set', includedByDefault: true },
            { presetCodename: 'enumeration', includedByDefault: true }
        ])
        for (const codename of [
            'QuizResponses',
            'QuizAttempts',
            'ModuleProgress',
            'Assignments',
            'AssignmentSubmissions',
            'TrainingEvents',
            'TrainingAttendance',
            'Certificates',
            'CertificateIssues',
            'Enrollments'
        ]) {
            expect(entityByCodename.get(codename)?.config?.recordBehavior).toEqual(
                expect.objectContaining({
                    mode: 'transactional',
                    numbering: expect.objectContaining({ enabled: true }),
                    posting: expect.objectContaining({ mode: 'manual' })
                })
            )
        }
        expect(manifest.seed.scripts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'AutoEnrollmentRuleScript',
                    attachedToKind: 'catalog',
                    attachedToEntityCodename: 'Students',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['records.read', 'records.write', 'lifecycle'])
                }),
                expect.objectContaining({
                    codename: 'EnrollmentPostingScript',
                    attachedToKind: 'catalog',
                    attachedToEntityCodename: 'Enrollments',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'QuizAttemptPostingScript',
                    attachedToKind: 'catalog',
                    attachedToEntityCodename: 'QuizAttempts',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'ModuleCompletionPostingScript',
                    attachedToKind: 'catalog',
                    attachedToEntityCodename: 'ModuleProgress',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'CertificateIssuePostingScript',
                    attachedToKind: 'catalog',
                    attachedToEntityCodename: 'CertificateIssues',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                })
            ])
        )
        expect(manifest.seed.entities.find((entity) => entity.codename === 'LearnerHome')).toEqual(
            expect.objectContaining({
                kind: 'page',
                name: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Welcome' }),
                        ru: expect.objectContaining({ content: 'Добро пожаловать' })
                    })
                })
            })
        )
        for (const codename of ['CourseOverview', 'KnowledgeArticle', 'AssignmentInstructions', 'CertificatePolicy']) {
            const pageEntity = entityByCodename.get(codename)
            expect(pageEntity).toEqual(
                expect.objectContaining({
                    kind: 'page'
                })
            )
            expect(pageEntity?.config).toMatchObject({
                blockContent: expect.objectContaining({
                    format: 'editorjs',
                    blocks: expect.arrayContaining([
                        expect.objectContaining({ type: 'header' }),
                        expect.objectContaining({ type: 'paragraph' })
                    ])
                }),
                runtime: expect.objectContaining({
                    menuVisibility: 'secondary'
                })
            })
        }
        expect(manifest.seed.entities.find((entity) => entity.codename === 'LmsConfiguration')).toEqual(
            expect.objectContaining({
                kind: 'set',
                fixedValues: expect.arrayContaining([
                    expect.objectContaining({ codename: 'DefaultPassingScore', value: 80 }),
                    expect.objectContaining({ codename: 'CertificateValidityDays', value: 365 }),
                    expect.objectContaining({ codename: 'SupportEmail', value: '' })
                ])
            })
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
