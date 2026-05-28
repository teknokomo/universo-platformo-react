import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import RotateLeftRoundedIcon from '@mui/icons-material/RotateLeftRounded'
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded'
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded'
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded'
import * as pc from '@universo-react/playcanvas-engine'
import {
    applyFollowCameraTransform,
    createBasicApplication,
    createBoxEntity,
    createStandardMaterial,
    resizeApplicationCanvas,
    rotateFollowCamera,
    zoomFollowCamera,
    type Vector3Like
} from '@universo-react/playcanvas-engine'
import {
    Client,
    createMoveToObjectIntent,
    createMoveToPointIntent,
    createStopIntent,
    lerpVector3,
    type Room
} from '@universo-react/colyseus-client'
import { playcanvasCanvasWidgetConfigSchema, readLocalizedTextValue } from '@universo-react/types'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { executeClientModuleMethod } from '../runtime/browserModuleRuntime'
import { createClientModuleContext, isClientModuleMethodTarget, useRuntimeWidgetClientModule } from './runtimeWidgetHelpers'

interface SceneObjectConfig {
    id: string
    position: Vector3Like
    scale: Vector3Like
    selectable?: boolean
    guard?: boolean
}

interface RuntimeModuleMountModel {
    scene?: {
        objects?: SceneObjectConfig[]
        controlledObjectId?: string
        targetObjectId?: string
    }
}

interface PlayCanvasCanvasWidgetProps {
    widgetId?: string
    config?: Record<string, unknown>
}

interface FixedTickSceneState {
    ship?: {
        position?: Vector3Like
    }
}

type RealtimeStatus =
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'restored'
    | 'failed_reconnect'
    | 'disconnected'
    | 'unauthorized'
    | 'unavailable'
    | 'room_full'
    | 'version_mismatch'

type PlayCanvasControlCanvas = HTMLCanvasElement & {
    __playcanvasMoveToTarget?: (target: Vector3Like | null, objectId?: string) => void
    __playcanvasPickAt?: (clientX: number, clientY: number, includeFlightPlane: boolean) => CanvasPickResult | null
}

interface CanvasPickResult {
    point: Vector3Like
    objectId?: string
}

interface AabbLike {
    center: Vector3Like
    halfExtents: Vector3Like
}

const DEFAULT_SCENE_OBJECTS: SceneObjectConfig[] = [
    { id: 'controlled', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 }, selectable: true },
    { id: 'target', position: { x: 72, y: 0, z: -48 }, scale: { x: 48, y: 16, z: 16 }, selectable: true, guard: true }
]

const DEFAULT_CAMERA = {
    yaw: -1,
    pitch: 0.25,
    distance: 120,
    minDistance: 18,
    maxDistance: 220
}
const DEFAULT_INTENT_DISTANCE = 720
const DEFAULT_GUARD_CLEARANCE = 8
const DEFAULT_TURN_RESPONSE = 3

const isFiniteVector3 = (value: unknown): value is Vector3Like => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const candidate = value as Partial<Vector3Like>
    return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)
}

const normalizeSceneObject = (value: unknown): SceneObjectConfig | null => {
    if (!value || typeof value !== 'object') {
        return null
    }
    const candidate = value as Partial<SceneObjectConfig>
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
        return null
    }
    if (!isFiniteVector3(candidate.position) || !isFiniteVector3(candidate.scale)) {
        return null
    }
    return {
        id: candidate.id.trim().slice(0, 128),
        position: { x: candidate.position.x, y: candidate.position.y, z: candidate.position.z },
        scale: { x: candidate.scale.x, y: candidate.scale.y, z: candidate.scale.z },
        selectable: candidate.selectable === true,
        guard: candidate.guard === true
    }
}

const normalizeRuntimeModuleMountModel = (value: unknown): RuntimeModuleMountModel => {
    if (!value || typeof value !== 'object') {
        return {}
    }
    const scene = (value as { scene?: unknown }).scene
    if (!scene || typeof scene !== 'object') {
        return {}
    }
    const sceneRecord = scene as { objects?: unknown; controlledObjectId?: unknown; targetObjectId?: unknown }
    const objects = Array.isArray(sceneRecord.objects)
        ? sceneRecord.objects
              .map(normalizeSceneObject)
              .filter((object): object is SceneObjectConfig => Boolean(object))
              .slice(0, 64)
        : undefined
    return {
        scene: {
            objects: objects?.length ? objects : undefined,
            controlledObjectId:
                typeof sceneRecord.controlledObjectId === 'string' ? sceneRecord.controlledObjectId.slice(0, 128) : undefined,
            targetObjectId: typeof sceneRecord.targetObjectId === 'string' ? sceneRecord.targetObjectId.slice(0, 128) : undefined
        }
    }
}

const readAuthoritativePosition = (state: FixedTickSceneState | undefined): Vector3Like | null => {
    const position = state?.ship?.position
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
        return null
    }
    return { x: position.x, y: position.y, z: position.z }
}

const moveTowards = (current: Vector3Like, target: Vector3Like, maxDistance: number): Vector3Like => {
    const delta = {
        x: target.x - current.x,
        y: target.y - current.y,
        z: target.z - current.z
    }
    const distance = Math.hypot(delta.x, delta.y, delta.z)
    if (distance <= maxDistance || distance <= 0.000001) {
        return { ...target }
    }

    const ratio = maxDistance / distance
    return {
        x: current.x + delta.x * ratio,
        y: current.y + delta.y * ratio,
        z: current.z + delta.z * ratio
    }
}

const createHalfExtents = (scale: Vector3Like): Vector3Like => ({
    x: Math.abs(scale.x) / 2,
    y: Math.abs(scale.y) / 2,
    z: Math.abs(scale.z) / 2
})

const vectorLength = (value: Vector3Like): number => Math.hypot(value.x, value.y, value.z)

const vectorBoundingRadius = (value: Vector3Like): number =>
    Math.hypot(Math.max(0, Math.abs(value.x)), Math.max(0, Math.abs(value.y)), Math.max(0, Math.abs(value.z)))

const expandAabb = (box: AabbLike, halfExtents: Vector3Like): AabbLike => ({
    center: box.center,
    halfExtents: {
        x: box.halfExtents.x + vectorBoundingRadius(halfExtents),
        y: box.halfExtents.y + vectorBoundingRadius(halfExtents),
        z: box.halfExtents.z + vectorBoundingRadius(halfExtents)
    }
})

const isPointInsideAabb = (point: Vector3Like, box: AabbLike): boolean =>
    Math.abs(point.x - box.center.x) <= box.halfExtents.x &&
    Math.abs(point.y - box.center.y) <= box.halfExtents.y &&
    Math.abs(point.z - box.center.z) <= box.halfExtents.z

const segmentIntersectsAabb = (from: Vector3Like, to: Vector3Like, box: AabbLike): boolean => {
    let tMin = 0
    let tMax = 1

    for (const axis of ['x', 'y', 'z'] as const) {
        const start = from[axis]
        const delta = to[axis] - start
        const min = box.center[axis] - box.halfExtents[axis]
        const max = box.center[axis] + box.halfExtents[axis]

        if (Math.abs(delta) < 0.000001) {
            if (start < min || start > max) {
                return false
            }
            continue
        }

        const inverse = 1 / delta
        const first = (min - start) * inverse
        const second = (max - start) * inverse
        tMin = Math.max(tMin, Math.min(first, second))
        tMax = Math.min(tMax, Math.max(first, second))
        if (tMin > tMax) {
            return false
        }
    }

    return true
}

const isBlockedByGuard = (from: Vector3Like, to: Vector3Like, guards: readonly AabbLike[]): boolean =>
    guards.some((guard) => segmentIntersectsAabb(from, to, guard) || isPointInsideAabb(to, guard))

const distanceToAabbSurface = (point: Vector3Like, box: AabbLike): number => {
    const dx = Math.max(Math.abs(point.x - box.center.x) - box.halfExtents.x, 0)
    const dy = Math.max(Math.abs(point.y - box.center.y) - box.halfExtents.y, 0)
    const dz = Math.max(Math.abs(point.z - box.center.z) - box.halfExtents.z, 0)
    if (dx > 0 || dy > 0 || dz > 0) {
        return Math.hypot(dx, dy, dz)
    }

    return -Math.min(
        box.halfExtents.x - Math.abs(point.x - box.center.x),
        box.halfExtents.y - Math.abs(point.y - box.center.y),
        box.halfExtents.z - Math.abs(point.z - box.center.z)
    )
}

const resolveSafeTargetOutsideGuards = (
    from: Vector3Like,
    target: Vector3Like,
    guards: readonly AabbLike[],
    clearance = DEFAULT_GUARD_CLEARANCE
): Vector3Like => {
    if (!guards.length) {
        return { ...target }
    }

    const direction = normalizeVector({ x: target.x - from.x, y: target.y - from.y, z: target.z - from.z })
    let resolved = { ...target }

    for (const guard of guards) {
        if (!segmentIntersectsAabb(from, resolved, guard) && !isPointInsideAabb(resolved, guard)) {
            continue
        }

        let bestDistance = Infinity
        for (const axis of ['x', 'y', 'z'] as const) {
            const component = direction[axis]
            if (Math.abs(component) < 0.000001) {
                continue
            }
            const face = guard.center[axis] + (component > 0 ? -guard.halfExtents[axis] : guard.halfExtents[axis])
            const distance = (face - from[axis]) / component
            if (distance >= 0 && distance < bestDistance) {
                bestDistance = distance
            }
        }

        if (Number.isFinite(bestDistance)) {
            resolved = moveTowards(from, target, Math.max(0, bestDistance - clearance))
        }
    }

    return resolved
}

const normalizeVector = (value: Vector3Like): Vector3Like => {
    const length = vectorLength(value)
    if (length <= 0.000001) {
        return { x: 1, y: 0, z: 0 }
    }
    return { x: value.x / length, y: value.y / length, z: value.z / length }
}

const smoothVector = (current: Vector3Like, desired: Vector3Like, alpha: number): Vector3Like => {
    const safeAlpha = Math.min(1, Math.max(0, alpha))
    const dot = Math.max(-1, Math.min(1, current.x * desired.x + current.y * desired.y + current.z * desired.z))
    if (dot > 0.999) {
        return desired
    }

    if (dot < -0.999) {
        const axis = Math.abs(current.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
        const orthogonal = normalizeVector({
            x: current.y * axis.z - current.z * axis.y,
            y: current.z * axis.x - current.x * axis.z,
            z: current.x * axis.y - current.y * axis.x
        })
        const angle = Math.PI * safeAlpha
        return normalizeVector({
            x: current.x * Math.cos(angle) + orthogonal.x * Math.sin(angle),
            y: current.y * Math.cos(angle) + orthogonal.y * Math.sin(angle),
            z: current.z * Math.cos(angle) + orthogonal.z * Math.sin(angle)
        })
    }

    const theta = Math.acos(dot)
    const sinTheta = Math.sin(theta)
    const currentScale = Math.sin((1 - safeAlpha) * theta) / sinTheta
    const desiredScale = Math.sin(safeAlpha * theta) / sinTheta
    return normalizeVector({
        x: current.x * currentScale + desired.x * desiredScale,
        y: current.y * currentScale + desired.y * desiredScale,
        z: current.z * currentScale + desired.z * desiredScale
    })
}

const resolveRealtimeEndpoint = (apiBaseUrl: string) => {
    if (typeof window === 'undefined') {
        return 'ws://127.0.0.1:2567'
    }

    const runtimeApiUrl = new URL(apiBaseUrl.trim() || '/api/v1', window.location.origin)
    const protocol = runtimeApiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${runtimeApiUrl.host}`
}

const resolveRuntimeAccessMode = (configuredMode: 'member' | 'public' | undefined): 'member' | 'public' => {
    if (configuredMode) {
        return configuredMode
    }
    if (typeof window !== 'undefined' && /^\/public\/a\//.test(window.location.pathname)) {
        return 'public'
    }
    return 'member'
}

const buildRuntimeApiUrl = (apiBaseUrl: string, path: string): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`
    return /^https?:\/\//i.test(normalizedBase) ? new URL(apiPath).toString() : new URL(apiPath, window.location.origin).toString()
}

const resolveCsrfToken = async (apiBaseUrl: string): Promise<string> => {
    const response = await fetch(buildRuntimeApiUrl(apiBaseUrl, '/auth/csrf'), { credentials: 'include' })
    if (!response.ok) {
        throw new Error('CSRF token request failed')
    }

    const payload = (await response.json()) as { csrfToken?: unknown }
    if (typeof payload.csrfToken !== 'string' || payload.csrfToken.trim().length === 0) {
        throw new Error('CSRF token response is invalid')
    }
    return payload.csrfToken
}

export default function PlayCanvasCanvasWidget({ widgetId, config }: PlayCanvasCanvasWidgetProps) {
    const { t, i18n } = useTranslation('apps')
    const details = useDashboardDetails()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const dragRef = useRef<{ x: number; y: number } | null>(null)
    const capturedPointerIdRef = useRef<number | null>(null)
    const draggedRef = useRef(false)
    const [error, setError] = useState<string | null>(null)
    const [ready, setReady] = useState(false)
    const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
    const [measuredCanvasHeight, setMeasuredCanvasHeight] = useState<number | null>(null)
    const loadFailedMessageRef = useRef(t('playcanvasCanvas.loadFailed', 'The 3D scene could not be loaded.'))
    loadFailedMessageRef.current = t('playcanvasCanvas.loadFailed', 'The 3D scene could not be loaded.')

    const parsed = useMemo(() => playcanvasCanvasWidgetConfigSchema.safeParse(config ?? {}), [config])
    const widgetConfig = parsed.success ? parsed.data : undefined
    const moduleCodename = typeof widgetConfig?.moduleCodename === 'string' ? widgetConfig.moduleCodename : null
    const mountMethodName = widgetConfig?.mountMethodName?.trim() || 'mount'
    const queryKeyPrefix = Array.isArray(details?.runtimeQueryKeyPrefix) ? details.runtimeQueryKeyPrefix.join(':') : 'runtime'
    const applicationId = details?.applicationId
    const objectCollectionId = details?.objectCollectionId
    const currentWorkspaceId = details?.currentWorkspaceId ?? null
    const runtimeAccessMode = resolveRuntimeAccessMode(details?.runtimeAccessMode)
    const canControlScene = runtimeAccessMode === 'member' && details?.permissions?.editContent === true
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'

    const runtimeClientModule = useRuntimeWidgetClientModule({
        queryKeyPrefix,
        apiBaseUrl,
        applicationId,
        objectCollectionId,
        moduleCodename,
        attachedToKind: widgetConfig?.attachedToKind ?? 'metahub'
    })

    const selectedModule = runtimeClientModule.selectedModule
    const clientBundle = runtimeClientModule.clientBundle
    const runtimeModuleHasMountMethod = selectedModule
        ? selectedModule.manifest.methods.some(
              (method) => method.name === mountMethodName && isClientModuleMethodTarget(method.target) && !method.eventName
          )
        : !moduleCodename
    const runtimeModuleMountQuery = useQuery({
        queryKey: [queryKeyPrefix, 'playcanvas-module-mount', applicationId, selectedModule?.id, mountMethodName, i18n.language],
        enabled: Boolean(applicationId && selectedModule && clientBundle && runtimeModuleHasMountMethod),
        queryFn: async () => {
            if (!applicationId || !selectedModule || !clientBundle) {
                return null
            }
            return await executeClientModuleMethod({
                bundle: clientBundle,
                methodName: mountMethodName,
                args: [{ locale: i18n.language, scene: widgetConfig?.scene ?? null }],
                context: createClientModuleContext({ apiBaseUrl, applicationId, module: selectedModule })
            })
        }
    })
    const runtimeModuleMount = useMemo(() => normalizeRuntimeModuleMountModel(runtimeModuleMountQuery.data), [runtimeModuleMountQuery.data])
    const title = readLocalizedTextValue(widgetConfig?.title, details?.locale ?? 'en') ?? t('playcanvasCanvas.title', '3D scene')
    const sceneObjects = useMemo(
        () =>
            runtimeModuleMount.scene?.objects?.length
                ? runtimeModuleMount.scene.objects
                : widgetConfig?.scene?.objects?.length
                ? widgetConfig.scene.objects
                : DEFAULT_SCENE_OBJECTS,
        [runtimeModuleMount.scene?.objects, widgetConfig?.scene?.objects]
    )
    const controlledObjectId =
        runtimeModuleMount.scene?.controlledObjectId ?? widgetConfig?.scene?.controlledObjectId ?? sceneObjects[0]?.id ?? 'controlled'
    const targetObjectId =
        runtimeModuleMount.scene?.targetObjectId ??
        widgetConfig?.scene?.targetObjectId ??
        sceneObjects.find((item) => item.id !== controlledObjectId)?.id
    const minHeight = widgetConfig?.minHeight ?? 520
    const canvasHeight =
        widgetConfig?.heightMode === 'fitViewport'
            ? measuredCanvasHeight ?? {
                  xs: `clamp(320px, calc(100dvh - 220px), 1200px)`,
                  md: `clamp(${minHeight}px, calc(100dvh - 180px), 1200px)`
              }
            : minHeight
    const runtimeModuleDiscoveryPending = Boolean(applicationId && runtimeClientModule.modulesQuery.isLoading)
    const requiresRuntimeModule = Boolean(applicationId && (moduleCodename || selectedModule || runtimeModuleDiscoveryPending))
    const runtimeModuleLoading =
        requiresRuntimeModule &&
        (runtimeClientModule.modulesQuery.isLoading ||
            runtimeClientModule.clientBundleQuery.isLoading ||
            (runtimeModuleHasMountMethod && runtimeModuleMountQuery.isLoading))
    const runtimeModuleError =
        requiresRuntimeModule &&
        (runtimeClientModule.modulesQuery.isError || runtimeClientModule.clientBundleQuery.isError || runtimeModuleMountQuery.isError)
    const runtimeModuleMissing =
        requiresRuntimeModule &&
        !runtimeModuleLoading &&
        !runtimeModuleError &&
        (!selectedModule || !clientBundle || !runtimeModuleHasMountMethod)
    const runtimeModuleReady =
        !requiresRuntimeModule ||
        (!runtimeModuleLoading && !runtimeModuleError && !runtimeModuleMissing && runtimeModuleMountQuery.isSuccess)

    useEffect(() => {
        if (widgetConfig?.heightMode !== 'fitViewport' || !runtimeModuleReady) {
            setMeasuredCanvasHeight(null)
            return undefined
        }

        const updateMeasuredHeight = () => {
            const container = containerRef.current
            if (!container) {
                return
            }
            const rect = container.getBoundingClientRect()
            const viewportHeight = window.visualViewport?.height ?? window.innerHeight
            const viewportWidth = window.visualViewport?.width ?? window.innerWidth
            const minimumHeight = viewportWidth < 600 ? 320 : minHeight
            const bottomGap = viewportWidth < 600 ? 20 : 24
            const nextHeight = Math.floor(Math.min(1200, Math.max(minimumHeight, viewportHeight - rect.top - bottomGap)))
            setMeasuredCanvasHeight((current) => (current === nextHeight ? current : nextHeight))
        }

        updateMeasuredHeight()
        window.addEventListener('resize', updateMeasuredHeight)
        window.visualViewport?.addEventListener('resize', updateMeasuredHeight)
        const observer = new ResizeObserver(updateMeasuredHeight)
        const container = containerRef.current
        if (container) {
            observer.observe(container)
        }
        return () => {
            window.removeEventListener('resize', updateMeasuredHeight)
            window.visualViewport?.removeEventListener('resize', updateMeasuredHeight)
            observer.disconnect()
        }
    }, [minHeight, runtimeModuleReady, widgetConfig?.heightMode])

    useEffect(() => {
        if (!runtimeModuleReady) {
            setError(null)
            setReady(false)
            setRealtimeStatus('connecting')
            return undefined
        }

        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) {
            return undefined
        }

        let disposed = false
        let app: pc.Application | null = null
        let room: Room<unknown, FixedTickSceneState> | null = null
        const entities = new Map<string, pc.Entity>()
        const authoritativePositionRef = { current: null as Vector3Like | null }
        const predictedTargetRef = { current: null as Vector3Like | null }
        const authoritativeUpdateCountRef = { current: 0 }
        const lastControlledPositionRef = { current: null as Vector3Like | null }
        const shipForwardRef = { current: { x: 1, y: 0, z: 0 } as Vector3Like }
        const desiredShipForwardRef = { current: { x: 1, y: 0, z: 0 } as Vector3Like }
        const cameraState = {
            ...DEFAULT_CAMERA,
            distance: widgetConfig?.camera?.distance ?? DEFAULT_CAMERA.distance,
            minDistance: widgetConfig?.camera?.minDistance ?? DEFAULT_CAMERA.minDistance,
            maxDistance: widgetConfig?.camera?.maxDistance ?? DEFAULT_CAMERA.maxDistance
        }
        const controlledSceneObject = sceneObjects.find((object) => object.id === controlledObjectId)
        const controlledHalfExtents = controlledSceneObject ? createHalfExtents(controlledSceneObject.scale) : { x: 0, y: 0, z: 0 }
        const expandedGuardBoxes = sceneObjects
            .filter((object) => object.guard === true && object.id !== controlledObjectId)
            .map((object) =>
                expandAabb(
                    {
                        center: object.position,
                        halfExtents: createHalfExtents(object.scale)
                    },
                    controlledHalfExtents
                )
            )

        try {
            setError(null)
            app = createBasicApplication(canvas)
            app.scene.ambientLight = new pc.Color(0.25, 0.25, 0.25)

            const light = new pc.Entity('main-light')
            light.addComponent('light', { type: 'directional', intensity: 1.5 })
            light.setEulerAngles(45, 45, 0)
            app.root.addChild(light)

            const camera = new pc.Entity('follow-camera')
            camera.addComponent('camera', { clearColor: new pc.Color(0.02, 0.025, 0.035) })
            app.root.addChild(camera)

            const material = createStandardMaterial(new pc.Color(1, 1, 1))
            for (const object of sceneObjects) {
                const entity = createBoxEntity({
                    name: object.id,
                    position: object.position,
                    scale: object.scale,
                    material
                })
                entities.set(object.id, entity)
                app.root.addChild(entity)
            }

            const controlled = entities.get(controlledObjectId)
            if (!controlled) {
                throw new Error('Controlled scene object is missing')
            }
            lastControlledPositionRef.current = {
                x: controlled.getPosition().x,
                y: controlled.getPosition().y,
                z: controlled.getPosition().z
            }

            const observer = new ResizeObserver(([entry]) => {
                if (!app || disposed) return
                resizeApplicationCanvas(app, entry.contentRect.width, entry.contentRect.height)
            })
            observer.observe(container)

            const handleCameraControl = (event: Event) => {
                const detail = (event as CustomEvent<string>).detail
                if (detail === 'zoomIn') {
                    cameraState.distance = zoomFollowCamera(cameraState.distance, -12, cameraState.minDistance, cameraState.maxDistance)
                } else if (detail === 'zoomOut') {
                    cameraState.distance = zoomFollowCamera(cameraState.distance, 12, cameraState.minDistance, cameraState.maxDistance)
                } else if (detail === 'rotateLeft') {
                    cameraState.yaw = rotateFollowCamera(cameraState.yaw, cameraState.pitch, -0.25, 0).yaw
                } else if (detail === 'rotateRight') {
                    cameraState.yaw = rotateFollowCamera(cameraState.yaw, cameraState.pitch, 0.25, 0).yaw
                } else if (detail === 'reset') {
                    cameraState.yaw = DEFAULT_CAMERA.yaw
                    cameraState.pitch = DEFAULT_CAMERA.pitch
                    cameraState.distance = widgetConfig?.camera?.distance ?? DEFAULT_CAMERA.distance
                }
            }
            const handleCameraDrag = (event: Event) => {
                const detail = (event as CustomEvent<{ deltaX?: number; deltaY?: number }>).detail ?? {}
                const next = rotateFollowCamera(
                    cameraState.yaw,
                    cameraState.pitch,
                    (detail.deltaX ?? 0) * 0.005,
                    (detail.deltaY ?? 0) * 0.005
                )
                cameraState.yaw = next.yaw
                cameraState.pitch = next.pitch
            }
            canvas.addEventListener('playcanvas-camera-control', handleCameraControl)
            canvas.addEventListener('playcanvas-camera-drag', handleCameraDrag)

            const resolveCanvasRay = (clientX: number, clientY: number) => {
                const cameraComponent = camera.camera
                if (!cameraComponent) {
                    return null
                }
                const rect = canvas.getBoundingClientRect()
                if (rect.width <= 0 || rect.height <= 0) {
                    return null
                }
                const screenX = ((clientX - rect.left) / rect.width) * canvas.width
                const screenY = ((clientY - rect.top) / rect.height) * canvas.height
                const near = cameraComponent.screenToWorld(screenX, screenY, cameraComponent.nearClip)
                const far = cameraComponent.screenToWorld(screenX, screenY, cameraComponent.farClip)
                const direction = far.clone().sub(near).normalize()
                return { origin: near, direction }
            }

            const intersectAabb = (origin: pc.Vec3, direction: pc.Vec3, center: Vector3Like, halfExtents: Vector3Like): number | null => {
                let nearT = -Infinity
                let farT = Infinity
                const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z']

                for (const axis of axes) {
                    const originValue = origin[axis]
                    const directionValue = direction[axis]
                    const min = center[axis] - halfExtents[axis]
                    const max = center[axis] + halfExtents[axis]

                    if (Math.abs(directionValue) < 0.000001) {
                        if (originValue < min || originValue > max) {
                            return null
                        }
                        continue
                    }

                    const first = (min - originValue) / directionValue
                    const second = (max - originValue) / directionValue
                    const axisNear = Math.min(first, second)
                    const axisFar = Math.max(first, second)
                    nearT = Math.max(nearT, axisNear)
                    farT = Math.min(farT, axisFar)

                    if (nearT > farT) {
                        return null
                    }
                }

                return farT >= 0 ? Math.max(0, nearT) : null
            }

            const updateDesiredOrientation = (from: Vector3Like, to: Vector3Like) => {
                const movement = {
                    x: to.x - from.x,
                    y: to.y - from.y,
                    z: to.z - from.z
                }
                if (vectorLength(movement) <= 0.001) {
                    return
                }

                desiredShipForwardRef.current = normalizeVector(movement)
                canvas.dataset.shipDesiredForwardX = desiredShipForwardRef.current.x.toFixed(4)
                canvas.dataset.shipDesiredForwardY = desiredShipForwardRef.current.y.toFixed(4)
                canvas.dataset.shipDesiredForwardZ = desiredShipForwardRef.current.z.toFixed(4)
            }

            const applyControlledOrientation = (entity: pc.Entity, dt: number) => {
                const desired = desiredShipForwardRef.current
                const currentForward = shipForwardRef.current
                const alignment = Math.max(
                    -1,
                    Math.min(1, currentForward.x * desired.x + currentForward.y * desired.y + currentForward.z * desired.z)
                )
                const alpha = Math.min(1, Math.max(0.02, dt * DEFAULT_TURN_RESPONSE))
                const forward = alignment > 0.999 ? desired : smoothVector(currentForward, desired, alpha)
                shipForwardRef.current = forward
                entity.setRotation(new pc.Quat().setFromDirections(new pc.Vec3(1, 0, 0), new pc.Vec3(forward.x, forward.y, forward.z)))
                canvas.dataset.shipForwardX = forward.x.toFixed(4)
                canvas.dataset.shipForwardY = forward.y.toFixed(4)
                canvas.dataset.shipForwardZ = forward.z.toFixed(4)
                canvas.dataset.shipTurning = alignment > 0.999 ? 'false' : 'true'
            }

            const pickAt = (clientX: number, clientY: number, includeFlightPlane: boolean): CanvasPickResult | null => {
                const ray = resolveCanvasRay(clientX, clientY)
                if (!ray) {
                    return null
                }

                let selected: { objectId: string; distance: number } | null = null
                for (const object of sceneObjects) {
                    if (!object.selectable || object.id === controlledObjectId) {
                        continue
                    }
                    const hit = intersectAabb(ray.origin, ray.direction, object.position, {
                        x: Math.abs(object.scale.x) / 2,
                        y: Math.abs(object.scale.y) / 2,
                        z: Math.abs(object.scale.z) / 2
                    })
                    if (hit !== null && (!selected || hit < selected.distance)) {
                        selected = { objectId: object.id, distance: hit }
                    }
                }

                if (selected) {
                    const object = sceneObjects.find((item) => item.id === selected?.objectId)
                    return object ? { objectId: object.id, point: object.position } : null
                }

                if (!includeFlightPlane) {
                    return null
                }

                const controlledPosition = entities.get(controlledObjectId)?.getPosition()
                if (!controlledPosition) {
                    return null
                }
                const distance = widgetConfig?.scene?.intentDistance ?? DEFAULT_INTENT_DISTANCE
                const direction = ray.direction.clone().normalize()
                return {
                    point: {
                        x: controlledPosition.x + direction.x * distance,
                        y: controlledPosition.y + direction.y * distance,
                        z: controlledPosition.z + direction.z * distance
                    }
                }
            }

            app.on('update', (dt) => {
                const controlledEntity = entities.get(controlledObjectId)
                if (!controlledEntity) return

                const current = controlledEntity.getPosition()
                let currentPosition = { x: current.x, y: current.y, z: current.z }
                const predictedTarget = predictedTargetRef.current
                if (predictedTarget) {
                    const predictedPosition = moveTowards(
                        currentPosition,
                        predictedTarget,
                        Math.max(1, widgetConfig?.scene?.cruiseSpeed ?? 36) * dt
                    )
                    if (isBlockedByGuard(currentPosition, predictedPosition, expandedGuardBoxes)) {
                        predictedTargetRef.current = null
                        canvas.dataset.predictionActive = 'false'
                    } else {
                        controlledEntity.setPosition(predictedPosition.x, predictedPosition.y, predictedPosition.z)
                        currentPosition = predictedPosition
                        const remainingPredictionDistance = Math.hypot(
                            predictedTarget.x - currentPosition.x,
                            predictedTarget.y - currentPosition.y,
                            predictedTarget.z - currentPosition.z
                        )
                        if (remainingPredictionDistance < 0.5) {
                            predictedTargetRef.current = null
                            canvas.dataset.predictionActive = 'false'
                        } else {
                            canvas.dataset.predictionActive = 'true'
                        }
                    }
                }
                const authoritativePosition = authoritativePositionRef.current
                if (authoritativePosition) {
                    const next = lerpVector3(currentPosition, authoritativePosition, Math.min(1, dt * 12))
                    if (!isBlockedByGuard(currentPosition, next, expandedGuardBoxes)) {
                        controlledEntity.setPosition(next.x, next.y, next.z)
                    }
                }

                const nextPosition = controlledEntity.getPosition()
                const previousPosition = lastControlledPositionRef.current
                const nextPositionValue = { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z }
                if (previousPosition) {
                    updateDesiredOrientation(previousPosition, nextPositionValue)
                }
                applyControlledOrientation(controlledEntity, dt)
                lastControlledPositionRef.current = nextPositionValue
                canvas.dataset.shipX = nextPosition.x.toFixed(2)
                canvas.dataset.shipY = nextPosition.y.toFixed(2)
                canvas.dataset.shipZ = nextPosition.z.toFixed(2)
                canvas.dataset.shipForwardX = shipForwardRef.current.x.toFixed(4)
                canvas.dataset.shipForwardY = shipForwardRef.current.y.toFixed(4)
                canvas.dataset.shipForwardZ = shipForwardRef.current.z.toFixed(4)
                canvas.dataset.authoritativeUpdates = String(authoritativeUpdateCountRef.current)
                const nearestGuardClearance = expandedGuardBoxes.length
                    ? Math.min(...expandedGuardBoxes.map((guard) => distanceToAabbSurface(nextPositionValue, guard)))
                    : Infinity
                canvas.dataset.shipGuardClearance = Number.isFinite(nearestGuardClearance) ? nearestGuardClearance.toFixed(2) : 'Infinity'
                applyFollowCameraTransform(camera, {
                    target: { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z },
                    yaw: cameraState.yaw,
                    pitch: cameraState.pitch,
                    distance: cameraState.distance,
                    minDistance: cameraState.minDistance,
                    maxDistance: cameraState.maxDistance
                })
                canvas.dataset.cameraDistance = cameraState.distance.toFixed(2)
                canvas.dataset.cameraYaw = cameraState.yaw.toFixed(4)
                canvas.dataset.cameraPitch = cameraState.pitch.toFixed(4)

                const cameraComponent = camera.camera
                const stationEntity = targetObjectId ? entities.get(targetObjectId) : null
                if (cameraComponent && stationEntity) {
                    const shipScreen = cameraComponent.worldToScreen(new pc.Vec3(nextPosition.x, nextPosition.y, nextPosition.z))
                    const stationScreen = cameraComponent.worldToScreen(stationEntity.getPosition())
                    canvas.dataset.shipScreenX = shipScreen.x.toFixed(1)
                    canvas.dataset.shipScreenY = shipScreen.y.toFixed(1)
                    canvas.dataset.stationScreenX = stationScreen.x.toFixed(1)
                    canvas.dataset.stationScreenY = stationScreen.y.toFixed(1)
                }
            })

            app.start()
            canvas.dataset.runtimeModuleExecuted = requiresRuntimeModule ? 'true' : 'not_required'
            if (selectedModule?.codename) {
                canvas.dataset.runtimeModuleCodename = selectedModule.codename
            } else {
                delete canvas.dataset.runtimeModuleCodename
            }
            setReady(true)
            ;(canvas as PlayCanvasControlCanvas).__playcanvasMoveToTarget = (target, objectId) => {
                if (!room || !canControlScene) {
                    return
                }
                const controlledEntity = entities.get(controlledObjectId)
                const currentPosition = controlledEntity?.getPosition()
                const currentPositionValue = currentPosition ? { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z } : null
                if (!target) {
                    room.send('intent', createStopIntent())
                    predictedTargetRef.current = null
                    canvas.dataset.lastIntentKind = 'stop'
                    canvas.dataset.predictionActive = 'false'
                    delete canvas.dataset.lastIntentObjectId
                    delete canvas.dataset.lastIntentTargetX
                    delete canvas.dataset.lastIntentTargetY
                    delete canvas.dataset.lastIntentTargetZ
                } else if (objectId) {
                    room.send('intent', createMoveToObjectIntent(objectId))
                    const safeTarget = currentPositionValue
                        ? resolveSafeTargetOutsideGuards(currentPositionValue, target, expandedGuardBoxes)
                        : target
                    predictedTargetRef.current = safeTarget
                    if (currentPositionValue) {
                        updateDesiredOrientation(currentPositionValue, safeTarget)
                    }
                    canvas.dataset.lastIntentKind = 'move_to_object'
                    canvas.dataset.lastIntentObjectId = objectId
                    canvas.dataset.lastIntentTargetX = safeTarget.x.toFixed(2)
                    canvas.dataset.lastIntentTargetY = safeTarget.y.toFixed(2)
                    canvas.dataset.lastIntentTargetZ = safeTarget.z.toFixed(2)
                    canvas.dataset.predictionActive = 'true'
                } else {
                    room.send('intent', createMoveToPointIntent(target))
                    predictedTargetRef.current = target
                    if (currentPositionValue) {
                        updateDesiredOrientation(currentPositionValue, target)
                    }
                    canvas.dataset.lastIntentKind = 'move_to_point'
                    canvas.dataset.lastIntentTargetX = target.x.toFixed(2)
                    canvas.dataset.lastIntentTargetY = target.y.toFixed(2)
                    canvas.dataset.lastIntentTargetZ = target.z.toFixed(2)
                    canvas.dataset.predictionActive = 'true'
                    delete canvas.dataset.lastIntentObjectId
                }
            }
            ;(canvas as PlayCanvasControlCanvas).__playcanvasPickAt = pickAt

            let reconnectTimer: number | null = null
            let restoredTimer: number | null = null

            const clearRealtimeTimers = () => {
                if (reconnectTimer) {
                    window.clearTimeout(reconnectTimer)
                    reconnectTimer = null
                }
                if (restoredTimer) {
                    window.clearTimeout(restoredTimer)
                    restoredTimer = null
                }
            }

            const updateRealtimeStatus = (status: RealtimeStatus) => {
                setRealtimeStatus(status)
                canvas.dataset.realtimeStatus = status
            }

            const resolveRealtimeFailureStatus = (cause: unknown, isReconnect: boolean): RealtimeStatus => {
                const code = Number((cause as { code?: unknown; status?: unknown; statusCode?: unknown })?.code)
                const status = Number((cause as { code?: unknown; status?: unknown; statusCode?: unknown })?.status)
                const statusCode = Number((cause as { code?: unknown; status?: unknown; statusCode?: unknown })?.statusCode)
                const values = [code, status, statusCode]
                if (values.some((value) => value === 401 || value === 403)) {
                    return 'unauthorized'
                }
                if (values.some((value) => value === 409 || value === 426)) {
                    return 'version_mismatch'
                }
                if (values.some((value) => value === 421 || value === 429)) {
                    return 'room_full'
                }
                return isReconnect ? 'failed_reconnect' : 'disconnected'
            }

            const connectRealtime = async (options: { isReconnect?: boolean } = {}) => {
                if (!applicationId) {
                    updateRealtimeStatus('unavailable')
                    return
                }

                updateRealtimeStatus(options.isReconnect ? 'reconnecting' : 'connecting')
                try {
                    const csrfToken = await resolveCsrfToken(apiBaseUrl)
                    const client = new Client(resolveRealtimeEndpoint(apiBaseUrl), {
                        headers: { 'X-CSRF-Token': csrfToken }
                    })
                    const joinedRoom = await client.joinOrCreate<FixedTickSceneState>('fixed_tick_scene', {
                        accessMode: runtimeAccessMode,
                        applicationId,
                        widgetId,
                        workspaceId: currentWorkspaceId ?? undefined,
                        objectCollectionId,
                        moduleCodename: moduleCodename ?? undefined
                    })
                    if (disposed) {
                        await joinedRoom.leave(true)
                        return
                    }
                    room = joinedRoom
                    if (options.isReconnect) {
                        updateRealtimeStatus('restored')
                        restoredTimer = window.setTimeout(() => {
                            if (!disposed) {
                                updateRealtimeStatus('connected')
                            }
                            restoredTimer = null
                        }, 1200)
                    } else {
                        updateRealtimeStatus('connected')
                    }
                    const updateAuthoritativeState = (state: FixedTickSceneState) => {
                        authoritativePositionRef.current = readAuthoritativePosition(state)
                        if (authoritativePositionRef.current) {
                            authoritativeUpdateCountRef.current += 1
                            canvas.dataset.shipX = authoritativePositionRef.current.x.toFixed(2)
                            canvas.dataset.shipY = authoritativePositionRef.current.y.toFixed(2)
                            canvas.dataset.shipZ = authoritativePositionRef.current.z.toFixed(2)
                            canvas.dataset.authoritativeUpdates = String(authoritativeUpdateCountRef.current)
                        }
                    }
                    updateAuthoritativeState(joinedRoom.state)
                    joinedRoom.onStateChange(updateAuthoritativeState)
                    joinedRoom.onLeave(() => {
                        if (!disposed) {
                            updateRealtimeStatus('reconnecting')
                            room = null
                            clearRealtimeTimers()
                            reconnectTimer = window.setTimeout(() => {
                                reconnectTimer = null
                                void connectRealtime({ isReconnect: true })
                            }, 500)
                        }
                    })
                } catch (cause) {
                    room = null
                    authoritativePositionRef.current = null
                    predictedTargetRef.current = null
                    updateRealtimeStatus(resolveRealtimeFailureStatus(cause, options.isReconnect === true))
                }
            }

            void connectRealtime()

            return () => {
                disposed = true
                clearRealtimeTimers()
                void room?.leave(true)
                observer.disconnect()
                canvas.removeEventListener('playcanvas-camera-control', handleCameraControl)
                canvas.removeEventListener('playcanvas-camera-drag', handleCameraDrag)
                setReady(false)
                predictedTargetRef.current = null
                delete (canvas as PlayCanvasControlCanvas).__playcanvasMoveToTarget
                delete (canvas as PlayCanvasControlCanvas).__playcanvasPickAt
                app?.destroy()
            }
        } catch {
            setError(loadFailedMessageRef.current)
            app?.destroy()
            return undefined
        }
    }, [
        apiBaseUrl,
        applicationId,
        canControlScene,
        controlledObjectId,
        currentWorkspaceId,
        moduleCodename,
        objectCollectionId,
        requiresRuntimeModule,
        runtimeAccessMode,
        runtimeModuleReady,
        sceneObjects,
        selectedModule?.codename,
        targetObjectId,
        widgetConfig?.camera,
        widgetConfig?.scene?.cruiseSpeed,
        widgetConfig?.scene?.intentDistance,
        widgetId
    ])

    const moveToConfiguredTarget = () => {
        if (!canControlScene) {
            return
        }
        const target = sceneObjects.find((item) => item.id === targetObjectId)
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        if (target && canvas?.__playcanvasMoveToTarget) {
            canvas.__playcanvasMoveToTarget(target.position, target.id)
        }
    }

    const stop = () => {
        if (!canControlScene) {
            return
        }
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        canvas?.__playcanvasMoveToTarget?.(null)
    }

    const updateCamera = (kind: 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight' | 'reset') => {
        const canvas = canvasRef.current
        if (!canvas) return
        const event = new CustomEvent('playcanvas-camera-control', { detail: kind })
        canvas.dispatchEvent(event)
    }

    const handleCanvasWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.focus()
        updateCamera(event.deltaY < 0 ? 'zoomIn' : 'zoomOut')
    }

    const releaseCapturedPointer = (canvas: HTMLCanvasElement | null) => {
        const pointerId = capturedPointerIdRef.current
        if (canvas && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
            canvas.releasePointerCapture(pointerId)
        }
        capturedPointerIdRef.current = null
    }

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        capturedPointerIdRef.current = event.pointerId
        draggedRef.current = false
        dragRef.current = { x: event.clientX, y: event.clientY }
    }

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!dragRef.current || event.buttons !== 1) return
        const deltaX = event.clientX - dragRef.current.x
        const deltaY = event.clientY - dragRef.current.y
        if (Math.abs(deltaX) + Math.abs(deltaY) > 2) {
            draggedRef.current = true
        }
        dragRef.current = { x: event.clientX, y: event.clientY }
        const canvas = canvasRef.current
        if (!canvas) return
        const cameraControl = new CustomEvent('playcanvas-camera-drag', { detail: { deltaX, deltaY } })
        canvas.dispatchEvent(cameraControl)
    }

    const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        releaseCapturedPointer(event.currentTarget)
        dragRef.current = null
    }

    const handlePointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        releaseCapturedPointer(event.currentTarget)
        dragRef.current = null
    }

    const handleCanvasClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
        if (draggedRef.current) {
            return
        }
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        const picked = canvas?.__playcanvasPickAt?.(event.clientX, event.clientY, false)
        if (picked?.objectId) {
            canvas?.__playcanvasMoveToTarget?.(picked.point, picked.objectId)
        }
    }

    const handleCanvasDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
        if (draggedRef.current) {
            return
        }
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        const picked = canvas?.__playcanvasPickAt?.(event.clientX, event.clientY, true)
        if (picked && !picked.objectId) {
            canvas?.__playcanvasMoveToTarget?.(picked.point)
        }
    }

    const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            moveToConfiguredTarget()
        } else if (event.key === 'Escape') {
            event.preventDefault()
            releaseCapturedPointer(event.currentTarget)
            dragRef.current = null
            stop()
        } else if (event.key === '+' || event.key === '=') {
            event.preventDefault()
            updateCamera('zoomIn')
        } else if (event.key === '-' || event.key === '_') {
            event.preventDefault()
            updateCamera('zoomOut')
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            updateCamera('rotateLeft')
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            updateCamera('rotateRight')
        }
    }

    if (!parsed.success) {
        return <Alert severity='warning'>{t('playcanvasCanvas.invalidConfig', 'The 3D scene configuration is invalid.')}</Alert>
    }
    const runtimeModuleAlert = runtimeModuleLoading
        ? { severity: 'info' as const, message: t('playcanvasCanvas.moduleLoading', 'Loading 3D runtime module...') }
        : runtimeModuleError
        ? {
              severity: 'error' as const,
              message: t('playcanvasCanvas.moduleLoadFailed', 'The 3D runtime module could not be loaded.')
          }
        : runtimeModuleMissing
        ? {
              severity: 'warning' as const,
              message: t('playcanvasCanvas.moduleUnavailable', 'The 3D runtime module is unavailable.')
          }
        : null
    const realtimeAlert =
        realtimeStatus === 'unauthorized'
            ? {
                  severity: 'error' as const,
                  message: t('playcanvasCanvas.realtime.unauthorizedDescription', 'Realtime control is not available for your account.')
              }
            : realtimeStatus === 'room_full'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.roomFullDescription', 'Realtime room is full. Try again later.')
              }
            : realtimeStatus === 'version_mismatch'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.versionMismatchDescription', 'Realtime version mismatch. Reload the application.')
              }
            : realtimeStatus === 'unavailable'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.unavailableDescription', 'Realtime control is unavailable for this application.')
              }
            : realtimeStatus === 'reconnecting'
            ? {
                  severity: 'info' as const,
                  message: t('playcanvasCanvas.realtime.reconnectingDescription', 'Realtime control is reconnecting.')
              }
            : realtimeStatus === 'restored'
            ? {
                  severity: 'success' as const,
                  message: t('playcanvasCanvas.realtime.restoredDescription', 'Realtime control was restored.')
              }
            : realtimeStatus === 'failed_reconnect'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.failedReconnectDescription', 'Realtime control could not reconnect.')
              }
            : realtimeStatus === 'disconnected'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.disconnectedDescription', 'Realtime control is not connected.')
              }
            : null
    const movementControlsEnabled = (realtimeStatus === 'connected' || realtimeStatus === 'restored') && canControlScene
    const showViewOnlyState = (realtimeStatus === 'connected' || realtimeStatus === 'restored') && !canControlScene

    return (
        <Box
            data-testid='playcanvas-canvas-widget'
            sx={{ width: '100%', minWidth: 0, mb: widgetConfig?.heightMode === 'fitViewport' ? -3 : 0 }}
        >
            <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1, minWidth: 0, flexWrap: 'wrap', rowGap: 1 }}>
                <Typography variant='h6' sx={{ flex: 1, minWidth: 0 }}>
                    {title}
                </Typography>
                <Typography variant='caption' color='text.secondary' data-testid='playcanvas-realtime-status' sx={{ minWidth: 0 }}>
                    {t(`playcanvasCanvas.realtime.${realtimeStatus}`, realtimeStatus)}
                </Typography>
                {showViewOnlyState ? (
                    <Typography variant='caption' color='text.secondary' data-testid='playcanvas-control-mode' sx={{ minWidth: 0 }}>
                        {t('playcanvasCanvas.viewOnly', 'View only')}
                    </Typography>
                ) : null}
                <Tooltip title={t('playcanvasCanvas.moveToTarget', 'Move to target')}>
                    <span>
                        <IconButton
                            aria-label={t('playcanvasCanvas.moveToTarget', 'Move to target')}
                            onClick={moveToConfiguredTarget}
                            disabled={!movementControlsEnabled}
                            size='small'
                        >
                            <MyLocationRoundedIcon fontSize='small' />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.stop', 'Stop')}>
                    <span>
                        <IconButton
                            aria-label={t('playcanvasCanvas.stop', 'Stop')}
                            onClick={stop}
                            disabled={!movementControlsEnabled}
                            size='small'
                        >
                            <PauseRoundedIcon fontSize='small' />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.resetCamera', 'Reset camera')}>
                    <IconButton
                        aria-label={t('playcanvasCanvas.resetCamera', 'Reset camera')}
                        onClick={() => updateCamera('reset')}
                        size='small'
                    >
                        <CenterFocusStrongRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.zoomIn', 'Zoom in')}>
                    <IconButton aria-label={t('playcanvasCanvas.zoomIn', 'Zoom in')} onClick={() => updateCamera('zoomIn')} size='small'>
                        <ZoomInRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.zoomOut', 'Zoom out')}>
                    <IconButton aria-label={t('playcanvasCanvas.zoomOut', 'Zoom out')} onClick={() => updateCamera('zoomOut')} size='small'>
                        <ZoomOutRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.rotateLeft', 'Rotate left')}>
                    <IconButton
                        aria-label={t('playcanvasCanvas.rotateLeft', 'Rotate left')}
                        onClick={() => updateCamera('rotateLeft')}
                        size='small'
                    >
                        <RotateLeftRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.rotateRight', 'Rotate right')}>
                    <IconButton
                        aria-label={t('playcanvasCanvas.rotateRight', 'Rotate right')}
                        onClick={() => updateCamera('rotateRight')}
                        size='small'
                    >
                        <RotateRightRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            </Stack>
            {runtimeModuleAlert ? <Alert severity={runtimeModuleAlert.severity}>{runtimeModuleAlert.message}</Alert> : null}
            {error ? <Alert severity='error'>{error}</Alert> : null}
            {!ready && !error && !runtimeModuleAlert ? (
                <Alert severity='info'>{t('playcanvasCanvas.loading', 'Loading 3D scene...')}</Alert>
            ) : null}
            {ready && realtimeAlert && !error ? <Alert severity={realtimeAlert.severity}>{realtimeAlert.message}</Alert> : null}
            {runtimeModuleReady ? (
                <Box ref={containerRef} sx={{ width: '100%', minWidth: 0, height: canvasHeight, bgcolor: 'grey.950', overflow: 'hidden' }}>
                    <canvas
                        ref={canvasRef}
                        data-testid='playcanvas-canvas'
                        aria-label={t('playcanvasCanvas.canvasLabel', 'Interactive 3D flight scene')}
                        tabIndex={0}
                        onClick={handleCanvasClick}
                        onDoubleClick={handleCanvasDoubleClick}
                        onKeyDown={handleCanvasKeyDown}
                        onWheel={handleCanvasWheel}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onPointerLeave={handlePointerCancel}
                        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
                    />
                </Box>
            ) : null}
        </Box>
    )
}
