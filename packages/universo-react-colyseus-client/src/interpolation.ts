export interface Vector3Like {
    x: number
    y: number
    z: number
}

export interface SnapshotState<TState> {
    state: TState
    receivedAt: number
}

export type Vector3Selector<TState> = (state: TState) => Vector3Like

export const createMoveToPointIntent = (target: Vector3Like): { type: 'move_to_point'; target: Vector3Like } => ({
    type: 'move_to_point',
    target: { x: target.x, y: target.y, z: target.z }
})

export const createMoveToObjectIntent = (objectId: string): { type: 'move_to_object'; objectId: string } => ({
    type: 'move_to_object',
    objectId
})

export const createStopIntent = (): { type: 'stop' } => ({ type: 'stop' })

export const lerpNumber = (from: number, to: number, alpha: number): number => from + (to - from) * Math.min(1, Math.max(0, alpha))

export const lerpVector3 = (from: Vector3Like, to: Vector3Like, alpha: number): Vector3Like => ({
    x: lerpNumber(from.x, to.x, alpha),
    y: lerpNumber(from.y, to.y, alpha),
    z: lerpNumber(from.z, to.z, alpha)
})

export const interpolateSnapshotVector3 = <TState>(
    previous: SnapshotState<TState> | null,
    next: SnapshotState<TState> | null,
    renderTime: number,
    selectVector: Vector3Selector<TState>
): Vector3Like | null => {
    if (!next) {
        return previous ? selectVector(previous.state) : null
    }
    if (!previous || previous.receivedAt >= next.receivedAt) {
        return selectVector(next.state)
    }

    const duration = next.receivedAt - previous.receivedAt
    const alpha = duration > 0 ? (renderTime - previous.receivedAt) / duration : 1
    return lerpVector3(selectVector(previous.state), selectVector(next.state), alpha)
}

export const isDoubleClickActivation = (params: { lastClickAt: number | null; currentClickAt: number; thresholdMs?: number }): boolean =>
    params.lastClickAt !== null && params.currentClickAt - params.lastClickAt <= (params.thresholdMs ?? 350)
