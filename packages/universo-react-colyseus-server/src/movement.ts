export interface Vector3Like {
    x: number
    y: number
    z: number
}

export interface AabbLike {
    center: Vector3Like
    halfExtents: Vector3Like
}

export interface FixedTickMovementState {
    position: Vector3Like
    velocity: Vector3Like
    target: Vector3Like | null
    speed: number
}

export interface FixedTickMovementOptions {
    cruiseSpeed: number
    acceleration: number
    deceleration: number
    arrivalRadius: number
    guards?: readonly AabbLike[]
    controlledHalfExtents?: Vector3Like
}

export interface FixedTickMovementResult {
    state: FixedTickMovementState
    arrived: boolean
    blocked: boolean
}

const EPSILON = 1e-6
const DEFAULT_GUARD_CLEARANCE = 8

export const cloneVector3 = (value: Vector3Like): Vector3Like => ({ x: value.x, y: value.y, z: value.z })

export const createVector3 = (x = 0, y = 0, z = 0): Vector3Like => ({ x, y, z })

export const addVector3 = (a: Vector3Like, b: Vector3Like): Vector3Like => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const subtractVector3 = (a: Vector3Like, b: Vector3Like): Vector3Like => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const scaleVector3 = (value: Vector3Like, scale: number): Vector3Like => ({
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
})

export const vector3Length = (value: Vector3Like): number => Math.hypot(value.x, value.y, value.z)

export const vector3BoundingRadius = (value: Vector3Like): number =>
    Math.hypot(Math.max(0, Math.abs(value.x)), Math.max(0, Math.abs(value.y)), Math.max(0, Math.abs(value.z)))

export const normalizeVector3 = (value: Vector3Like): Vector3Like => {
    const length = vector3Length(value)
    return length > EPSILON ? scaleVector3(value, 1 / length) : createVector3()
}

export const distanceVector3 = (a: Vector3Like, b: Vector3Like): number => vector3Length(subtractVector3(a, b))

export const isPointInsideAabb = (point: Vector3Like, box: AabbLike): boolean =>
    Math.abs(point.x - box.center.x) <= box.halfExtents.x &&
    Math.abs(point.y - box.center.y) <= box.halfExtents.y &&
    Math.abs(point.z - box.center.z) <= box.halfExtents.z

export const expandAabb = (box: AabbLike, halfExtents: Vector3Like | undefined): AabbLike =>
    halfExtents
        ? {
              center: cloneVector3(box.center),
              halfExtents: {
                  x: box.halfExtents.x + vector3BoundingRadius(halfExtents),
                  y: box.halfExtents.y + vector3BoundingRadius(halfExtents),
                  z: box.halfExtents.z + vector3BoundingRadius(halfExtents)
              }
          }
        : box

export const segmentIntersectsAabb = (from: Vector3Like, to: Vector3Like, box: AabbLike): boolean => {
    let tMin = 0
    let tMax = 1

    for (const axis of ['x', 'y', 'z'] as const) {
        const start = from[axis]
        const delta = to[axis] - start
        const min = box.center[axis] - box.halfExtents[axis]
        const max = box.center[axis] + box.halfExtents[axis]

        if (Math.abs(delta) < EPSILON) {
            if (start < min || start > max) {
                return false
            }
            continue
        }

        const inverse = 1 / delta
        let near = (min - start) * inverse
        let far = (max - start) * inverse
        if (near > far) {
            const swap = near
            near = far
            far = swap
        }
        tMin = Math.max(tMin, near)
        tMax = Math.min(tMax, far)
        if (tMin > tMax) {
            return false
        }
    }

    return true
}

const moveSpeedToward = (current: number, target: number, maxDelta: number): number => {
    if (Math.abs(target - current) <= maxDelta) {
        return target
    }
    return current + Math.sign(target - current) * maxDelta
}

const isMovementBlocked = (
    from: Vector3Like,
    to: Vector3Like,
    guards: readonly AabbLike[] | undefined,
    controlledHalfExtents?: Vector3Like
): boolean =>
    guards?.some((guard) => {
        const expandedGuard = expandAabb(guard, controlledHalfExtents)
        return segmentIntersectsAabb(from, to, expandedGuard) || isPointInsideAabb(to, expandedGuard)
    }) ?? false

export const resolveSafeTargetOutsideGuards = (
    from: Vector3Like,
    target: Vector3Like,
    guards: readonly AabbLike[] | undefined,
    controlledHalfExtents?: Vector3Like,
    clearance = DEFAULT_GUARD_CLEARANCE
): Vector3Like => {
    if (!guards?.length) {
        return cloneVector3(target)
    }

    const direction = normalizeVector3(subtractVector3(target, from))
    const safeClearance = Math.max(0, clearance)
    let resolved = cloneVector3(target)

    for (const guard of guards) {
        const expandedGuard = expandAabb(guard, controlledHalfExtents)
        if (!segmentIntersectsAabb(from, resolved, expandedGuard) && !isPointInsideAabb(resolved, expandedGuard)) {
            continue
        }

        let bestDistance = Infinity
        for (const axis of ['x', 'y', 'z'] as const) {
            const component = direction[axis]
            if (Math.abs(component) < EPSILON) {
                continue
            }
            const face = expandedGuard.center[axis] + (component > 0 ? -expandedGuard.halfExtents[axis] : expandedGuard.halfExtents[axis])
            const distance = (face - from[axis]) / component
            if (distance >= 0 && distance < bestDistance) {
                bestDistance = distance
            }
        }

        if (Number.isFinite(bestDistance)) {
            const safeDistance = Math.max(0, bestDistance - safeClearance)
            resolved = addVector3(from, scaleVector3(direction, safeDistance))
        }
    }

    return resolved
}

export const createStoppedMovementState = (position: Vector3Like): FixedTickMovementState => ({
    position: cloneVector3(position),
    velocity: createVector3(),
    target: null,
    speed: 0
})

export const applyMoveToPointIntent = (state: FixedTickMovementState, target: Vector3Like): FixedTickMovementState => ({
    ...state,
    position: cloneVector3(state.position),
    velocity: cloneVector3(state.velocity),
    target: cloneVector3(target)
})

export const applyStopIntent = (state: FixedTickMovementState): FixedTickMovementState => ({
    ...state,
    position: cloneVector3(state.position),
    velocity: cloneVector3(state.velocity),
    target: null
})

export const stepFixedTickMovement = (
    state: FixedTickMovementState,
    deltaSeconds: number,
    options: FixedTickMovementOptions
): FixedTickMovementResult => {
    const safeDelta = Math.max(0, deltaSeconds)
    const currentPosition = cloneVector3(state.position)

    if (!state.target) {
        const nextSpeed = moveSpeedToward(state.speed, 0, options.deceleration * safeDelta)
        const direction = normalizeVector3(state.velocity)
        const nextVelocity = scaleVector3(direction, nextSpeed)
        const nextPosition = addVector3(currentPosition, scaleVector3(nextVelocity, safeDelta))
        const blocked = isMovementBlocked(currentPosition, nextPosition, options.guards, options.controlledHalfExtents)

        if (blocked) {
            return {
                state: { position: currentPosition, velocity: createVector3(), target: null, speed: 0 },
                arrived: false,
                blocked: true
            }
        }

        return {
            state: { position: nextPosition, velocity: nextVelocity, target: null, speed: nextSpeed },
            arrived: false,
            blocked: false
        }
    }

    const target = cloneVector3(state.target)
    const remaining = distanceVector3(currentPosition, target)
    if (remaining <= options.arrivalRadius) {
        return {
            state: { position: target, velocity: createVector3(), target: null, speed: 0 },
            arrived: true,
            blocked: false
        }
    }

    const direction = normalizeVector3(subtractVector3(target, currentPosition))
    const brakingDistance = state.speed > 0 && options.deceleration > EPSILON ? (state.speed * state.speed) / (2 * options.deceleration) : 0
    const desiredSpeed = remaining <= Math.max(options.arrivalRadius, brakingDistance) ? 0 : options.cruiseSpeed
    const rate = desiredSpeed > state.speed ? options.acceleration : options.deceleration
    const nextSpeed = moveSpeedToward(state.speed, desiredSpeed, rate * safeDelta)
    const stepDistance = Math.min(remaining, nextSpeed * safeDelta)
    const nextPosition = addVector3(currentPosition, scaleVector3(direction, stepDistance))
    const blocked = isMovementBlocked(currentPosition, nextPosition, options.guards, options.controlledHalfExtents)

    if (blocked) {
        return {
            state: { position: currentPosition, velocity: createVector3(), target: null, speed: 0 },
            arrived: false,
            blocked: true
        }
    }

    const arrived = distanceVector3(nextPosition, target) <= options.arrivalRadius
    return {
        state: {
            position: arrived ? target : nextPosition,
            velocity: arrived ? createVector3() : scaleVector3(direction, nextSpeed),
            target: arrived ? null : target,
            speed: arrived ? 0 : nextSpeed
        },
        arrived,
        blocked: false
    }
}
