import type { Vector3Like } from '@universo-react/playcanvas-engine'

/** Result returned by the host canvas picker. */
export interface CanvasPickResult {
    point: Vector3Like
    objectId?: string
}

/** Intent shape accepted by the published-script host bridge. */
export type PlayCanvasHostIntent =
    | { type: 'move_to_point'; target: Vector3Like }
    | { type: 'move_to_object'; objectId: string }
    | { type: 'stop' }

/** Read-only participant summary exposed to published scripts. */
export interface PlayCanvasParticipantSummary {
    total: number
    remote: number
}

/**
 * Narrow bridge exposed by the runtime widget to a published PlayCanvas
 * script. The room, sequence allocation and DOM input remain widget-owned.
 */
export interface PlayCanvasHostBridge {
    sendIntent(intent: PlayCanvasHostIntent): boolean
    pickAt(clientX: number, clientY: number, includeFlightPlane: boolean): CanvasPickResult | null
    getParticipants(): PlayCanvasParticipantSummary
}

/** Runtime API implemented by the built-in flight-control script asset. */
export interface FlightControlRuntimeApi {
    setPredictionTarget(target: Vector3Like | null): void
    setPendingPredictionCount(count: number): void
    setAuthoritativeState(position: Vector3Like | null, velocity: Vector3Like | null): void
    applyPredictionAck(target: Vector3Like | null, speed?: number): void
    clearAuthoritativeState(): void
    updateDesiredOrientation(from: Vector3Like, to: Vector3Like): void
    syncPosition(position: Vector3Like): void
    resolveTarget?: (target: Vector3Like) => Vector3Like
    getForward(): Vector3Like
}

/** Runtime API implemented by the built-in follow-camera script asset. */
export interface FollowCameraRuntimeApi {
    zoomBy(delta: number): void
    rotateBy(deltaYaw: number): void
    setDragDelta(deltaX: number, deltaY: number): void
    resetView(): void
}

/** Runtime API implemented by the built-in remote-ships script asset. */
export interface RemoteShipsRuntimeApi {
    applySnapshot(snapshot: ReadonlyMap<string, RemoteShipRenderState>): void
}

/** Snapshot projected from the authoritative room state for one remote ship. */
export interface RemoteShipRenderState {
    position: Vector3Like
    heading: Vector3Like | null
}

export const DEFAULT_INTENT_DISTANCE = 720
export const FLIGHT_CONTROL_SCRIPT_NAME = 'flightControl'
export const FOLLOW_CAMERA_SCRIPT_NAME = 'followCamera'
export const REMOTE_SHIPS_SCRIPT_NAME = 'remoteShips'

const EPSILON = 0.000001

/** Return the Euclidean length of a vector. */
export const vectorLength = (value: Vector3Like): number => Math.hypot(value.x, value.y, value.z)

/** Normalize a vector, using +X for a zero-length vector. */
export const normalizeVector = (value: Vector3Like): Vector3Like => {
    const length = vectorLength(value)
    if (length <= EPSILON) {
        return { x: 1, y: 0, z: 0 }
    }
    return { x: value.x / length, y: value.y / length, z: value.z / length }
}

/** Normalize a direction with a normalized fallback. */
export const normalizeForward = (value: Vector3Like, fallback: Vector3Like = { x: 1, y: 0, z: 0 }): Vector3Like => {
    const length = vectorLength(value)
    if (length > EPSILON) {
        return { x: value.x / length, y: value.y / length, z: value.z / length }
    }
    const fallbackLength = vectorLength(fallback)
    return fallbackLength > EPSILON
        ? { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength, z: fallback.z / fallbackLength }
        : { x: 1, y: 0, z: 0 }
}

/** Add two vectors without mutating either input. */
export const addVector = (a: Vector3Like, b: Vector3Like): Vector3Like => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
})

/** Scale a vector without mutating it. */
export const scaleVector = (value: Vector3Like, scale: number): Vector3Like => ({
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
})

/** Return the dot product of two vectors. */
export const dotVector = (a: Vector3Like, b: Vector3Like): number => a.x * b.x + a.y * b.y + a.z * b.z

/** Return the cross product of two vectors. */
export const crossVector = (a: Vector3Like, b: Vector3Like): Vector3Like => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
})

/** Resolve an entity script instance without exposing PlayCanvas internals. */
export const getEntityScriptInstance = <T>(entity: { script?: unknown } | undefined, scriptName: string): T | null => {
    if (!entity) {
        return null
    }
    const component = entity.script
    if (!component || typeof component !== 'object') {
        return null
    }
    return ((component as Record<string, unknown>)[scriptName] as T | undefined) ?? null
}
