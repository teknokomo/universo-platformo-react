import * as pc from 'playcanvas'

export interface Vector3Like {
    x: number
    y: number
    z: number
}

export interface BoxEntityOptions {
    name: string
    position: Vector3Like
    scale: Vector3Like
    material?: pc.Material
}

export interface PrimitiveEntityOptions extends BoxEntityOptions {
    primitive?: 'box' | 'sphere'
}

export interface TranslucentMaterialOptions {
    color: pc.Color
    opacity?: number
    emissive?: pc.Color
    emissiveIntensity?: number
    additive?: boolean
}

export interface LowPolySphereEntityOptions extends BoxEntityOptions {
    latitudeBands?: number
    longitudeBands?: number
}

export const MIN_LOW_POLY_SPHERE_BANDS = 3
export const MAX_LOW_POLY_SPHERE_BANDS = 16

export interface FollowCameraOptions {
    target: Vector3Like
    yaw: number
    pitch: number
    distance: number
    minDistance: number
    maxDistance: number
}

export interface AabbLike {
    center: Vector3Like
    halfExtents: Vector3Like
}

export const createBasicApplication = (canvas: HTMLCanvasElement): pc.Application => {
    const app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        touch: new pc.TouchDevice(canvas),
        keyboard: new pc.Keyboard(window)
    })
    app.setCanvasFillMode(pc.FILLMODE_NONE)
    app.setCanvasResolution(pc.RESOLUTION_AUTO)
    return app
}

export const resizeApplicationCanvas = (app: pc.Application, width: number, height: number): void => {
    app.resizeCanvas(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)))
}

export const createStandardMaterial = (color: pc.Color): pc.StandardMaterial => {
    const material = new pc.StandardMaterial()
    material.diffuse = color
    material.update()
    return material
}

export const createTranslucentStandardMaterial = (options: TranslucentMaterialOptions): pc.StandardMaterial => {
    const material = new pc.StandardMaterial()
    material.diffuse = options.color
    if (options.emissive) {
        material.emissive = options.emissive
        material.emissiveIntensity = Math.max(0, options.emissiveIntensity ?? 1)
    }
    const opacity = Math.min(1, Math.max(0, options.opacity ?? 1))
    material.opacity = opacity
    if (opacity < 1) {
        material.blendType = options.additive ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL
        material.depthWrite = false
    }
    material.update()
    return material
}

export const createPrimitiveEntity = (options: PrimitiveEntityOptions): pc.Entity => {
    const entity = new pc.Entity(options.name)
    entity.addComponent('render', {
        type: options.primitive ?? 'box',
        material: options.material
    })
    entity.setLocalPosition(options.position.x, options.position.y, options.position.z)
    entity.setLocalScale(options.scale.x, options.scale.y, options.scale.z)
    return entity
}

export const createBoxEntity = (options: BoxEntityOptions): pc.Entity => {
    return createPrimitiveEntity({ ...options, primitive: 'box' })
}

export const createLowPolySphereEntity = (app: pc.Application, options: LowPolySphereEntityOptions): pc.Entity => {
    const clampBands = (value: number | undefined): number =>
        Math.min(MAX_LOW_POLY_SPHERE_BANDS, Math.max(MIN_LOW_POLY_SPHERE_BANDS, Math.floor(value ?? 8)))
    const geometry = new pc.SphereGeometry({
        radius: 0.5,
        latitudeBands: clampBands(options.latitudeBands),
        longitudeBands: clampBands(options.longitudeBands)
    })
    const material = options.material ?? createStandardMaterial(new pc.Color(1, 1, 1))
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry)
    const meshInstance = new pc.MeshInstance(mesh, material)
    const entity = new pc.Entity(options.name)
    entity.addComponent('render')
    if (entity.render) {
        entity.render.meshInstances = [meshInstance]
    }
    entity.setLocalPosition(options.position.x, options.position.y, options.position.z)
    entity.setLocalScale(options.scale.x, options.scale.y, options.scale.z)
    return entity
}

export const applySceneFog = (
    scene: pc.Scene,
    options: { type?: 'none' | 'linear' | 'exp' | 'exp2'; color?: pc.Color; density?: number }
): void => {
    scene.fog.type = options.type ?? 'none'
    if (options.color) {
        scene.fog.color = options.color
    }
    if (Number.isFinite(options.density)) {
        scene.fog.density = Math.max(0, Number(options.density))
    }
}

export const resolveFollowCameraPosition = (options: FollowCameraOptions): Vector3Like => {
    const distance = Math.min(options.maxDistance, Math.max(options.minDistance, options.distance))
    const pitch = Math.min(Math.PI / 2 - 0.01, Math.max(-Math.PI / 2 + 0.01, options.pitch))
    const horizontal = Math.cos(pitch) * distance

    return {
        x: options.target.x + Math.sin(options.yaw) * horizontal,
        y: options.target.y + Math.sin(pitch) * distance,
        z: options.target.z + Math.cos(options.yaw) * horizontal
    }
}

export const applyFollowCameraTransform = (camera: pc.Entity, options: FollowCameraOptions): void => {
    const position = resolveFollowCameraPosition(options)
    camera.setPosition(position.x, position.y, position.z)
    camera.lookAt(options.target.x, options.target.y, options.target.z)
}

export const zoomFollowCamera = (distance: number, delta: number, minDistance: number, maxDistance: number): number =>
    Math.min(maxDistance, Math.max(minDistance, distance + delta))

export const rotateFollowCamera = (
    yaw: number,
    pitch: number,
    deltaYaw: number,
    deltaPitch: number,
    minPitch = -Math.PI / 3,
    maxPitch = Math.PI / 3
): { yaw: number; pitch: number } => ({
    yaw: yaw + deltaYaw,
    pitch: Math.min(maxPitch, Math.max(minPitch, pitch + deltaPitch))
})

export const createAabbFromCenterAndSize = (center: Vector3Like, size: Vector3Like): AabbLike => ({
    center: { x: center.x, y: center.y, z: center.z },
    halfExtents: { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
})

export const isPointInsideAabb = (point: Vector3Like, box: AabbLike): boolean =>
    Math.abs(point.x - box.center.x) <= box.halfExtents.x &&
    Math.abs(point.y - box.center.y) <= box.halfExtents.y &&
    Math.abs(point.z - box.center.z) <= box.halfExtents.z
