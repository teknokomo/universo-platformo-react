import { z } from 'zod'

import { dashboardLayoutConfigSchema, type DashboardLayoutConfig } from './dashboardLayout'
import { DASHBOARD_LAYOUT_WIDGETS, DASHBOARD_LAYOUT_ZONES } from './metahubs'
import {
    DASHBOARD_WIDGET_CONFIG_SCHEMAS,
    dashboardWidgetConfigSchemaByKey,
    type DashboardLayoutWidgetKeyFromRegistry
} from './dashboardWidgetRegistry'
import {
    applicationTemplateKeySchema,
    marketingAuthWidgetConfigSchema,
    marketingBrandWidgetConfigSchema,
    marketingCollectionWidgetConfigSchema,
    marketingFooterWidgetConfigSchema,
    marketingHeroWidgetConfigSchema,
    marketingImageWidgetConfigSchema,
    marketingLayoutZoneSchema,
    marketingNavigationWidgetConfigSchema,
    marketingPageConfigSchema,
    marketingPricingWidgetConfigSchema,
    marketingWidgetKeySchema,
    type ApplicationTemplateKey,
    type MarketingPageConfig
} from './marketingPage'
import { MESSENGER_APP_LAYOUT_ZONES, messengerAppConfigSchema, type MessengerAppConfig } from './messengerAppPrimitives'

const dashboardLayoutWidgetKeySchema = z.enum(
    DASHBOARD_LAYOUT_WIDGETS.map((widget) => widget.key) as [
        DashboardLayoutWidgetKeyFromRegistry,
        ...DashboardLayoutWidgetKeyFromRegistry[]
    ]
)
const dashboardLayoutZoneSchema = z.enum(DASHBOARD_LAYOUT_ZONES)
const messengerLayoutZoneSchema = z.enum(MESSENGER_APP_LAYOUT_ZONES)
export const applicationLayoutWidgetKeySchema = z.union([dashboardLayoutWidgetKeySchema, marketingWidgetKeySchema])
export const applicationLayoutZoneSchema = z.union([dashboardLayoutZoneSchema, marketingLayoutZoneSchema, messengerLayoutZoneSchema])

/**
 * Layout configuration is template-owned. Keep the transport schema open so a
 * template config is not stripped by the dashboard-only Zod object; callers
 * validate it against the selected template before persisting or rendering.
 */
export type ApplicationLayoutConfig = (DashboardLayoutConfig | MarketingPageConfig | MessengerAppConfig) & Record<string, unknown>
export const applicationLayoutConfigSchema = z
    .record(z.string(), z.unknown())
    .default({})
    .transform((config) => config as ApplicationLayoutConfig)

const isApplicationLayoutRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

// `appearance` is a cross-template key (all three schemas accept it); only the
// marketing-specific policy fields remain marketing-only. The removed legacy
// appearance fields (`themeMode`, `primaryColor`, `accentColor`) are rejected
// everywhere by the strict per-template schemas.
const MARKETING_ONLY_LAYOUT_CONFIG_KEYS = new Set(['brandLogo', 'allowEmailActions', 'allowTelephoneActions', 'externalLinkTarget'])
const RESERVED_LAYOUT_CONFIG_KEYS = new Set(['__layout', 'compositionMode', 'baseLayoutId'])

export const parseApplicationLayoutConfig = (templateKey: ApplicationTemplateKey | string, config: unknown): ApplicationLayoutConfig => {
    const key = applicationTemplateKeySchema.parse(templateKey)
    if (isApplicationLayoutRecord(config) && Object.keys(config).some((configKey) => RESERVED_LAYOUT_CONFIG_KEYS.has(configKey))) {
        throw new Error('Layout metadata must be decoded before renderer configuration is parsed.')
    }
    switch (key) {
        case 'marketing-page':
            return marketingPageConfigSchema.parse(config ?? {}) as ApplicationLayoutConfig
        case 'messenger-app':
            return messengerAppConfigSchema.parse(config ?? {}) as ApplicationLayoutConfig
        case 'dashboard': {
            if (
                isApplicationLayoutRecord(config) &&
                Object.keys(config).some((configKey) => MARKETING_ONLY_LAYOUT_CONFIG_KEYS.has(configKey))
            ) {
                throw new Error('Dashboard layouts cannot contain marketing-page configuration keys.')
            }
            const dashboardConfig = dashboardLayoutConfigSchema.parse(config ?? {}) ?? {}
            return dashboardConfig as ApplicationLayoutConfig
        }
        default:
            return assertNeverTemplate(key)
    }
}

const assertNeverTemplate = (templateKey: never): never => {
    throw new Error(`Unsupported application layout template: ${String(templateKey)}`)
}

const marketingStoredWidgetConfigSchemaByKey = {
    'marketing.brand': marketingBrandWidgetConfigSchema,
    'marketing.navigation': marketingNavigationWidgetConfigSchema,
    'marketing.auth': marketingAuthWidgetConfigSchema,
    'marketing.hero': marketingHeroWidgetConfigSchema,
    'marketing.image': marketingImageWidgetConfigSchema,
    'marketing.collection': marketingCollectionWidgetConfigSchema,
    'marketing.pricing': marketingPricingWidgetConfigSchema,
    'marketing.footer': marketingFooterWidgetConfigSchema
} as const

const widgetConfigSchemaByKey = {
    ...dashboardWidgetConfigSchemaByKey,
    ...marketingStoredWidgetConfigSchemaByKey
} as const

const allWidgetConfigSchemas = Object.values(widgetConfigSchemaByKey)
if (allWidgetConfigSchemas.length < 2) {
    throw new Error('Application layouts require at least two widget config schemas.')
}
const [firstWidgetConfigSchema, secondWidgetConfigSchema, ...remainingWidgetConfigSchemas] = allWidgetConfigSchemas
export const applicationLayoutWidgetConfigSchema = z.union([
    firstWidgetConfigSchema!,
    secondWidgetConfigSchema!,
    ...remainingWidgetConfigSchemas
])

export const isStoredWidgetConfigValid = (widgetKey: string, config: unknown): boolean => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey]
    return Boolean(schema?.safeParse(config ?? {}).success)
}

/** Parse persisted renderer config using the exact strict schema for its widget key. */
export const parseApplicationLayoutWidgetConfig = (widgetKey: string, config: unknown): Record<string, unknown> => {
    const schema = widgetConfigSchemaByKey[widgetKey as keyof typeof widgetConfigSchemaByKey]
    if (!schema) throw new Error(`Unsupported layout widget key: ${widgetKey}`)
    return schema.parse(config ?? {}) as Record<string, unknown>
}

export const menuWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget
export const columnsContainerWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.columnsContainer
export const detailsTabsWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTabs
export const quizWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.quizWidget
export const playcanvasCanvasWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.playcanvasCanvas
export const detailsTableWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTable
export const relationBuilderWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.relationBuilder
export const overviewCardsWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.overviewCards
export const recordsSeriesChartWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.sessionsChart
export const resourcePreviewWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.resourcePreview
export const learnerPlayerWidgetConfigSchema = DASHBOARD_WIDGET_CONFIG_SCHEMAS.learnerPlayer
export type DetailsTabsWidgetConfig = z.infer<typeof detailsTabsWidgetConfigSchema>
export type DetailsTableWidgetConfig = z.infer<typeof detailsTableWidgetConfigSchema>
export type RelationBuilderWidgetConfig = z.infer<typeof relationBuilderWidgetConfigSchema>
export type RecordsSeriesChartWidgetConfig = z.infer<typeof recordsSeriesChartWidgetConfigSchema>
export type ResourcePreviewWidgetConfig = z.infer<typeof resourcePreviewWidgetConfigSchema>
export type LearnerPlayerWidgetConfig = z.infer<typeof learnerPlayerWidgetConfigSchema>
