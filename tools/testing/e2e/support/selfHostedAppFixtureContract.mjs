import { METAHUB_SETTINGS_REGISTRY } from '@universo/types'
import { buildVLC, computeSnapshotHash } from '@universo/utils'

export const SELF_HOSTED_APP_FIXTURE_FILENAME = 'metahubs-self-hosted-app-snapshot.json'
export const SELF_HOSTED_APP_SCREENSHOTS_DIRNAME = 'self-hosted-app'
export const SELF_HOSTED_APP_STRUCTURE_VERSION = '0.1.0'

export const SELF_HOSTED_APP_CANONICAL_METAHUB = {
    name: {
        en: 'Metahubs Self-Hosted App',
        ru: 'Автономное приложение метахабов'
    },
    description: {
        en: 'Reference metahub for the self-hosted application flow with localized metadata, interface settings, migration controls, and snapshot import/export.',
        ru: 'Эталонный метахаб для автономного сценария приложения с локализованными метаданными, настройками интерфейса, управлением миграциями и экспортом/импортом снимков.'
    },
    codename: {
        en: 'MetahubsSelfHostedApp',
        ru: 'АвтономноеПриложениеМетахабов'
    }
}

export const SELF_HOSTED_APP_LAYOUT = {
    name: {
        en: 'Metahubs Self-Hosted Dashboard',
        ru: 'Панель автономного приложения метахабов'
    },
    description: {
        en: 'Default dashboard layout for the self-hosted metahub application.',
        ru: 'Базовый макет панели для автономного приложения метахабов.'
    },
    menuTitle: {
        en: 'Catalogs',
        ru: 'Каталоги'
    },
    runtimeConfig: {
        showOverviewTitle: false,
        showOverviewCards: false,
        showSessionsChart: false,
        showPageViewsChart: false,
        showDetailsTitle: true,
        showDetailsTable: true,
        showFooter: false,
        showViewToggle: true,
        defaultViewMode: 'card',
        showFilterBar: true,
        enableRowReordering: true,
        cardColumns: 3,
        rowHeight: 'auto'
    }
}

export const SELF_HOSTED_APP_SETTINGS_LAYOUT = {
    name: {
        en: 'Settings Catalog Layout',
        ru: 'Макет каталога настроек'
    },
    description: {
        en: 'Catalog-specific layout override for the Settings catalog.',
        ru: 'Специальный макет каталога для каталога настроек.'
    },
    runtimeConfig: {
        showDetailsTitle: false,
        showViewToggle: false,
        defaultViewMode: 'list',
        showFilterBar: false
    },
    catalogBehavior: {
        showCreateButton: true,
        searchMode: 'server',
        createSurface: 'page',
        editSurface: 'page',
        copySurface: 'page'
    }
}

export const SELF_HOSTED_APP_PUBLICATION = {
    name: {
        en: 'Metahubs Self-Hosted Publication',
        ru: 'Публикация автономного приложения метахабов'
    },
    applicationName: {
        en: 'Metahubs Self-Hosted App',
        ru: 'Автономное приложение метахабов'
    },
    versionName: {
        en: 'Initial self-hosted app release v1',
        ru: 'Стартовый релиз автономного приложения v1'
    },
    versionDescription: {
        en: 'Initial release snapshot for the self-hosted app.',
        ru: 'Стартовый снимок релиза автономного приложения.'
    }
}

const createSelfHostedAppEntityType = ({
    templateCodename,
    displayLabel,
    kindKey,
    codename,
    components = {},
    ui,
    physicalTable = false,
    published = true
}) => ({
    templateCodename,
    displayLabel,
    kindKey,
    codename,
    components,
    ui,
    physicalTable,
    published
})

export const SELF_HOSTED_APP_HUB_ENTITY_TYPE = createSelfHostedAppEntityType({
    templateCodename: 'hub',
    displayLabel: 'Hubs',
    kindKey: 'hub',
    codename: {
        en: 'Hub',
        ru: 'Hub'
    },
    components: {
        dataSchema: false,
        records: false,
        treeAssignment: false,
        optionValues: false,
        fixedValues: false,
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        scripting: { enabled: true },
        actions: { enabled: true },
        events: { enabled: true },
        layoutConfig: false,
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconHierarchy',
        tabs: ['general'],
        sidebarSection: 'objects',
        sidebarOrder: 10,
        nameKey: 'metahubs:treeEntities.title'
    }
})

export const SELF_HOSTED_APP_CATALOG_ENTITY_TYPE = createSelfHostedAppEntityType({
    templateCodename: 'catalog',
    displayLabel: 'Catalogs',
    kindKey: 'catalog',
    codename: {
        en: 'Catalog',
        ru: 'Catalog'
    },
    components: {
        dataSchema: { enabled: true },
        records: { enabled: true },
        treeAssignment: { enabled: true },
        optionValues: false,
        fixedValues: false,
        hierarchy: { enabled: true, supportsFolders: true },
        nestedCollections: false,
        relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
        scripting: { enabled: true },
        actions: { enabled: true },
        events: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: { enabled: true }
    },
    ui: {
        iconName: 'IconDatabase',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects',
        sidebarOrder: 20,
        nameKey: 'metahubs:linkedCollections.title'
    },
    physicalTable: {
        enabled: true,
        prefix: 'cat'
    }
})

export const SELF_HOSTED_APP_SET_ENTITY_TYPE = createSelfHostedAppEntityType({
    templateCodename: 'set',
    displayLabel: 'Sets',
    kindKey: 'set',
    codename: {
        en: 'Set',
        ru: 'Set'
    },
    components: {
        dataSchema: { enabled: true },
        records: false,
        treeAssignment: false,
        optionValues: false,
        fixedValues: { enabled: true },
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        scripting: { enabled: true },
        actions: { enabled: true },
        events: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconFileText',
        tabs: ['general', 'scripts'],
        sidebarSection: 'objects',
        sidebarOrder: 30,
        nameKey: 'metahubs:valueGroups.title'
    }
})

export const SELF_HOSTED_APP_ENUMERATION_ENTITY_TYPE = createSelfHostedAppEntityType({
    templateCodename: 'enumeration',
    displayLabel: 'Enumerations',
    kindKey: 'enumeration',
    codename: {
        en: 'Enumeration',
        ru: 'Enumeration'
    },
    components: {
        dataSchema: false,
        records: false,
        treeAssignment: false,
        optionValues: { enabled: true },
        fixedValues: false,
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        scripting: { enabled: true },
        actions: { enabled: true },
        events: { enabled: true },
        layoutConfig: false,
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconFiles',
        tabs: ['general', 'scripts'],
        sidebarSection: 'objects',
        sidebarOrder: 40,
        nameKey: 'metahubs:optionLists.title'
    }
})

export const SELF_HOSTED_APP_STANDARD_ENTITY_TYPES = [
    SELF_HOSTED_APP_HUB_ENTITY_TYPE,
    SELF_HOSTED_APP_CATALOG_ENTITY_TYPE,
    SELF_HOSTED_APP_SET_ENTITY_TYPE,
    SELF_HOSTED_APP_ENUMERATION_ENTITY_TYPE
]

export const SELF_HOSTED_APP_SHARED_ENTITIES = {
    attribute: {
        name: {
            en: 'Shared Title',
            ru: 'Общий заголовок'
        },
        codename: {
            en: 'shared_title',
            ru: 'shared_title'
        },
        includedCatalogSectionCodename: 'catalogs',
        excludedCatalogSectionCodename: 'settings'
    },
    constant: {
        name: {
            en: 'Shared Constant',
            ru: 'Общая константа'
        },
        codename: {
            en: 'shared_constant',
            ru: 'shared_constant'
        },
        targetSetSectionCodename: 'sets'
    },
    enumerationValue: {
        name: {
            en: 'Shared Status',
            ru: 'Общий статус'
        },
        codename: {
            en: 'shared_status',
            ru: 'shared_status'
        },
        targetEnumerationSectionCodename: 'enumerations'
    }
}

export const SELF_HOSTED_APP_SECTIONS = [
    {
        codename: 'metahubs',
        kind: 'catalog',
        name: { en: 'Metahubs', ru: 'Метахабы' },
        description: {
            en: 'Metahub records used to configure authoring, publication, and access workflows.',
            ru: 'Записи метахабов для настройки сценариев авторинга, публикации и доступа.'
        }
    },
    {
        codename: 'catalogs',
        kind: 'catalog',
        name: { en: 'Catalogs', ru: 'Каталоги' },
        description: {
            en: 'Catalog definitions with display settings, editing surfaces, and structure rules.',
            ru: 'Определения каталогов с настройками отображения, поверхностями редактирования и правилами структуры.'
        }
    },
    {
        codename: 'elements',
        kind: 'catalog',
        name: { en: 'Enumerations', ru: 'Перечисления' },
        description: {
            en: 'Catalog records that mirror enumeration-driven content in the published self-hosted app.',
            ru: 'Записи каталога, отражающие контент на основе перечислений в опубликованном автономном приложении.'
        }
    },
    {
        codename: 'hubs',
        kind: 'hub',
        name: { en: 'Hubs', ru: 'Хабы' },
        description: {
            en: 'Hub hierarchy for navigation, grouping, and scoped content placement.',
            ru: 'Иерархия хабов для навигации, группировки и размещения контента по областям.'
        }
    },
    {
        codename: 'sets',
        kind: 'set',
        name: { en: 'Sets', ru: 'Наборы' },
        description: {
            en: 'Reusable typed sets for references, templates, and metadata constraints.',
            ru: 'Переиспользуемые типизированные наборы для ссылок, шаблонов и ограничений метаданных.'
        }
    },
    {
        codename: 'enumerations',
        kind: 'enumeration',
        name: { en: 'Enumerations', ru: 'Перечисления' },
        description: {
            en: 'Enumeration dictionaries for stable choices in forms and records.',
            ru: 'Справочники перечислений для стабильных вариантов выбора в формах и записях.'
        }
    },
    {
        codename: 'constants',
        kind: 'catalog',
        name: { en: 'Sets', ru: 'Наборы' },
        description: {
            en: 'Catalog records that mirror set-driven content and shared typed references.',
            ru: 'Записи каталога, отражающие контент на основе наборов и общие типизированные ссылки.'
        }
    },
    {
        codename: 'branches',
        kind: 'catalog',
        name: { en: 'Branches', ru: 'Ветки' },
        description: {
            en: 'Working branches for preparing and comparing publication changes.',
            ru: 'Рабочие ветки для подготовки и сравнения изменений перед публикацией.'
        }
    },
    {
        codename: 'publications',
        kind: 'catalog',
        name: { en: 'Publications', ru: 'Публикации' },
        description: {
            en: 'Publication records that track application releases, versions, and activation state.',
            ru: 'Записи публикаций для релизов, версий и состояния активации.'
        }
    },
    {
        codename: 'layouts',
        kind: 'catalog',
        name: { en: 'Layouts', ru: 'Макеты' },
        description: {
            en: 'Dashboard layouts, widget zones, and presentation presets for the app.',
            ru: 'Макеты панели, зоны виджетов и пресеты представления приложения.'
        }
    },
    {
        codename: 'settings',
        kind: 'catalog',
        name: { en: 'Settings', ru: 'Настройки' },
        description: {
            en: 'Seeded settings rows derived from the real metahub settings registry defaults.',
            ru: 'Заполненные настройки на основе текущих значений по умолчанию из реестра настроек метахаба.'
        }
    }
]

export function findSelfHostedAppSection(sectionCodename) {
    return SELF_HOSTED_APP_SECTIONS.find((section) => section.codename === sectionCodename) ?? null
}

const ATTRIBUTE_LABELS = {
    name: { en: 'Name', ru: 'Название' },
    description: { en: 'Description', ru: 'Описание' },
    slug: { en: 'Slug', ru: 'Слаг' },
    is_public: { en: 'Is Public', ru: 'Публичный' },
    storage_mode: { en: 'Storage Mode', ru: 'Режим хранения' },
    codename: { en: 'Codename', ru: 'Кодовое имя' },
    kind: { en: 'Kind', ru: 'Вид' },
    sort_order: { en: 'Sort Order', ru: 'Порядок сортировки' },
    data_type: { en: 'Data Type', ru: 'Тип данных' },
    is_default: { en: 'Is Default', ru: 'По умолчанию' },
    version_number: { en: 'Version Number', ru: 'Номер версии' },
    is_active: { en: 'Is Active', ru: 'Активна' },
    template_key: { en: 'Template Key', ru: 'Ключ шаблона' },
    key: { en: 'Key', ru: 'Ключ' },
    value: { en: 'Value', ru: 'Значение' },
    category: { en: 'Category', ru: 'Категория' }
}

const CATALOG_ATTRIBUTE_DEFINITIONS = {
    metahubs: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'description', dataType: 'STRING' },
        { codename: 'slug', dataType: 'STRING', isRequired: true },
        { codename: 'is_public', dataType: 'BOOLEAN' },
        { codename: 'storage_mode', dataType: 'STRING' }
    ],
    catalogs: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'codename', dataType: 'STRING', isRequired: true },
        { codename: 'kind', dataType: 'STRING' }
    ],
    elements: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'codename', dataType: 'STRING', isRequired: true },
        { codename: 'sort_order', dataType: 'NUMBER' }
    ],
    constants: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'codename', dataType: 'STRING', isRequired: true },
        { codename: 'data_type', dataType: 'STRING' }
    ],
    branches: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'codename', dataType: 'STRING', isRequired: true },
        { codename: 'is_default', dataType: 'BOOLEAN' }
    ],
    publications: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'version_number', dataType: 'NUMBER' },
        { codename: 'is_active', dataType: 'BOOLEAN' }
    ],
    layouts: [
        { codename: 'name', dataType: 'STRING', isRequired: true },
        { codename: 'template_key', dataType: 'STRING' },
        { codename: 'is_default', dataType: 'BOOLEAN' },
        { codename: 'sort_order', dataType: 'NUMBER' }
    ],
    settings: [
        { codename: 'key', dataType: 'STRING', isRequired: true },
        { codename: 'value', dataType: 'STRING' },
        { codename: 'category', dataType: 'STRING' }
    ]
}

export function getSelfHostedAppCatalogAttributes(catalogCodename) {
    const defs = CATALOG_ATTRIBUTE_DEFINITIONS[catalogCodename] ?? []
    return defs.map((def) => ({
        ...def,
        name: ATTRIBUTE_LABELS[def.codename] ?? { en: def.codename, ru: def.codename }
    }))
}

const stringifySettingValue = (value) => {
    if (Array.isArray(value)) {
        return JSON.stringify(value)
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false'
    }
    if (value == null) {
        return ''
    }
    return String(value)
}

export const SELF_HOSTED_APP_SETTINGS_BASELINE = METAHUB_SETTINGS_REGISTRY.map((entry) => ({
    Key: entry.key,
    Value: stringifySettingValue(entry.defaultValue),
    Category: entry.tab
}))

const readLocalizedText = (value, locale = 'en') => {
    if (typeof value === 'string') {
        return value
    }
    if (!value || typeof value !== 'object') {
        return undefined
    }

    const locales = value.locales && typeof value.locales === 'object' ? value.locales : {}
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const directValue = locales?.[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryLocale = typeof value._primary === 'string' ? value._primary : undefined
    const primaryValue = primaryLocale ? locales?.[primaryLocale]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

const isLocalizedCodenameObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'locales' in value)

const flattenFieldRecords = (fields) => {
    if (!Array.isArray(fields)) {
        return []
    }

    return fields.flatMap((field) => {
        const normalizedField = field && typeof field === 'object' ? field : null
        if (!normalizedField) {
            return []
        }

        return [normalizedField, ...flattenFieldRecords(normalizedField.childFields)]
    })
}

const setLocalizedContent = (value, locale, content) => {
    if (!value || typeof value !== 'object') {
        return
    }
    if (!value.locales || typeof value.locales !== 'object') {
        value.locales = {}
    }
    if (!value.locales[locale] || typeof value.locales[locale] !== 'object') {
        value.locales[locale] = {}
    }
    value.locales[locale].content = content
    if (!value._primary) {
        value._primary = locale
    }
}

const ensureLocalizedField = (container, key) => {
    if (!container || typeof container !== 'object') {
        return null
    }
    if (!container[key] || typeof container[key] !== 'object') {
        container[key] = {
            _schema: 'v1',
            _primary: 'en',
            locales: {}
        }
    }
    return container[key]
}

const readCodenameText = (value) => {
    if (typeof value === 'string') {
        return value
    }
    return readLocalizedText(value, 'en')
}

const setEntityCodename = (entity, en, ru) => {
    if (!entity || typeof entity !== 'object') {
        return
    }
    entity.codename = buildVLC(en, ru)
}

const findSectionEntity = (entities, section) =>
    entities.find(
        (entity) =>
            entity?.kind === section.kind &&
            (readCodenameText(entity?.codename) === section.codename || readLocalizedText(entity?.presentation?.name, 'en') === section.name.en)
    )

export function buildSelfHostedAppLiveMetahubName(suffix) {
    void suffix
    return { ...SELF_HOSTED_APP_CANONICAL_METAHUB.name }
}

export function buildSelfHostedAppLiveMetahubCodename(suffix) {
    void suffix
    return buildVLC(SELF_HOSTED_APP_CANONICAL_METAHUB.codename.en, SELF_HOSTED_APP_CANONICAL_METAHUB.codename.ru)
}

export function canonicalizeSelfHostedAppEnvelope(envelope) {
    const nextEnvelope = JSON.parse(JSON.stringify(envelope))

    if (nextEnvelope?.snapshot && typeof nextEnvelope.snapshot === 'object') {
        nextEnvelope.snapshotHash = computeSnapshotHash(nextEnvelope.snapshot)
    }

    return nextEnvelope
}

const findDefaultLayout = (envelope) => {
    const layouts = Array.isArray(envelope?.snapshot?.layouts) ? envelope.snapshot.layouts : []
    const defaultLayoutId = envelope?.snapshot?.defaultLayoutId

    return (
        layouts.find((layout) => layout?.id === defaultLayoutId) ??
        layouts.find((layout) => layout?.isDefault) ??
        null
    )
}

const assertSelfHostedAppEntityTypeDefinition = (entityTypeDefinitions, expectedEntityType, errors) => {
    const entityTypeLabel = expectedEntityType.displayLabel ?? expectedEntityType.kindKey
    const persistedEntityType = entityTypeDefinitions[expectedEntityType.kindKey]

    if (!persistedEntityType || typeof persistedEntityType !== 'object') {
        errors.push(`Self-hosted app fixture must export the published ${entityTypeLabel} entity definition`)
        return
    }

    if (persistedEntityType.published !== expectedEntityType.published) {
        errors.push(`${entityTypeLabel} entity definition must remain published in the self-hosted app fixture`)
    }
    if (readLocalizedText(persistedEntityType.codename, 'en') !== expectedEntityType.codename.en) {
        errors.push(`${entityTypeLabel} entity definition is missing the canonical English codename locale`)
    }
    if (readLocalizedText(persistedEntityType.codename, 'ru') !== expectedEntityType.codename.ru) {
        errors.push(`${entityTypeLabel} entity definition is missing the canonical Russian codename locale`)
    }

    const persistedUi = persistedEntityType.ui && typeof persistedEntityType.ui === 'object' ? persistedEntityType.ui : {}
    if (persistedUi.iconName !== expectedEntityType.ui.iconName) {
        errors.push(`${entityTypeLabel} entity definition icon drifted in the self-hosted app fixture`)
    }
    if (persistedUi.sidebarSection !== expectedEntityType.ui.sidebarSection) {
        errors.push(`${entityTypeLabel} entity definition sidebar section drifted in the self-hosted app fixture`)
    }
    if (persistedUi.sidebarOrder !== expectedEntityType.ui.sidebarOrder) {
        errors.push(`${entityTypeLabel} entity definition sidebar order drifted in the self-hosted app fixture`)
    }
    if (persistedUi.nameKey !== expectedEntityType.ui.nameKey) {
        errors.push(`${entityTypeLabel} entity definition nameKey drifted in the self-hosted app fixture`)
    }
    if (persistedUi.descriptionKey !== expectedEntityType.ui.descriptionKey) {
        errors.push(`${entityTypeLabel} entity definition descriptionKey drifted in the self-hosted app fixture`)
    }

    const persistedTabs = Array.isArray(persistedUi.tabs) ? persistedUi.tabs : []
    if (JSON.stringify(persistedTabs) !== JSON.stringify(expectedEntityType.ui.tabs)) {
        errors.push(`${entityTypeLabel} entity definition tabs drifted in the self-hosted app fixture`)
    }

    const persistedComponents =
        persistedEntityType.components && typeof persistedEntityType.components === 'object' ? persistedEntityType.components : {}
    const persistedPhysicalTable =
        persistedComponents.physicalTable && typeof persistedComponents.physicalTable === 'object'
            ? persistedComponents.physicalTable
            : persistedComponents.physicalTable

    for (const [componentKey, expectedComponent] of Object.entries(expectedEntityType.components ?? {})) {
        const persistedComponent = persistedComponents[componentKey]
        if (!expectedComponent || typeof expectedComponent !== 'object') {
            continue
        }

        if (!persistedComponent || typeof persistedComponent !== 'object' || persistedComponent.enabled !== expectedComponent.enabled) {
            errors.push(`${entityTypeLabel} entity definition component ${componentKey} drifted in the self-hosted app fixture`)
        }
    }

    if (expectedEntityType.physicalTable && typeof expectedEntityType.physicalTable === 'object') {
        if (!persistedPhysicalTable || typeof persistedPhysicalTable !== 'object' || persistedPhysicalTable.enabled !== true) {
            errors.push(`${entityTypeLabel} entity definition must keep the physicalTable component enabled`)
        } else if (persistedPhysicalTable.prefix !== expectedEntityType.physicalTable.prefix) {
            errors.push(`${entityTypeLabel} entity definition physicalTable prefix drifted in the self-hosted app fixture`)
        }
    } else if (persistedPhysicalTable && typeof persistedPhysicalTable === 'object' && persistedPhysicalTable.enabled === true) {
        errors.push(`${entityTypeLabel} entity definition must keep the physicalTable component disabled`)
    }
}

export function assertSelfHostedAppEnvelopeContract(envelope) {
    const errors = []
    const metahubNameEn = readLocalizedText(envelope?.metahub?.name, 'en')
    const metahubNameRu = readLocalizedText(envelope?.metahub?.name, 'ru')
    const metahubDescriptionEn = readLocalizedText(envelope?.metahub?.description, 'en')
    const metahubDescriptionRu = readLocalizedText(envelope?.metahub?.description, 'ru')
    const metahubCodename = readLocalizedText(envelope?.metahub?.codename, 'en')
    const metahubCodenameRu = readLocalizedText(envelope?.metahub?.codename, 'ru')

    if (metahubNameEn !== SELF_HOSTED_APP_CANONICAL_METAHUB.name.en) {
        errors.push(`Unexpected self-hosted app fixture name: ${metahubNameEn || '<missing>'}`)
    }
    if (metahubNameRu !== SELF_HOSTED_APP_CANONICAL_METAHUB.name.ru) {
        errors.push(`Unexpected Russian self-hosted app fixture name: ${metahubNameRu || '<missing>'}`)
    }
    if (metahubDescriptionEn !== SELF_HOSTED_APP_CANONICAL_METAHUB.description.en) {
        errors.push('Self-hosted app fixture is missing the canonical English metahub description')
    }
    if (metahubDescriptionRu !== SELF_HOSTED_APP_CANONICAL_METAHUB.description.ru) {
        errors.push('Self-hosted app fixture is missing the canonical Russian metahub description')
    }
    if (metahubCodename !== SELF_HOSTED_APP_CANONICAL_METAHUB.codename.en) {
        errors.push(`Unexpected self-hosted app fixture codename: ${metahubCodename || '<missing>'}`)
    }
    if (metahubCodenameRu !== SELF_HOSTED_APP_CANONICAL_METAHUB.codename.ru) {
        errors.push(`Unexpected Russian self-hosted app fixture codename: ${metahubCodenameRu || '<missing>'}`)
    }
    if (!isLocalizedCodenameObject(envelope?.metahub?.codename)) {
        errors.push('Self-hosted app fixture metahub codename must be exported as a localized codename object')
    }
    if ([metahubNameEn, metahubNameRu, metahubCodename, metahubCodenameRu].some((value) => typeof value === 'string' && /e2e|runid|self-model|imported-/i.test(value))) {
        errors.push('Self-hosted app fixture identity still contains run-specific or legacy self-model markers')
    }

    const structureVersion = envelope?.snapshot?.versionEnvelope?.structureVersion
    if (structureVersion !== SELF_HOSTED_APP_STRUCTURE_VERSION) {
        errors.push(
            `Self-hosted app fixture structureVersion drifted: ${String(structureVersion)} != ${SELF_HOSTED_APP_STRUCTURE_VERSION}`
        )
    }

    const entities = Object.values(envelope?.snapshot?.entities ?? {})
    const entityTypeDefinitions =
        envelope?.snapshot?.entityTypeDefinitions && typeof envelope.snapshot.entityTypeDefinitions === 'object'
            ? envelope.snapshot.entityTypeDefinitions
            : {}
    for (const expectedEntityType of SELF_HOSTED_APP_STANDARD_ENTITY_TYPES) {
        assertSelfHostedAppEntityTypeDefinition(entityTypeDefinitions, expectedEntityType, errors)
    }

    if (entities.some((entity) => entity.kind === 'catalog' && (readCodenameText(entity?.codename) === 'Attributes' || readLocalizedText(entity.presentation?.name, 'en') === 'Attributes'))) {
        errors.push('Self-hosted app fixture still contains the deprecated standalone Attributes catalog')
    }
    if (
        entities.some(
            (entity) =>
                entity.kind === 'catalog' &&
                (readCodenameText(entity?.codename) === 'enum_values' || readLocalizedText(entity?.presentation?.name, 'en') === 'Enumeration Values')
        )
    ) {
        errors.push('Self-hosted app fixture still contains the deprecated standalone Enumeration Values catalog')
    }
    if (
        entities.some(
            (entity) =>
                entity.kind === 'catalog' &&
                ['Elements', 'Constants'].includes(readLocalizedText(entity?.presentation?.name, 'en') || '')
        )
    ) {
        errors.push('Self-hosted app fixture still contains legacy Elements / Constants catalog labels')
    }
    if (
        entities.some((entity) => ['MainHub', 'MainCatalog', 'MainSet', 'MainEnumeration'].includes(readCodenameText(entity?.codename)))
    ) {
        errors.push('Self-hosted app fixture still contains legacy type-suffixed Main codenames')
    }

    for (const entity of entities) {
        if (!isLocalizedCodenameObject(entity?.codename) || !readCodenameText(entity?.codename)) {
            errors.push(`Entity ${String(entity?.id || '<unknown>')} must keep codename as a localized snapshot object`)
        }
    }

    for (const field of entities.flatMap((entity) => flattenFieldRecords(entity?.fields))) {
        if (!isLocalizedCodenameObject(field?.codename) || !readCodenameText(field?.codename)) {
            errors.push(`Field ${String(field?.id || '<unknown>')} must keep codename as a localized snapshot object`)
        }
    }

    const enumerationValues = Object.values(envelope?.snapshot?.enumerationValues ?? {})
    for (const value of enumerationValues.flat()) {
        if (!isLocalizedCodenameObject(value?.codename) || !readCodenameText(value?.codename)) {
            errors.push(`Enumeration value ${String(value?.id || '<unknown>')} must keep codename as a localized snapshot object`)
        }
    }

    const fixedValues = Object.values(envelope?.snapshot?.fixedValues ?? {})
    for (const constant of fixedValues.flat()) {
        if (!isLocalizedCodenameObject(constant?.codename) || !readCodenameText(constant?.codename)) {
            errors.push(`Constant ${String(constant?.id || '<unknown>')} must keep codename as a localized snapshot object`)
        }
    }

    const scripts = Array.isArray(envelope?.snapshot?.scripts) ? envelope.snapshot.scripts : []
    for (const script of scripts) {
        if (!isLocalizedCodenameObject(script?.codename) || !readCodenameText(script?.codename)) {
            errors.push(`Script ${String(script?.id || '<unknown>')} must keep codename as a localized snapshot object`)
        }
    }

    const sharedAttributes = Array.isArray(envelope?.snapshot?.sharedFieldDefinitions)
        ? envelope.snapshot.sharedFieldDefinitions
        : Array.isArray(envelope?.snapshot?.sharedAttributes)
            ? envelope.snapshot.sharedAttributes
            : []
    const sharedConstants = Array.isArray(envelope?.snapshot?.sharedFixedValues)
        ? envelope.snapshot.sharedFixedValues
        : Array.isArray(envelope?.snapshot?.sharedConstants)
            ? envelope.snapshot.sharedConstants
            : []
    const sharedEnumerationValues = Array.isArray(envelope?.snapshot?.sharedOptionValues)
        ? envelope.snapshot.sharedOptionValues
        : Array.isArray(envelope?.snapshot?.sharedEnumerationValues)
            ? envelope.snapshot.sharedEnumerationValues
            : []
    const sharedEntityOverrides = Array.isArray(envelope?.snapshot?.sharedEntityOverrides) ? envelope.snapshot.sharedEntityOverrides : []

    const canonicalSharedAttribute = sharedAttributes.find(
        (item) =>
            readCodenameText(item?.codename) === SELF_HOSTED_APP_SHARED_ENTITIES.attribute.codename.en ||
            readLocalizedText(item?.presentation?.name, 'en') === SELF_HOSTED_APP_SHARED_ENTITIES.attribute.name.en
    )
    if (!canonicalSharedAttribute) {
        errors.push('Self-hosted app fixture must include the canonical shared attribute')
    }

    const canonicalSharedConstant = sharedConstants.find(
        (item) =>
            readCodenameText(item?.codename) === SELF_HOSTED_APP_SHARED_ENTITIES.constant.codename.en ||
            readLocalizedText(item?.presentation?.name, 'en') === SELF_HOSTED_APP_SHARED_ENTITIES.constant.name.en
    )
    if (!canonicalSharedConstant) {
        errors.push('Self-hosted app fixture must include the canonical shared constant')
    }

    const canonicalSharedEnumerationValue = sharedEnumerationValues.find(
        (item) =>
            readCodenameText(item?.codename) === SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.codename.en ||
            readLocalizedText(item?.presentation?.name, 'en') === SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.name.en
    )
    if (!canonicalSharedEnumerationValue) {
        errors.push('Self-hosted app fixture must include the canonical shared enumeration value')
    }

    const excludedCatalogSection = findSelfHostedAppSection(SELF_HOSTED_APP_SHARED_ENTITIES.attribute.excludedCatalogSectionCodename)
    const excludedCatalogEntity = excludedCatalogSection ? findSectionEntity(entities, excludedCatalogSection) : null
    if (
        canonicalSharedAttribute &&
        excludedCatalogEntity &&
        !sharedEntityOverrides.some(
            (override) =>
                override?.sharedEntityId === canonicalSharedAttribute.id &&
                override?.targetObjectId === excludedCatalogEntity.id &&
                override?.isExcluded === true
        )
    ) {
        errors.push('Self-hosted app fixture must exclude the canonical shared attribute from the Settings catalog')
    }

    const layouts = Array.isArray(envelope?.snapshot?.layouts) ? envelope.snapshot.layouts : []
    if (layouts.length !== 1) {
        errors.push(`Self-hosted app fixture should export exactly one canonical layout, received ${layouts.length}`)
    }

    const defaultLayout = findDefaultLayout(envelope)
    if (!defaultLayout) {
        errors.push('Self-hosted app fixture is missing the canonical default layout')
    } else {
        if (readLocalizedText(defaultLayout.name, 'en') !== SELF_HOSTED_APP_LAYOUT.name.en) {
            errors.push('Self-hosted app fixture default layout is missing the canonical English name')
        }
        if (readLocalizedText(defaultLayout.name, 'ru') !== SELF_HOSTED_APP_LAYOUT.name.ru) {
            errors.push('Self-hosted app fixture default layout is missing the canonical Russian name')
        }
        if (readLocalizedText(defaultLayout.description, 'en') !== SELF_HOSTED_APP_LAYOUT.description.en) {
            errors.push('Self-hosted app fixture default layout is missing the canonical English description')
        }
        if (readLocalizedText(defaultLayout.description, 'ru') !== SELF_HOSTED_APP_LAYOUT.description.ru) {
            errors.push('Self-hosted app fixture default layout is missing the canonical Russian description')
        }

        const runtimeConfig = defaultLayout?.config && typeof defaultLayout.config === 'object' ? defaultLayout.config : {}
        for (const [key, expectedValue] of Object.entries(SELF_HOSTED_APP_LAYOUT.runtimeConfig)) {
            if (runtimeConfig[key] !== expectedValue) {
                errors.push(`Default layout runtime config drifted for ${key}: ${String(runtimeConfig[key])} != ${String(expectedValue)}`)
            }
        }

        const topLevelLayoutConfig =
            envelope?.snapshot?.layoutConfig && typeof envelope.snapshot.layoutConfig === 'object'
                ? envelope.snapshot.layoutConfig
                : {}
        for (const [key, expectedValue] of Object.entries(SELF_HOSTED_APP_LAYOUT.runtimeConfig)) {
            if (topLevelLayoutConfig[key] !== expectedValue) {
                errors.push(`Top-level snapshot layout config drifted for ${key}: ${String(topLevelLayoutConfig[key])} != ${String(expectedValue)}`)
            }
        }

        const layoutWidgets = Array.isArray(envelope?.snapshot?.layoutZoneWidgets) ? envelope.snapshot.layoutZoneWidgets : []
        const menuWidgets = layoutWidgets.filter(
            (widget) => widget?.layoutId === defaultLayout.id && widget?.widgetKey === 'menuWidget'
        )
        const activeMenuWidgets = menuWidgets.filter((widget) => widget?.isActive !== false)
        const menuWidget = activeMenuWidgets[0] ?? menuWidgets[0]
        if (activeMenuWidgets.length !== 1) {
            errors.push(
                `Self-hosted app fixture must contain exactly one active menuWidget for the default layout, received ${activeMenuWidgets.length}`
            )
        }
        if (!menuWidget) {
            errors.push('Self-hosted app fixture default layout is missing the menuWidget zone widget')
        } else {
            if (menuWidget?.config?.autoShowAllCatalogs !== true) {
                errors.push('Self-hosted app fixture menuWidget must enable autoShowAllCatalogs')
            }
            if (menuWidget?.config?.showTitle !== true) {
                errors.push('Self-hosted app fixture menuWidget must show its title')
            }
            if (readLocalizedText(menuWidget?.config?.title, 'en') !== SELF_HOSTED_APP_LAYOUT.menuTitle.en) {
                errors.push('Self-hosted app fixture menuWidget is missing the canonical English title')
            }
            if (readLocalizedText(menuWidget?.config?.title, 'ru') !== SELF_HOSTED_APP_LAYOUT.menuTitle.ru) {
                errors.push('Self-hosted app fixture menuWidget is missing the canonical Russian title')
            }
        }

        const detailsTableWidget = layoutWidgets.find(
            (widget) => widget?.layoutId === defaultLayout.id && widget?.widgetKey === 'detailsTable'
        )
        if (!detailsTableWidget) {
            errors.push('Self-hosted app fixture default layout is missing the detailsTable widget')
        }
    }

    for (const section of SELF_HOSTED_APP_SECTIONS) {
        const sectionEntity = entities.find(
            (entity) => entity.kind === section.kind && readLocalizedText(entity.presentation?.name, 'en') === section.name.en
        )

        if (!sectionEntity) {
            errors.push(`Missing self-hosted app section: ${section.name.en}`)
            continue
        }

        if (readLocalizedText(sectionEntity.presentation?.name, 'ru') !== section.name.ru) {
            errors.push(`Section ${section.name.en} is missing the canonical Russian name`)
        }
        if (readLocalizedText(sectionEntity.codename, 'en') !== section.name.en) {
            errors.push(`Section ${section.name.en} is missing the canonical English codename locale`)
        }
        if (readLocalizedText(sectionEntity.codename, 'ru') !== section.name.ru) {
            errors.push(`Section ${section.name.en} is missing the canonical Russian codename locale`)
        }
        if (readLocalizedText(sectionEntity.presentation?.description, 'en') !== section.description.en) {
            errors.push(`Section ${section.name.en} is missing the canonical English description`)
        }
        if (readLocalizedText(sectionEntity.presentation?.description, 'ru') !== section.description.ru) {
            errors.push(`Section ${section.name.en} is missing the canonical Russian description`)
        }

        if (section.kind === 'catalog') {
            const fieldNames = Array.isArray(sectionEntity.fields) ? sectionEntity.fields : []
            if (fieldNames.some((field) => !readLocalizedText(field.presentation?.name, 'ru'))) {
                errors.push(`Catalog ${section.name.en} contains attributes without Russian localized names`)
            }
        }
    }

    const mainEntities = entities.filter((entity) => readCodenameText(entity?.codename) === 'Main')
    for (const entity of mainEntities) {
        const localizedMainCodenameRu = readLocalizedText(entity?.codename, 'ru')
        if (!localizedMainCodenameRu) {
            errors.push(`Main ${entity?.kind || 'entity'} is missing the canonical Russian codename locale`)
        }
    }

    const settingsCatalog = entities.find(
        (entity) => entity.kind === 'catalog' && readLocalizedText(entity.presentation?.name, 'en') === 'Settings'
    )
    if (!settingsCatalog?.id) {
        errors.push('Self-hosted app fixture is missing the Settings catalog')
    } else {
        const settingsRows = Array.isArray(envelope?.snapshot?.elements?.[settingsCatalog.id])
            ? envelope.snapshot.elements[settingsCatalog.id]
            : []
        const actualKeys = new Set(settingsRows.map((row) => row?.data?.Key).filter((key) => typeof key === 'string'))

        if (settingsRows.length !== SELF_HOSTED_APP_SETTINGS_BASELINE.length) {
            errors.push(
                `Settings baseline row count drifted: ${settingsRows.length} != ${SELF_HOSTED_APP_SETTINGS_BASELINE.length}`
            )
        }

        for (const expectedRow of SELF_HOSTED_APP_SETTINGS_BASELINE) {
            if (!actualKeys.has(expectedRow.Key)) {
                errors.push(`Settings baseline is missing key ${expectedRow.Key}`)
            }
        }

        const catalogLayouts = Array.isArray(envelope?.snapshot?.catalogLayouts) ? envelope.snapshot.catalogLayouts : []
        const settingsCatalogLayouts = catalogLayouts.filter(
            (layout) => (layout?.linkedCollectionId ?? layout?.catalogId) === settingsCatalog.id
        )

        if (settingsCatalogLayouts.length !== 1) {
            errors.push(
                `Self-hosted app fixture must contain exactly one catalog-specific layout for Settings, received ${settingsCatalogLayouts.length}`
            )
        }

        const settingsLayout = settingsCatalogLayouts[0]
        const defaultLayout = findDefaultLayout(envelope)
        const layoutWidgets = Array.isArray(envelope?.snapshot?.layoutZoneWidgets) ? envelope.snapshot.layoutZoneWidgets : []
        const catalogLayoutWidgetOverrides = Array.isArray(envelope?.snapshot?.catalogLayoutWidgetOverrides)
            ? envelope.snapshot.catalogLayoutWidgetOverrides
            : []

        if (!settingsLayout) {
            errors.push('Self-hosted app fixture is missing the Settings catalog-specific layout override')
        } else {
            if (readLocalizedText(settingsLayout.name, 'en') !== SELF_HOSTED_APP_SETTINGS_LAYOUT.name.en) {
                errors.push('Settings catalog layout is missing the canonical English name')
            }
            if (readLocalizedText(settingsLayout.name, 'ru') !== SELF_HOSTED_APP_SETTINGS_LAYOUT.name.ru) {
                errors.push('Settings catalog layout is missing the canonical Russian name')
            }
            if (readLocalizedText(settingsLayout.description, 'en') !== SELF_HOSTED_APP_SETTINGS_LAYOUT.description.en) {
                errors.push('Settings catalog layout is missing the canonical English description')
            }
            if (readLocalizedText(settingsLayout.description, 'ru') !== SELF_HOSTED_APP_SETTINGS_LAYOUT.description.ru) {
                errors.push('Settings catalog layout is missing the canonical Russian description')
            }
            if (defaultLayout?.id && settingsLayout.baseLayoutId !== defaultLayout.id) {
                errors.push('Settings catalog layout must inherit from the canonical default layout')
            }

            const settingsLayoutConfig = settingsLayout?.config && typeof settingsLayout.config === 'object' ? settingsLayout.config : {}
            for (const [key, expectedValue] of Object.entries({
                showViewToggle: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.showViewToggle,
                defaultViewMode: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.defaultViewMode,
                showFilterBar: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.showFilterBar
            })) {
                if (settingsLayoutConfig[key] !== expectedValue) {
                    errors.push(
                        `Settings catalog layout runtime config drifted for ${key}: ${String(settingsLayoutConfig[key])} != ${String(expectedValue)}`
                    )
                }
            }

            const settingsCatalogBehavior =
                settingsLayoutConfig.catalogBehavior && typeof settingsLayoutConfig.catalogBehavior === 'object'
                    ? settingsLayoutConfig.catalogBehavior
                    : {}

            for (const [key, expectedValue] of Object.entries(SELF_HOSTED_APP_SETTINGS_LAYOUT.catalogBehavior)) {
                if (settingsCatalogBehavior[key] !== expectedValue) {
                    errors.push(
                        `Settings catalog layout catalogBehavior drifted for ${key}: ${String(settingsCatalogBehavior[key])} != ${String(expectedValue)}`
                    )
                }
            }

            const defaultDetailsTitleWidget = layoutWidgets.find(
                (widget) => widget?.layoutId === defaultLayout?.id && widget?.widgetKey === 'detailsTitle' && widget?.isActive !== false
            )
            if (!defaultDetailsTitleWidget?.id) {
                errors.push('Self-hosted app fixture default layout is missing the active detailsTitle widget needed for Settings overrides')
            } else {
                const detailsTitleOverride = catalogLayoutWidgetOverrides.find(
                    (override) =>
                        override?.catalogLayoutId === settingsLayout.id &&
                        override?.baseWidgetId === defaultDetailsTitleWidget.id &&
                        override?.isDeletedOverride !== true
                )

                if (!detailsTitleOverride || detailsTitleOverride.isActive !== false) {
                    errors.push('Settings catalog layout must disable the inherited detailsTitle widget via a catalog layout override')
                }
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
}
