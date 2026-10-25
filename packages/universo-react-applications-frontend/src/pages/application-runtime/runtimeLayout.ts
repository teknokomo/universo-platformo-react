import { type AppDataResponse, type AuthenticatedRuntimePlacementScopes, type ZoneWidgets } from '@universo-react/apps-template-mui'
import { sanitizeApplicationLearningContentSettings } from '@universo-react/types'
import type { ApplicationEffectiveLayoutResponse } from '../../types'

export const UUID_PATH_SEGMENT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const normalizeRuntimeLocale = (value: string | null | undefined): string => {
    const normalized = value?.trim().split(/[-_]/)[0]?.toLowerCase() ?? ''
    return /^[a-z]{2}$/.test(normalized) ? normalized : 'en'
}

export const PUBLIC_RUNTIME_LOCALES = ['en', 'ru'] as const
export type PublicRuntimeLocale = (typeof PUBLIC_RUNTIME_LOCALES)[number]

/**
 * The anonymous published-read boundary serves only the platform locales it
 * can actually localize. An unsupported `?locale=` value falls back to the
 * default English runtime instead of turning a valid public application into
 * an unavailable outcome.
 */
export const normalizePublicRuntimeLocale = (value: string | null | undefined): PublicRuntimeLocale =>
    value?.trim().split(/[-_]/)[0]?.toLowerCase() === 'ru' ? 'ru' : 'en'

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

/**
 * The effective-layout resolver may resolve a default homepage while the
 * requested target is the application root (targetKind: null). In that case,
 * a non-null resolvedEntityTypeId is guaranteed to identify the homepage Page.
 */
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
        if (!isDashboardLayoutZone(widget.zone)) {
            throw new Error(`Effective layout contains an unsupported Dashboard zone: ${widget.zone}`)
        }
        grouped[widget.zone]?.push({
            widgetKey: widget.widgetKey,
            sortOrder: widget.sortOrder,
            config: widget.config,
            isActive: widget.isActive,
            instanceKey: widget.instanceKey,
            zone: widget.zone,
            parentInstanceKey: widget.parentInstanceKey,
            slotKey: widget.slotKey,
            ...(widget.runtimeData === undefined ? {} : { runtimeData: widget.runtimeData })
        })
    }

    for (const zone of DASHBOARD_LAYOUT_ZONES) {
        grouped[zone]?.sort((left, right) => left.sortOrder - right.sortOrder || left.instanceKey.localeCompare(right.instanceKey))
    }

    return grouped
}

export const toAuthenticatedRuntimePlacementScopes = (
    effectiveLayout: ApplicationEffectiveLayoutResponse | undefined
): AuthenticatedRuntimePlacementScopes | undefined => {
    if (!effectiveLayout || effectiveLayout.layout.templateKey !== 'dashboard') return undefined
    return Object.fromEntries(
        effectiveLayout.widgets.map((widget) => [
            widget.instanceKey,
            { widgetId: widget.id, layoutId: widget.layoutId ?? effectiveLayout.layout.id }
        ])
    )
}
