import {
    type AppDataResponse,
    type DashboardLayoutConfig,
    type DashboardMenuItem,
    type ZoneWidgets
} from '@universo-react/apps-template-mui'
import {
    MARKETING_LAYOUT_ZONES,
    sanitizeApplicationLearningContentSettings,
    type MarketingLayoutWidgetReference
} from '@universo-react/types'
import type { ApplicationEffectiveLayoutResponse, ApplicationRuntimeTargetKind } from '../../types'

export const WORKSPACE_ROUTE_LAYOUT_OVERRIDES: Partial<DashboardLayoutConfig> = {
    showOverviewTitle: false,
    showOverviewCards: false,
    showSessionsChart: false,
    showPageViewsChart: false,
    showDetailsTitle: false,
    showDetailsTable: false,
    showFooter: false
}

export const UUID_PATH_SEGMENT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const normalizeRuntimeLocale = (value: string | null | undefined): string => {
    const normalized = value?.trim().split(/[-_]/)[0]?.toLowerCase() ?? ''
    return /^[a-z]{2}$/.test(normalized) ? normalized : 'en'
}

export const withRuntimeLocale = (href: string, locale: string): string => {
    const url = new URL(href, 'http://universo-runtime.local')
    url.searchParams.set('locale', normalizeRuntimeLocale(locale))
    return `${url.pathname}${url.search}${url.hash}`
}

const buildRuntimeSectionHref = (
    applicationId: string,
    collectionId: string,
    targetKind: ApplicationRuntimeTargetKind,
    locale: string,
    sectionLinksEnabled: boolean
): string => {
    if (!sectionLinksEnabled) return `/a/${applicationId}`

    const targetQuery = new URLSearchParams({ targetKind, entityTypeId: collectionId, locale: normalizeRuntimeLocale(locale) }).toString()
    return `/a/${applicationId}/${encodeURIComponent(collectionId)}?${targetQuery}`
}

export const isWorkspaceRootMenuItem = (item: DashboardMenuItem): boolean =>
    item.id === 'runtime-workspaces' || item.id === 'workspaces' || /\/workspaces(?:$|\?)/.test(item.href ?? '')

export const buildLearningContentCreateDefaultContext = (appData: AppDataResponse | undefined): Record<string, unknown> => {
    const learningContentSettings = sanitizeApplicationLearningContentSettings(
        appData?.settings?.learningContent as Record<string, unknown> | undefined
    )

    return {
        learningContent: {
            courseCompletionPolicy: learningContentSettings.courseCompletionPolicy,
            trackOrderPolicy: learningContentSettings.trackOrderPolicy
        }
    }
}

const normalizeRuntimeKey = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase()

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readStringArrayConfig = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

export const resolveSingleSystemMatrixSectionId = (appData: AppDataResponse | undefined): string | undefined => {
    if (!appData) return undefined

    const workspaceWidget = appData.zoneWidgets?.center?.find((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')
    const visibleFor = isRecord(workspaceWidget?.config?.visibleFor) ? workspaceWidget.config.visibleFor : undefined
    if (!visibleFor) return undefined

    const sectionIds = readStringArrayConfig(visibleFor.sectionIds)
    const sectionCodenames = readStringArrayConfig(visibleFor.sectionCodenames).map(normalizeRuntimeKey)
    const objectCollectionIds = readStringArrayConfig(visibleFor.objectCollectionIds)
    const objectCollectionCodenames = readStringArrayConfig(visibleFor.objectCollectionCodenames).map(normalizeRuntimeKey)
    const menuSectionTargets = new Set(
        (appData.menus ?? [])
            .flatMap((menu) => [...(menu.items ?? []), ...(menu.overflowItems ?? [])])
            .filter((item) => item.isActive !== false && item.kind === 'section')
            .flatMap((item) => [item.sectionId, item.objectCollectionId])
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
    const matchingIds = [...(appData.objectCollections ?? []), ...(appData.sections ?? [])]
        .filter(
            (candidate) =>
                sectionIds.includes(candidate.id) ||
                objectCollectionIds.includes(candidate.id) ||
                sectionCodenames.includes(normalizeRuntimeKey(candidate.codename)) ||
                objectCollectionCodenames.includes(normalizeRuntimeKey(candidate.codename))
        )
        .sort((left, right) => Number(Boolean(right.tableName)) - Number(Boolean(left.tableName)))
        .map((candidate) => candidate.id)
    const uniqueIds = Array.from(new Set(matchingIds))

    return uniqueIds.find((id) => menuSectionTargets.has(id)) ?? uniqueIds[0]
}

export const toRuntimeSectionLinkMenuItem = (
    item: DashboardMenuItem,
    applicationId: string,
    locale: string,
    sectionLinksEnabled: boolean,
    forceLink: boolean
): DashboardMenuItem => {
    if (item.kind !== 'section') {
        return { ...item, selected: false }
    }

    const targetCollectionId = item.objectCollectionId ?? item.sectionId
    if (!targetCollectionId) {
        return { ...item, selected: false }
    }
    const targetKind: ApplicationRuntimeTargetKind = item.objectCollectionId ? 'object' : 'page'

    if (!forceLink && !sectionLinksEnabled) {
        return { ...item, selected: false }
    }

    return {
        ...item,
        kind: 'link',
        href: buildRuntimeSectionHref(applicationId, targetCollectionId, targetKind, locale, sectionLinksEnabled),
        selected: false
    }
}

const DASHBOARD_LAYOUT_ZONES = ['left', 'top', 'right', 'bottom', 'center'] as const
type DashboardLayoutZone = (typeof DASHBOARD_LAYOUT_ZONES)[number]

const isDashboardLayoutZone = (zone: string): zone is DashboardLayoutZone => DASHBOARD_LAYOUT_ZONES.includes(zone as DashboardLayoutZone)

export const toDashboardZoneWidgets = (effectiveLayout: ApplicationEffectiveLayoutResponse | undefined): ZoneWidgets | undefined => {
    if (!effectiveLayout || effectiveLayout.layout.templateKey !== 'dashboard') return undefined

    const grouped: ZoneWidgets = {
        left: [],
        top: [],
        right: [],
        bottom: [],
        center: []
    }

    for (const widget of effectiveLayout.widgets) {
        if (!widget.isActive) continue
        if (!isDashboardLayoutZone(widget.zone)) {
            throw new Error(`Effective layout contains an unsupported Dashboard zone: ${widget.zone}`)
        }
        grouped[widget.zone]?.push({
            id: widget.id,
            layoutId: widget.layoutId,
            widgetKey: widget.widgetKey,
            sortOrder: widget.sortOrder,
            config: widget.config,
            isActive: widget.isActive
        })
    }

    for (const zone of DASHBOARD_LAYOUT_ZONES) {
        grouped[zone]?.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    }

    return grouped
}

export const toMarketingLayoutWidgets = (
    effectiveLayout: ApplicationEffectiveLayoutResponse | undefined
): readonly MarketingLayoutWidgetReference[] | undefined => {
    if (!effectiveLayout || effectiveLayout.layout.templateKey !== 'marketing-page') return undefined
    const activeWidgets = effectiveLayout.widgets.filter((widget) => widget.isActive)
    for (const widget of activeWidgets) {
        if (!MARKETING_LAYOUT_ZONES.includes(widget.zone as (typeof MARKETING_LAYOUT_ZONES)[number])) {
            throw new Error(`Effective layout contains an unsupported Marketing zone: ${widget.zone}`)
        }
    }

    return activeWidgets.map(({ id, widgetKey, zone, instanceKey, sortOrder, isActive }) => ({
        id,
        widgetKey,
        zone,
        ...(instanceKey === undefined ? {} : { instanceKey }),
        sortOrder,
        isActive
    }))
}
