/**
 * Built-in MMOOMM follow camera script (PlayCanvas ESM script asset).
 *
 * Owns the orbit follow-camera state (yaw/pitch/distance) and the per-frame
 * positioning around the controlled ship, including guard-box collision
 * resolution. Dataset markers written here: cameraDistance, cameraYaw,
 * cameraPitch, cameraGuardClearance.
 *
 * Host contract: DOM input (toolbar buttons, pointer drag, wheel) stays in the
 * widget; the widget calls this script's public methods (`zoomBy`, `rotateBy`,
 * `setDragDelta`, `resetView`). Published scripts can use the frozen
 * `this.app.__universoHost` facade: `{ sendIntent(intent),
 * pickAt(clientX, clientY, includeFlightPlane), getParticipants() }`.
 * The backend builtin-script catalog is the canonical source for this asset;
 * the fixture generator reads it directly when authoring project snapshots.
 */
import { Script } from 'playcanvas'
import {
    CAMERA_COLLISION_HALF_EXTENTS,
    distanceToAabbSurface,
    expandAabb,
    resolveCameraPositionOutsideGuardBoxes,
    resolveFollowCameraPosition,
    rotateFollowCamera,
    zoomFollowCamera
} from '@shared/flight-math'

const VECTOR_JSON_SCHEMA = [
    { name: 'x', type: 'number', default: 0 },
    { name: 'y', type: 'number', default: 0 },
    { name: 'z', type: 'number', default: 0 }
]

const AABB_JSON_SCHEMA = [
    { name: 'center', type: 'json', schema: VECTOR_JSON_SCHEMA, default: { x: 0, y: 0, z: 0 } },
    { name: 'halfExtents', type: 'json', schema: VECTOR_JSON_SCHEMA, default: { x: 0, y: 0, z: 0 } }
]

const DEFAULT_CAMERA = {
    yaw: -1,
    pitch: 0.25,
    distance: 120,
    minDistance: 18,
    maxDistance: 220
}

export class FollowCamera extends Script {
    static scriptName = 'followCamera'

    static attributes = {
        controlledEntityId: { type: 'string', default: 'controlled' },
        yaw: { type: 'number', default: DEFAULT_CAMERA.yaw },
        pitch: { type: 'number', default: DEFAULT_CAMERA.pitch },
        distance: { type: 'number', default: DEFAULT_CAMERA.distance },
        minDistance: { type: 'number', default: DEFAULT_CAMERA.minDistance },
        maxDistance: { type: 'number', default: DEFAULT_CAMERA.maxDistance },
        guardBoxes: { type: 'json', array: true, schema: AABB_JSON_SCHEMA, default: [] }
    }

    initialize() {
        // PlayCanvas ESM classes inherit from `Script`, whose constructor does
        // not materialize static attribute defaults (unlike the legacy
        // `ScriptType` wrapper). Resolve defaults here so a binding that only
        // supplies authored values remains safe and deterministic.
        this.controlledEntityId =
            typeof this.controlledEntityId === 'string' && this.controlledEntityId.trim() ? this.controlledEntityId.trim() : 'controlled'
        this.yaw = Number.isFinite(this.yaw) ? this.yaw : DEFAULT_CAMERA.yaw
        this.pitch = Number.isFinite(this.pitch) ? this.pitch : DEFAULT_CAMERA.pitch
        this.distance = Number.isFinite(this.distance) ? this.distance : DEFAULT_CAMERA.distance
        this.minDistance = Number.isFinite(this.minDistance) ? this.minDistance : DEFAULT_CAMERA.minDistance
        this.maxDistance = Number.isFinite(this.maxDistance) ? this.maxDistance : DEFAULT_CAMERA.maxDistance
        this.guardBoxes = Array.isArray(this.guardBoxes) ? this.guardBoxes : []
        this.canvas = this.app.graphicsDevice?.canvas ?? null
        this.targetEntity = this.app.root.findByName(this.controlledEntityId)
        this.resetDistance = this.distance
    }

    // ---- Widget-facing runtime API (DOM input stays in the widget) ----

    zoomBy(delta) {
        this.distance = zoomFollowCamera(this.distance, delta, this.minDistance, this.maxDistance)
    }

    rotateBy(deltaYaw) {
        this.yaw = rotateFollowCamera(this.yaw, this.pitch, deltaYaw, 0).yaw
    }

    setDragDelta(deltaX, deltaY) {
        const next = rotateFollowCamera(this.yaw, this.pitch, deltaX * 0.005, -(deltaY * 0.005))
        this.yaw = next.yaw
        this.pitch = next.pitch
    }

    resetView() {
        this.yaw = DEFAULT_CAMERA.yaw
        this.pitch = DEFAULT_CAMERA.pitch
        this.distance = this.resetDistance
    }

    pickAt(clientX, clientY, includeFlightPlane = false) {
        const bridge = this.app?.__universoHost
        if (typeof bridge?.pickAt !== 'function') return null
        if (![clientX, clientY].every((value) => typeof value === 'number' && Number.isFinite(value))) return null
        return bridge.pickAt(clientX, clientY, includeFlightPlane === true)
    }

    // ---- Per-frame follow positioning ----

    update() {
        if (!this.targetEntity) {
            return
        }
        const target = this.targetEntity.getPosition()
        const targetValue = { x: target.x, y: target.y, z: target.z }
        const rawCameraPosition = resolveFollowCameraPosition({
            target: targetValue,
            yaw: this.yaw,
            pitch: this.pitch,
            distance: this.distance,
            minDistance: this.minDistance,
            maxDistance: this.maxDistance
        })
        const cameraPosition = resolveCameraPositionOutsideGuardBoxes(rawCameraPosition, targetValue, this.guardBoxes ?? [])
        this.entity.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z)
        this.entity.lookAt(targetValue.x, targetValue.y, targetValue.z)
        const canvas = this.canvas
        if (canvas) {
            canvas.dataset.cameraDistance = this.distance.toFixed(2)
            canvas.dataset.cameraYaw = this.yaw.toFixed(4)
            canvas.dataset.cameraPitch = this.pitch.toFixed(4)
            const guardBoxes = this.guardBoxes ?? []
            const nearestCameraGuardClearance = guardBoxes.length
                ? Math.min(
                      ...guardBoxes.map((guard) => distanceToAabbSurface(cameraPosition, expandAabb(guard, CAMERA_COLLISION_HALF_EXTENTS)))
                  )
                : Infinity
            canvas.dataset.cameraGuardClearance = Number.isFinite(nearestCameraGuardClearance)
                ? nearestCameraGuardClearance.toFixed(2)
                : 'Infinity'
        }
    }
}
