jest.mock('@universo-react/colyseus-server', () => {
    const actual = jest.requireActual('@universo-react/colyseus-server')
    return {
        ...actual,
        matchMaker: {
            ...actual.matchMaker,
            query: jest.fn(),
            remoteRoomCall: jest.fn()
        }
    }
})

import { matchMaker } from '@universo-react/colyseus-server'

import { describeFlightContext, queryFixedTickRoomsForApplication } from '../../services/runtimeFlightRoomBridge'

const mockedQuery = matchMaker.query as unknown as jest.Mock
const mockedRemoteRoomCall = matchMaker.remoteRoomCall as unknown as jest.Mock

const FLIGHT_CONTEXT = {
    position: { x: 10, y: 20, z: 30 },
    stations: [{ id: 'station-1', position: { x: 12, y: 20, z: 30 } }]
}

describe('runtimeFlightRoomBridge', () => {
    beforeEach(() => {
        mockedQuery.mockReset()
        mockedRemoteRoomCall.mockReset()
    })

    it('filters fixed-tick rooms by application scopeId prefix and workspace', async () => {
        mockedQuery.mockResolvedValue([
            { roomId: 'room-a', metadata: { scopeId: 'app-1:member:ws-1:default:w1:m', workspaceId: 'ws-1' } },
            { roomId: 'room-b', metadata: { scopeId: 'app-2:member:global:default:w2:m', workspaceId: null } },
            { roomId: 'room-c', metadata: {} }
        ])

        const rooms = await queryFixedTickRoomsForApplication('app-1', 'ws-1')

        expect(mockedQuery).toHaveBeenCalledWith({ name: 'fixed_tick_scene' })
        expect(rooms).toEqual([{ roomId: 'room-a', scopeId: 'app-1:member:ws-1:default:w1:m' }])
    })

    it('matches workspace-less rooms only for workspace-less requests', async () => {
        mockedQuery.mockResolvedValue([{ roomId: 'room-a', metadata: { scopeId: 'app-1:member:global:default:w1:m', workspaceId: null } }])

        const rooms = await queryFixedTickRoomsForApplication('app-1', null)
        expect(rooms).toEqual([{ roomId: 'room-a', scopeId: 'app-1:member:global:default:w1:m' }])

        const scoped = await queryFixedTickRoomsForApplication('app-1', 'ws-1')
        expect(scoped).toEqual([])
    })

    it('returns the first non-null flight context and probes rooms in order', async () => {
        mockedQuery.mockResolvedValue([
            { roomId: 'room-a', metadata: { scopeId: 'app-1:member', workspaceId: null } },
            { roomId: 'room-b', metadata: { scopeId: 'app-1:member', workspaceId: null } }
        ])
        mockedRemoteRoomCall.mockResolvedValueOnce(null).mockResolvedValueOnce(FLIGHT_CONTEXT)

        const context = await describeFlightContext('app-1', 'user-1', null)

        expect(context).toEqual(FLIGHT_CONTEXT)
        expect(mockedRemoteRoomCall).toHaveBeenCalledTimes(2)
        expect(mockedRemoteRoomCall.mock.calls[0]).toEqual(['room-a', 'describeShipForUser', ['user-1'], 2000])
        expect(mockedRemoteRoomCall.mock.calls[1][0]).toBe('room-b')
    })

    it('treats a disposed room as "no session" and keeps probing', async () => {
        mockedQuery.mockResolvedValue([
            { roomId: 'room-a', metadata: { scopeId: 'app-1:member', workspaceId: null } },
            { roomId: 'room-b', metadata: { scopeId: 'app-1:member', workspaceId: null } }
        ])
        mockedRemoteRoomCall.mockRejectedValueOnce(new Error('room disposed')).mockResolvedValueOnce(FLIGHT_CONTEXT)

        const context = await describeFlightContext('app-1', 'user-1', null)

        expect(context).toEqual(FLIGHT_CONTEXT)
    })

    it('returns null when no live room exists for the application', async () => {
        mockedQuery.mockResolvedValue([{ roomId: 'room-x', metadata: { scopeId: 'app-9:member' } }])

        const context = await describeFlightContext('app-1', 'user-1', null)

        expect(context).toBeNull()
        expect(mockedRemoteRoomCall).not.toHaveBeenCalled()
    })

    it('returns null when the matchmaker query itself fails', async () => {
        mockedQuery.mockRejectedValue(new Error('matchmaker down'))

        const context = await describeFlightContext('app-1', 'user-1', null)

        expect(context).toBeNull()
        expect(mockedRemoteRoomCall).not.toHaveBeenCalled()
    })

    it('returns null when the user has no ship in any room', async () => {
        mockedQuery.mockResolvedValue([{ roomId: 'room-a', metadata: { scopeId: 'app-1:member', workspaceId: null } }])
        mockedRemoteRoomCall.mockResolvedValue(null)

        const context = await describeFlightContext('app-1', 'user-1', null)

        expect(context).toBeNull()
    })

    it('never probes rooms from another workspace (cross-workspace trade gate)', async () => {
        // Greptile P1: a docked ship in one workspace must not enable trades in
        // another — the bridge only probes rooms of the requesting workspace.
        mockedQuery.mockResolvedValue([
            { roomId: 'room-other', metadata: { scopeId: 'app-1:member:ws-other:default:w1:m', workspaceId: 'ws-other' } }
        ])
        mockedRemoteRoomCall.mockResolvedValue(FLIGHT_CONTEXT)

        const context = await describeFlightContext('app-1', 'user-1', 'ws-1')

        expect(context).toBeNull()
        expect(mockedRemoteRoomCall).not.toHaveBeenCalled()
    })
})
