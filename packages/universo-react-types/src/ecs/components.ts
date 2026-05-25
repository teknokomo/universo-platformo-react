import type { Transform } from './transform'

export interface Health {
    current: number
    max: number
}

export interface Visual {
    model?: string
    tint?: readonly [number, number, number]
}

export type ComponentSnapshotMap = { readonly transform?: Transform; readonly visual?: Visual; readonly health?: Health }
