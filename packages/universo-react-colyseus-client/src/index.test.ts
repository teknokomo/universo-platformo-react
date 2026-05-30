import { describe, expect, it } from 'vitest'

import {
    Client,
    createMoveToObjectIntent,
    createMoveToPointIntent,
    createStopIntent,
    dropAcknowledgedPredictions,
    interpolateKeyedSnapshotVector3,
    interpolateSnapshotVector3,
    isDoubleClickActivation
} from './index'

describe('@universo-react/colyseus-client', () => {
    it('re-exports the Colyseus client SDK API', () => {
        expect(Client).toBeTypeOf('function')
    })

    it('creates typed movement intents', () => {
        expect(createMoveToPointIntent({ x: 1, y: 2, z: 3 }, 7)).toEqual({
            type: 'move_to_point',
            target: { x: 1, y: 2, z: 3 },
            seq: 7
        })
        expect(createStopIntent(8)).toEqual({ type: 'stop', seq: 8 })
    })

    it('rejects movement intents without a valid caller-owned sequence number', () => {
        expect(createMoveToObjectIntent('station', 9)).toEqual({ type: 'move_to_object', objectId: 'station', seq: 9 })
        expect(() => createMoveToPointIntent({ x: 1, y: 2, z: 3 }, 0)).toThrow(RangeError)
        expect(() => createStopIntent(2147483648)).toThrow(RangeError)
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

    it('interpolates keyed authoritative snapshots and drops acknowledged predictions', () => {
        const previous = new Map([['entity-1', { receivedAt: 0, state: { position: { x: 0, y: 0, z: 0 } } }]])
        const next = new Map([['entity-1', { receivedAt: 100, state: { position: { x: 10, y: 0, z: 0 } } }]])

        expect(interpolateKeyedSnapshotVector3(previous, next, 'entity-1', 50, (state) => state.position)).toEqual({ x: 5, y: 0, z: 0 })
        expect(dropAcknowledgedPredictions([{ seq: 1 }, { seq: 2 }, { seq: 3 }], 2)).toEqual([{ seq: 3 }])
    })

    it('detects double-click activation within a threshold', () => {
        expect(isDoubleClickActivation({ lastClickAt: 100, currentClickAt: 250 })).toBe(true)
        expect(isDoubleClickActivation({ lastClickAt: 100, currentClickAt: 600 })).toBe(false)
    })
})
