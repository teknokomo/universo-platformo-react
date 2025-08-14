import type { ComponentSnapshotMap, Snapshot, Delta } from '@universo-platformo/types'

export function applyDelta(snapshot: Snapshot, delta: Delta): Snapshot {
    const entities: Record<string, Partial<ComponentSnapshotMap>> = { ...snapshot.entities }

    delta.added?.forEach((a) => {
        entities[a.entityId] = { ...(a.components || {}) }
    })

    delta.updated?.forEach((u) => {
        const cur = entities[u.entityId] || {}
        entities[u.entityId] = { ...cur, ...(u.components || {}) }
        u.removedComponents?.forEach((k) => {
            if (k in entities[u.entityId]!) delete (entities[u.entityId]! as any)[k]
        })
    })

    delta.removed?.forEach((id) => {
        delete entities[id]
    })

    return { tick: delta.tick, serverTimeMs: snapshot.serverTimeMs, entities, events: snapshot.events }
}
