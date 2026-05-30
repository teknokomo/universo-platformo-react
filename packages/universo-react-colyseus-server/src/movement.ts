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
    occupiedEntities?: readonly OccupiedEntityLike[]
    bodyRadius?: number
    collisionSafetyMargin?: number
}

export interface FixedTickMovementResult {
    state: FixedTickMovementState
    arrived: boolean
    blocked: boolean
}

interface MovementClamp {
    position: Vector3Like
    blocked: boolean
}

export interface OccupiedEntityLike {
    position: Vector3Like
    radius: number
    halfExtents?: Vector3Like
    heading?: Vector3Like
}

export interface SweptOrientedBodyContactOptions {
    leftFrom: Vector3Like
    leftTo: Vector3Like
    leftHalfExtents: Vector3Like
    leftHeading: Vector3Like
    rightFrom: Vector3Like
    rightTo: Vector3Like
    rightHalfExtents: Vector3Like
    rightHeading: Vector3Like
    clearance?: number
}

export interface SweptOrientedBodyContactResult {
    left: Vector3Like
    right: Vector3Like
    contactTime: number
}

interface OrientedBoxLike {
    center: Vector3Like
    halfExtents: Vector3Like
    axes: [Vector3Like, Vector3Like, Vector3Like]
}

export interface SpawnSearchOptions {
    origin: Vector3Like
    blockers?: readonly AabbLike[]
    occupiedEntities?: readonly OccupiedEntityLike[]
    bodyRadius: number
    safetyMargin: number
    maxAttempts: number
    ringSpacing: number
}

const EPSILON = 1e-6
const CONTACT_EPSILON = 0.02
const DEFAULT_GUARD_CLEARANCE = CONTACT_EPSILON
const GOLDEN_ANGLE = 2.399963229728653

export const cloneVector3 = (value: Vector3Like): Vector3Like => ({ x: value.x, y: value.y, z: value.z })

export const createVector3 = (x = 0, y = 0, z = 0): Vector3Like => ({ x, y, z })

export const addVector3 = (a: Vector3Like, b: Vector3Like): Vector3Like => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const subtractVector3 = (a: Vector3Like, b: Vector3Like): Vector3Like => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const scaleVector3 = (value: Vector3Like, scale: number): Vector3Like => ({
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
})

export const dotVector3 = (a: Vector3Like, b: Vector3Like): number => a.x * b.x + a.y * b.y + a.z * b.z

export const crossVector3 = (a: Vector3Like, b: Vector3Like): Vector3Like => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
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

export const distanceToAabbSurface = (point: Vector3Like, box: AabbLike): number => {
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

export const expandAabb = (box: AabbLike, halfExtents: Vector3Like | undefined): AabbLike =>
    halfExtents
        ? {
              center: cloneVector3(box.center),
              halfExtents: {
                  x: box.halfExtents.x + Math.max(0, Math.abs(halfExtents.x)),
                  y: box.halfExtents.y + Math.max(0, Math.abs(halfExtents.y)),
                  z: box.halfExtents.z + Math.max(0, Math.abs(halfExtents.z))
              }
          }
        : box

export const resolveOrientedBodyHalfExtents = (
    halfExtents: Vector3Like | undefined,
    direction: Vector3Like | undefined
): Vector3Like | undefined => {
    if (!halfExtents) {
        return undefined
    }

    const forward = direction ? normalizeVector3(direction) : createVector3()
    if (vector3Length(forward) <= EPSILON) {
        return {
            x: Math.max(0, Math.abs(halfExtents.x)),
            y: Math.max(0, Math.abs(halfExtents.y)),
            z: Math.max(0, Math.abs(halfExtents.z))
        }
    }

    const referenceUp = Math.abs(dotVector3(forward, { x: 0, y: 1, z: 0 })) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalizeVector3(crossVector3(referenceUp, forward))
    const up = normalizeVector3(crossVector3(forward, right))
    const hx = Math.max(0, Math.abs(halfExtents.x))
    const hy = Math.max(0, Math.abs(halfExtents.y))
    const hz = Math.max(0, Math.abs(halfExtents.z))

    return {
        x: Math.abs(forward.x) * hx + Math.abs(up.x) * hy + Math.abs(right.x) * hz,
        y: Math.abs(forward.y) * hx + Math.abs(up.y) * hy + Math.abs(right.y) * hz,
        z: Math.abs(forward.z) * hx + Math.abs(up.z) * hy + Math.abs(right.z) * hz
    }
}

const resolveBodyAxes = (direction: Vector3Like | undefined): [Vector3Like, Vector3Like, Vector3Like] => {
    const forward = direction ? normalizeVector3(direction) : createVector3(1, 0, 0)
    const safeForward = vector3Length(forward) > EPSILON ? forward : createVector3(1, 0, 0)
    const referenceUp = Math.abs(dotVector3(safeForward, { x: 0, y: 1, z: 0 })) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalizeVector3(crossVector3(referenceUp, safeForward))
    const up = normalizeVector3(crossVector3(safeForward, right))
    return [safeForward, up, right]
}

const createOrientedBox = (center: Vector3Like, halfExtents: Vector3Like, direction?: Vector3Like): OrientedBoxLike => ({
    center,
    halfExtents: {
        x: Math.max(0, Math.abs(halfExtents.x)),
        y: Math.max(0, Math.abs(halfExtents.y)),
        z: Math.max(0, Math.abs(halfExtents.z))
    },
    axes: resolveBodyAxes(direction)
})

const createAabbBox = (box: AabbLike): OrientedBoxLike => ({
    center: box.center,
    halfExtents: {
        x: Math.max(0, Math.abs(box.halfExtents.x)),
        y: Math.max(0, Math.abs(box.halfExtents.y)),
        z: Math.max(0, Math.abs(box.halfExtents.z))
    },
    axes: [createVector3(1, 0, 0), createVector3(0, 1, 0), createVector3(0, 0, 1)]
})

const boxRadiusOnAxis = (box: OrientedBoxLike, axis: Vector3Like): number =>
    box.halfExtents.x * Math.abs(dotVector3(box.axes[0], axis)) +
    box.halfExtents.y * Math.abs(dotVector3(box.axes[1], axis)) +
    box.halfExtents.z * Math.abs(dotVector3(box.axes[2], axis))

const orientedBoxesOverlap = (left: OrientedBoxLike, right: OrientedBoxLike): boolean => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector3(leftAxis, rightAxis)
            if (vector3Length(cross) > EPSILON) {
                axes.push(normalizeVector3(cross))
            }
        }
    }

    const centerDelta = subtractVector3(right.center, left.center)
    return axes.every((axis) => Math.abs(dotVector3(centerDelta, axis)) <= boxRadiusOnAxis(left, axis) + boxRadiusOnAxis(right, axis))
}

const resolveSeparatingAxes = (left: OrientedBoxLike, right: OrientedBoxLike): Vector3Like[] => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector3(leftAxis, rightAxis)
            if (vector3Length(cross) > EPSILON) {
                axes.push(normalizeVector3(cross))
            }
        }
    }
    return axes
}

export const orientedBodyBoxesOverlap = (
    leftCenter: Vector3Like,
    leftHalfExtents: Vector3Like,
    leftHeading: Vector3Like | undefined,
    rightCenter: Vector3Like,
    rightHalfExtents: Vector3Like,
    rightHeading: Vector3Like | undefined
): boolean =>
    orientedBoxesOverlap(
        createOrientedBox(leftCenter, leftHalfExtents, leftHeading),
        createOrientedBox(rightCenter, rightHalfExtents, rightHeading)
    )

export const resolveSweptOrientedBodyContact = (options: SweptOrientedBodyContactOptions): SweptOrientedBodyContactResult | null => {
    const leftDelta = subtractVector3(options.leftTo, options.leftFrom)
    const rightDelta = subtractVector3(options.rightTo, options.rightFrom)
    const relativeDelta = subtractVector3(leftDelta, rightDelta)
    const relativeLength = vector3Length(relativeDelta)
    if (relativeLength <= EPSILON) {
        return null
    }

    const contactDistance = findFirstOverlapDistance(
        options.leftFrom,
        addVector3(options.leftFrom, relativeDelta),
        options.leftHalfExtents,
        options.leftHeading,
        createOrientedBox(options.rightFrom, options.rightHalfExtents, options.rightHeading)
    )
    if (contactDistance === null) {
        return null
    }

    const safeContactTime = Math.max(0, Math.min(1, (contactDistance - Math.max(0, options.clearance ?? CONTACT_EPSILON)) / relativeLength))
    return {
        left: addVector3(options.leftFrom, scaleVector3(leftDelta, safeContactTime)),
        right: addVector3(options.rightFrom, scaleVector3(rightDelta, safeContactTime)),
        contactTime: safeContactTime
    }
}

const findFirstOverlapDistance = (
    from: Vector3Like,
    to: Vector3Like,
    controlledHalfExtents: Vector3Like,
    controlledHeading: Vector3Like,
    blocker: OrientedBoxLike
): number | null => {
    const movement = subtractVector3(to, from)
    const movementLength = vector3Length(movement)
    if (movementLength <= EPSILON) {
        return null
    }

    const movingBox = createOrientedBox(from, controlledHalfExtents, controlledHeading)

    if (orientedBoxesOverlap(movingBox, blocker)) {
        return 0
    }

    let enter = 0
    let exit = 1
    const centerDelta = subtractVector3(blocker.center, from)
    for (const axis of resolveSeparatingAxes(movingBox, blocker)) {
        const radius = boxRadiusOnAxis(movingBox, axis) + boxRadiusOnAxis(blocker, axis)
        const projectedStart = dotVector3(centerDelta, axis)
        const projectedVelocity = -dotVector3(movement, axis)

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

export const expandAabbForOrientedBody = (
    box: AabbLike,
    halfExtents: Vector3Like | undefined,
    direction: Vector3Like | undefined
): AabbLike => expandAabb(box, resolveOrientedBodyHalfExtents(halfExtents, direction))

export const resolveOccupiedEntityAabb = (occupied: OccupiedEntityLike): AabbLike | null =>
    occupied.halfExtents
        ? expandAabbForOrientedBody(
              {
                  center: occupied.position,
                  halfExtents: createVector3()
              },
              occupied.halfExtents,
              occupied.heading
          )
        : null

export const isBodyClearOfAabb = (position: Vector3Like, bodyRadius: number, blocker: AabbLike, safetyMargin = 0): boolean => {
    const radius = Math.max(0, bodyRadius) + Math.max(0, safetyMargin)
    const dx = Math.max(Math.abs(position.x - blocker.center.x) - blocker.halfExtents.x, 0)
    const dy = Math.max(Math.abs(position.y - blocker.center.y) - blocker.halfExtents.y, 0)
    const dz = Math.max(Math.abs(position.z - blocker.center.z) - blocker.halfExtents.z, 0)
    return Math.hypot(dx, dy, dz) > radius
}

export const isBodyClearOfOccupiedEntity = (
    position: Vector3Like,
    bodyRadius: number,
    occupied: OccupiedEntityLike,
    safetyMargin = 0
): boolean => {
    if (occupied.halfExtents) {
        const expandedHalfExtents = {
            x: Math.max(0, Math.abs(occupied.halfExtents.x)) + Math.max(0, bodyRadius) + Math.max(0, safetyMargin),
            y: Math.max(0, Math.abs(occupied.halfExtents.y)) + Math.max(0, safetyMargin),
            z: Math.max(0, Math.abs(occupied.halfExtents.z)) + Math.max(0, bodyRadius) + Math.max(0, safetyMargin)
        }
        return !orientedBoxesOverlap(
            createOrientedBox(position, createVector3(Math.max(0, bodyRadius), Math.max(0, bodyRadius), Math.max(0, bodyRadius))),
            createOrientedBox(occupied.position, expandedHalfExtents, occupied.heading)
        )
    }

    return distanceVector3(position, occupied.position) > Math.max(0, bodyRadius) + Math.max(0, occupied.radius) + Math.max(0, safetyMargin)
}

export const distancePointToSegment = (point: Vector3Like, from: Vector3Like, to: Vector3Like): number => {
    const segment = subtractVector3(to, from)
    const segmentLengthSq = segment.x * segment.x + segment.y * segment.y + segment.z * segment.z
    if (segmentLengthSq <= EPSILON) {
        return distanceVector3(point, from)
    }

    const pointOffset = subtractVector3(point, from)
    const t = Math.max(
        0,
        Math.min(1, (pointOffset.x * segment.x + pointOffset.y * segment.y + pointOffset.z * segment.z) / segmentLengthSq)
    )
    const closest = addVector3(from, scaleVector3(segment, t))
    return distanceVector3(point, closest)
}

export const segmentIntersectsOccupiedEntity = (
    from: Vector3Like,
    to: Vector3Like,
    bodyRadius: number,
    occupied: OccupiedEntityLike,
    safetyMargin = 0,
    bodyHalfExtents?: Vector3Like
): boolean => {
    if (occupied.halfExtents && bodyHalfExtents) {
        const movementDirection = subtractVector3(to, from)
        const occupiedAabb = resolveOccupiedEntityAabb(occupied)
        if (!occupiedAabb) {
            return false
        }
        const expandedOccupied = expandAabbForOrientedBody(
            occupiedAabb,
            {
                x: Math.max(0, Math.abs(bodyHalfExtents.x)) + safetyMargin,
                y: Math.max(0, Math.abs(bodyHalfExtents.y)) + safetyMargin,
                z: Math.max(0, Math.abs(bodyHalfExtents.z)) + safetyMargin
            },
            movementDirection
        )
        return segmentIntersectsAabb(from, to, expandedOccupied) || isPointInsideAabb(to, expandedOccupied)
    }

    return (
        distancePointToSegment(occupied.position, from, to) <=
        Math.max(0, bodyRadius) + Math.max(0, occupied.radius) + Math.max(0, safetyMargin)
    )
}

export const isSpawnPositionFree = (
    position: Vector3Like,
    options: Omit<SpawnSearchOptions, 'origin' | 'maxAttempts' | 'ringSpacing'>
): boolean => {
    const blockers = options.blockers ?? []
    const occupiedEntities = options.occupiedEntities ?? []
    return (
        blockers.every((blocker) => isBodyClearOfAabb(position, options.bodyRadius, blocker, options.safetyMargin)) &&
        occupiedEntities.every((occupied) => isBodyClearOfOccupiedEntity(position, options.bodyRadius, occupied, options.safetyMargin))
    )
}

export const findFreeSpawnPosition = (options: SpawnSearchOptions): Vector3Like | null => {
    const maxAttempts = Math.max(0, Math.floor(options.maxAttempts))
    const ringSpacing = Math.max(0, options.ringSpacing)
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const ring = Math.floor(Math.sqrt(attempt))
        const distance = ring * ringSpacing
        const angle = attempt * GOLDEN_ANGLE
        const candidate = {
            x: options.origin.x + Math.cos(angle) * distance,
            y: options.origin.y,
            z: options.origin.z + Math.sin(angle) * distance
        }
        if (isSpawnPositionFree(candidate, options)) {
            return candidate
        }
    }
    return null
}

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

const clampMovementBeforeBlockedContact = (
    from: Vector3Like,
    to: Vector3Like,
    guards: readonly AabbLike[] | undefined,
    controlledHalfExtents?: Vector3Like,
    occupiedEntities?: readonly OccupiedEntityLike[],
    bodyRadius = 0,
    collisionSafetyMargin = 0
): MovementClamp => {
    const movement = subtractVector3(to, from)
    const movementLength = vector3Length(movement)
    if (movementLength <= EPSILON) {
        return { position: cloneVector3(from), blocked: false }
    }

    const direction = scaleVector3(movement, 1 / movementLength)
    let nearestContactDistance: number | null = null

    const registerContact = (distance: number | null) => {
        if (distance === null) {
            return
        }
        const clampedDistance = Math.max(0, Math.min(movementLength, distance))
        nearestContactDistance = nearestContactDistance === null ? clampedDistance : Math.min(nearestContactDistance, clampedDistance)
    }

    for (const guard of guards ?? []) {
        if (controlledHalfExtents) {
            registerContact(findFirstOverlapDistance(from, to, controlledHalfExtents, direction, createAabbBox(guard)))
        } else if (segmentIntersectsAabb(from, to, guard) || isPointInsideAabb(to, guard)) {
            registerContact(rayAabbEntryDistance(from, to, guard))
        }
    }

    for (const occupied of occupiedEntities ?? []) {
        if (occupied.halfExtents && controlledHalfExtents) {
            const occupiedHalfExtents = {
                x: Math.max(0, Math.abs(occupied.halfExtents.x)) + collisionSafetyMargin,
                y: Math.max(0, Math.abs(occupied.halfExtents.y)) + collisionSafetyMargin,
                z: Math.max(0, Math.abs(occupied.halfExtents.z)) + collisionSafetyMargin
            }
            registerContact(
                findFirstOverlapDistance(
                    from,
                    to,
                    controlledHalfExtents,
                    direction,
                    createOrientedBox(occupied.position, occupiedHalfExtents, occupied.heading)
                )
            )
            continue
        }

        if (segmentIntersectsOccupiedEntity(from, to, bodyRadius, occupied, collisionSafetyMargin, controlledHalfExtents)) {
            registerContact(0)
        }
    }

    if (nearestContactDistance === null) {
        return { position: cloneVector3(to), blocked: false }
    }

    const safeDistance = Math.max(0, nearestContactDistance - CONTACT_EPSILON)
    return {
        position: addVector3(from, scaleVector3(direction, safeDistance)),
        blocked: true
    }
}

export const rayAabbEntryDistance = (from: Vector3Like, target: Vector3Like, box: AabbLike): number | null => {
    const delta = subtractVector3(target, from)
    const segmentLength = vector3Length(delta)
    if (segmentLength <= EPSILON) {
        return isPointInsideAabb(from, box) ? 0 : null
    }

    let nearT = 0
    let farT = 1
    for (const axis of ['x', 'y', 'z'] as const) {
        const start = from[axis]
        const axisDelta = delta[axis]
        const min = box.center[axis] - box.halfExtents[axis]
        const max = box.center[axis] + box.halfExtents[axis]

        if (Math.abs(axisDelta) < EPSILON) {
            if (start < min || start > max) {
                return null
            }
            continue
        }

        const inverse = 1 / axisDelta
        let near = (min - start) * inverse
        let far = (max - start) * inverse
        if (near > far) {
            const swap = near
            near = far
            far = swap
        }
        nearT = Math.max(nearT, near)
        farT = Math.min(farT, far)
        if (nearT > farT) {
            return null
        }
    }

    return farT >= 0 ? Math.max(0, nearT) * segmentLength : null
}

const resolveSurfaceClearanceDistance = (
    from: Vector3Like,
    direction: Vector3Like,
    entryDistance: number,
    box: AabbLike,
    clearance: number
): number => {
    if (clearance <= 0) {
        return Math.max(0, entryDistance)
    }
    if (distanceToAabbSurface(from, box) <= clearance) {
        return 0
    }

    let low = 0
    let high = Math.max(0, entryDistance)
    for (let iteration = 0; iteration < 24; iteration += 1) {
        const mid = (low + high) / 2
        const candidate = addVector3(from, scaleVector3(direction, mid))
        if (distanceToAabbSurface(candidate, box) >= clearance) {
            low = mid
        } else {
            high = mid
        }
    }
    return low
}

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
        if (controlledHalfExtents) {
            const entryDistance = findFirstOverlapDistance(from, resolved, controlledHalfExtents, direction, createAabbBox(guard))
            if (entryDistance !== null) {
                const safeDistance = Math.max(0, entryDistance - safeClearance)
                resolved = addVector3(from, scaleVector3(direction, safeDistance))
            }
        } else if (segmentIntersectsAabb(from, resolved, guard) || isPointInsideAabb(resolved, guard)) {
            const entryDistance = rayAabbEntryDistance(from, resolved, guard)
            if (entryDistance === null) {
                continue
            }
            const safeDistance = resolveSurfaceClearanceDistance(from, direction, entryDistance, guard, safeClearance)
            resolved = addVector3(from, scaleVector3(direction, safeDistance))
        }
    }

    return resolved
}

export const resolveSafeTargetOutsideOccupiedEntities = (
    from: Vector3Like,
    target: Vector3Like,
    occupiedEntities: readonly OccupiedEntityLike[] | undefined,
    controlledHalfExtents?: Vector3Like,
    bodyRadius = 0,
    clearance = DEFAULT_GUARD_CLEARANCE
): Vector3Like => {
    if (!occupiedEntities?.length) {
        return cloneVector3(target)
    }

    const movement = subtractVector3(target, from)
    const movementLength = vector3Length(movement)
    if (movementLength <= EPSILON) {
        return cloneVector3(target)
    }

    const direction = scaleVector3(movement, 1 / movementLength)
    const safeClearance = Math.max(0, clearance)
    let resolved = cloneVector3(target)

    for (const occupied of occupiedEntities) {
        if (occupied.halfExtents && controlledHalfExtents) {
            const targetWouldOverlap = orientedBoxesOverlap(
                createOrientedBox(resolved, controlledHalfExtents, direction),
                createOrientedBox(occupied.position, occupied.halfExtents, occupied.heading)
            )
            if (!targetWouldOverlap) {
                continue
            }
            const entryDistance = findFirstOverlapDistance(
                from,
                resolved,
                controlledHalfExtents,
                direction,
                createOrientedBox(occupied.position, occupied.halfExtents, occupied.heading)
            )
            if (entryDistance !== null) {
                resolved = addVector3(from, scaleVector3(direction, Math.max(0, entryDistance - safeClearance)))
            }
            continue
        }

        if (distanceVector3(resolved, occupied.position) <= Math.max(0, bodyRadius) + Math.max(0, occupied.radius) + safeClearance) {
            const radius = Math.max(0, bodyRadius) + Math.max(0, occupied.radius) + safeClearance
            let low = 0
            let high = distanceVector3(from, resolved)
            for (let iteration = 0; high > 0 && iteration < 24; iteration += 1) {
                const mid = (low + high) / 2
                const candidate = addVector3(from, scaleVector3(direction, mid))
                if (distanceVector3(candidate, occupied.position) > radius) {
                    low = mid
                } else {
                    high = mid
                }
            }
            if (high > 0) {
                resolved = addVector3(from, scaleVector3(direction, low))
            }
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
        const clamp = clampMovementBeforeBlockedContact(
            currentPosition,
            nextPosition,
            options.guards,
            options.controlledHalfExtents,
            options.occupiedEntities,
            options.bodyRadius,
            options.collisionSafetyMargin
        )

        if (clamp.blocked) {
            return {
                state: { position: clamp.position, velocity: createVector3(), target: null, speed: 0 },
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
        const clamp = clampMovementBeforeBlockedContact(
            currentPosition,
            target,
            options.guards,
            options.controlledHalfExtents,
            options.occupiedEntities,
            options.bodyRadius,
            options.collisionSafetyMargin
        )
        if (clamp.blocked) {
            return {
                state: { position: clamp.position, velocity: createVector3(), target: null, speed: 0 },
                arrived: false,
                blocked: true
            }
        }
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
    const clamp = clampMovementBeforeBlockedContact(
        currentPosition,
        nextPosition,
        options.guards,
        options.controlledHalfExtents,
        options.occupiedEntities,
        options.bodyRadius,
        options.collisionSafetyMargin
    )

    if (clamp.blocked) {
        return {
            state: { position: clamp.position, velocity: createVector3(), target: null, speed: 0 },
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
