/**
 * Built-in MMOOMM remote ships script (PlayCanvas ESM script asset).
 *
 * Owns interpolation and rendering of remote ships around the local visual
 * hull: entity create/destroy, position lerp, heading smoothing, collision
 * avoidance against the local ship body. Dataset markers written here:
 * remoteShipCount (on snapshot), remoteRenderedShip*, remoteRenderedShipForward*.
 *
 * Host contract: room state snapshots are pushed in by the widget through
 * `applySnapshot(shipsMap)` where the map carries normalized render states
 * (`{ position, heading }`). Published scripts can use the frozen
 * `this.app.__universoHost` facade: `{ sendIntent(intent),
 * pickAt(clientX, clientY, includeFlightPlane), getParticipants() }`.
 * The backend builtin-script catalog is the canonical source for this asset;
 * the fixture generator reads it directly when authoring project snapshots.
 */
import { Color, Entity, Quat, Script, StandardMaterial, Vec3 } from 'playcanvas'
import {
    DEFAULT_TURN_RESPONSE,
    MAX_TURN_RADIANS_PER_FRAME,
    REMOTE_SHIP_RENDER_CLEARANCE,
    clampSegmentBeforeObstacleContact,
    createOrientedBox,
    lerpVector3,
    normalizeForward,
    resolvePositionOutsideObstacle,
    rotateForwardTowards
} from '@shared/flight-math'

const VECTOR_JSON_SCHEMA = [
    { name: 'x', type: 'number', default: 0 },
    { name: 'y', type: 'number', default: 0 },
    { name: 'z', type: 'number', default: 0 }
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

export class RemoteShips extends Script {
    static scriptName = 'remoteShips'

    static attributes = {
        controlledEntityId: { type: 'string', default: 'controlled' },
        remoteColor: { type: 'vec3', default: { x: 0.45, y: 0.85, z: 1 } },
        renderClearance: { type: 'number', default: REMOTE_SHIP_RENDER_CLEARANCE },
        interpolationRate: { type: 'number', default: 10 },
        fallbackScale: { type: 'json', schema: VECTOR_JSON_SCHEMA, default: { x: 12, y: 4, z: 4 } },
        shipHalfExtents: { type: 'json', schema: VECTOR_JSON_SCHEMA, default: { x: 6, y: 2, z: 2 } }
    }

    initialize() {
        this.controlledEntityId =
            typeof this.controlledEntityId === 'string' && this.controlledEntityId.trim() ? this.controlledEntityId.trim() : 'controlled'
        this.remoteColor = this.remoteColor && typeof this.remoteColor === 'object' ? this.remoteColor : { x: 0.45, y: 0.85, z: 1 }
        this.renderClearance = Number.isFinite(this.renderClearance) ? this.renderClearance : REMOTE_SHIP_RENDER_CLEARANCE
        this.interpolationRate = Number.isFinite(this.interpolationRate) ? this.interpolationRate : 10
        this.fallbackScale = this.fallbackScale && typeof this.fallbackScale === 'object' ? this.fallbackScale : { x: 12, y: 4, z: 4 }
        this.shipHalfExtents =
            this.shipHalfExtents && typeof this.shipHalfExtents === 'object' ? this.shipHalfExtents : { x: 6, y: 2, z: 2 }
        this.canvas = this.app.graphicsDevice?.canvas ?? null
        this.controlledEntity =
            this.entity?.name === this.controlledEntityId ? this.entity : this.app.root.findByName(this.controlledEntityId)
        const color = this.remoteColor ?? { x: 0.45, y: 0.85, z: 1 }
        this.remoteMaterial = new StandardMaterial()
        this.remoteMaterial.diffuse = new Color(color.x, color.y, color.z)
        this.remoteMaterial.update()
        this.snapshotShips = new Map()
        this.renderedShips = new Map()
        this.forwards = new Map()
        this.entities = new Map()
    }

    // ---- Widget-facing runtime API ----

    applySnapshot(snapshot) {
        this.snapshotShips = new Map(snapshot)
        if (this.canvas) {
            this.canvas.dataset.remoteShipCount = String(this.snapshotShips.size)
        }
    }

    getObstacleBoxes() {
        const boxes = new Map()
        const halfExtents = this.shipHalfExtents ?? { x: 6, y: 2, z: 2 }
        this.snapshotShips.forEach((remoteShip, shipId) => {
            boxes.set(shipId, createOrientedBox(remoteShip.position, halfExtents, remoteShip.heading ?? { x: 1, y: 0, z: 0 }))
        })
        this.renderedShips.forEach((remoteShip, shipId) => {
            boxes.set(shipId, createOrientedBox(remoteShip.position, halfExtents, remoteShip.heading ?? { x: 1, y: 0, z: 0 }))
        })
        return Array.from(boxes.values())
    }

    getParticipantSummary() {
        const bridge = this.app?.__universoHost
        return typeof bridge?.getParticipants === 'function' ? bridge.getParticipants() : { total: 0, remote: 0 }
    }

    // ---- Per-frame interpolation and rendering ----

    update(dt) {
        if (!this.remoteMaterial || !this.controlledEntity) {
            return
        }
        const halfExtents = this.shipHalfExtents ?? { x: 6, y: 2, z: 2 }
        const localPosition = this.controlledEntity.getPosition()
        const localState = {
            position: { x: localPosition.x, y: localPosition.y, z: localPosition.z },
            heading: this.controlledEntity.script?.flightControl?.getForward() ?? { x: 1, y: 0, z: 0 }
        }
        const localObstacle = createOrientedBox(localState.position, halfExtents, localState.heading)
        for (const [shipId, targetState] of this.snapshotShips.entries()) {
            let remoteEntity = this.entities.get(shipId)
            if (!remoteEntity) {
                remoteEntity = new Entity(`remote-${shipId}`)
                remoteEntity.addComponent('render', { type: 'box', material: this.remoteMaterial })
                remoteEntity.setLocalPosition(targetState.position.x, targetState.position.y, targetState.position.z)
                const scale = this.fallbackScale ?? { x: 12, y: 4, z: 4 }
                remoteEntity.setLocalScale(scale.x, scale.y, scale.z)
                this.entities.set(shipId, remoteEntity)
                this.app.root.addChild(remoteEntity)
                this.forwards.set(shipId, normalizeForward(targetState.heading ?? { x: 1, y: 0, z: 0 }))
            }
            const currentRemote = remoteEntity.getPosition()
            const currentRemoteValue = { x: currentRemote.x, y: currentRemote.y, z: currentRemote.z }
            const nextRemote = lerpVector3(currentRemoteValue, targetState.position, Math.min(1, dt * (this.interpolationRate ?? 10)))
            const currentRemoteForward = this.forwards.get(shipId) ?? { x: 1, y: 0, z: 0 }
            const desiredRemoteForward = normalizeForward(
                targetState.heading ?? {
                    x: targetState.position.x - currentRemote.x,
                    y: targetState.position.y - currentRemote.y,
                    z: targetState.position.z - currentRemote.z
                },
                currentRemoteForward
            )
            const nextRemoteForward = rotateForwardTowards(
                currentRemoteForward,
                desiredRemoteForward,
                Math.min(MAX_TURN_RADIANS_PER_FRAME, Math.max(0.01, dt * DEFAULT_TURN_RESPONSE))
            )
            const visualRemoteForward = applyEntityForward(remoteEntity, nextRemoteForward)
            const clampedRemote = clampSegmentBeforeObstacleContact(currentRemoteValue, nextRemote, halfExtents, visualRemoteForward, [
                localObstacle
            ])
            const renderedRemote = resolvePositionOutsideObstacle(
                clampedRemote ?? nextRemote,
                halfExtents,
                visualRemoteForward,
                localObstacle,
                this.renderClearance ?? REMOTE_SHIP_RENDER_CLEARANCE
            )
            remoteEntity.setPosition(renderedRemote.x, renderedRemote.y, renderedRemote.z)
            this.forwards.set(shipId, visualRemoteForward)
            this.renderedShips.set(shipId, {
                position: renderedRemote,
                heading: visualRemoteForward
            })
        }
        for (const [shipId, remoteEntity] of this.entities.entries()) {
            if (!this.snapshotShips.has(shipId)) {
                remoteEntity.destroy()
                this.entities.delete(shipId)
                this.forwards.delete(shipId)
                this.renderedShips.delete(shipId)
            }
        }
        this.updateDatasetMarkers()
    }

    destroy() {
        this.entities.forEach((entity) => entity.destroy())
        this.entities.clear()
        this.renderedShips.clear()
        this.forwards.clear()
        this.snapshotShips.clear()
    }

    updateDatasetMarkers() {
        const canvas = this.canvas
        if (!canvas) {
            return
        }
        const firstRenderedRemote = Array.from(this.renderedShips.values())[0]
        if (firstRenderedRemote) {
            canvas.dataset.remoteRenderedShipX = firstRenderedRemote.position.x.toFixed(2)
            canvas.dataset.remoteRenderedShipY = firstRenderedRemote.position.y.toFixed(2)
            canvas.dataset.remoteRenderedShipZ = firstRenderedRemote.position.z.toFixed(2)
            const renderedHeading = firstRenderedRemote.heading ?? { x: 1, y: 0, z: 0 }
            canvas.dataset.remoteRenderedShipForwardX = renderedHeading.x.toFixed(4)
            canvas.dataset.remoteRenderedShipForwardY = renderedHeading.y.toFixed(4)
            canvas.dataset.remoteRenderedShipForwardZ = renderedHeading.z.toFixed(4)
        } else {
            delete canvas.dataset.remoteRenderedShipX
            delete canvas.dataset.remoteRenderedShipY
            delete canvas.dataset.remoteRenderedShipZ
            delete canvas.dataset.remoteRenderedShipForwardX
            delete canvas.dataset.remoteRenderedShipForwardY
            delete canvas.dataset.remoteRenderedShipForwardZ
        }
    }
}
