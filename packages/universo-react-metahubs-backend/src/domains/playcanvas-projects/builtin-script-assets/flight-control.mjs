/**
 * Built-in MMOOMM flight control script (PlayCanvas ESM script asset).
 *
 * Owns the per-frame kinematics of the controlled ship: client-side movement
 * prediction with acceleration/deceleration, authoritative-state
 * reconciliation, orientation smoothing and obstacle-aware clamping against
 * guard boxes and rendered remote ships. Dataset markers written here keep the
 * exact names used by the platform test suite: predictionActive,
 * shipDesiredForward*, shipForward*, shipVisualForward*, shipTurning, shipX/Y/Z,
 * shipGuardClearance.
 *
 * Host contract: the widget owns the Colyseus room, intent sequencing and raw
 * input. It drives this script through its public methods
 * (`setPredictionTarget`, `setPendingPredictionCount`, `setAuthoritativeState`,
 * `applyPredictionAck`, `clearAuthoritativeState`, `updateDesiredOrientation`,
 * `syncPosition`). Published scripts can use the frozen
 * `this.app.__universoHost` facade: `{ sendIntent(intent),
 * pickAt(clientX, clientY, includeFlightPlane), getParticipants() }`.
 * The backend builtin-script catalog is the canonical source for this asset;
 * the fixture generator reads it directly when authoring project snapshots.
 */
import { Quat, Script, Vec3 } from 'playcanvas'
import {
    AUTHORITATIVE_HARD_RESYNC_DISTANCE,
    DEFAULT_GUARD_CLEARANCE,
    DEFAULT_PREDICTION_ACCELERATION,
    DEFAULT_PREDICTION_DECELERATION,
    DEFAULT_TURN_RESPONSE,
    MAX_TURN_RADIANS_PER_FRAME,
    clampSegmentBeforeObstacleContact,
    createAabbObstacleBox,
    distanceToAabbSurface,
    expandAabbForOrientedBody,
    lerpVector3,
    moveNumberTowards,
    moveTowards,
    normalizeForward,
    rotateForwardTowards,
    vectorLength
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

const readEntityXAxisForward = (entity) => {
    const rotation = entity.getRotation?.()
    if (!rotation) {
        return null
    }
    const transformed = rotation.transformVector(new Vec3(1, 0, 0), new Vec3())
    return normalizeForward({ x: transformed.x, y: transformed.y, z: transformed.z })
}

const applyEntityForward = (entity, forward) => {
    const normalized = normalizeForward(forward)
    const rotation = new Quat().setFromDirections(new Vec3(1, 0, 0), new Vec3(normalized.x, normalized.y, normalized.z))
    if (typeof entity.setLocalRotation === 'function') {
        entity.setLocalRotation(rotation)
    } else {
        entity.setRotation(rotation)
    }
    return readEntityXAxisForward(entity) ?? normalized
}

export class FlightControl extends Script {
    static scriptName = 'flightControl'

    static attributes = {
        controlledEntityId: { type: 'string', default: 'controlled' },
        cruiseSpeed: { type: 'number', default: 36 },
        intentDistance: { type: 'number', default: 720 },
        guardClearance: { type: 'number', default: 0.02 },
        guardBoxes: { type: 'json', array: true, schema: AABB_JSON_SCHEMA, default: [] },
        shipHalfExtents: { type: 'json', schema: VECTOR_JSON_SCHEMA, default: { x: 6, y: 2, z: 2 } }
    }

    initialize() {
        this.controlledEntityId =
            typeof this.controlledEntityId === 'string' && this.controlledEntityId.trim() ? this.controlledEntityId.trim() : 'controlled'
        this.cruiseSpeed = Number.isFinite(this.cruiseSpeed) ? this.cruiseSpeed : 36
        this.intentDistance = Number.isFinite(this.intentDistance) ? this.intentDistance : 720
        this.guardClearance = Number.isFinite(this.guardClearance) ? this.guardClearance : 0.02
        this.guardBoxes = Array.isArray(this.guardBoxes) ? this.guardBoxes : []
        this.shipHalfExtents =
            this.shipHalfExtents && typeof this.shipHalfExtents === 'object' ? this.shipHalfExtents : { x: 6, y: 2, z: 2 }
        this.canvas = this.app.graphicsDevice?.canvas ?? null
        this.controlledEntity =
            this.entity?.name === this.controlledEntityId ? this.entity : this.app.root.findByName(this.controlledEntityId)
        this.guardObstacleBoxes = (this.guardBoxes ?? []).map((box) => createAabbObstacleBox(box))
        this.predictedTarget = null
        this.predictionSpeed = 0
        this.pendingPredictionCount = 0
        this.authoritativePosition = null
        this.authoritativeVelocity = null
        this.shipForward = { x: 1, y: 0, z: 0 }
        this.desiredShipForward = { x: 1, y: 0, z: 0 }
        const position = this.entity.getPosition()
        this.lastControlledPosition = { x: position.x, y: position.y, z: position.z }
    }

    // ---- Widget-facing runtime API (room/intent bookkeeping lives outside) ----

    setPredictionTarget(target) {
        this.predictedTarget = target
    }

    setPendingPredictionCount(count) {
        this.pendingPredictionCount = Math.max(0, count)
    }

    setAuthoritativeState(position, velocity) {
        this.authoritativePosition = position
        this.authoritativeVelocity = velocity
    }

    applyPredictionAck(target, speed) {
        this.predictedTarget = target
        const hasFiniteSpeed = typeof speed === 'number' && Number.isFinite(speed)
        if (!target) {
            if (this.canvas) {
                this.canvas.dataset.predictionActive = 'false'
            }
            this.predictionSpeed = hasFiniteSpeed ? Math.max(0, speed) : 0
        }
        if (hasFiniteSpeed) {
            this.predictionSpeed = Math.max(0, speed)
        }
    }

    clearAuthoritativeState() {
        this.authoritativePosition = null
        this.predictedTarget = null
    }

    syncPosition(position) {
        this.lastControlledPosition = { x: position.x, y: position.y, z: position.z }
    }

    /**
     * Resolve a host-issued target against the same authoritative obstacle
     * geometry used by the per-frame prediction loop. Keeping this decision
     * inside the published script prevents the widget from carrying a second
     * collision implementation.
     */
    resolveTarget(target) {
        if (!target || ![target.x, target.y, target.z].every((value) => typeof value === 'number' && Number.isFinite(value))) {
            return null
        }
        const position = this.entity.getPosition()
        const from = { x: position.x, y: position.y, z: position.z }
        const direction = normalizeForward({ x: target.x - from.x, y: target.y - from.y, z: target.z - from.z }, this.shipForward)
        const clamped = clampSegmentBeforeObstacleContact(from, target, this.shipHalfExtents ?? { x: 6, y: 2, z: 2 }, direction, [
            ...(this.guardObstacleBoxes ?? []),
            ...this.resolveRemoteObstacleBoxes()
        ])
        return clamped ?? { x: target.x, y: target.y, z: target.z }
    }

    updateDesiredOrientation(from, to) {
        const movement = {
            x: to.x - from.x,
            y: to.y - from.y,
            z: to.z - from.z
        }
        if (vectorLength(movement) <= 0.001) {
            return
        }

        this.desiredShipForward = normalizeForward(movement, this.desiredShipForward)
        const canvas = this.canvas
        if (canvas) {
            canvas.dataset.shipDesiredForwardX = this.desiredShipForward.x.toFixed(4)
            canvas.dataset.shipDesiredForwardY = this.desiredShipForward.y.toFixed(4)
            canvas.dataset.shipDesiredForwardZ = this.desiredShipForward.z.toFixed(4)
        }
    }

    getForward() {
        return this.shipForward
    }

    /**
     * Optional published-script entry points. Input devices stay owned by the
     * host widget; authored scripts can request an intent through the narrow,
     * capability-checked facade without reaching into the Colyseus room.
     */
    sendIntent(intent) {
        const bridge = this.app?.__universoHost
        return typeof bridge?.sendIntent === 'function' && bridge.sendIntent(intent) === true
    }

    requestMoveToPoint(target) {
        if (!target || ![target.x, target.y, target.z].every((value) => typeof value === 'number' && Number.isFinite(value))) {
            return false
        }
        return this.sendIntent({ type: 'move_to_point', target: { x: target.x, y: target.y, z: target.z } })
    }

    requestMoveToObject(objectId) {
        if (typeof objectId !== 'string' || !objectId.trim() || objectId.trim().length > 128) return false
        return this.sendIntent({ type: 'move_to_object', objectId: objectId.trim() })
    }

    requestStop() {
        return this.sendIntent({ type: 'stop' })
    }

    // ---- Per-frame kinematics ----

    resolveRemoteObstacleBoxes() {
        const remoteShipsScript = this.controlledEntity?.script?.remoteShips
        return remoteShipsScript ? remoteShipsScript.getObstacleBoxes() : []
    }

    update(dt) {
        const entity = this.entity
        const current = entity.getPosition()
        let currentPosition = { x: current.x, y: current.y, z: current.z }
        const predictedTarget = this.predictedTarget
        if (predictedTarget) {
            const remainingPredictionDistance = Math.hypot(
                predictedTarget.x - currentPosition.x,
                predictedTarget.y - currentPosition.y,
                predictedTarget.z - currentPosition.z
            )
            const acceleration = DEFAULT_PREDICTION_ACCELERATION
            const deceleration = DEFAULT_PREDICTION_DECELERATION
            const brakingDistance =
                this.predictionSpeed > 0 && deceleration > 0 ? (this.predictionSpeed * this.predictionSpeed) / (2 * deceleration) : 0
            const desiredSpeed =
                remainingPredictionDistance <= Math.max(DEFAULT_GUARD_CLEARANCE, brakingDistance) ? 0 : Math.max(1, this.cruiseSpeed)
            this.predictionSpeed = moveNumberTowards(
                this.predictionSpeed,
                desiredSpeed,
                (desiredSpeed > this.predictionSpeed ? acceleration : deceleration) * dt
            )
            const predictedPosition = moveTowards(currentPosition, predictedTarget, this.predictionSpeed * dt)
            const predictionDirection = normalizeForward(
                {
                    x: predictedPosition.x - currentPosition.x,
                    y: predictedPosition.y - currentPosition.y,
                    z: predictedPosition.z - currentPosition.z
                },
                this.shipForward
            )
            const obstacleBoxes = [...this.guardObstacleBoxes, ...this.resolveRemoteObstacleBoxes()]
            const clampedPosition = clampSegmentBeforeObstacleContact(
                currentPosition,
                predictedPosition,
                this.shipHalfExtents ?? { x: 6, y: 2, z: 2 },
                predictionDirection,
                obstacleBoxes
            )
            if (clampedPosition) {
                entity.setPosition(clampedPosition.x, clampedPosition.y, clampedPosition.z)
                this.predictedTarget = null
                if (this.canvas) {
                    this.canvas.dataset.predictionActive = 'false'
                }
            } else {
                entity.setPosition(predictedPosition.x, predictedPosition.y, predictedPosition.z)
                currentPosition = predictedPosition
                const remainingAfterMove = Math.hypot(
                    predictedTarget.x - currentPosition.x,
                    predictedTarget.y - currentPosition.y,
                    predictedTarget.z - currentPosition.z
                )
                if (remainingAfterMove < 0.5) {
                    this.predictedTarget = null
                    this.predictionSpeed = 0
                    if (this.canvas) {
                        this.canvas.dataset.predictionActive = 'false'
                    }
                } else if (this.canvas) {
                    this.canvas.dataset.predictionActive = 'true'
                }
            }
        }
        const authoritativePosition = this.authoritativePosition
        if (authoritativePosition && this.pendingPredictionCount === 0 && !this.predictedTarget) {
            const halfExtents = this.shipHalfExtents ?? { x: 6, y: 2, z: 2 }
            const authoritativeDelta = {
                x: authoritativePosition.x - currentPosition.x,
                y: authoritativePosition.y - currentPosition.y,
                z: authoritativePosition.z - currentPosition.z
            }
            const next =
                vectorLength(authoritativeDelta) > AUTHORITATIVE_HARD_RESYNC_DISTANCE
                    ? authoritativePosition
                    : lerpVector3(
                          currentPosition,
                          authoritativePosition,
                          this.authoritativeVelocity && vectorLength(this.authoritativeVelocity) > 0.001
                              ? Math.min(1, dt * 4)
                              : Math.min(1, dt * 12)
                      )
            const reconciliationDirection = normalizeForward(
                {
                    x: next.x - currentPosition.x,
                    y: next.y - currentPosition.y,
                    z: next.z - currentPosition.z
                },
                this.shipForward
            )
            if (
                !clampSegmentBeforeObstacleContact(currentPosition, next, halfExtents, reconciliationDirection, [
                    ...this.guardObstacleBoxes,
                    ...this.resolveRemoteObstacleBoxes()
                ])
            ) {
                entity.setPosition(next.x, next.y, next.z)
            }
        }

        const nextPosition = entity.getPosition()
        const previousPosition = this.lastControlledPosition
        const nextPositionValue = { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z }
        if (this.predictedTarget) {
            this.updateDesiredOrientation(nextPositionValue, this.predictedTarget)
        } else if (previousPosition) {
            this.updateDesiredOrientation(previousPosition, nextPositionValue)
        }
        this.applyControlledOrientation(dt)
        this.lastControlledPosition = nextPositionValue
        const canvas = this.canvas
        if (canvas) {
            canvas.dataset.shipX = nextPosition.x.toFixed(2)
            canvas.dataset.shipY = nextPosition.y.toFixed(2)
            canvas.dataset.shipZ = nextPosition.z.toFixed(2)
            const halfExtents = this.shipHalfExtents ?? { x: 6, y: 2, z: 2 }
            const expandedGuardBoxes = (this.guardBoxes ?? []).map((guard) =>
                expandAabbForOrientedBody(guard, halfExtents, this.shipForward)
            )
            const nearestGuardClearance = expandedGuardBoxes.length
                ? Math.min(...expandedGuardBoxes.map((guard) => distanceToAabbSurface(nextPositionValue, guard)))
                : Infinity
            canvas.dataset.shipGuardClearance = Number.isFinite(nearestGuardClearance) ? nearestGuardClearance.toFixed(2) : 'Infinity'
        }
    }

    applyControlledOrientation(dt) {
        const desired = this.desiredShipForward
        const currentForward = this.shipForward
        const alignment = Math.max(
            -1,
            Math.min(1, currentForward.x * desired.x + currentForward.y * desired.y + currentForward.z * desired.z)
        )
        const maxTurnRadians = Math.min(MAX_TURN_RADIANS_PER_FRAME, Math.max(0.01, dt * DEFAULT_TURN_RESPONSE))
        const forward =
            alignment > 0.999 ? normalizeForward(desired, currentForward) : rotateForwardTowards(currentForward, desired, maxTurnRadians)
        const visualForward = applyEntityForward(this.entity, forward)
        this.shipForward = visualForward
        const canvas = this.canvas
        if (canvas) {
            canvas.dataset.shipForwardX = visualForward.x.toFixed(4)
            canvas.dataset.shipForwardY = visualForward.y.toFixed(4)
            canvas.dataset.shipForwardZ = visualForward.z.toFixed(4)
            canvas.dataset.shipVisualForwardX = visualForward.x.toFixed(4)
            canvas.dataset.shipVisualForwardY = visualForward.y.toFixed(4)
            canvas.dataset.shipVisualForwardZ = visualForward.z.toFixed(4)
            canvas.dataset.shipTurning = alignment > 0.999 ? 'false' : 'true'
        }
    }
}
