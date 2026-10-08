import { createHash } from 'node:crypto'
import stableStringify from 'json-stable-stringify'
import {
    decodeLayoutConfigEnvelope,
    decodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefaultPlacement,
    getLayoutZoneDefinition,
    LAYOUT_ZONE_DEFINITIONS,
    layoutHashSchema,
    layoutInstanceKeySchema,
    layoutNeutralCompositionSchema,
    type ApplicationLayout,
    type ApplicationLayoutWidget,
    type ApplicationTemplateKey,
    type LayoutLogicalPlacement,
    type LayoutNeutralComposition,
    type PersistedLayoutNeutralMetadata
} from '@universo-react/types'
import { getApplicationLayoutWidgetSourceBindingState } from '../persistence/applicationLayoutStoreSupport'
import { decodePlacementWidgetConfigEnvelope, resolvePlacementBindingPolicy } from '../persistence/applicationLayoutWidgetPlacement'

export interface SemanticLayoutScope {
    entityKind: string
    codename: string
}

export interface ApplicationLayoutHashInput {
    layout: Pick<ApplicationLayout, 'templateKey' | 'name'> &
        Partial<Pick<ApplicationLayout, 'description' | 'config' | 'isActive' | 'isDefault' | 'sortOrder'>> & {
            scopeEntityId?: string | null
            sourceComposition?: LayoutNeutralComposition
            semanticScope?: SemanticLayoutScope | null
            baseLayoutContentHash?: string | null
        }
    widgets?: Array<
        Partial<Pick<ApplicationLayoutWidget, 'id' | 'layoutId' | 'version'>> &
            Pick<
                ApplicationLayoutWidget,
                'zone' | 'widgetKey' | 'instanceKey' | 'parentWidgetId' | 'slotKey' | 'sortOrder' | 'config' | 'isActive'
            > &
            Partial<Pick<ApplicationLayoutWidget, 'sourceConfig' | 'sourceWidgetId' | 'sourceBaseWidgetId'>>
    >
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const resolveLayoutComposition = (
    neutral: PersistedLayoutNeutralMetadata,
    sourceComposition: LayoutNeutralComposition | undefined,
    baseLayoutContentHash: string | null | undefined
): { mode: 'overlay' | 'independent'; baseContentHash: string | null } => {
    const persistedComposition = neutral.composition
    if (sourceComposition && persistedComposition && sourceComposition.mode !== persistedComposition.mode) {
        throw new Error('Application layout hash input contains conflicting composition metadata')
    }

    const composition = layoutNeutralCompositionSchema.parse(sourceComposition ?? persistedComposition)
    if (composition.mode === 'independent') {
        if (baseLayoutContentHash !== undefined && baseLayoutContentHash !== null) {
            throw new Error('Independent application layout hash input cannot have a base content hash')
        }
        return { mode: 'independent', baseContentHash: null }
    }
    const parsedBaseHash = layoutHashSchema.safeParse(baseLayoutContentHash)
    if (!parsedBaseHash.success) throw new Error('Overlay application layout hash input is missing its portable base content hash')
    return { mode: 'overlay', baseContentHash: parsedBaseHash.data }
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
    widget: Pick<ApplicationLayoutWidget, 'widgetKey' | 'zone' | 'config' | 'instanceKey'>
): {
    rendererConfig: Record<string, unknown>
    placement: LayoutLogicalPlacement | null
    bindings: ReturnType<typeof decodeLayoutWidgetConfigEnvelope>['neutral']['bindings']
} => {
    const decoded = decodePlacementWidgetConfigEnvelope(widget.config, {
        templateKey,
        widgetKey: widget.widgetKey,
        zone: widget.zone,
        instanceKey: widget.instanceKey
    })
    let defaultPlacement: LayoutLogicalPlacement | undefined
    try {
        defaultPlacement = getLayoutWidgetDefaultPlacement({ templateKey, widgetKey: widget.widgetKey, zone: widget.zone })
    } catch {
        defaultPlacement = undefined
    }
    return {
        rendererConfig: decoded.rendererConfig,
        bindings: decoded.neutral.bindings,
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
    const sourceWidgets = input.widgets ?? []
    const widgetById = new Map<string, (typeof sourceWidgets)[number]>()
    const instanceKeyById = new Map<string, string>()
    const seenInstanceKeys = new Set<string>()
    for (const widget of sourceWidgets) {
        const instanceKey = layoutInstanceKeySchema.parse(widget.instanceKey)
        if (seenInstanceKeys.has(instanceKey)) throw new Error('Application layout hash input contains duplicate placement identities')
        seenInstanceKeys.add(instanceKey)
        if (widget.id !== undefined) {
            if (widgetById.has(widget.id)) throw new Error('Application layout hash input contains duplicate widget ids')
            widgetById.set(widget.id, widget)
            instanceKeyById.set(widget.id, instanceKey)
        }
        if ((widget.parentWidgetId === null) !== (widget.slotKey === null)) {
            throw new Error('Application layout hash input contains malformed parent and slot metadata')
        }
    }
    const widgets = sourceWidgets
        .map((widget) => {
            const widgetEnvelope = decodeWidgetForHash(templateKey, widget)
            const sourceAuthority =
                resolvePlacementBindingPolicy(widget.widgetKey, widgetEnvelope.rendererConfig).sourceAuthority === 'local'
                    ? 'local'
                    : 'source-managed'
            const sourceBindingState = getApplicationLayoutWidgetSourceBindingState(widget)
            let trustedBindings = sourceBindingState?.bindings
            if (sourceBindingState === undefined && widget.sourceConfig !== undefined && widget.sourceConfig !== null) {
                trustedBindings = decodePlacementWidgetConfigEnvelope(widget.sourceConfig, {
                    templateKey,
                    widgetKey: widget.widgetKey,
                    zone: widget.zone,
                    instanceKey: widget.instanceKey
                }).neutral.bindings
            }
            const semanticBindings =
                sourceBindingState !== undefined || (widget.sourceConfig !== undefined && widget.sourceConfig !== null)
                    ? trustedBindings
                    : widgetEnvelope.bindings
            const instanceKey = layoutInstanceKeySchema.parse(widget.instanceKey)
            let parentInstanceKey: string | null = null
            if (widget.parentWidgetId !== null) {
                parentInstanceKey = instanceKeyById.get(widget.parentWidgetId) ?? null
                const parent = widgetById.get(widget.parentWidgetId)
                if (!parentInstanceKey || !parent) throw new Error('Application layout hash input contains an unresolved parent placement')
                if (widget.layoutId !== undefined && parent.layoutId !== undefined && widget.layoutId !== parent.layoutId) {
                    throw new Error('Application layout hash input contains a cross-layout parent placement')
                }
                if (parentInstanceKey === instanceKey) throw new Error('Application layout hash input contains a self-parent placement')
            }
            // Physical row IDs, lineage IDs, and optimistic versions are deliberately
            // accepted by the input type for store reuse, but are not part of the
            // semantic hash. They change during materialization without changing
            // the effective layout contract.
            return {
                zone: widget.zone,
                widgetKey: widget.widgetKey,
                sortOrder: widget.sortOrder,
                instanceKey,
                parent: parentInstanceKey === null ? null : { instanceKey: parentInstanceKey, slotKey: widget.slotKey },
                config: widgetEnvelope.rendererConfig,
                sourceAuthority,
                ...(semanticBindings === undefined ? {} : { bindings: semanticBindings }),
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

    const scopeEntityId = input.layout.scopeEntityId ?? null
    let semanticScope: SemanticLayoutScope | null = null
    if (scopeEntityId !== null) {
        const candidate = input.layout.semanticScope
        if (
            !candidate ||
            typeof candidate.entityKind !== 'string' ||
            !candidate.entityKind.trim() ||
            typeof candidate.codename !== 'string' ||
            !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/u.test(candidate.codename.trim())
        ) {
            throw new Error('Scoped application layout hash input is missing its trusted semantic scope')
        }
        semanticScope = { entityKind: candidate.entityKind.trim(), codename: candidate.codename.trim() }
    } else if (input.layout.semanticScope !== undefined && input.layout.semanticScope !== null) {
        throw new Error('Global application layout hash input cannot have an Entity scope')
    }

    return {
        layout: {
            scope: semanticScope,
            templateKey: input.layout.templateKey,
            name: input.layout.name ?? {},
            description: input.layout.description ?? null,
            config: layoutEnvelope.rendererConfig,
            composition: resolveLayoutComposition(
                layoutEnvelope.neutral,
                input.layout.sourceComposition,
                input.layout.baseLayoutContentHash
            ),
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
