import { describe, expect, it } from 'vitest'

import {
    Application,
    Entity,
    createAabbFromCenterAndSize,
    resolveFollowCameraPosition,
    rotateFollowCamera,
    zoomFollowCamera
} from './index'

describe('@universo-react/playcanvas-engine', () => {
    it('re-exports the PlayCanvas engine API', () => {
        expect(Application).toBeTypeOf('function')
        expect(Entity).toBeTypeOf('function')
    })

    it('resolves a bounded follow-camera position', () => {
        const position = resolveFollowCameraPosition({
            target: { x: 0, y: 0, z: 0 },
            yaw: 0,
            pitch: 0,
            distance: 100,
            minDistance: 10,
            maxDistance: 30
        })

        expect(position).toEqual({ x: 0, y: 0, z: 30 })
        expect(zoomFollowCamera(20, -15, 10, 30)).toBe(10)
        expect(rotateFollowCamera(0, 0, 1, 10).pitch).toBeCloseTo(Math.PI / 3)
    })

    it('creates generic AABB metadata from center and size', () => {
        expect(createAabbFromCenterAndSize({ x: 4, y: 0, z: 0 }, { x: 12, y: 4, z: 4 })).toEqual({
            center: { x: 4, y: 0, z: 0 },
            halfExtents: { x: 6, y: 2, z: 2 }
        })
    })
})
