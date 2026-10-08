import type {
    MetahubTemplateManifest,
    TemplateSeedComponent,
    TemplateSeedEntity,
    TemplateSeedElement,
    TemplateSeedZoneWidget
} from '@universo-react/types'
import { buildSingleTargetWidgetBinding, getDashboardWidgetDefinition } from '@universo-react/types'
import { buildDashboardRecordSetBinding, makeDashboardSeedPlacement } from '../services/dashboardSeedPlacement'
import { buildBasicMinimalSeedZoneWidgets, vlc } from './basic.template'

const buildContentBinding = (widgetKey: 'infoCard' | 'overviewTitle' | 'detailsTitle', semanticKey: string) => {
    const definition = getDashboardWidgetDefinition(widgetKey)
    if (!definition) throw new Error(`Dashboard widget is not registered: ${widgetKey}`)
    return buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'DashboardDemoContent',
        semanticKey
    })
}

const metricComponents: TemplateSeedComponent[] = [
    {
        codename: 'MetricKey',
        dataType: 'STRING',
        name: vlc('Metric key', 'Ключ показателя'),
        isRequired: true,
        sortOrder: 1,
        validationRules: { maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$', unique: true }
    },
    {
        codename: 'Title',
        dataType: 'STRING',
        name: vlc('Title', 'Название'),
        isRequired: true,
        sortOrder: 2,
        validationRules: { maxLength: 255, localized: true, versioned: true }
    },
    {
        codename: 'Interval',
        dataType: 'STRING',
        name: vlc('Interval', 'Период'),
        sortOrder: 3,
        validationRules: { maxLength: 128, localized: true, versioned: true }
    },
    {
        codename: 'Value',
        dataType: 'NUMBER',
        name: vlc('Value', 'Значение'),
        isRequired: true,
        sortOrder: 4,
        validationRules: { min: 0, max: 1_000_000, nonNegative: true }
    },
    {
        codename: 'Order',
        dataType: 'NUMBER',
        name: vlc('Order', 'Порядок'),
        isRequired: true,
        sortOrder: 5,
        validationRules: { min: 0, max: 100 }
    }
]

const seriesComponents: TemplateSeedComponent[] = [
    {
        codename: 'SeriesKey',
        dataType: 'STRING',
        name: vlc('Series key', 'Ключ ряда'),
        isRequired: true,
        sortOrder: 1,
        validationRules: { maxLength: 64 }
    },
    {
        codename: 'Timestamp',
        dataType: 'STRING',
        name: vlc('Timestamp', 'Метка времени'),
        isRequired: true,
        sortOrder: 3,
        validationRules: { maxLength: 64 }
    },
    {
        codename: 'SeriesLabel',
        dataType: 'STRING',
        name: vlc('Series label', 'Название ряда'),
        isRequired: true,
        sortOrder: 2,
        validationRules: { maxLength: 160, localized: true, versioned: true }
    },
    {
        codename: 'Value',
        dataType: 'NUMBER',
        name: vlc('Value', 'Значение'),
        isRequired: true,
        sortOrder: 4,
        validationRules: { min: 0, max: 1_000_000, nonNegative: true }
    },
    {
        codename: 'Order',
        dataType: 'NUMBER',
        name: vlc('Order', 'Порядок'),
        isRequired: true,
        sortOrder: 5,
        validationRules: { min: 0, max: 366 }
    }
]

const tableComponents: TemplateSeedComponent[] = [
    {
        codename: 'Title',
        dataType: 'STRING',
        name: vlc('Title', 'Название'),
        isRequired: true,
        isDisplayComponent: true,
        sortOrder: 1,
        validationRules: { maxLength: 255, localized: true, versioned: true }
    },
    {
        codename: 'SortOrder',
        dataType: 'NUMBER',
        name: vlc('Order', 'Порядок'),
        isRequired: true,
        sortOrder: 2,
        validationRules: { min: 0, max: 100 }
    },
    {
        codename: 'Description',
        dataType: 'STRING',
        name: vlc('Description', 'Описание'),
        sortOrder: 3,
        validationRules: { maxLength: 1000, localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 3 }
    }
]

const contentComponents: TemplateSeedComponent[] = [
    {
        codename: 'Key',
        dataType: 'STRING',
        name: vlc('Content key', 'Ключ содержимого'),
        isRequired: true,
        sortOrder: 1,
        validationRules: { maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$', unique: true }
    },
    {
        codename: 'Title',
        dataType: 'STRING',
        name: vlc('Title', 'Название'),
        isRequired: true,
        isDisplayComponent: true,
        sortOrder: 2,
        validationRules: { maxLength: 255, localized: true, versioned: true }
    },
    {
        codename: 'Body',
        dataType: 'STRING',
        name: vlc('Body', 'Текст'),
        isRequired: false,
        sortOrder: 3,
        validationRules: { maxLength: 4096, localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 4 }
    }
]

const demoEntities: TemplateSeedEntity[] = [
    {
        codename: 'DashboardDemoMetrics',
        kind: 'object',
        name: vlc('Dashboard demo metrics', 'Показатели демонстрационной панели'),
        description: vlc('Bounded sample metric records for the Dashboard template.', 'Ограниченный набор показателей для шаблона панели.'),
        components: metricComponents
    },
    {
        codename: 'DashboardDemoSeries',
        kind: 'object',
        name: vlc('Dashboard demo series', 'Ряды демонстрационной панели'),
        description: vlc(
            'Bounded time-series records used by the Dashboard charts.',
            'Ограниченный набор временных рядов для графиков панели.'
        ),
        components: seriesComponents
    },
    {
        codename: 'DashboardDemoRecords',
        kind: 'object',
        name: vlc('Dashboard demo records', 'Записи демонстрационной панели'),
        description: vlc('Sample records displayed by the Dashboard table.', 'Примеры записей для таблицы панели.'),
        components: tableComponents
    },
    {
        codename: 'DashboardDemoContent',
        kind: 'object',
        name: vlc('Dashboard demo content', 'Содержимое демонстрационной панели'),
        description: vlc(
            'Localized information cards and headings used by the Dashboard demo.',
            'Локализованные карточки и заголовки демонстрационной панели.'
        ),
        hubs: ['Main'],
        config: {
            recordBehavior: 'reference',
            recordPolicy: {
                version: 1,
                semanticKey: {
                    componentCodename: 'Key',
                    creationPrefix: 'dashboard-content',
                    protectedValues: ['welcome', 'overview-heading', 'records-heading']
                },
                denyDeleteWhenBound: true,
                immutableSemanticKeyWhenBound: true,
                runtimeMutation: 'deny'
            }
        },
        components: contentComponents
    }
]

const content: TemplateSeedElement[] = [
    {
        codename: 'welcome',
        sortOrder: 1,
        data: {
            Key: 'welcome',
            Title: vlc('Welcome to the dashboard', 'Добро пожаловать на панель'),
            Body: vlc(
                'Dashboard content comes from Object records, while widgets store only presentation and source bindings.',
                'Содержимое панели хранится в записях Объектов, а виджеты содержат только оформление и привязки к источникам.'
            )
        }
    },
    {
        codename: 'overview-heading',
        sortOrder: 2,
        data: {
            Key: 'overview-heading',
            Title: vlc('Learning overview', 'Обзор обучения'),
            Body: vlc(
                'A localized heading for the metrics and activity chart.',
                'Локализованный заголовок показателей и графика активности.'
            )
        }
    },
    {
        codename: 'records-heading',
        sortOrder: 3,
        data: {
            Key: 'records-heading',
            Title: vlc('Learning resources', 'Учебные материалы'),
            Body: vlc('A localized heading for the sample Object records.', 'Локализованный заголовок демонстрационных записей Объекта.')
        }
    }
]

const metrics: TemplateSeedElement[] = [
    {
        codename: 'activeLearners',
        sortOrder: 1,
        data: {
            MetricKey: 'activeLearners',
            Title: vlc('Active learners', 'Активные учащиеся'),
            Interval: vlc('This week', 'За эту неделю'),
            Value: 128,
            Order: 1
        }
    },
    {
        codename: 'publishedCourses',
        sortOrder: 2,
        data: {
            MetricKey: 'publishedCourses',
            Title: vlc('Published courses', 'Опубликованные курсы'),
            Interval: vlc('Current workspace', 'Текущее рабочее пространство'),
            Value: 24,
            Order: 2
        }
    },
    {
        codename: 'completedLessons',
        sortOrder: 3,
        data: {
            MetricKey: 'completedLessons',
            Title: vlc('Completed lessons', 'Завершённые уроки'),
            Interval: vlc('All time', 'За всё время'),
            Value: 936,
            Order: 3
        }
    },
    {
        codename: 'learningHours',
        sortOrder: 4,
        data: {
            MetricKey: 'learningHours',
            Title: vlc('Learning hours', 'Часы обучения'),
            Interval: vlc('All time', 'За всё время'),
            Value: 742,
            Order: 4
        }
    }
]

const learningActivitySeriesLabel = vlc('Learning activity', 'Учебная активность')

const series: TemplateSeedElement[] = [
    {
        codename: 'day-1',
        sortOrder: 1,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-09-25T00:00:00.000Z',
            Value: 42,
            Order: 1
        }
    },
    {
        codename: 'day-2',
        sortOrder: 2,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-09-26T00:00:00.000Z',
            Value: 56,
            Order: 2
        }
    },
    {
        codename: 'day-3',
        sortOrder: 3,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-09-27T00:00:00.000Z',
            Value: 51,
            Order: 3
        }
    },
    {
        codename: 'day-4',
        sortOrder: 4,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-09-28T00:00:00.000Z',
            Value: 68,
            Order: 4
        }
    },
    {
        codename: 'day-5',
        sortOrder: 5,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-09-29T00:00:00.000Z',
            Value: 73,
            Order: 5
        }
    },
    {
        codename: 'day-6',
        sortOrder: 6,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-09-30T00:00:00.000Z',
            Value: 64,
            Order: 6
        }
    },
    {
        codename: 'day-7',
        sortOrder: 7,
        data: {
            SeriesKey: 'learningActivity',
            SeriesLabel: learningActivitySeriesLabel,
            Timestamp: '2026-10-01T00:00:00.000Z',
            Value: 89,
            Order: 7
        }
    }
]

const records: TemplateSeedElement[] = [
    {
        codename: 'course-foundations',
        sortOrder: 1,
        data: {
            Title: vlc('Platform foundations', 'Основы платформы'),
            SortOrder: 1,
            Description: vlc('A sample course record backed by Object components.', 'Пример курса, хранящийся в компонентах объекта.')
        }
    },
    {
        codename: 'course-data-modeling',
        sortOrder: 2,
        data: {
            Title: vlc('Data modeling', 'Моделирование данных'),
            SortOrder: 2,
            Description: vlc('A sample record with localized long-form content.', 'Пример записи с локализованным развёрнутым описанием.')
        }
    },
    {
        codename: 'course-application-design',
        sortOrder: 3,
        data: {
            Title: vlc('Application design', 'Проектирование приложений'),
            SortOrder: 3,
            Description: vlc(
                'A third source record for the first-class table placement.',
                'Третья запись источника для отдельного размещения таблицы.'
            )
        }
    }
]

function buildDemoSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    const recordsParentInstanceKey = 'demo-records-container'
    const tableConfig = { maxRows: 8, showSearch: true }

    return [
        ...buildBasicMinimalSeedZoneWidgets(),
        makeDashboardSeedPlacement({
            zone: 'right',
            widgetKey: 'infoCard',
            instanceKey: 'demo-welcome-card',
            sortOrder: 1,
            rendererConfig: { severity: 'info' },
            bindings: buildContentBinding('infoCard', 'welcome')
        }),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'overviewTitle',
            instanceKey: 'demo-overview-heading',
            sortOrder: 0,
            rendererConfig: { level: 'h1' },
            bindings: buildContentBinding('overviewTitle', 'overview-heading')
        }),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'overviewCards',
            instanceKey: 'demo-metrics',
            sortOrder: 1,
            rendererConfig: { maxCards: 4, density: 'standard' },
            bindings: buildDashboardRecordSetBinding('overviewCards', 'metrics', 'DashboardDemoMetrics')
        }),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'sessionsChart',
            instanceKey: 'demo-learning-activity',
            sortOrder: 2,
            rendererConfig: { chartStyle: 'line', interval: 'day', maxPoints: 7 },
            bindings: buildDashboardRecordSetBinding('sessionsChart', 'series', 'DashboardDemoSeries')
        }),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTitle',
            instanceKey: 'demo-records-heading',
            sortOrder: 3,
            rendererConfig: { level: 'h2' },
            bindings: buildContentBinding('detailsTitle', 'records-heading')
        }),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'columnsContainer',
            instanceKey: recordsParentInstanceKey,
            sortOrder: 4,
            rendererConfig: { columns: [{ slotKey: 'column:records', width: 12 }] }
        }),
        makeDashboardSeedPlacement({
            zone: 'center',
            widgetKey: 'detailsTable',
            instanceKey: 'demo-records-table',
            parentInstanceKey: recordsParentInstanceKey,
            slotKey: 'column:records',
            sortOrder: 1,
            rendererConfig: tableConfig,
            bindings: buildDashboardRecordSetBinding('detailsTable', 'rows', 'DashboardDemoRecords', tableConfig)
        })
    ]
}

/**
 * Basic Demo demonstrates entity-owned content and bounded widget sources. The
 * widget placements contain only presentation, source bindings, and graph keys.
 */
export const basicDemoTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'basic-demo',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('Basic Demo', 'Базовый-демо'),
    description: vlc(
        'A dashboard demo with real Object records, bounded metrics and charts, and a first-class table placement.',
        'Демонстрационная панель с реальными записями объектов, ограниченными наборами показателей и графиков и отдельным размещением таблицы.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['demo', 'dashboard', 'entity-backed'],
        icon: 'Dashboard'
    },
    presets: [
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: true },
        { presetCodename: 'object', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
    seed: {
        layouts: [
            {
                codename: 'main',
                templateKey: 'dashboard',
                name: vlc('Main', 'Основной'),
                description: vlc('Main layout for published applications', 'Основной макет для опубликованных приложений'),
                isDefault: true,
                isActive: true,
                sortOrder: 0
            }
        ],
        layoutZoneWidgets: { main: buildDemoSeedZoneWidgets() },
        entities: demoEntities,
        elements: {
            DashboardDemoMetrics: metrics,
            DashboardDemoSeries: series,
            DashboardDemoRecords: records,
            DashboardDemoContent: content
        },
        settings: [
            { key: 'general.language', value: { _value: 'system' } },
            { key: 'general.timezone', value: { _value: 'UTC' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: true } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            { key: 'entity.object.allowComponentCopy', value: { _value: true } },
            { key: 'entity.object.allowComponentDelete', value: { _value: true } },
            { key: 'entity.object.allowDeleteLastDisplayComponent', value: { _value: true } }
        ]
    }
}
