import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { assertLmsDashboardFixtureContract } from './lmsDashboardFixtureContract.ts'
import { LMS_DASHBOARD_PAGE_RUNTIME_ICONS, LMS_DASHBOARD_PRIMARY_OBJECT_RUNTIME_ICONS } from './lmsDashboardFixtureLayoutValidator.ts'

type FixtureRecord = Record<string, unknown>
type ContractArguments = Parameters<typeof assertLmsDashboardFixtureContract>[0]

const readRecord = (value: unknown): FixtureRecord | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as FixtureRecord) : null

const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') return value
    const localized = readRecord(value)
    if (!localized) return undefined
    const locales = readRecord(localized.locales)
    const readValue = (entry: unknown): string | undefined => {
        if (typeof entry === 'string') return entry
        const record = readRecord(entry)
        return typeof record?.content === 'string' ? record.content : undefined
    }
    return readValue(locales?.[locale]) ?? readValue(localized[locale])
}

const sourceFixture = JSON.parse(
    readFileSync(new URL('../../../fixtures/metahubs-lms-app-snapshot.json', import.meta.url), 'utf8')
) as FixtureRecord

const cloneSourceFixture = (): FixtureRecord => structuredClone(sourceFixture)

const findEntityByCodename = (fixture: FixtureRecord, codename: string): FixtureRecord | undefined => {
    const entities = readRecord(readRecord(fixture.snapshot)?.entities)
    return Object.values(entities ?? {})
        .map(readRecord)
        .find((entity) => readLocalizedText(entity?.codename) === codename)
}

const setEntityRuntime = (entity: FixtureRecord | undefined, updates: FixtureRecord): void => {
    assert.ok(entity)
    const config = readRecord(entity.config) ?? {}
    entity.config = { ...config, runtime: { ...readRecord(config.runtime), ...updates } }
}

const removeEntityRuntimeProperty = (entity: FixtureRecord | undefined, property: string): void => {
    assert.ok(entity)
    const config = readRecord(entity.config) ?? {}
    const runtime = readRecord(config.runtime) ?? {}
    delete runtime[property]
    entity.config = { ...config, runtime }
}

const applySeededRuntimeNavigation = (fixture: FixtureRecord): void => {
    for (const [codename, icon] of LMS_DASHBOARD_PAGE_RUNTIME_ICONS) {
        setEntityRuntime(findEntityByCodename(fixture, codename), { icon })
    }
    for (const [codename, icon] of LMS_DASHBOARD_PRIMARY_OBJECT_RUNTIME_ICONS) {
        setEntityRuntime(findEntityByCodename(fixture, codename), { menuVisibility: 'primary', icon })
    }
    setEntityRuntime(findEntityByCodename(fixture, 'Reports'), { requiresPermission: 'readReports' })
}

const makeContractArguments = (envelope: FixtureRecord): ContractArguments => {
    const snapshot = readRecord(envelope.snapshot) ?? {}
    const entities = readRecord(snapshot.entities) ?? {}
    const entityByCodename = new Map<string, { id?: string; kind?: string; fields?: FixtureRecord[]; presentation?: { name?: unknown } }>()
    for (const value of Object.values(entities)) {
        const entity = readRecord(value)
        const codename = readLocalizedText(entity?.codename)
        if (!codename || !entity) continue
        const presentation = readRecord(entity.presentation)
        entityByCodename.set(codename, {
            ...(typeof entity.id === 'string' ? { id: entity.id } : {}),
            ...(typeof entity.kind === 'string' ? { kind: entity.kind } : {}),
            ...(Array.isArray(entity.fields)
                ? { fields: entity.fields.map(readRecord).filter((field): field is FixtureRecord => Boolean(field)) }
                : {}),
            ...(presentation ? { presentation: { name: presentation.name } } : {})
        })
    }

    const errors: string[] = []
    const modules = Array.isArray(snapshot.modules)
        ? snapshot.modules.map(readRecord).filter((module): module is FixtureRecord => Boolean(module))
        : []
    const arguments_: ContractArguments = {
        envelope: envelope as ContractArguments['envelope'],
        entityByCodename,
        modules,
        errors,
        readRecord,
        readWidgetConfig: (value) => readRecord(value) ?? {},
        readLocalizedText,
        assertLocalizedFixtureValue: (targetErrors, value, expected, label) => {
            if (readLocalizedText(value, 'en') !== expected.en) {
                targetErrors.push(`${label} is missing the canonical English value`)
            }
            if (readLocalizedText(value, 'ru') !== expected.ru) {
                targetErrors.push(`${label} is missing the canonical Russian value`)
            }
        }
    }
    return arguments_
}

const assertDashboardFixture = (fixture: FixtureRecord): string[] => {
    const arguments_ = makeContractArguments(fixture)
    assertLmsDashboardFixtureContract(arguments_)
    return arguments_.errors
}

const findLearningResourcesSortOrder = (fixture: FixtureRecord): FixtureRecord | undefined => {
    const snapshot = readRecord(fixture.snapshot)
    const entities = readRecord(snapshot?.entities)
    const learningResources = Object.values(entities ?? {})
        .map(readRecord)
        .find((entity) => readLocalizedText(entity?.codename) === 'LearningResources')
    return Array.isArray(learningResources?.fields)
        ? learningResources.fields.map(readRecord).find((field) => readLocalizedText(field?.codename) === 'SortOrder') ?? undefined
        : undefined
}

test('accepts the canonical fixture dashboard with scoped layouts, entity bindings, and seeded runtime navigation', () => {
    assert.deepEqual(assertDashboardFixture(cloneSourceFixture()), [])
})

test('accepts the seven seeded Page icons and exactly four seeded primary Object icons', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    assert.deepEqual(assertDashboardFixture(fixture), [])
})

test('rejects an unrelated Object added to primary navigation and an unsupported Page icon', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    const courseOverview = findEntityByCodename(fixture, 'CourseOverview')
    setEntityRuntime(courseOverview, { icon: 'book' })
    const contentStars = findEntityByCodename(fixture, 'ContentStars')
    setEntityRuntime(contentStars, { menuVisibility: 'primary', icon: 'star' })

    const errors = assertDashboardFixture(fixture)
    assert.ok(errors.includes('LMS Page CourseOverview must have a supported runtime icon'))
    assert.ok(
        errors.includes(
            'LMS primary Object navigation must contain exactly ContentProjects, Courses, LearningTracks, Reports; found ContentProjects, ContentStars, Courses, LearningTracks, Reports'
        )
    )
})

test('rejects a removed Page runtime icon', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    removeEntityRuntimeProperty(findEntityByCodename(fixture, 'CourseOverview'), 'icon')

    assert.ok(assertDashboardFixture(fixture).includes('LMS Page CourseOverview must have a supported runtime icon'))
})

test('rejects a changed supported icon on a seeded primary Object', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    setEntityRuntime(findEntityByCodename(fixture, 'ContentProjects'), { icon: 'apps' })

    assert.ok(
        assertDashboardFixture(fixture).includes(
            'LMS primary Object ContentProjects must preserve seed-approved semantic runtime icon "folder"'
        )
    )
})

test('rejects a Reports Object without the readReports menu permission', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    removeEntityRuntimeProperty(findEntityByCodename(fixture, 'Reports'), 'requiresPermission')

    assert.ok(assertDashboardFixture(fixture).includes('LMS Reports navigation must require the readReports application permission'))
})

test('rejects a changed supported icon on a seeded Page', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    setEntityRuntime(findEntityByCodename(fixture, 'CourseOverview'), { icon: 'home' })

    assert.ok(
        assertDashboardFixture(fixture).includes(
            'LMS Page CourseOverview must preserve semantic runtime icon "analytics" from the current seed'
        )
    )
})

test('accepts LearningResources.SortOrder as required NUMBER with a nonnegative minimum and zero default', () => {
    const fixture = cloneSourceFixture()
    applySeededRuntimeNavigation(fixture)
    const field = findLearningResourcesSortOrder(fixture)
    assert.ok(field)
    assert.equal(field.dataType, 'NUMBER')
    assert.equal(field.isRequired, true)
    assert.equal(readRecord(field.validationRules)?.min, 0)
    assert.equal(readRecord(field.uiConfig)?.defaultValue, 0)
    assert.deepEqual(assertDashboardFixture(fixture), [])
})

test('reports a LearningResources.SortOrder field without the required default', () => {
    const fixture = cloneSourceFixture()
    const field = findLearningResourcesSortOrder(fixture)
    assert.ok(field)
    field.uiConfig = { ...readRecord(field.uiConfig), defaultValue: 1 }
    assert.ok(
        assertDashboardFixture(fixture).includes(
            'LMS LearningResources.SortOrder must be a required NUMBER field with min 0 and uiConfig.defaultValue 0'
        )
    )
})

test('reports a missing required scoped layout and a removed library binding', () => {
    const layoutFixture = cloneSourceFixture()
    const layoutArguments = makeContractArguments(layoutFixture)
    const learnerHomeId = layoutArguments.entityByCodename.get('LearnerHome')?.id
    const layoutSnapshot = readRecord(layoutFixture.snapshot)
    assert.ok(layoutSnapshot)
    assert.ok(Array.isArray(layoutSnapshot.scopedLayouts))
    layoutSnapshot.scopedLayouts = layoutSnapshot.scopedLayouts.filter((value) => readRecord(value)?.scopeEntityId !== learnerHomeId)
    assert.ok(
        assertDashboardFixture(layoutFixture).includes(
            'LMS fixture must scope the entity-backed learner content tabs to the LearnerHome page layout'
        )
    )

    const bindingFixture = cloneSourceFixture()
    const bindingSnapshot = readRecord(bindingFixture.snapshot)
    assert.ok(bindingSnapshot)
    assert.ok(Array.isArray(bindingSnapshot.layoutZoneWidgets))
    const libraryWidget = bindingSnapshot.layoutZoneWidgets.map(readRecord).find((widget) => {
        const config = readRecord(widget?.config)
        return (
            widget?.widgetKey === 'detailsTable' &&
            config?.variant === 'library' &&
            config.lifecycleState === 'active' &&
            config.libraryView === 'all'
        )
    })
    assert.ok(libraryWidget)
    const config = readRecord(libraryWidget.config)
    const layoutConfig = readRecord(config?.__layout)
    const bindings = readRecord(layoutConfig?.bindings)
    assert.ok(Array.isArray(bindings?.slots))
    const rowsSlot = bindings.slots.map(readRecord).find((slot) => slot?.slot === 'rows')
    assert.ok(rowsSlot)
    assert.ok(Array.isArray(rowsSlot.targets))
    const learningResourcesIndex = rowsSlot.targets.findIndex((target) => readRecord(target)?.entityCodename === 'LearningResources')
    assert.notEqual(learningResourcesIndex, -1)
    rowsSlot.targets.splice(learningResourcesIndex, 1)
    assert.ok(assertDashboardFixture(bindingFixture).includes('LMS Learning Content library rows binding must target LearningResources'))
})
