// ECS transform and math tuple types
export type Vec3 = readonly [number, number, number]
export type Quat = readonly [number, number, number, number]

export interface Transform {
    position: Vec3
    rotation: Quat
    scale?: Vec3
    velocity?: Vec3
}
