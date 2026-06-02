import { basicTemplate } from '../../domains/templates/data/basic.template'
import { basicDemoTemplate } from '../../domains/templates/data/basic-demo.template'
import { emptyTemplate } from '../../domains/templates/data/empty.template'
import { objectEntityPreset } from '../../domains/templates/data/object.entity-preset'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { oneCCompatibleTemplate } from '../../domains/templates/data/one-c-compatible.template'
import {
    oneCCompatibleAllPresets,
    oneCCompatibleCorePresets,
    oneCCompatiblePreviewPresets
} from '../../domains/templates/data/one-c-compatible.entity-presets'
import { enumerationEntityPreset } from '../../domains/templates/data/option-list.entity-preset'
import { pageEntityPreset } from '../../domains/templates/data/page.entity-preset'
import { ledgerEntityPreset } from '../../domains/templates/data/ledger.entity-preset'
import { hubEntityPreset } from '../../domains/templates/data/tree-entity.entity-preset'
import { setEntityPreset } from '../../domains/templates/data/value-group.entity-preset'
import { parseApplicationLayoutWidgetConfig, workflowActionSchema } from '@universo-react/types'
import {
    validateEntityTypePresetManifest,
    validateTemplateManifest,
    validateTemplateSeedEntityBehaviorReferences
} from '../../domains/templates/services/TemplateManifestValidator'

const cloneTemplate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const readVlcContent = (value: unknown, locale: 'en' | 'ru'): string | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const locales = (value as { locales?: unknown }).locales
    if (!locales || typeof locales !== 'object' || Array.isArray(locales)) return undefined
    const entry = (locales as Record<string, unknown>)[locale]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
    const content = (entry as { content?: unknown }).content
    return typeof content === 'string' ? content : undefined
}

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

    it('accepts the built-in 1C-Compatible template without changing the default starter template presets', () => {
        expect(() => validateTemplateManifest(cloneTemplate(oneCCompatibleTemplate))).not.toThrow()
        expect(oneCCompatibleTemplate.codename).toBe('1c-compatible')
        expect(oneCCompatibleTemplate.presets?.map((preset) => preset.presetCodename)).toEqual([
            'one-c-constant',
            'enumeration',
            'one-c-catalog',
            'one-c-document',
            'one-c-document-journal',
            'one-c-information-register',
            'one-c-accumulation-register',
            'one-c-chart-of-accounts',
            'one-c-chart-of-characteristic-types',
            'one-c-accounting-register',
            'one-c-chart-of-calculation-types',
            'one-c-calculation-register'
        ])
        expect(basicTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])
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

    it('accepts 1C-Compatible preset manifests with typed reusable behavior configs', () => {
        const presets = oneCCompatibleCorePresets.map((preset) => validateEntityTypePresetManifest(cloneTemplate(preset)))

        expect(presets.map((preset) => preset.entityType.kindKey)).toEqual([
            'constant',
            'catalog',
            'document',
            'document-journal',
            'information-register',
            'accumulation-register'
        ])
        expect(presets.map((preset) => preset.entityType.kindKey)).not.toContain('object')
        expect(presets.find((preset) => preset.codename === 'one-c-constant')?.entityType.config?.singleValue).toMatchObject({
            kind: 'singleValue',
            dataType: 'STRING'
        })
        expect(presets.find((preset) => preset.codename === 'one-c-document')?.entityType.config?.documentBehavior).toMatchObject({
            kind: 'document'
        })
        expect(
            presets.find((preset) => preset.codename === 'one-c-accumulation-register')?.entityType.config?.registerBehavior
        ).toMatchObject({
            kind: 'register',
            mode: 'balance'
        })
        expect(presets.find((preset) => preset.codename === 'one-c-catalog')?.entityType.ui.resourceSurfaces?.[0]).toMatchObject({
            key: 'requisites',
            routeSegment: 'requisites',
            fallbackTitle: 'Requisites',
            fallbackSharedTitle: 'Requisites'
        })
        expect(presets.find((preset) => preset.codename === 'one-c-catalog')?.entityType.capabilities.treeAssignment).toBe(false)
        expect(presets.find((preset) => preset.codename === 'one-c-document')?.entityType.capabilities.treeAssignment).toBe(false)
        expect(presets.find((preset) => preset.codename === 'one-c-information-register')?.entityType.capabilities.treeAssignment).toBe(
            false
        )
        expect(presets.find((preset) => preset.codename === 'one-c-accumulation-register')?.entityType.capabilities.treeAssignment).toBe(
            false
        )
        expect(new Set(presets.map((preset) => preset.entityType.ui.iconName)).size).toBe(presets.length)
        expect(presets.map((preset) => preset.entityType.presentation?.readiness)).toEqual(
            Array.from({ length: oneCCompatibleCorePresets.length }, () => 'preview')
        )
    })

    it('registers and materializes every 1C-Compatible target preset in the template', () => {
        const allPresets = oneCCompatibleAllPresets.map((preset) => validateEntityTypePresetManifest(cloneTemplate(preset)))
        const previewPresetCodenames = oneCCompatiblePreviewPresets.map((preset) => preset.codename)

        expect(allPresets.map((preset) => preset.codename)).toEqual(
            expect.arrayContaining([
                'one-c-constant',
                'one-c-catalog',
                'one-c-document',
                'one-c-document-journal',
                'one-c-information-register',
                'one-c-accumulation-register',
                'one-c-chart-of-accounts',
                'one-c-chart-of-characteristic-types',
                'one-c-accounting-register',
                'one-c-chart-of-calculation-types',
                'one-c-calculation-register'
            ])
        )
        expect(new Set(allPresets.map((preset) => preset.entityType.ui.iconName)).size).toBe(allPresets.length)
        expect(previewPresetCodenames).not.toContain('one-c-document')
        expect(oneCCompatibleTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(
            expect.arrayContaining(previewPresetCodenames)
        )
    })

    it('rejects invalid typed behavior config embedded in a preset manifest', () => {
        const manifest = cloneTemplate(oneCCompatibleCorePresets[1])
        manifest.entityType.config = {
            catalogBehavior: {
                kind: 'catalog',
                unexpected: true
            }
        }

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/Invalid typed behavior config: catalogBehavior/)
    })

    it('rejects invalid typed behavior config embedded in preset default instances', () => {
        const manifest = cloneTemplate(oneCCompatibleCorePresets[2])
        if (!manifest.defaultInstances?.[0]) {
            throw new Error('Document preset must keep a default instance fixture')
        }
        manifest.defaultInstances[0].config = {
            documentBehavior: {
                kind: 'register',
                mode: 'facts'
            }
        }

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/documentBehavior.*register/)
    })

    it('rejects dangling behavior references in merged template seed entities', () => {
        expect(() =>
            validateTemplateSeedEntityBehaviorReferences({
                layouts: [],
                layoutZoneWidgets: {},
                entities: [
                    {
                        codename: 'GoodsReceipt',
                        kind: 'document',
                        name: {} as never,
                        components: [
                            {
                                codename: 'Goods',
                                dataType: 'TABLE',
                                name: {} as never,
                                childComponents: [{ codename: 'Product', dataType: 'STRING', name: {} as never }]
                            }
                        ],
                        config: {
                            documentPosting: {
                                kind: 'documentPosting',
                                moduleCodename: 'MissingPostingModule',
                                movements: [
                                    {
                                        targetRegisterCodename: 'StockBalance',
                                        sourceTableCodename: 'MissingTable',
                                        dimensionMappings: { Product: 'MissingProduct' },
                                        resourceMappings: {}
                                    }
                                ],
                                repostPolicy: 'replace-existing-batch'
                            }
                        }
                    }
                ]
            })
        ).toThrow(/MODULE_NOT_FOUND|TARGET_REGISTER_NOT_FOUND|SOURCE_TABLE_NOT_FOUND|FIELD_MAPPING_NOT_FOUND/)
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

        expect(hubManifest.entityType.capabilities.modules).toEqual({ enabled: true })
        expect(hubManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(hubManifest.entityType.capabilities.events).toEqual({ enabled: true })

        expect(setManifest.entityType.capabilities.modules).toEqual({ enabled: true })
        expect(setManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(setManifest.entityType.capabilities.events).toEqual({ enabled: true })

        expect(enumerationManifest.entityType.capabilities.modules).toEqual({ enabled: true })
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
        const learningContentWidgets = manifest.seed.layoutZoneWidgets.learningContent ?? []
        const courseBuilderWidgets = manifest.seed.layoutZoneWidgets.courseBuilder ?? []
        const trackBuilderWidgets = manifest.seed.layoutZoneWidgets.trackBuilder ?? []
        const entityCodenames = manifest.seed.entities.map((entity) => entity.codename)
        const entityByCodename = new Map(manifest.seed.entities.map((entity) => [entity.codename, entity]))
        const menuWidget = widgets.find((widget) => widget.widgetKey === 'menuWidget')
        const learningContentTable = learningContentWidgets.find((widget) => widget.widgetKey === 'detailsTable')
        const courseBuilderTabs = courseBuilderWidgets.find((widget) => widget.widgetKey === 'detailsTabs')
        const trackBuilderTabs = trackBuilderWidgets.find((widget) => widget.widgetKey === 'detailsTabs')

        expect(widgets.some((widget) => widget.widgetKey === 'moduleViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'statsViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'qrCodeWidget')).toBe(false)
        expect(manifest.seed.scopedLayouts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'learnerHome',
                    scopeEntityCodename: 'LearnerHome',
                    scopeEntityKind: 'page',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'learningContent',
                    scopeEntityCodename: 'ContentProjects',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'learningContentTrash',
                    scopeEntityCodename: 'TrashEntries',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'courseBuilder',
                    scopeEntityCodename: 'Courses',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'trackBuilder',
                    scopeEntityCodename: 'LearningTracks',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                })
            ])
        )
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
        const learningContentTableConfig = parseApplicationLayoutWidgetConfig('detailsTable', learningContentTable?.config ?? {})
        expect(learningContentTableConfig.createTargets).toHaveLength(8)
        expect(learningContentTableConfig.createTargets?.map((target) => target.id)).toEqual([
            'learning-content-create-project',
            'learning-content-create-page',
            'learning-content-create-link',
            'learning-content-create-course',
            'learning-content-create-track',
            'learning-content-create-quiz-lite',
            'learning-content-create-assignment-lite',
            'learning-content-create-package'
        ])
        expect(learningContentTableConfig.createTargets?.filter((target) => target.disabled).map((target) => target.id)).toEqual([
            'learning-content-create-quiz-lite',
            'learning-content-create-assignment-lite',
            'learning-content-create-package'
        ])
        const createTargetById = new Map(learningContentTableConfig.createTargets?.map((target) => [target.id, target]) ?? [])
        expect(readVlcContent(createTargetById.get('learning-content-create-quiz-lite')?.disabledReason, 'en')).toBe(
            'Quiz authoring is planned for a later Learning Content phase.'
        )
        expect(readVlcContent(createTargetById.get('learning-content-create-quiz-lite')?.disabledReason, 'ru')).toBe(
            'Создание тестов запланировано на следующий этап учебного контента.'
        )
        expect(readVlcContent(createTargetById.get('learning-content-create-assignment-lite')?.disabledReason, 'en')).toBe(
            'Assignment authoring is planned for a later Learning Content phase.'
        )
        expect(readVlcContent(createTargetById.get('learning-content-create-assignment-lite')?.disabledReason, 'ru')).toBe(
            'Создание заданий запланировано на следующий этап учебного контента.'
        )
        expect(readVlcContent(createTargetById.get('learning-content-create-package')?.disabledReason, 'en')).toBe(
            'File import support is planned for a later phase.'
        )
        expect(readVlcContent(createTargetById.get('learning-content-create-package')?.disabledReason, 'ru')).toBe(
            'Импорт файлов запланирован на следующий этап.'
        )
        expect(courseBuilderTabs).toBeDefined()
        expect(trackBuilderTabs).toBeDefined()
        expect(() => parseApplicationLayoutWidgetConfig('detailsTabs', courseBuilderTabs?.config ?? {})).not.toThrow()
        expect(() => parseApplicationLayoutWidgetConfig('detailsTabs', trackBuilderTabs?.config ?? {})).not.toThrow()
        expect((courseBuilderTabs?.config?.tabs as Array<{ id: string }> | undefined)?.map((tab) => tab.id)).toEqual([
            'outline',
            'general',
            'completion',
            'player',
            'enrollments',
            'reports'
        ])
        expect((trackBuilderTabs?.config?.tabs as Array<{ id: string }> | undefined)?.map((tab) => tab.id)).toEqual([
            'outline',
            'general',
            'completion',
            'player',
            'enrollments',
            'reports'
        ])
        const courseOutlineWidgets = (
            courseBuilderTabs?.config?.tabs as Array<{
                id: string
                widgets?: Array<{ widgetKey: string; config?: Record<string, unknown> }>
            }>
        )?.find((tab) => tab.id === 'outline')?.widgets
        const trackOutlineWidgets = (
            trackBuilderTabs?.config?.tabs as Array<{
                id: string
                widgets?: Array<{ widgetKey: string; config?: Record<string, unknown> }>
            }>
        )?.find((tab) => tab.id === 'outline')?.widgets
        const courseRelationBuilder = courseOutlineWidgets?.find((widget) => widget.widgetKey === 'relationBuilder')
        const trackRelationBuilder = trackOutlineWidgets?.find((widget) => widget.widgetKey === 'relationBuilder')
        expect(() => parseApplicationLayoutWidgetConfig('relationBuilder', courseRelationBuilder?.config ?? {})).not.toThrow()
        expect(() => parseApplicationLayoutWidgetConfig('relationBuilder', trackRelationBuilder?.config ?? {})).not.toThrow()
        expect(courseRelationBuilder?.config).toMatchObject({
            parentDatasource: { sectionCodename: 'Courses' },
            panels: expect.arrayContaining([
                expect.objectContaining({
                    id: 'course-sections',
                    parentFieldCodename: 'CourseId',
                    datasource: expect.objectContaining({ sectionCodename: 'CourseSections' })
                }),
                expect.objectContaining({
                    id: 'course-items',
                    parentFieldCodename: 'CourseId',
                    datasource: expect.objectContaining({ sectionCodename: 'CourseItems' })
                })
            ])
        })
        expect(trackRelationBuilder?.config).toMatchObject({
            parentDatasource: { sectionCodename: 'LearningTracks' },
            panels: expect.arrayContaining([
                expect.objectContaining({
                    id: 'track-stages',
                    parentFieldCodename: 'TrackId',
                    datasource: expect.objectContaining({ sectionCodename: 'TrackStages' })
                }),
                expect.objectContaining({
                    id: 'track-steps',
                    parentFieldCodename: 'TrackId',
                    datasource: expect.objectContaining({ sectionCodename: 'TrackSteps' })
                })
            ])
        })
        for (const widget of homeWidgets.filter((item) => ['overviewCards', 'sessionsChart', 'pageViewsChart'].includes(item.widgetKey))) {
            expect(() => parseApplicationLayoutWidgetConfig(widget.widgetKey, widget.config ?? {})).not.toThrow()
        }
        expect(menuWidget?.config).toMatchObject(
            expect.objectContaining({
                autoShowAllSections: false,
                maxPrimaryItems: 12,
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
                expect.objectContaining({ id: 'lms-nav-learning-content', kind: 'section', sectionId: 'ContentProjects' }),
                expect.objectContaining({ id: 'lms-nav-recent-content', kind: 'section', sectionId: 'RecentContentViews' }),
                expect.objectContaining({ id: 'lms-nav-starred-content', kind: 'section', sectionId: 'ContentStars' }),
                expect.objectContaining({ id: 'lms-nav-shared-content', kind: 'section', sectionId: 'ContentAccessEntries' }),
                expect.objectContaining({ id: 'lms-nav-courses', kind: 'section', sectionId: 'Courses' }),
                expect.objectContaining({ id: 'lms-nav-tracks', kind: 'section', sectionId: 'LearningTracks' }),
                expect.objectContaining({ id: 'lms-nav-trash-content', kind: 'section', sectionId: 'TrashEntries' }),
                expect.objectContaining({ id: 'lms-nav-knowledge', kind: 'section', sectionId: 'KnowledgeArticles' }),
                expect.objectContaining({ id: 'lms-nav-development', kind: 'section', sectionId: 'DevelopmentPlans' }),
                expect.objectContaining({ id: 'lms-nav-reports', kind: 'section', sectionId: 'Reports' })
            ])
        )
        const learningContentMenuItem = menuItems.find((item) => item?.id === 'lms-nav-learning-content')
        expect(learningContentMenuItem?.title).toMatchObject({
            locales: {
                en: { content: 'Learning Content' },
                ru: { content: 'Учебный контент' }
            }
        })
        expect(entityCodenames).toEqual(
            expect.arrayContaining([
                'Learning',
                'LmsConfiguration',
                'LearnerHome',
                'CourseOverview',
                'KnowledgeHome',
                'KnowledgeArticle',
                'KnowledgeArticles',
                'DevelopmentHome',
                'AssignmentInstructions',
                'CertificatePolicy',
                'Classes',
                'Students',
                'ContentProjects',
                'ContentAccessEntries',
                'ContentStars',
                'RecentContentViews',
                'ContentProgress',
                'TrashEntries',
                'LearningResources',
                'Courses',
                'CourseSections',
                'CourseItems',
                'LearningTracks',
                'TrackStages',
                'TrackSteps',
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
                'AccessLinks',
                'AssignmentSubmissions',
                'TrainingAttendance',
                'CertificateIssues',
                'GamificationSettings',
                'PointAwardRules',
                'PointTransactions',
                'BadgeDefinitions',
                'BadgeIssues',
                'LeaderboardSnapshots',
                'LearningResourceStatus',
                'PublicationStatus',
                'QuestionType',
                'ContentType',
                'PointSourceType'
            ])
        )
        expect(manifest.presets).toEqual([
            { presetCodename: 'hub', includedByDefault: true },
            { presetCodename: 'page', includedByDefault: false },
            { presetCodename: 'object', includedByDefault: true },
            { presetCodename: 'set', includedByDefault: true },
            { presetCodename: 'enumeration', includedByDefault: true }
        ])
        expect(manifest.seed.modules?.map((module) => module.codename)).not.toContain('AutoEnrollmentRuleModule')
        for (const codename of [
            'QuizResponses',
            'QuizAttempts',
            'ContentProgress',
            'Assignments',
            'AssignmentSubmissions',
            'TrainingEvents',
            'TrainingAttendance',
            'Certificates',
            'CertificateIssues',
            'DevelopmentPlanTasks',
            'NotificationOutbox',
            'PointTransactions',
            'BadgeIssues',
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
        const workflowExpectations = [
            {
                entityCodename: 'AssignmentSubmissions',
                actions: [
                    {
                        codename: 'StartSubmissionReview',
                        from: ['Submitted'],
                        to: 'PendingReview',
                        requiredCapabilities: ['assignment.review']
                    },
                    {
                        codename: 'AcceptSubmission',
                        from: ['PendingReview'],
                        to: 'Accepted',
                        requiredCapabilities: ['assignment.review'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'DeclineSubmission',
                        from: ['PendingReview'],
                        to: 'Declined',
                        requiredCapabilities: ['assignment.review']
                    }
                ]
            },
            {
                entityCodename: 'TrainingAttendance',
                actions: [
                    {
                        codename: 'MarkAttendanceAttended',
                        from: ['Registered'],
                        to: 'Attended',
                        requiredCapabilities: ['attendance.mark'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'MarkAttendanceNoShow',
                        from: ['Registered'],
                        to: 'NoShow',
                        requiredCapabilities: ['attendance.mark'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'CancelAttendance',
                        from: ['Registered', 'Attended', 'NoShow'],
                        to: 'Cancelled',
                        requiredCapabilities: ['attendance.manage'],
                        postingCommand: 'void'
                    }
                ]
            },
            {
                entityCodename: 'CertificateIssues',
                actions: [
                    {
                        codename: 'IssueCertificate',
                        from: ['Eligible'],
                        to: 'Issued',
                        requiredCapabilities: ['certificate.issue'],
                        postingCommand: 'post',
                        moduleCodename: 'CertificateIssuePostingModule'
                    },
                    {
                        codename: 'RevokeCertificate',
                        from: ['Issued'],
                        to: 'Revoked',
                        requiredCapabilities: ['certificate.revoke'],
                        postingCommand: 'post',
                        moduleCodename: 'CertificateIssuePostingModule'
                    }
                ]
            },
            {
                entityCodename: 'DevelopmentPlanTasks',
                actions: [
                    {
                        codename: 'StartDevelopmentTask',
                        from: ['NotStarted'],
                        to: 'InProgress',
                        requiredCapabilities: ['development.task.update']
                    },
                    {
                        codename: 'CompleteDevelopmentTask',
                        from: ['InProgress'],
                        to: 'Completed',
                        requiredCapabilities: ['development.task.update']
                    },
                    {
                        codename: 'ReopenDevelopmentTask',
                        from: ['Completed'],
                        to: 'InProgress',
                        requiredCapabilities: ['development.task.update']
                    }
                ]
            },
            {
                entityCodename: 'NotificationOutbox',
                actions: [
                    {
                        codename: 'MarkNotificationSent',
                        from: ['Queued', 'Failed'],
                        to: 'Sent',
                        requiredCapabilities: ['notification.deliver'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'MarkNotificationFailed',
                        from: ['Queued'],
                        to: 'Failed',
                        requiredCapabilities: ['notification.deliver']
                    },
                    {
                        codename: 'CancelNotification',
                        from: ['Queued', 'Failed'],
                        to: 'Cancelled',
                        requiredCapabilities: ['notification.manage'],
                        postingCommand: 'void'
                    }
                ]
            },
            {
                entityCodename: 'PointTransactions',
                actions: [
                    {
                        codename: 'ApprovePointAdjustment',
                        from: ['Pending'],
                        to: 'Approved',
                        requiredCapabilities: ['gamification.points.adjust'],
                        postingCommand: 'post',
                        moduleCodename: 'PointTransactionPostingModule'
                    },
                    {
                        codename: 'ReversePointAdjustment',
                        from: ['Approved'],
                        to: 'Reversed',
                        requiredCapabilities: ['gamification.points.adjust'],
                        postingCommand: 'void',
                        moduleCodename: 'PointTransactionPostingModule'
                    }
                ]
            },
            {
                entityCodename: 'BadgeIssues',
                actions: [
                    {
                        codename: 'IssueBadge',
                        from: ['Eligible'],
                        to: 'Issued',
                        requiredCapabilities: ['badge.issue']
                    },
                    {
                        codename: 'RevokeBadge',
                        from: ['Issued'],
                        to: 'Revoked',
                        requiredCapabilities: ['badge.revoke']
                    }
                ]
            }
        ]
        for (const { entityCodename, actions } of workflowExpectations) {
            const workflowActions = entityByCodename.get(entityCodename)?.config?.workflowActions
            expect(Array.isArray(workflowActions)).toBe(true)
            for (const expectedAction of actions) {
                expect(workflowActions).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            codename: expectedAction.codename,
                            from: expectedAction.from,
                            to: expectedAction.to,
                            statusFieldCodename: 'Status',
                            requiredCapabilities: expectedAction.requiredCapabilities,
                            ...(expectedAction.postingCommand ? { postingCommand: expectedAction.postingCommand } : {}),
                            ...(expectedAction.moduleCodename ? { moduleCodename: expectedAction.moduleCodename } : {})
                        })
                    ])
                )
            }
            for (const action of workflowActions ?? []) {
                expect(() => workflowActionSchema.parse(action)).not.toThrow()
            }
        }
        expect(manifest.seed.modules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'EnrollmentPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'Enrollments',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'QuizAttemptPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'QuizAttempts',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'ContentCompletionPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'ContentProgress',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'CertificateIssuePostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'CertificateIssues',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'PointTransactionPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'PointTransactions',
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
        for (const codename of [
            'CourseOverview',
            'KnowledgeHome',
            'KnowledgeArticle',
            'DevelopmentHome',
            'AssignmentInstructions',
            'CertificatePolicy'
        ]) {
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
                    expect.objectContaining({ codename: 'SupportEmail', value: '' }),
                    expect.objectContaining({ codename: 'GamificationEnabled', value: true }),
                    expect.objectContaining({ codename: 'DefaultPointAward', value: 10 })
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

    it('rejects non-embedded seed module source kinds while template seeding is inline-only', () => {
        const manifest = cloneTemplate(lmsTemplate)
        const firstModule = manifest.seed.modules?.[0]
        expect(firstModule).toBeDefined()
        if (firstModule) {
            firstModule.sourceKind = 'external' as never
        }

        expect(() => validateTemplateManifest(manifest)).toThrow()
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
