import { createRequire } from 'node:module'
import { METAHUB_SETTINGS_REGISTRY } from '@universo/types'
import { buildVLC, computeSnapshotHash } from '@universo/utils'

const require = createRequire(import.meta.url)

const resolveSelfHostedAppStructureVersion = () => {
    try {
        const { CURRENT_STRUCTURE_VERSION_SEMVER } = require(
            '../../../../packages/metahubs-backend/base/dist/domains/metahubs/services/structureVersions.js'
        )
        if (typeof CURRENT_STRUCTURE_VERSION_SEMVER === 'string' && CURRENT_STRUCTURE_VERSION_SEMVER.trim()) {
            return CURRENT_STRUCTURE_VERSION_SEMVER
        }
    } catch {
        // Fall back to the current validated baseline when the backend dist is not present yet.
    }

    return '0.4.0'
}

export const SELF_HOSTED_APP_FIXTURE_FILENAME = 'metahubs-self-hosted-app-snapshot.json'
export const SELF_HOSTED_APP_SCREENSHOTS_DIRNAME = 'self-hosted-app'
export const SELF_HOSTED_APP_STRUCTURE_VERSION = resolveSelfHostedAppStructureVersion()

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

export const SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE = {
    templateCodename: 'catalog-v2',
    kindKey: 'custom.catalog-v2',
    codename: {
        en: 'CatalogV2',
        ru: 'CatalogV2'
    },
    ui: {
        iconName: 'IconDatabase',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'Catalogs V2',
        descriptionKey:
            'Catalog-compatible custom entity with hubs, hierarchy, references, scripts, and publication-ready layout support.'
    },
    physicalTablePrefix: 'catx',
    compatibility: {
        legacyObjectKind: 'catalog'
    },
    published: true
}

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
    const catalogV2EntityType = entityTypeDefinitions[SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.kindKey]

    if (!catalogV2EntityType || typeof catalogV2EntityType !== 'object') {
        errors.push('Self-hosted app fixture must export the published Catalogs V2 custom entity definition')
    } else {
        if (catalogV2EntityType.isBuiltin === true) {
            errors.push('Catalogs V2 custom entity definition must stay custom in the self-hosted app fixture')
        }
        if (catalogV2EntityType.published !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.published) {
            errors.push('Catalogs V2 custom entity definition must remain published in the self-hosted app fixture')
        }
        if (readLocalizedText(catalogV2EntityType.codename, 'en') !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.codename.en) {
            errors.push('Catalogs V2 custom entity definition is missing the canonical English codename locale')
        }
        if (readLocalizedText(catalogV2EntityType.codename, 'ru') !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.codename.ru) {
            errors.push('Catalogs V2 custom entity definition is missing the canonical Russian codename locale')
        }

        const catalogV2Ui = catalogV2EntityType.ui && typeof catalogV2EntityType.ui === 'object' ? catalogV2EntityType.ui : {}
        if (catalogV2Ui.iconName !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.ui.iconName) {
            errors.push('Catalogs V2 custom entity definition icon drifted in the self-hosted app fixture')
        }
        if (catalogV2Ui.sidebarSection !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.ui.sidebarSection) {
            errors.push('Catalogs V2 custom entity definition sidebar section drifted in the self-hosted app fixture')
        }
        if (catalogV2Ui.nameKey !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.ui.nameKey) {
            errors.push('Catalogs V2 custom entity definition nameKey drifted in the self-hosted app fixture')
        }
        if (catalogV2Ui.descriptionKey !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.ui.descriptionKey) {
            errors.push('Catalogs V2 custom entity definition descriptionKey drifted in the self-hosted app fixture')
        }

        const catalogV2Tabs = Array.isArray(catalogV2Ui.tabs) ? catalogV2Ui.tabs : []
        if (JSON.stringify(catalogV2Tabs) !== JSON.stringify(SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.ui.tabs)) {
            errors.push('Catalogs V2 custom entity definition tabs drifted in the self-hosted app fixture')
        }

        const catalogV2Components =
            catalogV2EntityType.components && typeof catalogV2EntityType.components === 'object' ? catalogV2EntityType.components : {}
        const catalogV2PhysicalTable =
            catalogV2Components.physicalTable && typeof catalogV2Components.physicalTable === 'object'
                ? catalogV2Components.physicalTable
                : {}

        if (catalogV2PhysicalTable.enabled !== true) {
            errors.push('Catalogs V2 custom entity definition must keep the physicalTable component enabled')
        }
        if (catalogV2PhysicalTable.prefix !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.physicalTablePrefix) {
            errors.push('Catalogs V2 custom entity definition physicalTable prefix drifted in the self-hosted app fixture')
        }

        const catalogV2Config =
            catalogV2EntityType.config && typeof catalogV2EntityType.config === 'object' ? catalogV2EntityType.config : {}
        const catalogV2Compatibility =
            catalogV2Config.compatibility && typeof catalogV2Config.compatibility === 'object' ? catalogV2Config.compatibility : {}

        if (
            catalogV2Compatibility.legacyObjectKind !== SELF_HOSTED_APP_CATALOG_V2_ENTITY_TYPE.compatibility.legacyObjectKind
        ) {
            errors.push('Catalogs V2 custom entity definition legacy compatibility drifted in the self-hosted app fixture')
        }
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

    const constants = Object.values(envelope?.snapshot?.constants ?? {})
    for (const constant of constants.flat()) {
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

    const sharedAttributes = Array.isArray(envelope?.snapshot?.sharedAttributes) ? envelope.snapshot.sharedAttributes : []
    const sharedConstants = Array.isArray(envelope?.snapshot?.sharedConstants) ? envelope.snapshot.sharedConstants : []
    const sharedEnumerationValues = Array.isArray(envelope?.snapshot?.sharedEnumerationValues)
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
        const settingsCatalogLayouts = catalogLayouts.filter((layout) => layout?.catalogId === settingsCatalog.id)

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
