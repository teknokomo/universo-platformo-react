// Networking event types and payload contracts
export interface EventPayloads {
    'system.join': { playerId: string; worldId: string }
    'system.leave': { playerId: string; reason?: string }
    'combat.hit': { attacker: string; target: string; amount: number; damageType?: string }
    'economy.transfer': { from: string; to: string; currency: string; amount: number; ref?: string }
}

export type UpEventType = keyof EventPayloads

export type EventPacket = {
    [K in UpEventType]: {
        type: K
        tServerMs: number
        payload: EventPayloads[K]
    }
}[UpEventType]
