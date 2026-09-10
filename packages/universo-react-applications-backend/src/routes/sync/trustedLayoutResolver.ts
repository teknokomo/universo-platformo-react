import { isUuidV7, validateSnapshotLayoutIdentities } from '@universo-react/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { EffectiveLayoutError, failEffectiveLayout } from '../../services/effectiveLayoutContract'
import { selectCanonicalLayoutCandidate } from '../../services/effectiveLayoutSelection'
import { materializeSnapshotLayoutsAndWidgets } from './syncHelpers'
import type { PersistedAppLayout, PersistedAppLayoutZoneWidget } from './syncTypes'

export type TrustedLayoutTarget =
    | {
          targetKind: null
          entityTypeId?: null
      }
    | {
          targetKind: 'page' | 'object'
          entityTypeId: string
      }

export type TrustedMaterializedLayout = {
    layout: PersistedAppLayout
    widgets: PersistedAppLayoutZoneWidget[]
    scope: 'global' | 'entity'
}

const NON_OBJECT_RUNTIME_KINDS = new Set(['hub', 'set', 'enumeration', 'page', 'ledger'])

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

/**
 * Keep snapshot target classification aligned with runtimeObjectFilterSql.
 * Custom physical entity kinds are object-like in the runtime; only platform
 * container kinds and registrar-only ledgers are excluded.
 */
const isRuntimeObjectKind = (entity: { kind: unknown; config?: unknown }): boolean => {
    if (typeof entity.kind !== 'string' || entity.kind.length === 0 || NON_OBJECT_RUNTIME_KINDS.has(entity.kind)) {
        return false
    }

    const config = isRecord(entity.config) ? entity.config : null
    const capabilities = config && isRecord(config.capabilities) ? config.capabilities : null
    const ledgerSchema = capabilities && isRecord(capabilities.ledgerSchema) ? capabilities.ledgerSchema : null
    const ledger = config && isRecord(config.ledger) ? config.ledger : null

    return !(ledgerSchema?.enabled === true && ledger?.sourcePolicy === 'registrar')
}

/**
 * Validate and materialize the trusted snapshot projection used by
 * publication/snapshot sync. No physical IDs are allocated here; the sync
 * stores remain responsible for application-row identity allocation.
 */
export const materializeTrustedSnapshotLayoutsAndWidgets = (
    snapshot: PublishedApplicationSnapshot
): { layouts: PersistedAppLayout[]; widgets: PersistedAppLayoutZoneWidget[] } => {
    validateSnapshotLayoutIdentities(snapshot)
    return materializeSnapshotLayoutsAndWidgets(snapshot)
}

/**
 * Resolve an effective layout from the already trusted snapshot projection.
 * This is the publication/snapshot counterpart of the request-scoped DB
 * resolver and intentionally shares the same canonical selection core.
 */
export const resolveTrustedMaterializedLayout = (
    snapshot: PublishedApplicationSnapshot,
    target: TrustedLayoutTarget
): TrustedMaterializedLayout => {
    const materialized = materializeTrustedSnapshotLayoutsAndWidgets(snapshot)
    const entityTypeId = target.targetKind === null ? null : target.entityTypeId

    if (target.targetKind !== null) {
        if (!isUuidV7(entityTypeId)) {
            throw new EffectiveLayoutError('LAYOUT_REQUEST_INVALID')
        }
        const entity = snapshot.entities[entityTypeId]
        if (!entity) {
            throw new EffectiveLayoutError('LAYOUT_TARGET_NOT_FOUND')
        }
        const isTargetKindValid = target.targetKind === 'page' ? entity.kind === 'page' : isRuntimeObjectKind(entity)
        if (!isTargetKindValid) {
            throw new EffectiveLayoutError('LAYOUT_TARGET_NOT_FOUND')
        }
    }

    const selected = selectCanonicalLayoutCandidate(materialized.layouts, entityTypeId)
    if (!selected) {
        return failEffectiveLayout('LAYOUT_DEFAULT_INVALID')
    }

    return {
        layout: selected.layout,
        widgets: materialized.widgets.filter((widget) => widget.layoutId === selected.layout.id && widget.isActive),
        scope: selected.scope
    }
}
