import stableStringify from 'json-stable-stringify'
import {
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    parseApplicationLayoutWidgetConfig
} from '@universo-react/types'
import type { PersistedAppLayoutZoneWidget } from '../routes/sync/syncTypes'
import {
    parseApplicationLayoutSyncTemplateKey,
    requireApplicationLayoutSyncBoolean,
    requireApplicationLayoutSyncInteger,
    requireApplicationLayoutSyncRecord
} from './applicationLayoutSyncGuards'
import type { ApplicationLayoutSyncWidgetRow } from './applicationLayoutSyncTypes'

export type PersistedPublishedWidgetProjectionRow = Pick<
    ApplicationLayoutSyncWidgetRow,
    | 'id'
    | 'layout_id'
    | 'zone'
    | 'widget_key'
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
        const inheritsMarketingBindings =
            templateKey === 'marketing-page' && row.source_base_widget_id !== null && row.source_base_widget_id !== undefined
        if (typeof row.zone !== 'string' || row.zone.length === 0 || typeof row.widget_key !== 'string' || row.widget_key.length === 0) {
            throw new Error(`[SchemaSync] Persisted widget ${row.id} identity is invalid`)
        }
        const hasSourceConfig = row.source_config !== null && row.source_config !== undefined
        const decoded = decodeLayoutWidgetConfigEnvelope(
            requireApplicationLayoutSyncRecord(row.config, `Persisted widget ${row.id} config`),
            {
                templateKey,
                widgetKey: row.widget_key,
                zone: row.zone,
                requireBindings: !inheritsMarketingBindings && !hasSourceConfig
            }
        )
        if (inheritsMarketingBindings && decoded.neutral.bindings !== undefined) {
            throw new Error(`[SchemaSync] Persisted Marketing overlay widget ${row.id} cannot contain entity bindings`)
        }

        const neutral = { ...decoded.neutral }
        if (hasSourceConfig) {
            const sourceDecoded = decodeLayoutWidgetConfigEnvelope(
                requireApplicationLayoutSyncRecord(row.source_config, `Persisted widget ${row.id} source config`),
                { templateKey, widgetKey: row.widget_key, zone: row.zone, requireBindings: !inheritsMarketingBindings }
            )
            if (inheritsMarketingBindings && sourceDecoded.neutral.bindings !== undefined) {
                throw new Error(`[SchemaSync] Persisted Marketing overlay widget ${row.id} source config cannot contain entity bindings`)
            }
            if (
                decoded.neutral.bindings !== undefined &&
                stableStringify(decoded.neutral.bindings) !== stableStringify(sourceDecoded.neutral.bindings)
            ) {
                throw new Error(`[SchemaSync] Persisted widget ${row.id} config bindings do not match its source config`)
            }
            if (sourceDecoded.neutral.bindings === undefined) delete neutral.bindings
            else neutral.bindings = sourceDecoded.neutral.bindings
        }

        const rendererConfig = parseApplicationLayoutWidgetConfig(row.widget_key, decoded.rendererConfig)
        return {
            id: row.id,
            layoutId: row.layout_id,
            sourceBaseWidgetId: row.source_base_widget_id,
            zone: row.zone as PersistedAppLayoutZoneWidget['zone'],
            widgetKey: row.widget_key,
            sortOrder: requireApplicationLayoutSyncInteger(row.sort_order, `Persisted widget ${row.id} sortOrder`),
            config: encodeLayoutWidgetConfigEnvelope(
                { rendererConfig, neutral },
                { templateKey, widgetKey: row.widget_key, zone: row.zone, requireBindings: !inheritsMarketingBindings }
            ),
            isActive: requireApplicationLayoutSyncBoolean(row.is_active, `Persisted widget ${row.id} isActive`)
        }
    })
