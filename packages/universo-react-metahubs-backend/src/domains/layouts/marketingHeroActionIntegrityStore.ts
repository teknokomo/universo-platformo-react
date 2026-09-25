import {
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    decodeWidgetConfigEnvelope,
    getMarketingSectionAnchorEntries,
    LAYOUT_WIDGET_DEFINITIONS,
    parseApplicationLayoutWidgetConfig,
    resolveSharedBehavior,
    widgetEntityBindingEnvelopeSchema,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import { codenamePrimaryTextSql } from '../shared/codename'
import { MetahubValidationError } from '../shared/domainErrors'
import { resolveEntityRecordPolicy } from '@universo-react/types'
import { projectMarketingHeroContentData, validateMarketingHeroComponents } from './marketingHeroBindingsStore'
import { isAuthoritativeMarketingHeroRecordPolicy, validateEntityRecordPolicyData } from '../shared/entityRecordPolicy'
import { validateMarketingHeroActionTargets } from './marketingHeroActionPolicy'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
const MARKETING_TEMPLATE = 'marketing-page'
const HERO_WIDGET = 'marketing.hero'

type DbLayout = { id: string; scope_entity_id: string | null; base_layout_id: string | null }
type DbWidget = {
    id: string
    layout_id: string
    widget_key: unknown
    zone: unknown
    config: unknown
    sort_order: number
    is_active: boolean | null
}
type DbOverride = {
    layout_id: string
    base_widget_id: string
    config: unknown
    zone: string | null
    sort_order: number | null
    is_active: boolean | null
    is_deleted_override: boolean
}
type BindingTarget = WidgetEntityBindingEnvelope['slots'][number]['targets'][number]
type EffectiveWidget = {
    id: string
    widgetKey: string
    zone: string
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    activeOverride?: boolean
    configOverridden?: boolean
    bindings?: WidgetEntityBindingEnvelope
}
type EffectiveMarketingLayout = { id: string; scopeEntityId: string | null; baseLayoutId: string | null; widgets: EffectiveWidget[] }
type IgnoredWidgetOverride = { layoutId: string; baseWidgetId: string }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const decodeWidget = (row: DbWidget): EffectiveWidget => {
    const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
    const zone = applicationLayoutZoneSchema.parse(row.zone)
    const envelope = decodeWidgetConfigEnvelope(row.config, {
        templateKey: MARKETING_TEMPLATE,
        widgetKey,
        zone,
        requireBindings: true
    })
    return {
        id: String(row.id),
        widgetKey,
        zone,
        sortOrder: row.sort_order,
        config: parseApplicationLayoutWidgetConfig(widgetKey, envelope.rendererConfig),
        isActive: row.is_active !== false,
        ...(envelope.neutral.bindings ? { bindings: widgetEntityBindingEnvelopeSchema.parse(envelope.neutral.bindings) } : {})
    }
}

const getEffectiveLayouts = async (
    db: SqlQueryable,
    schemaName: string,
    ignoredOverride?: IgnoredWidgetOverride
): Promise<EffectiveMarketingLayout[]> => {
    const layouts = await queryMany<DbLayout>(
        db,
        `SELECT id, scope_entity_id, base_layout_id
           FROM ${qSchemaTable(schemaName, '_mhb_layouts')}
          WHERE template_key = $1 AND ${ACTIVE}
          ORDER BY id ASC`,
        [MARKETING_TEMPLATE]
    )
    if (layouts.length === 0) return []

    const widgetLayoutIds = [
        ...new Set(layouts.flatMap((layout) => [layout.id, layout.base_layout_id].filter((id): id is string => Boolean(id))))
    ]
    const widgetRows = await queryMany<DbWidget>(
        db,
        `SELECT id, layout_id, widget_key, zone, config, sort_order, is_active
           FROM ${qSchemaTable(schemaName, '_mhb_widgets')}
          WHERE layout_id = ANY($1::uuid[]) AND ${ACTIVE}
          ORDER BY layout_id ASC, zone ASC, sort_order ASC, _upl_created_at ASC`,
        [widgetLayoutIds]
    )
    const scopedLayoutIds = layouts.filter((layout) => layout.scope_entity_id && layout.base_layout_id).map((layout) => layout.id)
    const overrideRows =
        scopedLayoutIds.length === 0
            ? []
            : await queryMany<DbOverride>(
                  db,
                  `SELECT layout_id, base_widget_id, config, zone, sort_order, is_active, is_deleted_override
                     FROM ${qSchemaTable(schemaName, '_mhb_layout_widget_overrides')}
                    WHERE layout_id = ANY($1::uuid[]) AND ${ACTIVE}
                    ORDER BY _upl_created_at ASC`,
                  [scopedLayoutIds]
              )

    const widgetsByLayout = new Map<string, DbWidget[]>()
    for (const row of widgetRows) {
        const current = widgetsByLayout.get(row.layout_id) ?? []
        current.push(row)
        widgetsByLayout.set(row.layout_id, current)
    }
    const overridesByLayout = new Map<string, Map<string, DbOverride>>()
    for (const row of overrideRows) {
        if (row.layout_id === ignoredOverride?.layoutId && row.base_widget_id === ignoredOverride?.baseWidgetId) continue
        const current = overridesByLayout.get(row.layout_id) ?? new Map<string, DbOverride>()
        current.set(row.base_widget_id, row)
        overridesByLayout.set(row.layout_id, current)
    }

    return layouts.map((layout) => {
        if (!layout.scope_entity_id || !layout.base_layout_id) {
            return {
                id: layout.id,
                scopeEntityId: layout.scope_entity_id,
                baseLayoutId: layout.base_layout_id,
                widgets: (widgetsByLayout.get(layout.id) ?? []).map(decodeWidget)
            }
        }

        const overrides = overridesByLayout.get(layout.id) ?? new Map<string, DbOverride>()
        const inherited = (widgetsByLayout.get(layout.base_layout_id) ?? []).flatMap((row) => {
            const base = decodeWidget(row)
            const override = overrides.get(base.id)
            const shared = resolveSharedBehavior(isRecord(base.config.sharedBehavior) ? base.config.sharedBehavior : undefined)
            if (override?.is_deleted_override === true && shared.canExclude) return []

            let resolved = base
            if (override?.config !== null && override?.config !== undefined) {
                const configured = decodeWidget({ ...row, config: override.config })
                const baseInstanceKey = typeof base.config.instanceKey === 'string' ? base.config.instanceKey : undefined
                const overrideInstanceKey = typeof configured.config.instanceKey === 'string' ? configured.config.instanceKey : undefined
                if (baseInstanceKey !== overrideInstanceKey) {
                    throw new MetahubValidationError('Marketing widget instance key is immutable', { widgetKey: base.widgetKey })
                }
                resolved = configured
            }

            const activeOverride = shared.canDeactivate && typeof override?.is_active === 'boolean' ? override.is_active : undefined
            return [
                {
                    ...resolved,
                    id: base.id,
                    zone: shared.positionLocked || !override?.zone ? base.zone : applicationLayoutZoneSchema.parse(override.zone),
                    sortOrder: !shared.positionLocked && typeof override?.sort_order === 'number' ? override.sort_order : base.sortOrder,
                    isActive: activeOverride ?? base.isActive,
                    ...(override?.config !== null && override?.config !== undefined ? { configOverridden: true } : {}),
                    ...(activeOverride === undefined ? {} : { activeOverride })
                }
            ]
        })
        const owned = (widgetsByLayout.get(layout.id) ?? []).map(decodeWidget)
        return {
            id: layout.id,
            scopeEntityId: layout.scope_entity_id,
            baseLayoutId: layout.base_layout_id,
            widgets: [...inherited, ...owned].sort(
                (left, right) => left.zone.localeCompare(right.zone) || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
            )
        }
    })
}

const getBindings = (widgets: readonly EffectiveWidget[]): BindingTarget[] => {
    const targets = widgets
        .filter((widget) => widget.isActive && widget.widgetKey === HERO_WIDGET && widget.bindings)
        .flatMap((widget) => widget.bindings?.slots.flatMap((slot) => slot.targets) ?? [])
    if (targets.some((target) => !isMarketingHeroTarget(target))) {
        throw new MetahubValidationError('Hero layout contains an invalid Entity binding')
    }
    return targets
}

/** Count effective active Hero placements that reference the selected semantic record. */
export const countMarketingHeroBindingUsage = async (
    db: SqlQueryable,
    schemaName: string,
    binding: WidgetEntityBindingEnvelope,
    excludeWidgetId?: string
): Promise<number> => {
    const selected = binding.slots.find(({ slot }) => slot === 'content')?.targets[0]
    if (!selected || selected.selector.kind !== 'semantic-key') return 0
    const layouts = await getEffectiveLayouts(db, schemaName)
    return layouts.reduce(
        (count, layout) =>
            count +
            layout.widgets.filter((widget) => {
                if (widget.widgetKey !== HERO_WIDGET || widget.id === excludeWidgetId) return false
                return (widget.bindings?.slots.flatMap((slot) => slot.targets) ?? []).some(
                    (target) =>
                        target.entityKind === selected.entityKind &&
                        target.entityCodename === selected.entityCodename &&
                        target.selector.kind === 'semantic-key' &&
                        target.selector.field === selected.selector.field &&
                        target.selector.value === selected.selector.value
                )
            }).length,
        0
    )
}

const isMarketingHeroTarget = (target: BindingTarget): boolean => target.entityKind === 'object' && target.selector.kind === 'semantic-key'

const getMarketingHeroSemanticKeyDefinition = () => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === HERO_WIDGET)
    const semanticKey = definition?.bindingSlots
        ?.find(({ key }) => key === 'content')
        ?.requirements.components.find(({ semanticKey: isKey }) => isKey === true)
    if (!semanticKey) throw new MetahubValidationError('Hero binding slot has no semantic key definition')
    return { selectorField: semanticKey.field, componentCodename: semanticKey.componentCodename }
}

const getSectionDescriptors = (widgets: readonly EffectiveWidget[]) =>
    widgets.map((widget) => ({ widgetKey: widget.widgetKey, config: widget.config, isActive: widget.isActive }))

const loadBoundHeroContent = async (
    db: SqlQueryable,
    schemaName: string,
    targets: readonly BindingTarget[]
): Promise<Array<{ target: BindingTarget; content: ReturnType<typeof projectMarketingHeroContentData> }>> => {
    if (targets.length === 0) return []
    if (targets.some((target) => !isMarketingHeroTarget(target) || target.selector.kind !== 'semantic-key')) {
        throw new MetahubValidationError('Hero action integrity requires semantic record bindings')
    }

    const semanticKeyDefinition = getMarketingHeroSemanticKeyDefinition()
    const semanticTargets = targets.map((target) => {
        if (
            !isMarketingHeroTarget(target) ||
            target.selector.kind !== 'semantic-key' ||
            target.selector.field !== semanticKeyDefinition.selectorField
        ) {
            throw new MetahubValidationError('Hero binding selector does not match its semantic key field')
        }
        return { target, semanticKey: target.selector.value }
    })
    const result: Array<{ target: BindingTarget; content: ReturnType<typeof projectMarketingHeroContentData> }> = []
    for (const { target, semanticKey } of semanticTargets) {
        const object = await queryOne<{ id: string; config: unknown }>(
            db,
            `SELECT id, config FROM ${qSchemaTable(schemaName, '_mhb_objects')}
              WHERE kind = 'object' AND ${codenamePrimaryTextSql('codename')} = $1 AND ${ACTIVE} LIMIT 1`,
            [target.entityCodename]
        )
        if (!object) throw new MetahubValidationError('Hero binding Object is unavailable')
        const policy = resolveEntityRecordPolicy(object.config)
        if (
            !isAuthoritativeMarketingHeroRecordPolicy(policy) ||
            policy.semanticKey?.componentCodename !== semanticKeyDefinition.componentCodename
        ) {
            throw new MetahubValidationError('Hero Entity record policy does not match its registered binding slot')
        }
        const components = await queryMany<{ codename: string; data_type: string; is_required: boolean; validation_rules: unknown }>(
            db,
            `SELECT ${codenamePrimaryTextSql('codename')} AS codename, data_type, is_required, validation_rules
               FROM ${qSchemaTable(schemaName, '_mhb_components')} WHERE object_id = $1 AND parent_component_id IS NULL AND ${ACTIVE}`,
            [object.id]
        )
        validateMarketingHeroComponents(components)
        const matches = await queryMany<{ id: string; data: unknown }>(
            db,
            `SELECT id, data FROM ${qSchemaTable(schemaName, '_mhb_elements')}
              WHERE object_id = $1 AND ${ACTIVE} AND data ->> $2::text = $3 ORDER BY id ASC LIMIT 2`,
            [object.id, policy.semanticKey.componentCodename, semanticKey]
        )
        if (matches.length !== 1 || !isRecord(matches[0]!.data)) {
            throw new MetahubValidationError('Hero semantic key does not resolve to one active Entity record', {
                semanticKey,
                matchCount: matches.length
            })
        }
        const validation = validateEntityRecordPolicyData(
            policy,
            matches[0]!.data,
            components.map((component) => ({
                codename: component.codename,
                isRequired: component.is_required,
                validationRules: isRecord(component.validation_rules) ? component.validation_rules : {}
            }))
        )
        if (!validation.valid) throw new MetahubValidationError('Hero content is incomplete or invalid', { fields: validation.errors })
        result.push({ target, content: projectMarketingHeroContentData(matches[0]!.data) })
    }
    return result
}

/** Protect every effective layout that currently binds this Hero record. */
export const assertMarketingHeroRecordActionsRemainValid = async (
    db: SqlQueryable,
    schemaName: string,
    semanticKeyField: string,
    semanticKey: string,
    content: ReturnType<typeof projectMarketingHeroContentData>
): Promise<void> => {
    const semanticKeyDefinition = getMarketingHeroSemanticKeyDefinition()
    if (semanticKeyField !== semanticKeyDefinition.componentCodename) {
        throw new MetahubValidationError('Hero record update does not match its registered semantic key Component')
    }
    const layouts = await getEffectiveLayouts(db, schemaName)
    for (const layout of layouts) {
        const isBound = getBindings(layout.widgets).some(
            (target) =>
                isMarketingHeroTarget(target) &&
                target.selector.kind === 'semantic-key' &&
                target.selector.field === semanticKeyDefinition.selectorField &&
                target.selector.value === semanticKey
        )
        if (isBound) validateMarketingHeroActionTargets(content, getSectionDescriptors(layout.widgets))
    }
}

export type MarketingHeroLayoutWidgetMutation =
    | { widgetId: string; widgetKey: string; config?: Record<string, unknown>; kind: 'remove' }
    | { widgetId: string; widgetKey: string; config?: Record<string, unknown>; kind: 'set-active'; isActive: boolean }
    | { widgetId: string; widgetKey: string; config: Record<string, unknown>; kind: 'set-config' }
    | { widgetId: string; widgetKey: string; config?: Record<string, unknown>; kind: 'reset-override' }

/** Validate the effective post-mutation composition before a section is hidden or removed. */
export const assertMarketingHeroLayoutMutationPreservesActions = async (
    db: SqlQueryable,
    schemaName: string,
    layoutId: string,
    mutation: MarketingHeroLayoutWidgetMutation
): Promise<void> => {
    if (getMarketingSectionAnchorEntries([{ widgetKey: mutation.widgetKey, config: mutation.config, isActive: true }]).length === 0) {
        return
    }
    const layouts = await getEffectiveLayouts(
        db,
        schemaName,
        mutation.kind === 'reset-override' ? { layoutId, baseWidgetId: mutation.widgetId } : undefined
    )
    const targetLayout = layouts.find((candidate) => candidate.id === layoutId)
    if (!targetLayout) throw new MetahubValidationError('Marketing layout is unavailable for Hero action validation')
    const affectedLayouts =
        targetLayout.scopeEntityId === null && targetLayout.baseLayoutId === null
            ? layouts.filter((candidate) => candidate.id === layoutId || candidate.baseLayoutId === layoutId)
            : [targetLayout]

    for (const layout of affectedLayouts) {
        const currentWidget = layout.widgets.find((widget) => widget.id === mutation.widgetId)
        if (!currentWidget) continue

        const isInheritedFromMutatedBase = layout.id !== layoutId && layout.baseLayoutId === layoutId
        const widgets =
            mutation.kind === 'remove'
                ? layout.widgets.filter((widget) => widget.id !== mutation.widgetId)
                : mutation.kind === 'set-active'
                ? layout.widgets.map((widget) => {
                      if (widget.id !== mutation.widgetId) return widget
                      if (isInheritedFromMutatedBase && widget.activeOverride !== undefined) return widget
                      return { ...widget, isActive: mutation.isActive }
                  })
                : mutation.kind === 'set-config'
                ? layout.widgets.map((widget) => {
                      if (widget.id !== mutation.widgetId) return widget
                      if (isInheritedFromMutatedBase && widget.configOverridden) return widget
                      const envelope = decodeWidgetConfigEnvelope(mutation.config, {
                          templateKey: MARKETING_TEMPLATE,
                          widgetKey: widget.widgetKey,
                          zone: widget.zone,
                          requireBindings: true
                      })
                      return {
                          ...widget,
                          config: parseApplicationLayoutWidgetConfig(widget.widgetKey, envelope.rendererConfig),
                          ...(envelope.neutral.bindings ? { bindings: envelope.neutral.bindings } : { bindings: undefined })
                      }
                  })
                : layout.widgets
        const boundContent = await loadBoundHeroContent(db, schemaName, getBindings(widgets))
        const sections = getSectionDescriptors(widgets)
        for (const { content } of boundContent) validateMarketingHeroActionTargets(content, sections)
    }
}
