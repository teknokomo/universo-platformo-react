import { METAHUB_SETTINGS_REGISTRY } from '@universo/types'
import { buildVLC, computeSnapshotHash } from '@universo/utils'

export const SELF_HOSTED_APP_FIXTURE_FILENAME = 'metahubs-self-hosted-app-snapshot.json'
export const SELF_HOSTED_APP_SCREENSHOTS_DIRNAME = 'self-hosted-app'

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

function canonicalizeMenuWidgetConfig(config) {
    const nextConfig = config && typeof config === 'object' ? { ...config } : {}
    nextConfig.autoShowAllCatalogs = true
    nextConfig.showTitle = true

    const titleField = ensureLocalizedField(nextConfig, 'title')
    if (titleField) {
        setLocalizedContent(titleField, 'en', SELF_HOSTED_APP_LAYOUT.menuTitle.en)
        setLocalizedContent(titleField, 'ru', SELF_HOSTED_APP_LAYOUT.menuTitle.ru)
    }

    return nextConfig
}

export function canonicalizeSelfHostedAppEnvelope(envelope) {
    const nextEnvelope = JSON.parse(JSON.stringify(envelope))

    if (nextEnvelope?.metahub?.name) {
        setLocalizedContent(nextEnvelope.metahub.name, 'en', SELF_HOSTED_APP_CANONICAL_METAHUB.name.en)
        setLocalizedContent(nextEnvelope.metahub.name, 'ru', SELF_HOSTED_APP_CANONICAL_METAHUB.name.ru)
    }

    if (nextEnvelope?.metahub?.description) {
        setLocalizedContent(nextEnvelope.metahub.description, 'en', SELF_HOSTED_APP_CANONICAL_METAHUB.description.en)
        setLocalizedContent(nextEnvelope.metahub.description, 'ru', SELF_HOSTED_APP_CANONICAL_METAHUB.description.ru)
    }

    if (nextEnvelope?.metahub?.codename) {
        setLocalizedContent(nextEnvelope.metahub.codename, 'en', SELF_HOSTED_APP_CANONICAL_METAHUB.codename.en)
        setLocalizedContent(nextEnvelope.metahub.codename, 'ru', SELF_HOSTED_APP_CANONICAL_METAHUB.codename.ru)
    }

    const entities = Object.values(nextEnvelope?.snapshot?.entities ?? {})
    for (const section of SELF_HOSTED_APP_SECTIONS) {
        const entity = findSectionEntity(entities, section)
        if (!entity) {
            continue
        }

        const presentation = entity.presentation && typeof entity.presentation === 'object' ? entity.presentation : (entity.presentation = {})
        const nameField = ensureLocalizedField(presentation, 'name')
        const descriptionField = ensureLocalizedField(presentation, 'description')

        if (nameField) {
            setLocalizedContent(nameField, 'en', section.name.en)
            setLocalizedContent(nameField, 'ru', section.name.ru)
        }
        if (descriptionField) {
            setLocalizedContent(descriptionField, 'en', section.description.en)
            setLocalizedContent(descriptionField, 'ru', section.description.ru)
        }

        setEntityCodename(entity, section.name.en, section.name.ru)
    }

    for (const entity of entities) {
        if (readCodenameText(entity?.codename) !== 'Main') {
            continue
        }

        const nameEn = readLocalizedText(entity?.presentation?.name, 'en')
        const nameRu = readLocalizedText(entity?.presentation?.name, 'ru')
        if (nameEn && nameRu) {
            setEntityCodename(entity, nameEn, nameRu)
        }
    }

    const defaultLayout = findDefaultLayout(nextEnvelope)
    if (defaultLayout) {
        const layoutName = ensureLocalizedField(defaultLayout, 'name')
        const layoutDescription = ensureLocalizedField(defaultLayout, 'description')

        if (layoutName) {
            setLocalizedContent(layoutName, 'en', SELF_HOSTED_APP_LAYOUT.name.en)
            setLocalizedContent(layoutName, 'ru', SELF_HOSTED_APP_LAYOUT.name.ru)
        }
        if (layoutDescription) {
            setLocalizedContent(layoutDescription, 'en', SELF_HOSTED_APP_LAYOUT.description.en)
            setLocalizedContent(layoutDescription, 'ru', SELF_HOSTED_APP_LAYOUT.description.ru)
        }

        defaultLayout.config = {
            ...(defaultLayout.config && typeof defaultLayout.config === 'object' ? defaultLayout.config : {}),
            ...SELF_HOSTED_APP_LAYOUT.runtimeConfig
        }
    }

    if (nextEnvelope?.snapshot?.layoutConfig && typeof nextEnvelope.snapshot.layoutConfig === 'object') {
        nextEnvelope.snapshot.layoutConfig = {
            ...nextEnvelope.snapshot.layoutConfig,
            ...SELF_HOSTED_APP_LAYOUT.runtimeConfig
        }
    }

    const layoutWidgets = Array.isArray(nextEnvelope?.snapshot?.layoutZoneWidgets) ? nextEnvelope.snapshot.layoutZoneWidgets : []
    if (defaultLayout && Array.isArray(nextEnvelope?.snapshot?.layoutZoneWidgets)) {
        const menuWidgets = layoutWidgets.filter(
            (widget) => widget?.layoutId === defaultLayout.id && widget?.widgetKey === 'menuWidget'
        )
        const canonicalMenuWidget =
            menuWidgets.find((widget) => readLocalizedText(widget?.config?.title, 'en') === SELF_HOSTED_APP_LAYOUT.menuTitle.en) ??
            menuWidgets[0] ??
            null

        if (canonicalMenuWidget) {
            canonicalMenuWidget.config = canonicalizeMenuWidgetConfig(canonicalMenuWidget.config)
            const minSortOrder = Math.min(
                ...menuWidgets
                    .map((widget) => Number(widget?.sortOrder))
                    .filter((value) => Number.isFinite(value) && value > 0)
            )
            if (Number.isFinite(minSortOrder)) {
                canonicalMenuWidget.sortOrder = minSortOrder
            }

            nextEnvelope.snapshot.layoutZoneWidgets = layoutWidgets.filter(
                (widget) =>
                    !(widget?.layoutId === defaultLayout.id && widget?.widgetKey === 'menuWidget' && widget?.id !== canonicalMenuWidget.id)
            )
        }
    }

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
    if ([metahubNameEn, metahubNameRu, metahubCodename, metahubCodenameRu].some((value) => typeof value === 'string' && /e2e|runid|self-model|imported-/i.test(value))) {
        errors.push('Self-hosted app fixture identity still contains run-specific or legacy self-model markers')
    }

    const entities = Object.values(envelope?.snapshot?.entities ?? {})
    if (entities.some((entity) => entity.kind === 'catalog' && (entity.codename === 'Attributes' || readLocalizedText(entity.presentation?.name, 'en') === 'Attributes'))) {
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
        const menuWidget = menuWidgets[0]
        if (menuWidgets.length !== 1) {
            errors.push(`Self-hosted app fixture must contain exactly one menuWidget for the default layout, received ${menuWidgets.length}`)
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
    }

    if (errors.length > 0) {
        throw new Error(errors.join('\n'))
    }
}
