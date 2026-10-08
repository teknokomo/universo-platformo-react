import stableStringify from 'json-stable-stringify'
import { encodeLayoutWidgetConfigEnvelope } from '@universo-react/types'
import type { PersistedAppLayoutZoneWidget } from '../routes/sync/syncTypes'
import {
    parseApplicationLayoutSyncTemplateKey,
    requireApplicationLayoutSyncBoolean,
    requireApplicationLayoutSyncInteger,
    requireApplicationLayoutSyncRecord
} from './applicationLayoutSyncGuards'
import type { ApplicationLayoutSyncWidgetRow } from './applicationLayoutSyncTypes'
import {
    applicationLayoutWidgetPlacementSchema,
    classifyPlacementLineage,
    decodePlacementWidgetConfigEnvelope,
    parsePlacementRendererConfig,
    resolvePlacementBindingValidation
} from './applicationLayoutWidgetPlacement'

export type PersistedPublishedWidgetProjectionRow = Pick<
    ApplicationLayoutSyncWidgetRow,
    | 'id'
    | 'layout_id'
    | 'zone'
    | 'widget_key'
    | 'instance_key'
    | 'parent_widget_id'
    | 'slot_key'
    | 'sort_order'
    | 'config'
    | 'source_config'
    | 'is_active'
    | 'source_widget_id'
    | 'source_base_widget_id'
> & { template_key: unknown }

export const projectPersistedPublishedWidgets = (rows: readonly PersistedPublishedWidgetProjectionRow[]): PersistedAppLayoutZoneWidget[] =>
    rows.map((row) => {
        const templateKey = parseApplicationLayoutSyncTemplateKey(row.template_key, `persisted widget ${row.id}`)
        const instanceKey = row.instance_key
        const lineage = classifyPlacementLineage(row.source_widget_id, row.source_base_widget_id)
        const bindingsInheritedFromBase = row.source_base_widget_id !== null && row.source_base_widget_id !== undefined
        if (typeof row.zone !== 'string' || row.zone.length === 0 || typeof row.widget_key !== 'string' || row.widget_key.length === 0) {
            throw new Error(`[SchemaSync] Persisted widget ${row.id} identity is invalid`)
        }
        const placement = applicationLayoutWidgetPlacementSchema.safeParse({
            instanceKey,
            parentWidgetId: row.parent_widget_id,
            slotKey: row.slot_key
        })
        if (!placement.success) throw new Error(`[SchemaSync] Persisted widget ${row.id} placement identity is invalid`)
        const hasSourceConfig = row.source_config !== null && row.source_config !== undefined
        const validation = resolvePlacementBindingValidation(
            row.widget_key,
            row.config,
            lineage.kind === 'source-linked',
            bindingsInheritedFromBase
        )
        const decoded = decodePlacementWidgetConfigEnvelope(
            requireApplicationLayoutSyncRecord(row.config, `Persisted widget ${row.id} config`),
            {
                templateKey,
                widgetKey: row.widget_key,
                zone: row.zone,
                instanceKey,
                requireBindings: validation.requireBindings && !hasSourceConfig
            }
        )
        if (validation.rejectBindings && decoded.neutral.bindings !== undefined) {
            throw new Error(`[SchemaSync] Persisted widget ${row.id} cannot contain bindings for its registry policy`)
        }

        const neutral = { ...decoded.neutral }
        if (hasSourceConfig) {
            const sourceValidation = resolvePlacementBindingValidation(
                row.widget_key,
                row.source_config,
                lineage.kind === 'source-linked',
                bindingsInheritedFromBase
            )
            const sourceDecoded = decodePlacementWidgetConfigEnvelope(
                requireApplicationLayoutSyncRecord(row.source_config, `Persisted widget ${row.id} source config`),
                {
                    templateKey,
                    widgetKey: row.widget_key,
                    zone: row.zone,
                    instanceKey,
                    requireBindings: sourceValidation.requireBindings
                }
            )
            if (sourceValidation.rejectBindings && sourceDecoded.neutral.bindings !== undefined) {
                throw new Error(`[SchemaSync] Persisted widget ${row.id} source config violates its registry policy`)
            }
            if (
                !bindingsInheritedFromBase &&
                decoded.neutral.bindings !== undefined &&
                stableStringify(decoded.neutral.bindings) !== stableStringify(sourceDecoded.neutral.bindings)
            ) {
                throw new Error(`[SchemaSync] Persisted widget ${row.id} config bindings do not match its source config`)
            }
            if (sourceDecoded.neutral.bindings === undefined) delete neutral.bindings
            else neutral.bindings = sourceDecoded.neutral.bindings
        }

        const rendererConfig = parsePlacementRendererConfig(row.widget_key, decoded.rendererConfig)
        return {
            id: row.id,
            layoutId: row.layout_id,
            instanceKey,
            parentWidgetId: row.parent_widget_id,
            slotKey: row.slot_key,
            sourceWidgetId: row.source_widget_id,
            sourceBaseWidgetId: row.source_base_widget_id,
            zone: row.zone as PersistedAppLayoutZoneWidget['zone'],
            widgetKey: row.widget_key,
            sortOrder: requireApplicationLayoutSyncInteger(row.sort_order, `Persisted widget ${row.id} sortOrder`),
            config: encodeLayoutWidgetConfigEnvelope(
                { rendererConfig, neutral },
                { templateKey, widgetKey: row.widget_key, zone: row.zone, requireBindings: validation.requireBindings }
            ),
            isActive: requireApplicationLayoutSyncBoolean(row.is_active, `Persisted widget ${row.id} isActive`)
        }
    })
