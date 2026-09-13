import { createHash } from 'node:crypto'
import stableStringify from 'json-stable-stringify'
import {
    decodeLayoutConfigEnvelope,
    decodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefaultPlacement,
    getLayoutZoneDefinition,
    LAYOUT_ZONE_DEFINITIONS,
    layoutNeutralCompositionSchema,
    type ApplicationLayout,
    type ApplicationLayoutWidget,
    type ApplicationTemplateKey,
    type LayoutLogicalPlacement,
    type LayoutNeutralComposition,
    type PersistedLayoutNeutralMetadata
} from '@universo-react/types'

export interface ApplicationLayoutHashInput {
    layout: Pick<ApplicationLayout, 'templateKey' | 'name'> &
        Partial<Pick<ApplicationLayout, 'description' | 'config' | 'isActive' | 'isDefault' | 'sortOrder'>> & {
            scopeEntityId?: string | null
            sourceComposition?: LayoutNeutralComposition
        }
    widgets?: Array<
        Partial<Pick<ApplicationLayoutWidget, 'id' | 'layoutId' | 'version'>> &
            Pick<ApplicationLayoutWidget, 'zone' | 'widgetKey' | 'sortOrder' | 'config' | 'isActive'> &
            Partial<Pick<ApplicationLayoutWidget, 'sourceConfig' | 'sourceWidgetId' | 'sourceBaseWidgetId'>>
    >
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const resolveLayoutComposition = (
    neutral: PersistedLayoutNeutralMetadata,
    sourceComposition: LayoutNeutralComposition | undefined
): LayoutNeutralComposition => {
    const persistedComposition = neutral.composition
    if (sourceComposition && persistedComposition) {
        const sameComposition =
            sourceComposition.mode === persistedComposition.mode &&
            (sourceComposition.mode === 'independent' ||
                (persistedComposition.mode === 'overlay' && sourceComposition.baseLayoutId === persistedComposition.baseLayoutId))
        if (!sameComposition) {
            throw new Error('Application layout hash input contains conflicting composition metadata')
        }
    }

    return layoutNeutralCompositionSchema.parse(sourceComposition ?? persistedComposition)
}

const effectiveZoneSettings = (templateKey: ApplicationTemplateKey, neutral: PersistedLayoutNeutralMetadata): Record<string, unknown> => {
    const settings: Record<string, unknown> = {}
    const source = (neutral.sourceZoneSettings ?? {}) as Record<string, unknown>
    const local = (neutral.zoneSettings ?? {}) as Record<string, unknown>
    const definitions = LAYOUT_ZONE_DEFINITIONS.filter((definition) => definition.templateKey === templateKey)
    const zones = new Set([...definitions.map((definition) => definition.key), ...Object.keys(source), ...Object.keys(local)])
    for (const zone of zones) {
        const definition = getLayoutZoneDefinition(zone, templateKey)
        if (!definition || definition.settings.length === 0) continue
        const sourceValues = isRecord(source[zone]) ? source[zone] : {}
        const localValues = isRecord(local[zone]) ? local[zone] : {}
        settings[zone] = Object.fromEntries(
            definition.settings.map((setting) => [
                setting.key,
                localValues[setting.key] ?? sourceValues[setting.key] ?? setting.defaultValue
            ])
        )
    }
    return settings
}

const decodeLayoutForHash = (
    templateKey: ApplicationTemplateKey,
    rawConfig: unknown
): { rendererConfig: Record<string, unknown>; neutral: PersistedLayoutNeutralMetadata } => {
    const decoded = decodeLayoutConfigEnvelope(rawConfig, { templateKey })
    return { rendererConfig: decoded.rendererConfig, neutral: decoded.neutral }
}

const decodeWidgetForHash = (
    templateKey: ApplicationTemplateKey,
    widget: Pick<ApplicationLayoutWidget, 'widgetKey' | 'zone' | 'config'>
): { rendererConfig: Record<string, unknown>; placement: LayoutLogicalPlacement | null } => {
    const decoded = decodeLayoutWidgetConfigEnvelope(widget.config, {
        templateKey,
        widgetKey: widget.widgetKey,
        zone: widget.zone
    })
    let defaultPlacement: LayoutLogicalPlacement | undefined
    try {
        defaultPlacement = getLayoutWidgetDefaultPlacement({ templateKey, widgetKey: widget.widgetKey, zone: widget.zone })
    } catch {
        defaultPlacement = undefined
    }
    return {
        rendererConfig: decoded.rendererConfig,
        placement:
            (widget as ApplicationLayoutWidget & { placement?: LayoutLogicalPlacement }).placement ??
            decoded.neutral.placement ??
            defaultPlacement ??
            null
    }
}

export function normalizeApplicationLayoutForHash(input: ApplicationLayoutHashInput): Record<string, unknown> {
    const templateKey = input.layout.templateKey as ApplicationTemplateKey
    const layoutEnvelope = decodeLayoutForHash(templateKey, input.layout.config === undefined ? {} : input.layout.config)
    const widgets = (input.widgets ?? [])
        .map((widget) => {
            const widgetEnvelope = decodeWidgetForHash(templateKey, widget)
            const instanceKey =
                typeof widgetEnvelope.rendererConfig.instanceKey === 'string' && widgetEnvelope.rendererConfig.instanceKey.length > 0
                    ? widgetEnvelope.rendererConfig.instanceKey
                    : null
            // Physical row IDs, lineage IDs, and optimistic versions are deliberately
            // accepted by the input type for store reuse, but are not part of the
            // semantic hash. They change during materialization without changing
            // the effective layout contract.
            return {
                zone: widget.zone,
                widgetKey: widget.widgetKey,
                sortOrder: widget.sortOrder,
                instanceKey,
                config: widgetEnvelope.rendererConfig,
                placement: widgetEnvelope.placement,
                isActive: widget.isActive !== false
            }
        })
        .sort((left, right) => {
            if (left.zone !== right.zone) return left.zone.localeCompare(right.zone)
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            if (left.widgetKey !== right.widgetKey) return left.widgetKey.localeCompare(right.widgetKey)
            return (left.instanceKey ?? '').localeCompare(right.instanceKey ?? '')
        })

    return {
        layout: {
            scopeEntityId: input.layout.scopeEntityId ?? null,
            templateKey: input.layout.templateKey,
            name: input.layout.name ?? {},
            description: input.layout.description ?? null,
            config: layoutEnvelope.rendererConfig,
            composition: resolveLayoutComposition(layoutEnvelope.neutral, input.layout.sourceComposition),
            effectiveZoneSettings: effectiveZoneSettings(templateKey, layoutEnvelope.neutral),
            isActive: input.layout.isActive !== false,
            isDefault: input.layout.isDefault === true,
            sortOrder: input.layout.sortOrder ?? 0
        },
        widgets
    }
}

export function hashApplicationLayoutContent(input: ApplicationLayoutHashInput): string {
    const payload = stableStringify(normalizeApplicationLayoutForHash(input)) ?? '{}'
    return createHash('sha256').update(payload).digest('hex')
}
