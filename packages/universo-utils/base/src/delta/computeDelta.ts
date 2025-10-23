import type { ComponentSnapshotMap, Transform } from '@universo/types'
import { approxEq } from '../math/numbers'

const eqVec = (a?: readonly number[], b?: readonly number[]) => !!a && !!b && a.length === b.length && a.every((v, i) => approxEq(v, b[i]!))

type ComponentPatch = { transform?: Transform; visual?: ComponentSnapshotMap['visual']; health?: ComponentSnapshotMap['health'] }

function diffComponent(prev?: ComponentSnapshotMap, next?: ComponentSnapshotMap): Partial<ComponentSnapshotMap> | undefined {
    if (!prev && !next) return undefined
    if (!prev && next) return next
    if (prev && !next) return {}
    const patch: ComponentPatch = {}

    if (prev!.transform || next!.transform) {
        const p = prev!.transform
        const n = next!.transform
        if (!p || !n ||
            !eqVec(p.position, n.position) ||
            !eqVec(p.rotation, n.rotation) ||
            ((p.scale || n.scale) && !eqVec(p.scale, n.scale)) ||
            ((p.velocity || n.velocity) && !eqVec(p.velocity, n.velocity))) {
            patch.transform = n
        }
    }

    if (prev!.visual || next!.visual) {
        const p = prev!.visual
        const n = next!.visual
        if (!p || !n || p.model !== n.model || ((p.tint || n.tint) && !eqVec(p.tint as any, n.tint as any))) {
            patch.visual = n
        }
    }

    if (prev!.health || next!.health) {
        const p = prev!.health
        const n = next!.health
        if (!p || !n || p.current !== n.current || p.max !== n.max) {
            patch.health = n
        }
    }

    return Object.keys(patch).length ? (patch as Partial<ComponentSnapshotMap>) : undefined
}

export function computeDelta(
    prev: Readonly<Record<string, Partial<ComponentSnapshotMap>>>,
    next: Readonly<Record<string, Partial<ComponentSnapshotMap>>>,
    baseTick: number,
    nextTick: number
) {
    const added: any[] = []
    const updated: any[] = []
    const removed: string[] = []

    const prevIds = new Set(Object.keys(prev))
    const nextIds = new Set(Object.keys(next))

    for (const id of nextIds) {
        if (!prevIds.has(id)) {
            added.push({ entityId: id, components: next[id] })
        } else {
            const patch = diffComponent(prev[id], next[id])
            const removedComponents: (keyof ComponentSnapshotMap)[] = []
            if (prev[id]?.transform && !next[id]?.transform) removedComponents.push('transform')
            if (prev[id]?.visual && !next[id]?.visual) removedComponents.push('visual')
            if (prev[id]?.health && !next[id]?.health) removedComponents.push('health')
            if (patch || removedComponents.length) {
                updated.push({ entityId: id, components: patch, removedComponents: removedComponents.length ? removedComponents : undefined })
            }
        }
    }

    for (const id of prevIds) if (!nextIds.has(id)) removed.push(id)

    return { tick: nextTick, baseTick, added: added.length ? added : undefined, updated: updated.length ? updated : undefined, removed: removed.length ? removed : undefined }
}
