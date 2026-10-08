import { isObjectRuntimeMenuIcon } from '@universo-react/types'
import type { DashboardFixtureValidationContext } from './lmsDashboardFixtureContractSupport.ts'

export const LMS_DASHBOARD_PAGE_RUNTIME_ICONS = [
    ['LearnerHome', 'home'],
    ['CourseOverview', 'analytics'],
    ['KnowledgeHome', 'apps'],
    ['KnowledgeArticle', 'page'],
    ['DevelopmentHome', 'tasks'],
    ['AssignmentInstructions', 'school'],
    ['CertificatePolicy', 'star']
] as const

export const LMS_DASHBOARD_PRIMARY_OBJECT_RUNTIME_ICONS = [
    ['ContentProjects', 'folder'],
    ['Courses', 'school'],
    ['LearningTracks', 'tasks'],
    ['Reports', 'analytics']
] as const

const expectedPageRuntimeIcons = new Map(LMS_DASHBOARD_PAGE_RUNTIME_ICONS)
const expectedPrimaryObjectRuntimeIcons = new Map(LMS_DASHBOARD_PRIMARY_OBJECT_RUNTIME_ICONS)

export const assertDashboardLayoutWidgetOwnership = (context: DashboardFixtureValidationContext): void => {
    const { modules, errors, readRecord, readWidgetConfig, readLocalizedText } = context
    const { widgets, learnerHomeLayout, courseBuilderLayout, trackBuilderLayout, reportsLayout, knowledgeArticlesLayout, globalLayout } =
        context
    const forbiddenModuleCodenames = new Set(['lms-module-viewer', 'lms-stats-viewer'])
    for (const module of modules) {
        const moduleCodename = readLocalizedText(module?.codename, 'en')
        if (moduleCodename && forbiddenModuleCodenames.has(moduleCodename)) {
            errors.push(`LMS fixture must not export legacy dashboard module ${moduleCodename}`)
        }
    }

    if (!learnerHomeLayout) {
        errors.push('LMS fixture must scope the entity-backed learner content tabs to the LearnerHome page layout')
    }
    if (!courseBuilderLayout) {
        errors.push('LMS fixture must scope Course Builder widgets to the Courses layout')
    }
    if (!trackBuilderLayout) {
        errors.push('LMS fixture must scope Track Builder widgets to the LearningTracks layout')
    }
    if (!reportsLayout) {
        errors.push('LMS fixture must scope the primary Learning Content summary report to the Reports layout')
    }
    if (!knowledgeArticlesLayout) {
        errors.push('LMS fixture must scope the entity-backed Knowledge Articles table to its object layout')
    }
    const globalLayoutWidgets = widgets.filter((widget) => widget?.layoutId === globalLayout?.id)
    if (globalLayoutWidgets.some((widget) => widget?.widgetKey === 'detailsTabs')) {
        errors.push('LMS entity-backed LearnerHome detailsTabs must stay on the LearnerHome scoped layout')
    }

    const forbiddenWidgetKeys = new Set([
        'moduleViewerWidget',
        'statsViewerWidget',
        'qrCodeWidget',
        'brandSelector',
        'productTree',
        'usersByCountryChart'
    ])
    for (const widget of widgets) {
        if (forbiddenWidgetKeys.has(String(widget?.widgetKey))) {
            errors.push(`LMS fixture must not include legacy global widget ${String(widget?.widgetKey)}`)
        }

        const config = readWidgetConfig(widget?.config)
        if (Object.prototype.hasOwnProperty.call(config, 'cards')) {
            errors.push(`LMS widget ${String(widget?.widgetKey)} must not persist the retired config.cards content locator`)
        }
        const visitConfig = (value: unknown, path: string): void => {
            if (Array.isArray(value)) {
                value.forEach((entry, index) => visitConfig(entry, `${path}[${index}]`))
                return
            }
            const record = readRecord(value)
            if (!record) return
            for (const [key, nested] of Object.entries(record)) {
                const nextPath = path ? `${path}.${key}` : key
                if (key === 'datasource') {
                    errors.push(`LMS widget ${String(widget?.widgetKey)} must not persist retired ${nextPath} source locators`)
                }
                visitConfig(nested, nextPath)
            }
        }
        visitConfig(config, 'config')

        if (widget?.widgetKey === 'detailsTabs') {
            const tabs = Array.isArray(config.tabs) ? config.tabs.map(readRecord) : []
            if (tabs.some((tab) => Array.isArray(tab?.widgets))) {
                errors.push('LMS detailsTabs must store child widgets as first-class placements, not tabs[].widgets')
            }
        }
        if (widget?.widgetKey === 'columnsContainer') {
            const columns = Array.isArray(config.columns) ? config.columns.map(readRecord) : []
            if (columns.some((column) => Array.isArray(column?.widgets))) {
                errors.push('LMS columnsContainer must store child widgets as first-class placements, not columns[].widgets')
            }
        }
    }
}

export const assertDashboardNavigationAndKnowledgeLayout = (context: DashboardFixtureValidationContext): void => {
    const { envelope, entityByCodename, errors, readRecord, readWidgetConfig, readLocalizedText, widgets, knowledgeArticlesLayout } =
        context
    const snapshotEntities = readRecord(readRecord(envelope.snapshot)?.entities)
    const entities = Object.values(snapshotEntities ?? {})
        .map(readRecord)
        .filter((entity): entity is Record<string, unknown> => Boolean(entity))
    const entitiesByCodename = new Map(
        entities
            .map((entity) => [readLocalizedText(entity.codename, 'en'), entity] as const)
            .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry[0]))
    )
    const runtimeFor = (entity: Record<string, unknown> | undefined): Record<string, unknown> =>
        readRecord(readRecord(entity?.config)?.runtime) ?? {}

    const pages = entities.filter((entity) => entity.kind === 'page')
    if (pages.length !== expectedPageRuntimeIcons.size) {
        errors.push(`LMS fixture must include exactly ${expectedPageRuntimeIcons.size} Pages`)
    }
    for (const [codename, expectedIcon] of expectedPageRuntimeIcons) {
        const matchingPages = pages.filter((entity) => readLocalizedText(entity.codename, 'en') === codename)
        if (matchingPages.length !== 1) {
            errors.push(`LMS fixture must include exactly one Page ${codename}`)
            continue
        }
        const actualIcon = runtimeFor(matchingPages[0]).icon
        if (!isObjectRuntimeMenuIcon(actualIcon)) {
            errors.push(`LMS Page ${codename} must have a supported runtime icon`)
        } else if (actualIcon !== expectedIcon) {
            errors.push(`LMS Page ${codename} must preserve semantic runtime icon "${expectedIcon}" from the current seed`)
        }
    }

    const unexpectedPages = pages
        .map((entity) => readLocalizedText(entity.codename, 'en') ?? '<unknown>')
        .filter((codename) => !expectedPageRuntimeIcons.has(codename))
        .sort()
    if (unexpectedPages.length > 0) {
        errors.push(`LMS fixture must not include unexpected Pages: ${unexpectedPages.join(', ')}`)
    }

    const primaryObjects = entities.filter((entity) => entity.kind === 'object' && runtimeFor(entity).menuVisibility === 'primary')
    const actualPrimaryObjectCodenames = primaryObjects.map((entity) => readLocalizedText(entity.codename, 'en') ?? '<unknown>').sort()
    const expectedPrimaryObjectCodenames = [...expectedPrimaryObjectRuntimeIcons.keys()].sort()
    if (JSON.stringify(actualPrimaryObjectCodenames) !== JSON.stringify(expectedPrimaryObjectCodenames)) {
        errors.push(
            `LMS primary Object navigation must contain exactly ${expectedPrimaryObjectCodenames.join(', ')}; found ${
                actualPrimaryObjectCodenames.join(', ') || 'none'
            }`
        )
    }
    for (const [codename, expectedIcon] of expectedPrimaryObjectRuntimeIcons) {
        const object = entitiesByCodename.get(codename)
        const runtime = runtimeFor(object)
        if (object?.kind !== 'object' || runtime.menuVisibility !== 'primary') {
            errors.push(`LMS primary Object ${codename} must preserve primary navigation visibility from the current seed`)
        }
        if (!isObjectRuntimeMenuIcon(runtime.icon)) {
            errors.push(`LMS primary Object ${codename} must have a supported runtime icon`)
        } else if (runtime.icon !== expectedIcon) {
            errors.push(`LMS primary Object ${codename} must preserve seed-approved semantic runtime icon "${expectedIcon}"`)
        }
        if (codename === 'Reports' && runtime.requiresPermission !== 'readReports') {
            errors.push('LMS Reports navigation must require the readReports application permission')
        }
    }

    const menuWidget = widgets.find((widget) => widget?.widgetKey === 'menuWidget')
    if (!menuWidget) {
        errors.push('LMS fixture must include a default menuWidget')
    } else {
        const config = readWidgetConfig(menuWidget.config)
        const globalLayoutId = typeof envelope.snapshot?.defaultLayoutId === 'string' ? envelope.snapshot.defaultLayoutId : null
        const globalLayout = envelope.snapshot?.layouts?.find((layout) => layout?.id === globalLayoutId)
        if (!globalLayout || menuWidget.layoutId !== globalLayoutId || menuWidget.zone !== 'left' || menuWidget.isActive !== true) {
            errors.push('LMS generated menu must be an active left-zone placement on the default Dashboard layout')
        }
        if (config.variant !== 'generated' || Object.keys(config).length !== 1) {
            errors.push('LMS menuWidget config must select generated navigation and contain no embedded menu content')
        }

        const generatedNavigationSources = [
            ['LearnerHome', 'page'],
            ['ContentProjects', 'object'],
            ['RecentContentViews', 'object'],
            ['ContentStars', 'object'],
            ['ContentAccessEntries', 'object'],
            ['TrashEntries', 'object'],
            ['Courses', 'object'],
            ['LearningTracks', 'object'],
            ['KnowledgeArticles', 'object'],
            ['DevelopmentPlans', 'object'],
            ['Reports', 'object']
        ] as const
        for (const [codename, expectedKind] of generatedNavigationSources) {
            const entity = entityByCodename.get(codename)
            const nameEn = readLocalizedText(entity?.presentation?.name, 'en')
            const nameRu = readLocalizedText(entity?.presentation?.name, 'ru')
            if (entity?.kind !== expectedKind || !nameEn || !nameRu) {
                errors.push(
                    `LMS generated navigation source ${expectedKind} ${codename} must exist with bilingual Entity presentation metadata`
                )
            }
        }
    }
    if (knowledgeArticlesLayout) {
        const knowledgeArticlesWidget = widgets.find(
            (widget) => widget?.layoutId === knowledgeArticlesLayout.id && widget?.widgetKey === 'detailsTable'
        )
        const config = readWidgetConfig(knowledgeArticlesWidget?.config)
        const createTargets = Array.isArray(config.createTargets) ? config.createTargets.map(readRecord) : []
        const bindingTargets = context.readBindingTargets(knowledgeArticlesWidget, 'rows')
        const projection = Array.isArray(bindingTargets[0]?.projection) ? bindingTargets[0].projection.map(readRecord) : []
        if (config.variant !== 'records' || config.showSearch !== true) {
            errors.push('LMS Knowledge Articles layout must use a searchable generic records table')
        }
        if (!createTargets.some((target) => target?.objectCollectionCodename === 'KnowledgeArticles')) {
            errors.push('LMS Knowledge Articles table must expose its localized Entity-backed create target')
        }
        if (
            bindingTargets.length !== 1 ||
            bindingTargets[0]?.entityKind !== 'object' ||
            bindingTargets[0]?.entityCodename !== 'KnowledgeArticles' ||
            readRecord(bindingTargets[0]?.selector)?.kind !== 'record-set' ||
            projection.length !== 0
        ) {
            errors.push('LMS Knowledge Articles table rows must bind through the schema-driven KnowledgeArticles object record set')
        }
    }
}
