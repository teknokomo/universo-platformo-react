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

export type MovementIntent =
    | { type: 'move_to_point'; target: Vector3Like; seq: number }
    | { type: 'move_to_object'; objectId: string; seq: number }
    | { type: 'stop'; seq: number }

const MAX_INTENT_SEQ = 2147483647

const resolveIntentSeq = (seq: number): number => {
    if (Number.isInteger(seq) && seq > 0 && seq <= MAX_INTENT_SEQ) {
        return seq
    }

    throw new RangeError(`Movement intent seq must be an integer between 1 and ${MAX_INTENT_SEQ}`)
}

export const createMoveToPointIntent = (target: Vector3Like, seq: number): { type: 'move_to_point'; target: Vector3Like; seq: number } => ({
    type: 'move_to_point',
    target: { x: target.x, y: target.y, z: target.z },
    seq: resolveIntentSeq(seq)
})

export const createMoveToObjectIntent = (objectId: string, seq: number): { type: 'move_to_object'; objectId: string; seq: number } => ({
    type: 'move_to_object',
    objectId,
    seq: resolveIntentSeq(seq)
})

export const createStopIntent = (seq: number): { type: 'stop'; seq: number } => ({ type: 'stop', seq: resolveIntentSeq(seq) })

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

export const interpolateKeyedSnapshotVector3 = <TState>(
    previousById: ReadonlyMap<string, SnapshotState<TState>>,
    nextById: ReadonlyMap<string, SnapshotState<TState>>,
    id: string,
    renderTime: number,
    selectVector: Vector3Selector<TState>
): Vector3Like | null => interpolateSnapshotVector3(previousById.get(id) ?? null, nextById.get(id) ?? null, renderTime, selectVector)

export const dropAcknowledgedPredictions = <TPrediction extends { seq: number }>(
    predictions: readonly TPrediction[],
    lastProcessedInputSeq: number
): TPrediction[] => predictions.filter((prediction) => prediction.seq > lastProcessedInputSeq)

export const isDoubleClickActivation = (params: { lastClickAt: number | null; currentClickAt: number; thresholdMs?: number }): boolean =>
    params.lastClickAt !== null && params.currentClickAt - params.lastClickAt <= (params.thresholdMs ?? 350)
