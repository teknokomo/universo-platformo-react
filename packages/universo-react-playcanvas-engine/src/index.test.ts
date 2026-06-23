import { describe, expect, it } from 'vitest'

import {
    Application,
    Entity,
    Color,
    NullGraphicsDevice,
    Scene,
    MAX_LOW_POLY_SPHERE_BANDS,
    MIN_LOW_POLY_SPHERE_BANDS,
    applySceneFog,
    createTranslucentStandardMaterial,
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

    it('creates translucent materials with bounded opacity', () => {
        const material = createTranslucentStandardMaterial({
            color: new Color(1, 1, 1),
            emissive: new Color(0.15, 0.85, 1),
            emissiveIntensity: 2.4,
            additive: true,
            opacity: 0.42
        })

        expect(material.opacity).toBe(0.42)
        expect(material.depthWrite).toBe(false)
        expect(material.blendType).not.toBe(0)
        expect(material.emissiveIntensity).toBe(2.4)
    })

    it('exports bounded low-poly sphere band limits', () => {
        expect(MIN_LOW_POLY_SPHERE_BANDS).toBe(3)
        expect(MAX_LOW_POLY_SPHERE_BANDS).toBe(16)
    })

    it('applies fog through PlayCanvas FogParams without assigning the getter-only scene.fog', () => {
        const canvas = {
            setAttribute: () => undefined,
            getAttribute: () => null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            style: {},
            width: 1,
            height: 1
        }
        const device = new NullGraphicsDevice(canvas)
        const scene = new Scene(device)

        applySceneFog(scene, {
            type: 'exp2',
            color: new Color(0.08, 0.1, 0.14),
            density: -0.5
        })

        expect(scene.fog.type).toBe('exp2')
        expect(scene.fog.color.r).toBeCloseTo(0.08)
        expect(scene.fog.color.g).toBeCloseTo(0.1)
        expect(scene.fog.color.b).toBeCloseTo(0.14)
        expect(scene.fog.density).toBe(0)
    })
})
