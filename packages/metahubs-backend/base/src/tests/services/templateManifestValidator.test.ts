import { basicTemplate } from '../../domains/templates/data/basic.template'
import { basicDemoTemplate } from '../../domains/templates/data/basic-demo.template'
import { emptyTemplate } from '../../domains/templates/data/empty.template'
import { objectEntityPreset } from '../../domains/templates/data/object.entity-preset'
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

    it('accepts the built-in object entity preset', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(objectEntityPreset))).not.toThrow()
    })

    it('preserves record behavior component flags in the built-in object entity preset', () => {
        const validated = validateEntityTypePresetManifest(cloneTemplate(objectEntityPreset))

        expect(validated.entityType.ui.tabs).toContain('behavior')
        expect(validated.entityType.capabilities.identityFields).toEqual({
            enabled: true,
            allowNumber: true,
            allowEffectiveDate: true
        })
        expect(validated.entityType.capabilities.recordLifecycle).toEqual({
            enabled: true,
            allowCustomStates: true
        })
        expect(validated.entityType.capabilities.posting).toEqual({
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
            objectEntityPreset,
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

        expect(orderedKinds).toEqual(['hub', 'page', 'object', 'set', 'enumeration', 'ledger'])
        expect(basicTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])
        expect(basicDemoTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])
    })

    it('keeps standard resource surface definitions aligned with component capabilities', () => {
        const objectManifest = cloneTemplate(objectEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        expect(objectManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'components',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Components'
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

    it('keeps standard hub assignment labels data-driven for hub-scoped entity types', () => {
        const objectManifest = cloneTemplate(objectEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        for (const manifest of [objectManifest, setManifest, enumerationManifest]) {
            expect(manifest.entityType.ui.treeAssignmentLabels?.title?.locales.en.content).toBe('Hubs')
            expect(manifest.entityType.ui.treeAssignmentLabels?.title?.locales.ru.content).toBe('Хабы')
            expect(manifest.entityType.ui.treeAssignmentLabels?.requiredLabel?.locales.en.content).toBe('Hub required')
            expect(manifest.entityType.ui.treeAssignmentLabels?.requiredLabel?.locales.ru.content).toBe('Хаб обязателен')
            expect(manifest.entityType.ui.treeAssignmentLabels?.singleLabel?.locales.en.content).toBe('Single hub only')
            expect(manifest.entityType.ui.treeAssignmentLabels?.singleLabel?.locales.ru.content).toBe('Только один хаб')
        }
    })

    it('keeps the standard preset automation uplift enabled for hub, set, and enumeration entity presets', () => {
        const hubManifest = cloneTemplate(hubEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        expect(hubManifest.entityType.capabilities.scripting).toEqual({ enabled: true })
        expect(hubManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(hubManifest.entityType.capabilities.events).toEqual({ enabled: true })

        expect(setManifest.entityType.capabilities.scripting).toEqual({ enabled: true })
        expect(setManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(setManifest.entityType.capabilities.events).toEqual({ enabled: true })

        expect(enumerationManifest.entityType.capabilities.scripting).toEqual({ enabled: true })
        expect(enumerationManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(enumerationManifest.entityType.capabilities.events).toEqual({ enabled: true })
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
                expect.objectContaining({ id: 'lms-nav-modules', kind: 'section', sectionId: 'Modules' }),
                expect.objectContaining({ id: 'lms-nav-knowledge', kind: 'section', sectionId: 'Quizzes' }),
                expect.objectContaining({ id: 'lms-nav-development', kind: 'section', sectionId: 'Classes' }),
                expect.objectContaining({ id: 'lms-nav-reports', kind: 'section', sectionId: 'Reports' })
            ])
        )
        const modulesMenuItem = menuItems.find((item) => item?.id === 'lms-nav-modules')
        expect(modulesMenuItem?.title).toMatchObject({
            locales: {
                en: { content: 'Modules' },
                ru: { content: 'Модули' }
            }
        })
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
            { presetCodename: 'object', includedByDefault: true },
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
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'Students',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['records.read', 'records.write', 'lifecycle'])
                }),
                expect.objectContaining({
                    codename: 'EnrollmentPostingScript',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'Enrollments',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'QuizAttemptPostingScript',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'QuizAttempts',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'ModuleCompletionPostingScript',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'ModuleProgress',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'CertificateIssuePostingScript',
                    attachedToKind: 'object',
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
                kind: 'object',
                name: cloneTemplate(basicTemplate.name)
            }
        ]
        manifest.seed.elements = {
            tags: [{ codename: 'one', data: { label: 'One' }, sortOrder: 0 }]
        }
        const existingEntity = manifest.seed.entities[0]

        manifest.seed.entities.push({
            ...existingEntity,
            kind: existingEntity.kind === 'object' ? 'hub' : 'object'
        })

        expect(() => validateTemplateManifest(manifest)).toThrow(/ambiguous/i)
    })

    it('rejects entity presets with invalid component dependency combinations', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.capabilities.events = { enabled: true }
        manifest.entityType.capabilities.actions = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/actions/i)
    })

    it('accepts custom resource surface keys when the capability contract stays valid', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.ui.resourceSurfaces = [
            {
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'components',
                fallbackTitle: 'Components'
            }
        ]

        expect(() => validateEntityTypePresetManifest(manifest)).not.toThrow()
    })

    it('rejects resource surfaces that target disabled capabilities', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.capabilities.dataSchema = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/requires the matching entity component/i)
    })

    it('rejects duplicate resource surface route segments in entity presets', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.capabilities.optionValues = { enabled: true }
        manifest.entityType.ui.resourceSurfaces = [
            {
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'shared-tab',
                fallbackTitle: 'Components'
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
