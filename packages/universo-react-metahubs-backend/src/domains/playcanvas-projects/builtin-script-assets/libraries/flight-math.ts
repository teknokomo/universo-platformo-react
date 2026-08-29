import { SharedLibraryModule } from '@universo-react/extension-sdk'

/**
 * Shared gameplay math for the built-in MMOOMM PlayCanvas flight scripts
 * (`flight-control.mjs`, `follow-camera.mjs`, `remote-ships.mjs`), imported by
 * them through the `@shared/flight-math` specifier (library-role module,
 * compiled inline by `compileScriptAssetEsm`). This file is the canonical
 * shared implementation; the fixture generator reads it directly when it
 * creates the Editor-authored library module, so the frontend does not carry a
 * second copy of these formulas.
 */

/** Minimal 3D vector shape shared by every helper in this library. */
export interface Vector3 {
    x: number
    y: number
    z: number
}

/** Axis-aligned bounding box described by its center and half extents. */
export interface AabbBox {
    center: Vector3
    halfExtents: Vector3
}

/** Oriented bounding box described by its center, half extents and three axes. */
export interface OrientedBox {
    center: Vector3
    halfExtents: Vector3
    axes: Vector3[]
}

export const CONTACT_EPSILON = 0.02
export const DEFAULT_GUARD_CLEARANCE = CONTACT_EPSILON
export const CAMERA_GUARD_CLEARANCE = 1
export const CAMERA_COLLISION_HALF_EXTENTS: Vector3 = { x: 1, y: 1, z: 1 }
export const REMOTE_SHIP_RENDER_CLEARANCE = 0.35
export const DEFAULT_PREDICTION_ACCELERATION = 48
export const DEFAULT_PREDICTION_DECELERATION = 48
export const DEFAULT_TURN_RESPONSE = 1.8
export const MAX_TURN_RADIANS_PER_FRAME = 0.18
export const AUTHORITATIVE_HARD_RESYNC_DISTANCE = 2

const EPSILON = 0.000001

export const resolveFollowCameraPosition = (options: {
    target: Vector3
    yaw: number
    pitch: number
    distance: number
    minDistance: number
    maxDistance: number
}): Vector3 => {
    const distance = Math.min(options.maxDistance, Math.max(options.minDistance, options.distance))
    const pitch = Math.min(Math.PI / 2 - 0.01, Math.max(-Math.PI / 2 + 0.01, options.pitch))
    const horizontal = Math.cos(pitch) * distance

    return {
        x: options.target.x + Math.sin(options.yaw) * horizontal,
        y: options.target.y + Math.sin(pitch) * distance,
        z: options.target.z + Math.cos(options.yaw) * horizontal
    }
}

export const zoomFollowCamera = (distance: number, delta: number, minDistance: number, maxDistance: number): number =>
    Math.min(maxDistance, Math.max(minDistance, distance + delta))

export const rotateFollowCamera = (
    yaw: number,
    pitch: number,
    deltaYaw: number,
    deltaPitch: number,
    minPitch = -Math.PI / 3,
    maxPitch = Math.PI / 3
): { yaw: number; pitch: number } => ({
    yaw: yaw + deltaYaw,
    pitch: Math.min(maxPitch, Math.max(minPitch, pitch + deltaPitch))
})

export const vectorLength = (value: Vector3): number => Math.hypot(value.x, value.y, value.z)

export const normalizeVector = (value: Vector3): Vector3 => {
    const length = vectorLength(value)
    if (length <= EPSILON) {
        return { x: 1, y: 0, z: 0 }
    }
    return { x: value.x / length, y: value.y / length, z: value.z / length }
}

export const addVector = (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
})

export const scaleVector = (value: Vector3, scale: number): Vector3 => ({
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
})

export const dotVector = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const crossVector = (a: Vector3, b: Vector3): Vector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
})

export const normalizeForward = (value: Vector3, fallback: Vector3 = { x: 1, y: 0, z: 0 }): Vector3 => {
    const length = vectorLength(value)
    if (length > EPSILON) {
        return { x: value.x / length, y: value.y / length, z: value.z / length }
    }
    const fallbackLength = vectorLength(fallback)
    return fallbackLength > EPSILON
        ? { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength, z: fallback.z / fallbackLength }
        : { x: 1, y: 0, z: 0 }
}

export const rotateForwardTowards = (current: Vector3, desired: Vector3, maxRadians: number): Vector3 => {
    const currentForward = normalizeForward(current)
    const desiredForward = normalizeForward(desired, currentForward)
    const alignment = Math.max(-1, Math.min(1, dotVector(currentForward, desiredForward)))
    const angle = Math.acos(alignment)
    if (angle <= EPSILON || angle <= maxRadians) {
        return desiredForward
    }

    const ratio = maxRadians / angle
    const sinAngle = Math.sin(angle)
    if (Math.abs(sinAngle) <= EPSILON) {
        return normalizeForward(
            {
                x: currentForward.x + (desiredForward.x - currentForward.x) * ratio,
                y: currentForward.y + (desiredForward.y - currentForward.y) * ratio,
                z: currentForward.z + (desiredForward.z - currentForward.z) * ratio
            },
            currentForward
        )
    }

    const currentScale = Math.sin((1 - ratio) * angle) / sinAngle
    const desiredScale = Math.sin(ratio * angle) / sinAngle
    return normalizeForward({
        x: currentForward.x * currentScale + desiredForward.x * desiredScale,
        y: currentForward.y * currentScale + desiredForward.y * desiredScale,
        z: currentForward.z * currentScale + desiredForward.z * desiredScale
    })
}

export const moveTowards = (current: Vector3, target: Vector3, maxDistance: number): Vector3 => {
    const delta = {
        x: target.x - current.x,
        y: target.y - current.y,
        z: target.z - current.z
    }
    const distance = Math.hypot(delta.x, delta.y, delta.z)
    if (distance <= maxDistance || distance <= EPSILON) {
        return { ...target }
    }

    const ratio = maxDistance / distance
    return {
        x: current.x + delta.x * ratio,
        y: current.y + delta.y * ratio,
        z: current.z + delta.z * ratio
    }
}

export const moveNumberTowards = (current: number, target: number, maxDelta: number): number => {
    if (Math.abs(target - current) <= maxDelta) {
        return target
    }
    return current + Math.sign(target - current) * maxDelta
}

export const lerpVector3 = (from: Vector3, to: Vector3, alpha: number): Vector3 => {
    const clamped = Math.min(1, Math.max(0, alpha))
    return {
        x: from.x + (to.x - from.x) * clamped,
        y: from.y + (to.y - from.y) * clamped,
        z: from.z + (to.z - from.z) * clamped
    }
}

export const createHalfExtents = (scale: Vector3): Vector3 => ({
    x: Math.abs(scale.x) / 2,
    y: Math.abs(scale.y) / 2,
    z: Math.abs(scale.z) / 2
})

export const expandAabb = (box: AabbBox, halfExtents: Vector3 | null): AabbBox => {
    if (!halfExtents) {
        return {
            center: box.center,
            halfExtents: box.halfExtents
        }
    }

    return {
        center: box.center,
        halfExtents: {
            x: box.halfExtents.x + Math.max(0, Math.abs(halfExtents.x)),
            y: box.halfExtents.y + Math.max(0, Math.abs(halfExtents.y)),
            z: box.halfExtents.z + Math.max(0, Math.abs(halfExtents.z))
        }
    }
}

const resolveOrientedBodyHalfExtents = (halfExtents: Vector3, direction: Vector3): Vector3 => {
    const forward = normalizeVector(direction)
    const referenceUp = Math.abs(dotVector(forward, { x: 0, y: 1, z: 0 })) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalizeVector(crossVector(referenceUp, forward))
    const up = normalizeVector(crossVector(forward, right))
    const hx = Math.max(0, Math.abs(halfExtents.x))
    const hy = Math.max(0, Math.abs(halfExtents.y))
    const hz = Math.max(0, Math.abs(halfExtents.z))

    return {
        x: Math.abs(forward.x) * hx + Math.abs(up.x) * hy + Math.abs(right.x) * hz,
        y: Math.abs(forward.y) * hx + Math.abs(up.y) * hy + Math.abs(right.y) * hz,
        z: Math.abs(forward.z) * hx + Math.abs(up.z) * hy + Math.abs(right.z) * hz
    }
}

export const expandAabbForOrientedBody = (box: AabbBox, halfExtents: Vector3, direction: Vector3): AabbBox =>
    expandAabb(box, resolveOrientedBodyHalfExtents(halfExtents, direction))

const resolveBodyAxes = (direction: Vector3): Vector3[] => {
    const forward = normalizeVector(direction)
    const referenceUp = Math.abs(dotVector(forward, { x: 0, y: 1, z: 0 })) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalizeVector(crossVector(referenceUp, forward))
    const up = normalizeVector(crossVector(forward, right))
    return [forward, up, right]
}

export const createOrientedBox = (center: Vector3, halfExtents: Vector3, heading: Vector3): OrientedBox => ({
    center,
    halfExtents: {
        x: Math.max(0, Math.abs(halfExtents.x)),
        y: Math.max(0, Math.abs(halfExtents.y)),
        z: Math.max(0, Math.abs(halfExtents.z))
    },
    axes: resolveBodyAxes(heading)
})

export const createAabbObstacleBox = (box: AabbBox): OrientedBox => ({
    center: box.center,
    halfExtents: {
        x: Math.max(0, Math.abs(box.halfExtents.x)),
        y: Math.max(0, Math.abs(box.halfExtents.y)),
        z: Math.max(0, Math.abs(box.halfExtents.z))
    },
    axes: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }
    ]
})

const boxRadiusOnAxis = (box: OrientedBox, axis: Vector3): number =>
    box.halfExtents.x * Math.abs(dotVector(box.axes[0], axis)) +
    box.halfExtents.y * Math.abs(dotVector(box.axes[1], axis)) +
    box.halfExtents.z * Math.abs(dotVector(box.axes[2], axis))

export const orientedBoxesOverlap = (left: OrientedBox, right: OrientedBox): boolean => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector(leftAxis, rightAxis)
            if (vectorLength(cross) > EPSILON) {
                axes.push(normalizeVector(cross))
            }
        }
    }

    const centerDelta = {
        x: right.center.x - left.center.x,
        y: right.center.y - left.center.y,
        z: right.center.z - left.center.z
    }
    return axes.every((axis) => Math.abs(dotVector(centerDelta, axis)) <= boxRadiusOnAxis(left, axis) + boxRadiusOnAxis(right, axis))
}

export const resolveSeparatingAxes = (left: OrientedBox, right: OrientedBox): Vector3[] => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector(leftAxis, rightAxis)
            if (vectorLength(cross) > EPSILON) {
                axes.push(normalizeVector(cross))
            }
        }
    }
    return axes
}

export const findFirstObstacleContactDistance = (
    from: Vector3,
    to: Vector3,
    controlledHalfExtents: Vector3,
    controlledHeading: Vector3,
    obstacle: OrientedBox
): number | null => {
    const movement = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
    const movementLength = vectorLength(movement)
    if (movementLength <= EPSILON) {
        return null
    }

    const movingBox = createOrientedBox(from, controlledHalfExtents, controlledHeading)

    if (orientedBoxesOverlap(movingBox, obstacle)) {
        return 0
    }

    let enter = 0
    let exit = 1
    const centerDelta = {
        x: obstacle.center.x - from.x,
        y: obstacle.center.y - from.y,
        z: obstacle.center.z - from.z
    }
    for (const axis of resolveSeparatingAxes(movingBox, obstacle)) {
        const radius = boxRadiusOnAxis(movingBox, axis) + boxRadiusOnAxis(obstacle, axis)
        const projectedStart = dotVector(centerDelta, axis)
        const projectedVelocity = -dotVector(movement, axis)

        if (Math.abs(projectedVelocity) <= EPSILON) {
            if (Math.abs(projectedStart) > radius) {
                return null
            }
            continue
        }

        const first = (-radius - projectedStart) / projectedVelocity
        const second = (radius - projectedStart) / projectedVelocity
        const axisEnter = Math.min(first, second)
        const axisExit = Math.max(first, second)
        enter = Math.max(enter, axisEnter)
        exit = Math.min(exit, axisExit)
        if (enter > exit) {
            return null
        }
    }

    return exit >= 0 && enter <= 1 ? Math.max(0, enter) * movementLength : null
}

export const clampSegmentBeforeObstacleContact = (
    from: Vector3,
    to: Vector3,
    controlledHalfExtents: Vector3,
    controlledHeading: Vector3,
    obstacles: readonly OrientedBox[]
): Vector3 | null => {
    const movement = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
    const movementLength = vectorLength(movement)
    if (movementLength <= EPSILON) {
        return null
    }

    let nearestContactDistance: number | null = null
    for (const obstacle of obstacles) {
        const distance = findFirstObstacleContactDistance(from, to, controlledHalfExtents, controlledHeading, obstacle)
        if (distance !== null) {
            nearestContactDistance = nearestContactDistance === null ? distance : Math.min(nearestContactDistance, distance)
        }
    }

    if (nearestContactDistance === null) {
        return null
    }

    const safeRatio = Math.max(0, nearestContactDistance - CONTACT_EPSILON) / movementLength
    return {
        x: from.x + movement.x * safeRatio,
        y: from.y + movement.y * safeRatio,
        z: from.z + movement.z * safeRatio
    }
}

export const resolvePositionOutsideObstacle = (
    position: Vector3,
    halfExtents: Vector3,
    heading: Vector3,
    obstacle: OrientedBox,
    clearance: number = CONTACT_EPSILON
): Vector3 => {
    const movingBox = createOrientedBox(position, halfExtents, heading)
    if (!orientedBoxesOverlap(movingBox, obstacle)) {
        return position
    }

    const centerDelta = {
        x: position.x - obstacle.center.x,
        y: position.y - obstacle.center.y,
        z: position.z - obstacle.center.z
    }
    let bestAxis = normalizeForward(centerDelta, heading)
    let bestSeparation = Number.POSITIVE_INFINITY

    for (const axis of resolveSeparatingAxes(movingBox, obstacle)) {
        const signedDistance = dotVector(centerDelta, axis)
        const overlapDistance = boxRadiusOnAxis(movingBox, axis) + boxRadiusOnAxis(obstacle, axis) - Math.abs(signedDistance)
        if (overlapDistance >= 0 && overlapDistance < bestSeparation) {
            bestSeparation = overlapDistance
            bestAxis = signedDistance >= 0 ? axis : scaleVector(axis, -1)
        }
    }

    const away = bestAxis
    const projectedDistance = dotVector(centerDelta, away)
    const requiredDistance = boxRadiusOnAxis(movingBox, away) + boxRadiusOnAxis(obstacle, away) + clearance
    let resolved = {
        x: position.x + away.x * Math.max(0, requiredDistance - projectedDistance),
        y: position.y + away.y * Math.max(0, requiredDistance - projectedDistance),
        z: position.z + away.z * Math.max(0, requiredDistance - projectedDistance)
    }

    for (let iteration = 0; iteration < 12; iteration += 1) {
        if (!orientedBoxesOverlap(createOrientedBox(resolved, halfExtents, heading), obstacle)) {
            return resolved
        }
        resolved = {
            x: resolved.x + away.x * clearance,
            y: resolved.y + away.y * clearance,
            z: resolved.z + away.z * clearance
        }
    }

    return resolved
}

export const resolveSafeTargetOutsideGuardBoxes = (
    from: Vector3,
    target: Vector3,
    controlledHalfExtents: Vector3,
    guards: readonly AabbBox[],
    clearance: number = DEFAULT_GUARD_CLEARANCE
): Vector3 => {
    if (!guards.length) {
        return { ...target }
    }

    const direction = normalizeVector({ x: target.x - from.x, y: target.y - from.y, z: target.z - from.z })
    let resolved = { ...target }
    for (const guard of guards) {
        const obstacle = createAabbObstacleBox(guard)
        const entryDistance = findFirstObstacleContactDistance(from, resolved, controlledHalfExtents, direction, obstacle)
        if (entryDistance === null) {
            continue
        }
        const safeDistance = Math.max(0, entryDistance - Math.max(0, clearance))
        resolved = moveTowards(from, target, safeDistance)
    }
    return resolved
}

export const resolveCameraPositionOutsideGuardBoxes = (cameraPosition: Vector3, target: Vector3, guards: readonly AabbBox[]): Vector3 => {
    if (!guards.length) {
        return cameraPosition
    }

    const heading = normalizeVector({
        x: target.x - cameraPosition.x,
        y: target.y - cameraPosition.y,
        z: target.z - cameraPosition.z
    })
    return guards.reduce(
        (position, guard) =>
            resolvePositionOutsideObstacle(
                position,
                CAMERA_COLLISION_HALF_EXTENTS,
                heading,
                createAabbObstacleBox(guard),
                CAMERA_GUARD_CLEARANCE
            ),
        cameraPosition
    )
}

export const distanceToAabbSurface = (point: Vector3, box: AabbBox): number => {
    const dx = Math.max(Math.abs(point.x - box.center.x) - box.halfExtents.x, 0)
    const dy = Math.max(Math.abs(point.y - box.center.y) - box.halfExtents.y, 0)
    const dz = Math.max(Math.abs(point.z - box.center.z) - box.halfExtents.z, 0)
    if (dx > 0 || dy > 0 || dz > 0) {
        return Math.hypot(dx, dy, dz)
    }

    return -Math.min(
        box.halfExtents.x - Math.abs(point.x - box.center.x),
        box.halfExtents.y - Math.abs(point.y - box.center.y),
        box.halfExtents.z - Math.abs(point.z - box.center.z)
    )
}

// Library modules are compiled through the same SDK boundary as runtime
// modules, so retain a marker class while keeping the math helpers as named
// exports for @shared/flight-math consumers.
export default class FlightMathLibrary extends SharedLibraryModule {}
