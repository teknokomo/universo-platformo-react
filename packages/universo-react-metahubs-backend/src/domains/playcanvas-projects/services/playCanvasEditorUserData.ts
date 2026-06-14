import type { PlayCanvasEditorScenePayload } from '@universo-react/types'

type Vector3Tuple = [number, number, number]
const CAMERA_NAMES = ['perspective', 'top', 'bottom', 'front', 'back', 'left', 'right'] as const
const MAX_CAMERA_ABSOLUTE_VALUE = 1_000_000

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [9.2, 6, 9]
const DEFAULT_CAMERA_ROTATION: Vector3Tuple = [-25, 45, 0]
const DEFAULT_CAMERA_FOCUS: Vector3Tuple = [0, 0, 0]
const ORTHOGRAPHIC_CAMERAS = {
    top: { position: [0, 1000, 0], rotation: [-90, 0, 0] },
    bottom: { position: [0, -1000, 0], rotation: [90, 0, 0] },
    front: { position: [0, 0, 1000], rotation: [0, 0, 0] },
    back: { position: [0, 0, -1000], rotation: [0, 180, 0] },
    left: { position: [-1000, 0, 0], rotation: [0, -90, 0] },
    right: { position: [1000, 0, 0], rotation: [0, 90, 0] }
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readVector3 = (value: unknown, fallback: Vector3Tuple): Vector3Tuple => {
    if (Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))) {
        return [Number(value[0]), Number(value[1]), Number(value[2])]
    }
    return fallback
}

const isRenderable = (entity: PlayCanvasEditorScenePayload['entities'][number]): boolean => {
    const render = asRecord(asRecord(entity.components).render)
    return Object.keys(render).length > 0 && render.enabled !== false
}

const createFramingCamera = (entities: PlayCanvasEditorScenePayload['entities']): Record<string, unknown> => {
    const renderable = entities.filter(isRenderable)
    if (renderable.length === 0) {
        return {
            position: DEFAULT_CAMERA_POSITION,
            rotation: DEFAULT_CAMERA_ROTATION,
            focus: DEFAULT_CAMERA_FOCUS
        }
    }

    const min: Vector3Tuple = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
    const max: Vector3Tuple = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
    for (const entity of renderable) {
        const position = readVector3(entity.position, [0, 0, 0])
        const scale = readVector3(entity.scale, [1, 1, 1])
        for (let axis = 0; axis < 3; axis += 1) {
            const halfExtent = Math.max(Math.abs(scale[axis]) / 2, 0.5)
            min[axis] = Math.min(min[axis], position[axis] - halfExtent)
            max[axis] = Math.max(max[axis], position[axis] + halfExtent)
        }
    }

    const focus: Vector3Tuple = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
    const radius = Math.max(Math.hypot(max[0] - focus[0], max[1] - focus[1], max[2] - focus[2]), 4)
    const defaultDistance = Math.hypot(...DEFAULT_CAMERA_POSITION)
    const distance = radius * 2.75
    const position: Vector3Tuple = DEFAULT_CAMERA_POSITION.map(
        (component, axis) => focus[axis] + (component / defaultDistance) * distance
    ) as Vector3Tuple

    return {
        position,
        rotation: DEFAULT_CAMERA_ROTATION,
        focus
    }
}

export const createPlayCanvasEditorUserData = (payload: PlayCanvasEditorScenePayload | null | undefined): Record<string, unknown> => ({
    cameras: {
        perspective: createFramingCamera(payload?.entities ?? []),
        ...Object.fromEntries(
            Object.entries(ORTHOGRAPHIC_CAMERAS).map(([name, camera]) => [name, { ...camera, focus: DEFAULT_CAMERA_FOCUS, orthoHeight: 5 }])
        )
    }
})

const readBoundedVector3 = (value: unknown, path: string): Vector3Tuple => {
    if (
        !Array.isArray(value) ||
        value.length !== 3 ||
        !value.every((item) => Number.isFinite(item) && Math.abs(Number(item)) <= MAX_CAMERA_ABSOLUTE_VALUE)
    ) {
        throw new Error(`${path} must be a finite bounded vector3`)
    }
    return [Number(value[0]), Number(value[1]), Number(value[2])]
}

export const normalizePlayCanvasEditorUserData = (value: unknown): Record<string, unknown> => {
    const document = asRecord(value)
    if (Object.keys(document).some((key) => key !== 'cameras')) {
        throw new Error('PlayCanvas Editor user data supports only cameras')
    }
    const cameras = asRecord(document.cameras)
    if (Object.keys(cameras).some((name) => !CAMERA_NAMES.includes(name as (typeof CAMERA_NAMES)[number]))) {
        throw new Error('PlayCanvas Editor user data contains an unsupported camera')
    }
    return {
        cameras: Object.fromEntries(
            Object.entries(cameras).map(([name, rawCamera]) => {
                const camera = asRecord(rawCamera)
                if (Object.keys(camera).some((key) => !['position', 'rotation', 'focus', 'orthoHeight'].includes(key))) {
                    throw new Error(`PlayCanvas Editor user data camera ${name} contains an unsupported property`)
                }
                const orthoHeight = camera.orthoHeight
                if (
                    orthoHeight !== undefined &&
                    (!Number.isFinite(orthoHeight) || Number(orthoHeight) <= 0 || Number(orthoHeight) > MAX_CAMERA_ABSOLUTE_VALUE)
                ) {
                    throw new Error(`PlayCanvas Editor user data camera ${name} has an invalid orthoHeight`)
                }
                return [
                    name,
                    {
                        position: readBoundedVector3(camera.position, `cameras.${name}.position`),
                        rotation: readBoundedVector3(camera.rotation, `cameras.${name}.rotation`),
                        focus: readBoundedVector3(camera.focus, `cameras.${name}.focus`),
                        ...(orthoHeight === undefined ? {} : { orthoHeight: Number(orthoHeight) })
                    }
                ]
            })
        )
    }
}
