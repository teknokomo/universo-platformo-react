import { describe, expect, it } from 'vitest'

import {
    Room,
    applyMoveToPointIntent,
    applyStopIntent,
    createStoppedMovementState,
    expandAabb,
    expandAabbForOrientedBody,
    findFreeSpawnPosition,
    isSpawnPositionFree,
    isPointInsideAabb,
    orientedBodyBoxesOverlap,
    rayAabbEntryDistance,
    resolveOccupiedEntityAabb,
    resolveOrientedBodyHalfExtents,
    resolveSafeTargetOutsideGuards,
    resolveSafeTargetOutsideOccupiedEntities,
    resolveSweptOrientedBodyContact,
    stepFixedTickMovement
} from './index'

const normalizeTestVector = (value: { x: number; y: number; z: number }) => {
    const length = Math.hypot(value.x, value.y, value.z)
    return length > 0 ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 1, y: 0, z: 0 }
}

const addScaledTestVector = (
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    distance: number
) => ({
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance
})

describe('@universo-react/colyseus-server', () => {
    it('re-exports the Colyseus server API', () => {
        expect(Room).toBeTypeOf('function')
    })

    it('steps fixed-tick movement toward a point', () => {
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 10, y: 0, z: 0 })
        const result = stepFixedTickMovement(initial, 0.5, {
            cruiseSpeed: 10,
            acceleration: 10,
            deceleration: 10,
            arrivalRadius: 0.1
        })

        expect(result.blocked).toBe(false)
        expect(result.state.position.x).toBeGreaterThan(0)
        expect(result.state.target).toEqual({ x: 10, y: 0, z: 0 })
    })

    it('stops before crossing a guarded AABB', () => {
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 10, y: 0, z: 0 })
        const result = stepFixedTickMovement(initial, 1, {
            cruiseSpeed: 10,
            acceleration: 10,
            deceleration: 10,
            arrivalRadius: 0.1,
            guards: [{ center: { x: 5, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } }]
        })

        expect(result.blocked).toBe(true)
        expect(result.state.position.x).toBeCloseTo(3.98)
        expect(result.state.position.y).toBe(0)
        expect(result.state.position.z).toBe(0)
        expect(result.state.target).toBeNull()
    })

    it('treats the controlled body extents as part of the guard envelope', () => {
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 10, y: 0, z: 0 })
        const guard = { center: { x: 5, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } }
        const result = stepFixedTickMovement(initial, 1, {
            cruiseSpeed: 10,
            acceleration: 10,
            deceleration: 10,
            arrivalRadius: 0.1,
            controlledHalfExtents: { x: 2, y: 0.5, z: 0.5 },
            guards: [guard]
        })

        expect(result.blocked).toBe(true)
        expect(result.state.position.x).toBeCloseTo(1.98)
        expect(result.state.position.y).toBe(0)
        expect(result.state.position.z).toBe(0)
        expect(isPointInsideAabb({ x: 2.9, y: 0, z: 0 }, expandAabb(guard, { x: 2, y: 0.5, z: 0.5 }))).toBe(true)
        expect(expandAabb(guard, { x: 2, y: 0.5, z: 0.5 }).halfExtents).toEqual({ x: 3, y: 1.5, z: 1.5 })
    })

    it('does not snap into a guarded body when the target is inside arrival radius', () => {
        const guard = { center: { x: 5, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } }
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 1.95, y: 0, z: 0 }), { x: 2.05, y: 0, z: 0 })
        const result = stepFixedTickMovement(initial, 0.05, {
            cruiseSpeed: 10,
            acceleration: 10,
            deceleration: 10,
            arrivalRadius: 0.2,
            controlledHalfExtents: { x: 2, y: 0.5, z: 0.5 },
            guards: [guard]
        })

        expect(result.arrived).toBe(false)
        expect(result.blocked).toBe(true)
        expect(result.state.position.x).toBeLessThan(2)
        expect(isPointInsideAabb(result.state.position, expandAabb(guard, { x: 2, y: 0.5, z: 0.5 }))).toBe(false)
        expect(result.state.target).toBeNull()
    })

    it('uses direction-aware oriented body extents for guarded body checks', () => {
        const guard = { center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 10, y: 4, z: 10 } }

        expect(expandAabbForOrientedBody(guard, { x: 6, y: 2, z: 2 }, { x: 1, y: 0, z: 0 }).halfExtents).toEqual({
            x: 16,
            y: 6,
            z: 12
        })
        expect(expandAabbForOrientedBody(guard, { x: 6, y: 2, z: 2 }, { x: 0, y: 1, z: 0 }).halfExtents).toEqual({
            x: 12,
            y: 10,
            z: 12
        })
        expect(resolveOrientedBodyHalfExtents({ x: 6, y: 2, z: 2 }, { x: 1, y: 0, z: 1 }).x).toBeCloseTo(5.657)
        expect(resolveOrientedBodyHalfExtents({ x: 6, y: 2, z: 2 }, { x: 1, y: 0, z: 1 }).z).toBeCloseTo(5.657)
    })

    it('blocks movement into an occupied ship body', () => {
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 20, y: 0, z: 0 })
        const result = stepFixedTickMovement(initial, 1, {
            cruiseSpeed: 20,
            acceleration: 20,
            deceleration: 20,
            arrivalRadius: 0.1,
            occupiedEntities: [{ position: { x: 8, y: 0, z: 0 }, radius: 6 }],
            bodyRadius: 6
        })

        expect(result.blocked).toBe(true)
        expect(result.state.position).toEqual({ x: 0, y: 0, z: 0 })
        expect(result.state.target).toBeNull()
    })

    it('blocks swept movement through an occupied ship body even when the final point is clear', () => {
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 100, y: 0, z: 0 })
        const result = stepFixedTickMovement(initial, 1, {
            cruiseSpeed: 100,
            acceleration: 100,
            deceleration: 100,
            arrivalRadius: 0.1,
            occupiedEntities: [{ position: { x: 50, y: 0, z: 0 }, radius: 4 }],
            bodyRadius: 4
        })

        expect(result.blocked).toBe(true)
        expect(result.state.position).toEqual({ x: 0, y: 0, z: 0 })
        expect(result.state.target).toBeNull()
    })

    it('uses continuous swept body checks for narrow blockers between sample-sized intervals', () => {
        const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 1000, y: 0, z: 0 })
        const result = stepFixedTickMovement(initial, 1, {
            cruiseSpeed: 1000,
            acceleration: 1000,
            deceleration: 1000,
            arrivalRadius: 0.1,
            occupiedEntities: [{ position: { x: 515, y: 0, z: 0 }, radius: 0, halfExtents: { x: 2, y: 2, z: 2 } }],
            controlledHalfExtents: { x: 2, y: 2, z: 2 },
            bodyRadius: 0
        })

        expect(result.blocked).toBe(true)
        expect(result.state.position.x).toBeCloseTo(510.98)
        expect(result.state.position.y).toBe(0)
        expect(result.state.position.z).toBe(0)
        expect(result.state.target).toBeNull()
    })

    it('blocks diagonal movement into an occupied ship body over multiple ticks', () => {
        let state = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 24, y: 0, z: 24 })
        let blocked = false
        const occupied = { position: { x: 12, y: 0, z: 12 }, radius: 6 }

        for (let tick = 0; tick < 20; tick += 1) {
            const result = stepFixedTickMovement(state, 0.1, {
                cruiseSpeed: 24,
                acceleration: 48,
                deceleration: 48,
                arrivalRadius: 0.1,
                occupiedEntities: [occupied],
                bodyRadius: 6
            })
            state = result.state
            blocked = blocked || result.blocked
        }

        expect(blocked).toBe(true)
        expect(Math.hypot(state.position.x - occupied.position.x, state.position.z - occupied.position.z)).toBeGreaterThanOrEqual(12)
        expect(state.target).toBeNull()
    })

    it.each([
        {
            label: 'nose-to-nose',
            from: { x: 0, y: 0, z: 0 },
            target: { x: 40, y: 0, z: 0 },
            occupied: { x: 24, y: 0, z: 0 },
            expectedAxis: 'x' as const,
            expectedCenter: 12
        },
        {
            label: 'side approach',
            from: { x: 0, y: 0, z: 0 },
            target: { x: 0, y: 0, z: 40 },
            occupied: { x: 0, y: 0, z: 12 },
            expectedAxis: 'z' as const,
            expectedCenter: 4
        },
        {
            label: 'vertical approach',
            from: { x: 0, y: 0, z: 0 },
            target: { x: 0, y: 40, z: 0 },
            occupied: { x: 0, y: 16, z: 0 },
            expectedAxis: 'y' as const,
            expectedCenter: 8
        }
    ])('stops an oriented ship body at bounded standoff during $label', ({ from, target, occupied, expectedAxis, expectedCenter }) => {
        let state = applyMoveToPointIntent(createStoppedMovementState(from), target)
        let blocked = false
        for (let tick = 0; tick < 40; tick += 1) {
            const result = stepFixedTickMovement(state, 0.1, {
                cruiseSpeed: 40,
                acceleration: 80,
                deceleration: 80,
                arrivalRadius: 0.1,
                occupiedEntities: [{ position: occupied, radius: 0, halfExtents: { x: 6, y: 2, z: 2 } }],
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                bodyRadius: 0
            })
            state = result.state
            blocked = blocked || result.blocked
            if (blocked) {
                break
            }
        }

        expect(blocked).toBe(true)
        expect(state.position[expectedAxis]).toBeCloseTo(expectedCenter - 0.02)
        const occupiedBox = { center: occupied, halfExtents: { x: 6, y: 2, z: 2 } }
        const movementDirection = { x: target.x - from.x, y: target.y - from.y, z: target.z - from.z }
        const expandedOccupied = expandAabbForOrientedBody(occupiedBox, { x: 6, y: 2, z: 2 }, movementDirection)
        expect(isPointInsideAabb(state.position, expandedOccupied)).toBe(false)
        expect(rayAabbEntryDistance(from, target, expandedOccupied)).toBeCloseTo(expectedCenter)
        expect(state.target).toBeNull()
    })

    it('uses the occupied ship heading when blocking visual hull contact', () => {
        let state = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: -30 }), { x: 0, y: 0, z: 20 })
        let blocked = false
        const occupied = {
            position: { x: 0, y: 0, z: 0 },
            radius: 0,
            halfExtents: { x: 6, y: 2, z: 2 },
            heading: { x: 1, y: 0, z: 1 }
        }

        for (let tick = 0; tick < 60; tick += 1) {
            const result = stepFixedTickMovement(state, 0.1, {
                cruiseSpeed: 40,
                acceleration: 80,
                deceleration: 80,
                arrivalRadius: 0.1,
                occupiedEntities: [occupied],
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                bodyRadius: 0
            })
            state = result.state
            blocked = blocked || result.blocked
            if (blocked) {
                break
            }
        }

        const occupiedAabb = resolveOccupiedEntityAabb(occupied)
        expect(occupiedAabb?.halfExtents.z).toBeCloseTo(5.657)
        expect(blocked).toBe(true)
        expect(state.position.z).toBeCloseTo(-10.85, 1)
        expect(state.target).toBeNull()
    })

    it('checks exact oriented hull overlap for nose and vertical contact cases', () => {
        expect(
            orientedBodyBoxesOverlap(
                { x: 0, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: 1, y: 0, z: 0 },
                { x: 12.01, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: -1, y: 0, z: 0 }
            )
        ).toBe(false)
        expect(
            orientedBodyBoxesOverlap(
                { x: 0, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: 1, y: 0, z: 0 },
                { x: 11.99, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: -1, y: 0, z: 0 }
            )
        ).toBe(true)
        expect(
            orientedBodyBoxesOverlap(
                { x: 0, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: 0, y: 1, z: 0 },
                { x: 0, y: 12.01, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: 0, y: -1, z: 0 }
            )
        ).toBe(false)
    })

    it('resolves object movement targets to a safe standoff point outside guarded bodies', () => {
        const stationGuard = { center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }
        const from = { x: 0, y: 0, z: 0 }
        const controlledHalfExtents = { x: 6, y: 2, z: 2 }
        const safeTarget = resolveSafeTargetOutsideGuards(from, stationGuard.center, [stationGuard], controlledHalfExtents)
        const direction = normalizeTestVector({
            x: stationGuard.center.x - from.x,
            y: stationGuard.center.y - from.y,
            z: stationGuard.center.z - from.z
        })
        const overlapProbe = addScaledTestVector(safeTarget, direction, 0.05)

        expect(safeTarget.x).toBeLessThan(stationGuard.center.x)
        expect(safeTarget.z).toBeGreaterThan(stationGuard.center.z)
        expect(
            orientedBodyBoxesOverlap(safeTarget, controlledHalfExtents, direction, stationGuard.center, stationGuard.halfExtents, undefined)
        ).toBe(false)
        expect(
            orientedBodyBoxesOverlap(
                overlapProbe,
                controlledHalfExtents,
                direction,
                stationGuard.center,
                stationGuard.halfExtents,
                undefined
            )
        ).toBe(true)
    })

    it('resolves station standoff from multiple approach quadrants without excessive clearance', () => {
        const stationGuard = { center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }
        const controlledHalfExtents = { x: 6, y: 2, z: 2 }
        const starts = [
            { x: 0, y: 0, z: 0 },
            { x: 140, y: 0, z: 0 },
            { x: 0, y: 0, z: -120 },
            { x: 140, y: 0, z: -120 },
            { x: 0, y: 80, z: 0 },
            { x: 140, y: -80, z: -120 }
        ]

        for (const start of starts) {
            const safeTarget = resolveSafeTargetOutsideGuards(start, stationGuard.center, [stationGuard], controlledHalfExtents)
            const direction = normalizeTestVector({
                x: stationGuard.center.x - start.x,
                y: stationGuard.center.y - start.y,
                z: stationGuard.center.z - start.z
            })
            const overlapProbe = addScaledTestVector(safeTarget, direction, 0.05)

            expect(
                orientedBodyBoxesOverlap(
                    safeTarget,
                    controlledHalfExtents,
                    direction,
                    stationGuard.center,
                    stationGuard.halfExtents,
                    undefined
                )
            ).toBe(false)
            expect(
                orientedBodyBoxesOverlap(
                    overlapProbe,
                    controlledHalfExtents,
                    direction,
                    stationGuard.center,
                    stationGuard.halfExtents,
                    undefined
                )
            ).toBe(true)
        }
    })

    it('resolves point movement targets to a safe standoff outside occupied ship bodies', () => {
        const controlledHalfExtents = { x: 6, y: 2, z: 2 }
        const from = { x: 0, y: 0, z: 0 }
        const occupied = {
            position: { x: 24, y: 0, z: 0 },
            radius: 6,
            halfExtents: controlledHalfExtents,
            heading: { x: -1, y: 0, z: 0 }
        }
        const safeTarget = resolveSafeTargetOutsideOccupiedEntities(from, occupied.position, [occupied], controlledHalfExtents, 6)

        expect(safeTarget.x).toBeCloseTo(11.98)
        expect(
            orientedBodyBoxesOverlap(safeTarget, controlledHalfExtents, { x: 1, y: 0, z: 0 }, occupied.position, controlledHalfExtents, {
                x: -1,
                y: 0,
                z: 0
            })
        ).toBe(false)
    })

    it('resolves two moving oriented ships to the swept contact point instead of rollback positions', () => {
        const contact = resolveSweptOrientedBodyContact({
            leftFrom: { x: 0, y: 0, z: 0 },
            leftTo: { x: 10, y: 0, z: 0 },
            leftHalfExtents: { x: 6, y: 2, z: 2 },
            leftHeading: { x: 1, y: 0, z: 0 },
            rightFrom: { x: 20, y: 0, z: 0 },
            rightTo: { x: 10, y: 0, z: 0 },
            rightHalfExtents: { x: 6, y: 2, z: 2 },
            rightHeading: { x: -1, y: 0, z: 0 }
        })

        expect(contact?.left.x).toBeCloseTo(3.99)
        expect(contact?.right.x).toBeCloseTo(16.01)
        expect(
            orientedBodyBoxesOverlap(
                contact?.left ?? { x: 0, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: 1, y: 0, z: 0 },
                contact?.right ?? { x: 20, y: 0, z: 0 },
                { x: 6, y: 2, z: 2 },
                { x: -1, y: 0, z: 0 }
            )
        ).toBe(false)
    })

    it('guards deceleration after a stop intent', () => {
        const moving = {
            position: { x: 3, y: 0, z: 0 },
            velocity: { x: 10, y: 0, z: 0 },
            target: { x: 20, y: 0, z: 0 },
            speed: 10
        }
        const result = stepFixedTickMovement(applyStopIntent(moving), 0.5, {
            cruiseSpeed: 10,
            acceleration: 10,
            deceleration: 4,
            arrivalRadius: 0.1,
            guards: [{ center: { x: 5, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } }]
        })

        expect(result.blocked).toBe(true)
        expect(result.state.position.x).toBeCloseTo(3.98)
        expect(result.state.position.y).toBe(0)
        expect(result.state.position.z).toBe(0)
        expect(result.state.velocity).toEqual({ x: 0, y: 0, z: 0 })
        expect(result.state.speed).toBe(0)
        expect(result.state.target).toBeNull()
    })

    it('accepts the default spawn position when the origin is free', () => {
        expect(
            findFreeSpawnPosition({
                origin: { x: 0, y: 0, z: 0 },
                bodyRadius: 2,
                safetyMargin: 1,
                maxAttempts: 8,
                ringSpacing: 10
            })
        ).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('shifts spawn when an AABB blocker covers the origin', () => {
        const spawn = findFreeSpawnPosition({
            origin: { x: 0, y: 0, z: 0 },
            blockers: [{ center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 5, y: 5, z: 5 } }],
            bodyRadius: 2,
            safetyMargin: 1,
            maxAttempts: 16,
            ringSpacing: 12
        })

        expect(spawn).not.toBeNull()
        expect(spawn).not.toEqual({ x: 0, y: 0, z: 0 })
        expect(
            isSpawnPositionFree(spawn!, {
                blockers: [{ center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 5, y: 5, z: 5 } }],
                bodyRadius: 2,
                safetyMargin: 1
            })
        ).toBe(true)
    })

    it('shifts spawn when another occupied body covers the origin', () => {
        const spawn = findFreeSpawnPosition({
            origin: { x: 0, y: 0, z: 0 },
            occupiedEntities: [{ position: { x: 0, y: 0, z: 0 }, radius: 6 }],
            bodyRadius: 2,
            safetyMargin: 2,
            maxAttempts: 16,
            ringSpacing: 12
        })

        expect(spawn).not.toBeNull()
        expect(spawn).not.toEqual({ x: 0, y: 0, z: 0 })
    })

    it('returns deterministic spawn positions and fails closed when no position is free', () => {
        const options = {
            origin: { x: 0, y: 0, z: 0 },
            blockers: [{ center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 100, y: 100, z: 100 } }],
            bodyRadius: 2,
            safetyMargin: 1,
            maxAttempts: 5,
            ringSpacing: 4
        }

        expect(findFreeSpawnPosition({ ...options, blockers: [] })).toEqual(findFreeSpawnPosition({ ...options, blockers: [] }))
        expect(findFreeSpawnPosition(options)).toBeNull()
    })
})
