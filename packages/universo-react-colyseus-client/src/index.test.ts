import { describe, expect, it } from 'vitest'

import { Client, createMoveToPointIntent, createStopIntent, interpolateSnapshotVector3, isDoubleClickActivation } from './index'

describe('@universo-react/colyseus-client', () => {
    it('re-exports the Colyseus client SDK API', () => {
        expect(Client).toBeTypeOf('function')
    })

    it('creates typed movement intents', () => {
        expect(createMoveToPointIntent({ x: 1, y: 2, z: 3 })).toEqual({ type: 'move_to_point', target: { x: 1, y: 2, z: 3 } })
        expect(createStopIntent()).toEqual({ type: 'stop' })
    })

    it('interpolates authoritative snapshots', () => {
        const value = interpolateSnapshotVector3(
            { receivedAt: 0, state: { position: { x: 0, y: 0, z: 0 } } },
            { receivedAt: 100, state: { position: { x: 10, y: 0, z: 0 } } },
            50,
            (state) => state.position
        )

        expect(value).toEqual({ x: 5, y: 0, z: 0 })
    })

    it('detects double-click activation within a threshold', () => {
        expect(isDoubleClickActivation({ lastClickAt: 100, currentClickAt: 250 })).toBe(true)
        expect(isDoubleClickActivation({ lastClickAt: 100, currentClickAt: 600 })).toBe(false)
    })
})
