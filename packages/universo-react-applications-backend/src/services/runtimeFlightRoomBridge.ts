import { matchMaker } from '@universo-react/colyseus-server'

import { FIXED_TICK_SCENE_ROOM_NAME } from '../realtime/applicationsRealtimeRuntime'

export interface FlightStationTarget {
    id: string
    position: { x: number; y: number; z: number }
}

export interface FlightContext {
    position: { x: number; y: number; z: number }
    stations: FlightStationTarget[]
}

const DESCRIBE_SHIP_TIMEOUT_MS = 2_000

type DescribableFixedTickRoom = {
    describeShipForUser: (userId: string) => Promise<FlightContext | null>
}

/**
 * Server-side bridge between the economy REST routes and the authoritative
 * Colyseus flight state. The ship position never comes from the client: it is
 * read from the live room that owns the user's flight session. A missing or
 * disposed room yields null, which callers map to ECONOMY_NOT_AT_STATION.
 */
export async function describeFlightContext(applicationId: string, userId: string): Promise<FlightContext | null> {
    let rooms: Array<{ roomId: string; scopeId: string }>
    try {
        rooms = await queryFixedTickRoomsForApplication(applicationId)
    } catch {
        return null
    }

    for (const room of rooms) {
        try {
            const context = await matchMaker.remoteRoomCall<DescribableFixedTickRoom, 'describeShipForUser'>(
                room.roomId,
                'describeShipForUser',
                [userId],
                DESCRIBE_SHIP_TIMEOUT_MS
            )
            if (context) {
                return context
            }
        } catch {
            // Room disposed between the query and the call, or IPC timeout in a
            // multi-process setup — treat as "no session" and keep probing.
        }
    }

    return null
}

/** Enumerate live fixed-tick rooms belonging to one application (scopeId prefix match). */
export async function queryFixedTickRoomsForApplication(applicationId: string): Promise<Array<{ roomId: string; scopeId: string }>> {
    const rooms = await matchMaker.query({ name: FIXED_TICK_SCENE_ROOM_NAME })
    return rooms
        .map((room) => ({ roomId: String(room.roomId), scopeId: String(room.metadata?.scopeId ?? '') }))
        .filter((room) => room.scopeId.startsWith(`${applicationId}:`))
}
