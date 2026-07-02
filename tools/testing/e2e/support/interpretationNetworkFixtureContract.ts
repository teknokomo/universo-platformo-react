// Interpretation Network interpretation network — fixture contract for the
// `metahubs-interpretation-network-app-export.spec.ts` Playwright generator.
//
// The committed product fixture must contain the first-stage
// interpretation-network definitions and intro Page, but it must not
// prefill user-authored Structures, matrix rows, relations, materials, or
// table templates. Fresh app content belongs to the published workspace.

import type { MetahubSnapshotTransportEnvelope } from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'

export const INTERPRETATION_NETWORK_FIXTURE_FILENAME = 'metahubs-interpretation-network-app-snapshot.json'

export const INTERPRETATION_NETWORK_CANONICAL_METAHUB = {
    name: { en: 'Interpretation Network', ru: 'Трактовочная сеть' },
    codename: { en: 'InterpretationNetwork' },
    description: {
        en: 'Interpretation network configuration with Structures, Interpretations, typed Relations, Editor.js Materials, and matrix cell styling.',
        ru: 'Конфигурация трактовочной сети со структурами, трактовками, типизированными связями, материалами Editor.js и стилями ячеек матрицы.'
    },
    codenameStyle: 'pascal-case' as const,
    codenameAlphabet: 'en' as const,
    isPublic: true,
    workspacesEnabled: true
}

export const buildInterpretationNetworkLiveMetahubName = (runId: string): { en: string } => ({
    en: `E2E ${runId} Interpretation Network`
})

export const buildInterpretationNetworkLiveMetahubCodename = (runId: string): { en: string } =>
    createLocalizedContent('en', `${runId.toLowerCase().replace(/[^a-z0-9]+/g, '')}-interpretation-network`.slice(0, 60))

/** Selects which set of assertions the contract runs. */
const readRuntimeLabel = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const directTitle = (value as { title?: unknown }).title
    if (typeof directTitle === 'string') return directTitle
    const directName = (value as { name?: unknown }).name
    if (typeof directName === 'string') return directName
    const locales = (value as { locales?: Record<string, { content?: string }> }).locales
    if (!locales || typeof locales !== 'object') return ''
    return locales.en?.content ?? locales.ru?.content ?? ''
}

const findEntityByCodename = (entityList: Array<Record<string, unknown>>, codename: string): Record<string, unknown> | undefined =>
    entityList.find((e) => readRuntimeLabel(e?.codename) === codename)

const getEntityRows = (
    snapshot: Record<string, unknown>,
    entity: Record<string, unknown> | undefined
): Array<{ id?: string; data?: Record<string, unknown> }> => {
    const entityId = typeof entity?.id === 'string' ? entity.id : ''
    const elements = (snapshot as { elements?: Record<string, Array<{ id?: string; data?: Record<string, unknown> }>> }).elements ?? {}
    return entityId ? elements[entityId] ?? [] : []
}

const getOptionCodenames = (snapshot: Record<string, unknown>, entity: Record<string, unknown> | undefined): string[] => {
    const entityId = typeof entity?.id === 'string' ? entity.id : ''
    const optionValues = (snapshot as { optionValues?: Record<string, Array<{ codename?: unknown }>> }).optionValues ?? {}
    return entityId ? (optionValues[entityId] ?? []).map((value) => readRuntimeLabel(value.codename)).filter(Boolean) : []
}

const getEntityFields = (entity: Record<string, unknown> | undefined): Array<Record<string, unknown>> =>
    Array.isArray(entity?.fields) ? (entity.fields as Array<Record<string, unknown>>) : []

const findFieldByCodename = (fields: Array<Record<string, unknown>>, codename: string): Record<string, unknown> | undefined =>
    fields.find((field) => readRuntimeLabel(field.codename) === codename)

const requireFieldByCodename = (
    fields: Array<Record<string, unknown>>,
    codename: string,
    entityCodename: string
): Record<string, unknown> => {
    const field = findFieldByCodename(fields, codename)
    if (!field) {
        throw new Error(`Interpretation Network fixture contract failed: ${entityCodename} is missing component "${codename}"`)
    }
    return field
}

const assertHiddenSystemFieldUiConfig = (field: Record<string, unknown>, label: string): void => {
    const uiConfig = field.uiConfig && typeof field.uiConfig === 'object' ? (field.uiConfig as Record<string, unknown>) : {}
    for (const key of ['hidden', 'gridHidden', 'formHidden', 'serverOwned']) {
        if (uiConfig[key] !== true) {
            throw new Error(`Interpretation Network fixture contract failed: ${label}.uiConfig.${key} must be true`)
        }
    }
}

const assertLocalizedVersionedField = (field: Record<string, unknown>, label: string): void => {
    const validationRules =
        field.validationRules && typeof field.validationRules === 'object' ? (field.validationRules as Record<string, unknown>) : {}
    if (validationRules.localized !== true || validationRules.versioned !== true) {
        throw new Error(`Interpretation Network fixture contract failed: ${label} must be localized and versioned`)
    }
}

const assertTabularMaxChildComponents = (field: Record<string, unknown>, label: string): void => {
    const childFields = Array.isArray(field.childFields) ? field.childFields : []
    const validationRules =
        field.validationRules && typeof field.validationRules === 'object' ? (field.validationRules as Record<string, unknown>) : {}
    if (Number(validationRules.maxChildComponents ?? 0) !== childFields.length) {
        throw new Error(
            `Interpretation Network fixture contract failed: ${label}.validationRules.maxChildComponents must equal its child field count`
        )
    }
}

const assertInterpretationNetworkLayoutContract = (snapshot: Record<string, unknown>): void => {
    const layoutZoneWidgets = Array.isArray(snapshot.layoutZoneWidgets)
        ? (snapshot.layoutZoneWidgets as Array<Record<string, unknown>>)
        : []
    const centerWidgets = layoutZoneWidgets.filter((widget) => widget.zone === 'center')
    const workspaceWidget = centerWidgets.find((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')
    if (!workspaceWidget) {
        throw new Error('Interpretation Network fixture contract failed: center zone must include interpretationNetworkWorkspace')
    }
    const workspaceConfig =
        workspaceWidget.config && typeof workspaceWidget.config === 'object' ? (workspaceWidget.config as Record<string, unknown>) : {}
    const visibleFor =
        workspaceConfig.visibleFor && typeof workspaceConfig.visibleFor === 'object'
            ? (workspaceConfig.visibleFor as Record<string, unknown>)
            : {}
    const sectionCodenames = Array.isArray(visibleFor.sectionCodenames) ? visibleFor.sectionCodenames : []
    const objectCollectionCodenames = Array.isArray(visibleFor.objectCollectionCodenames) ? visibleFor.objectCollectionCodenames : []
    if (!sectionCodenames.includes('Structure') || !objectCollectionCodenames.includes('Structure')) {
        throw new Error(
            'Interpretation Network fixture contract failed: interpretationNetworkWorkspace must be visible only on Structure entities'
        )
    }
    const menuWidget = layoutZoneWidgets.find((widget) => widget.widgetKey === 'menuWidget')
    if (!menuWidget) {
        throw new Error('Interpretation Network fixture contract failed: left zone must include menuWidget')
    }
    const menuConfig = menuWidget.config && typeof menuWidget.config === 'object' ? (menuWidget.config as Record<string, unknown>) : {}
    if (menuConfig.autoShowAllSections !== false) {
        throw new Error('Interpretation Network fixture contract failed: menuWidget must not auto-render every object section')
    }
    if (menuConfig.startPage !== 'InterpretationNetworkIntro') {
        throw new Error('Interpretation Network fixture contract failed: menuWidget must start from InterpretationNetworkIntro')
    }
    const menuItems = Array.isArray(menuConfig.items) ? (menuConfig.items as Array<Record<string, unknown>>) : []
    const introItem = menuItems.find(
        (item) =>
            item.id === 'interpretationNetwork-nav-intro' &&
            item.kind === 'section' &&
            item.sectionId === 'InterpretationNetworkIntro' &&
            readRuntimeLabel(item.title) === 'Start'
    )
    if (!introItem) {
        throw new Error('Interpretation Network fixture contract failed: menuWidget must include the localized intro Page item')
    }
    const structuresItem = menuItems.find(
        (item) =>
            item.id === 'interpretationNetwork-nav-structures' &&
            item.kind === 'section' &&
            item.sectionId === 'Structure' &&
            item.objectCollectionId === 'Structure' &&
            readRuntimeLabel(item.title) === 'Structures'
    )
    if (!structuresItem) {
        throw new Error('Interpretation Network fixture contract failed: menuWidget must include the localized Structures return item')
    }

    const forbiddenWidgetKeys = new Set([
        'overviewCards',
        'sessionsChart',
        'pageViewsChart',
        'productTree',
        'usersByCountryChart',
        'brandSelector',
        'infoCard',
        'userProfile'
    ])
    const visitWidget = (widget: Record<string, unknown>, path: string): void => {
        const widgetKey = typeof widget.widgetKey === 'string' ? widget.widgetKey : ''
        if (forbiddenWidgetKeys.has(widgetKey)) {
            throw new Error(`Interpretation Network fixture contract failed: ${path} must not use generic dashboard widget "${widgetKey}"`)
        }

        const config = widget.config && typeof widget.config === 'object' ? (widget.config as Record<string, unknown>) : {}
        const columns = Array.isArray(config.columns) ? config.columns : []
        for (const [columnIndex, column] of columns.entries()) {
            const nestedWidgets =
                column && typeof column === 'object' && Array.isArray((column as { widgets?: unknown }).widgets)
                    ? (column as { widgets: Array<Record<string, unknown>> }).widgets ?? []
                    : []
            nestedWidgets.forEach((nestedWidget, nestedIndex) =>
                visitWidget(nestedWidget, `${path}.columns[${columnIndex}].widgets[${nestedIndex}]`)
            )
        }

        const tabs = Array.isArray(config.tabs) ? config.tabs : []
        for (const [tabIndex, tab] of tabs.entries()) {
            const nestedWidgets =
                tab && typeof tab === 'object' && Array.isArray((tab as { widgets?: unknown }).widgets)
                    ? (tab as { widgets: Array<Record<string, unknown>> }).widgets ?? []
                    : []
            nestedWidgets.forEach((nestedWidget, nestedIndex) =>
                visitWidget(nestedWidget, `${path}.tabs[${tabIndex}].widgets[${nestedIndex}]`)
            )
        }
    }

    layoutZoneWidgets.forEach((widget, index) => visitWidget(widget, `layoutZoneWidgets[${index}]`))
}

const assertIntroPageContract = (entityList: Array<Record<string, unknown>>): void => {
    const introPage = findEntityByCodename(entityList, 'InterpretationNetworkIntro')
    if (!introPage || introPage.kind !== 'page') {
        throw new Error('Interpretation Network fixture contract failed: missing Page entity "InterpretationNetworkIntro"')
    }
    const config = introPage.config && typeof introPage.config === 'object' ? (introPage.config as Record<string, unknown>) : {}
    const blockContent =
        config.blockContent && typeof config.blockContent === 'object' ? (config.blockContent as Record<string, unknown>) : {}
    const blocks = Array.isArray(blockContent.blocks) ? blockContent.blocks : []
    const serialized = JSON.stringify(blockContent)
    if (blockContent.format !== 'editorjs' || blocks.length < 2) {
        throw new Error('Interpretation Network fixture contract failed: InterpretationNetworkIntro must use Editor.js-compatible content')
    }
    if (!serialized.includes('Interpretation Network') || !serialized.includes('Трактовочная сеть')) {
        throw new Error('Interpretation Network fixture contract failed: InterpretationNetworkIntro must include localized intro text')
    }
}

const assertNoSeededRuntimeRows = (
    rows: Array<{ id?: string; data?: Record<string, unknown> }>,
    entityCodename: string,
    forbiddenText: RegExp
): void => {
    if (rows.length > 0) {
        throw new Error(`Interpretation Network fixture contract failed: ${entityCodename} must not contain seeded runtime rows`)
    }
    const serialized = JSON.stringify(rows)
    if (forbiddenText.test(serialized)) {
        throw new Error(`Interpretation Network fixture contract failed: ${entityCodename} still contains old demo data`)
    }
}

export function assertInterpretationNetworkFixtureEnvelopeContract(envelope: MetahubSnapshotTransportEnvelope): void {
    if (!envelope || typeof envelope !== 'object') {
        throw new Error('Interpretation Network fixture contract failed: envelope is not an object')
    }
    if (envelope.kind !== 'metahub_snapshot_bundle') {
        throw new Error(`Interpretation Network fixture contract failed: kind is "${envelope.kind}"`)
    }
    if (envelope.bundleVersion !== 1) {
        throw new Error(`Interpretation Network fixture contract failed: bundleVersion is ${envelope.bundleVersion}`)
    }

    const metahub = envelope.metahub as Record<string, unknown> | undefined
    if (!metahub) {
        throw new Error('Interpretation Network fixture contract failed: metahub section is missing')
    }
    if (readRuntimeLabel(metahub.name) !== INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en) {
        throw new Error(
            `Interpretation Network fixture contract failed: metahub.name must be "${INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en}"`
        )
    }
    if (readRuntimeLabel(metahub.codename) !== INTERPRETATION_NETWORK_CANONICAL_METAHUB.codename.en) {
        throw new Error(
            `Interpretation Network fixture contract failed: metahub.codename must be "${INTERPRETATION_NETWORK_CANONICAL_METAHUB.codename.en}"`
        )
    }

    const snapshot = envelope.snapshot as Record<string, unknown> | undefined
    if (!snapshot) {
        throw new Error('Interpretation Network fixture contract failed: snapshot section is missing')
    }

    const runtimePolicy = (snapshot as { runtimePolicy?: { workspaceMode?: string } }).runtimePolicy
    if (runtimePolicy?.workspaceMode !== 'required') {
        throw new Error('Interpretation Network fixture contract failed: runtimePolicy.workspaceMode must be "required"')
    }
    assertInterpretationNetworkLayoutContract(snapshot)

    const entities = (snapshot as { entities?: Record<string, unknown> }).entities ?? {}
    const entityList = Object.values(entities) as Array<Record<string, unknown>>
    if (entityList.length === 0) {
        throw new Error('Interpretation Network fixture contract failed: snapshot has no entities')
    }

    const requiredObjectTypes = ['Structure', 'Interpretation', 'Relation', 'TableTemplate']
    for (const typeName of requiredObjectTypes) {
        if (!findEntityByCodename(entityList, typeName)) {
            throw new Error(`Interpretation Network fixture contract failed: missing object type "${typeName}"`)
        }
    }
    const structureEntity = findEntityByCodename(entityList, 'Structure')
    const interpretationEntity = findEntityByCodename(entityList, 'Interpretation')
    const relationEntity = findEntityByCodename(entityList, 'Relation')
    const materialEntity = findEntityByCodename(entityList, 'Material')
    const tableTemplateEntity = findEntityByCodename(entityList, 'TableTemplate')
    if (!materialEntity || materialEntity.kind !== 'object') {
        throw new Error('Interpretation Network fixture contract failed: missing object type "Material"')
    }
    if (!findEntityByCodename(entityList, 'Main') || !findEntityByCodename(entityList, 'WelcomePage')) {
        throw new Error('Interpretation Network fixture contract failed: base template Hub/Page entities are incomplete')
    }
    assertIntroPageContract(entityList)
    if (!entityList.some((entity) => entity.kind === 'set')) {
        throw new Error('Interpretation Network fixture contract failed: base Set entity type is missing')
    }

    const requiredEnums = ['Context', 'RelationType', 'CellColor']
    for (const enumName of requiredEnums) {
        const entity = findEntityByCodename(entityList, enumName)
        if (!entity) {
            throw new Error(`Interpretation Network fixture contract failed: missing enumeration "${enumName}"`)
        }
        const optionCodenames = getOptionCodenames(snapshot, entity)
        if (optionCodenames.length === 0) {
            throw new Error(`Interpretation Network fixture contract failed: enumeration "${enumName}" has no values`)
        }
    }

    const cellColor = findEntityByCodename(entityList, 'CellColor')
    const cellColorCodenames = getOptionCodenames(snapshot, cellColor)
    const requiredColors = ['none', 'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'black']
    for (const color of requiredColors) {
        if (!cellColorCodenames.includes(color)) {
            throw new Error(`Interpretation Network fixture contract failed: CellColor is missing value "${color}"`)
        }
    }

    const structureRows = getEntityRows(snapshot, structureEntity)
    const interpRows = getEntityRows(snapshot, interpretationEntity)
    const relationRows = getEntityRows(snapshot, relationEntity)
    const materialRows = getEntityRows(snapshot, materialEntity)
    const tableTemplateRows = getEntityRows(snapshot, tableTemplateEntity)
    const structureFields = getEntityFields(structureEntity)
    const interpretationFields = getEntityFields(interpretationEntity)
    const relationFields = getEntityFields(relationEntity)
    const materialFields = getEntityFields(materialEntity)
    const tableTemplateFields = getEntityFields(tableTemplateEntity)
    for (const fieldCodename of ['Name', 'Description']) {
        requireFieldByCodename(structureFields, fieldCodename, 'Structure')
    }
    assertLocalizedVersionedField(requireFieldByCodename(structureFields, 'Name', 'Structure'), 'Structure.Name')
    assertLocalizedVersionedField(requireFieldByCodename(structureFields, 'Description', 'Structure'), 'Structure.Description')
    if (findFieldByCodename(structureFields, 'Context')) {
        throw new Error('Interpretation Network fixture contract failed: Structure.Context must not be present in create fields')
    }
    const interpretationMatrixField = requireFieldByCodename(interpretationFields, 'InterpretationMatrix', 'Interpretation')
    if (interpretationMatrixField.dataType !== 'TABLE') {
        throw new Error('Interpretation Network fixture contract failed: Interpretation.InterpretationMatrix must be a TABLE component')
    }
    assertTabularMaxChildComponents(interpretationMatrixField, 'Interpretation.InterpretationMatrix')
    const matrixFields = Array.isArray(interpretationMatrixField.childFields)
        ? (interpretationMatrixField.childFields as Array<Record<string, unknown>>)
        : []
    for (const fieldCodename of [
        'CellId',
        'CellValue',
        'CellFillColor',
        'BorderTopColor',
        'BorderRightColor',
        'BorderBottomColor',
        'BorderLeftColor',
        'BorderTopWidth',
        'BorderRightWidth',
        'BorderBottomWidth',
        'BorderLeftWidth',
        'BorderTopStyle',
        'BorderRightStyle',
        'BorderBottomStyle',
        'BorderLeftStyle',
        'MaterialRef'
    ]) {
        requireFieldByCodename(matrixFields, fieldCodename, 'Interpretation.InterpretationMatrix')
    }
    assertHiddenSystemFieldUiConfig(requireFieldByCodename(matrixFields, 'CellId', 'Interpretation.InterpretationMatrix'), 'CellId')

    for (const fieldCodename of [
        'SourceLabel',
        'SourceKind',
        'SourceId',
        'TargetLabel',
        'TargetKind',
        'TargetId',
        'RelationType',
        'Description'
    ]) {
        requireFieldByCodename(relationFields, fieldCodename, 'Relation')
    }
    for (const fieldCodename of ['SourceKind', 'SourceId', 'TargetKind', 'TargetId']) {
        assertHiddenSystemFieldUiConfig(requireFieldByCodename(relationFields, fieldCodename, 'Relation'), `Relation.${fieldCodename}`)
    }
    for (const fieldCodename of ['Title', 'Description', 'Body', 'CellId']) {
        requireFieldByCodename(materialFields, fieldCodename, 'Material')
    }
    assertLocalizedVersionedField(requireFieldByCodename(materialFields, 'Title', 'Material'), 'Material.Title')
    assertLocalizedVersionedField(requireFieldByCodename(materialFields, 'Description', 'Material'), 'Material.Description')
    assertHiddenSystemFieldUiConfig(requireFieldByCodename(materialFields, 'CellId', 'Material'), 'Material.CellId')
    for (const fieldCodename of ['Name', 'Description', 'TemplateMatrix']) {
        requireFieldByCodename(tableTemplateFields, fieldCodename, 'TableTemplate')
    }
    const templateMatrixField = requireFieldByCodename(tableTemplateFields, 'TemplateMatrix', 'TableTemplate')
    if (templateMatrixField.dataType !== 'TABLE') {
        throw new Error('Interpretation Network fixture contract failed: TableTemplate.TemplateMatrix must be a TABLE component')
    }
    assertTabularMaxChildComponents(templateMatrixField, 'TableTemplate.TemplateMatrix')

    assertNoSeededRuntimeRows(structureRows, 'Structure', /Gravity|Meaning/i)
    assertNoSeededRuntimeRows(interpRows, 'Interpretation', /Gravity|Attraction between masses|Falling apple/i)
    assertNoSeededRuntimeRows(relationRows, 'Relation', /Gravity|Mass/i)
    assertNoSeededRuntimeRows(materialRows, 'Material', /Gravity material|Meaning material/i)
    assertNoSeededRuntimeRows(tableTemplateRows, 'TableTemplate', /Basic interpretation matrix/i)
}
