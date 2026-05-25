import type { UpIntentKind } from '../common/enums'
import type { EventPacket } from './events'
import type { EntityId } from '../common/branding'
import type { ComponentSnapshotMap } from '../ecs/components'

export interface BaseIntent<TType extends UpIntentKind = UpIntentKind, TPayload = unknown> {
    seq: number
    clientTimeMs: number
    type: TType
    payload: TPayload
}

export interface Ack {
    seq: number
    serverTimeMs: number
}

export interface Snapshot {
    tick: number
    serverTimeMs: number
    entities: Readonly<Record<EntityId, Partial<ComponentSnapshotMap>>>
    events?: readonly EventPacket[]
}

export interface DeltaEntityUpdate {
    entityId: EntityId
    components?: Partial<ComponentSnapshotMap>
    removedComponents?: readonly (keyof ComponentSnapshotMap)[]
}

export interface Delta {
    tick: number
    baseTick: number
    added?: readonly DeltaEntityUpdate[]
    updated?: readonly DeltaEntityUpdate[]
    removed?: readonly EntityId[]
}
