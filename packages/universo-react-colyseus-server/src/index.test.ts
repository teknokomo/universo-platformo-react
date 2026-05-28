import { describe, expect, it } from 'vitest'

import {
    Room,
    applyMoveToPointIntent,
    applyStopIntent,
    createStoppedMovementState,
    expandAabb,
    isPointInsideAabb,
    resolveSafeTargetOutsideGuards,
    stepFixedTickMovement
} from './index'

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
        expect(result.state.position).toEqual({ x: 0, y: 0, z: 0 })
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
        expect(result.state.position).toEqual({ x: 0, y: 0, z: 0 })
        expect(isPointInsideAabb({ x: 2.9, y: 0, z: 0 }, expandAabb(guard, { x: 2, y: 0.5, z: 0.5 }))).toBe(true)
        expect(expandAabb(guard, { x: 2, y: 0.5, z: 0.5 }).halfExtents.x).toBeGreaterThan(3)
        expect(expandAabb(guard, { x: 2, y: 0.5, z: 0.5 }).halfExtents.z).toBeGreaterThan(3)
    })

    it('resolves object movement targets to a safe standoff point outside guarded bodies', () => {
        const stationGuard = { center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }
        const safeTarget = resolveSafeTargetOutsideGuards({ x: 0, y: 0, z: 0 }, stationGuard.center, [stationGuard], { x: 6, y: 2, z: 2 })
        const expandedStationGuard = expandAabb(stationGuard, { x: 6, y: 2, z: 2 })

        expect(isPointInsideAabb(safeTarget, expandedStationGuard)).toBe(false)
        expect(safeTarget.x).toBeLessThan(stationGuard.center.x)
        expect(safeTarget.z).toBeGreaterThan(stationGuard.center.z)
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
        expect(result.state.position).toEqual({ x: 3, y: 0, z: 0 })
        expect(result.state.velocity).toEqual({ x: 0, y: 0, z: 0 })
        expect(result.state.speed).toBe(0)
        expect(result.state.target).toBeNull()
    })
})
