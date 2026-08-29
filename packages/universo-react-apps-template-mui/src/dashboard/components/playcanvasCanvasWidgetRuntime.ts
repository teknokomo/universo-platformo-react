import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import * as pc from '@universo-react/playcanvas-engine'
import {
    Client,
    createMoveToObjectIntent,
    createMoveToPointIntent,
    createStopIntent,
    dropAcknowledgedPredictions,
    type MovementIntent,
    type Room
} from '@universo-react/colyseus-client'
import type { PlayCanvasRuntimeScriptManifest, MmoommVisualLabScene } from '@universo-react/types'
import {
    createBasicApplication,
    createBoxEntity,
    createStandardMaterial,
    resizeApplicationCanvas,
    type Vector3Like
} from '@universo-react/playcanvas-engine'
import {
    addVector,
    crossVector,
    dotVector,
    DEFAULT_INTENT_DISTANCE,
    FLIGHT_CONTROL_SCRIPT_NAME,
    FOLLOW_CAMERA_SCRIPT_NAME,
    type FlightControlRuntimeApi,
    type FollowCameraRuntimeApi,
    normalizeForward,
    normalizeVector,
    type CanvasPickResult,
    type PlayCanvasHostBridge,
    type PlayCanvasHostIntent,
    REMOTE_SHIPS_SCRIPT_NAME,
    type RemoteShipRenderState,
    type RemoteShipsRuntimeApi,
    scaleVector,
    getEntityScriptInstance
} from './playcanvasRuntimeMath'
import { attachManifestScripts, loadManifestScripts, ManifestScriptAssetError } from './playcanvasScriptAssets'
import { mountVisualLinkupLabRuntime } from './visualLinkupLabRuntime'

export interface SceneObjectConfig {
    id: string
    role?: 'mesh' | 'camera'
    position: Vector3Like
    scale: Vector3Like
    selectable?: boolean
    guard?: boolean
}

export interface FixedTickSceneState {
    ships?:
        | Map<string, FixedTickShipState>
        | Record<string, FixedTickShipState>
        | { forEach?: (callback: (value: FixedTickShipState, key: string) => void) => void }
    ship?: {
        position?: Vector3Like
    }
}

export interface FixedTickShipState {
    shipId?: string
    displayName?: string
    connected?: boolean
    lastProcessedInputSeq?: number
    position?: Vector3Like
    velocity?: Vector3Like
    heading?: Vector3Like
    target?: Vector3Like
    hasTarget?: boolean
    speed?: number
}

export type RealtimeStatus =
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

export type PlayCanvasControlCanvas = HTMLCanvasElement & {
    __playcanvasMoveToTarget?: (target: Vector3Like | null, objectId?: string) => void
    __playcanvasPickAt?: (clientX: number, clientY: number, includeFlightPlane: boolean) => CanvasPickResult | null
}

export const isRealtimeMovementEnabled = (status: RealtimeStatus, canControlScene: boolean): boolean =>
    (status === 'connected' || status === 'restored') && canControlScene

let widgetCanvasSequence = 0

export const resolveWidgetCanvasApplicationId = (widgetId: string | undefined): string => {
    const sanitizedWidgetId = (widgetId ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
    const uniquePart = sanitizedWidgetId.length > 0 ? sanitizedWidgetId : `instance-${++widgetCanvasSequence}`
    return `playcanvas-canvas-${uniquePart}`
}

export const isWebGL2Available = (): boolean => {
    try {
        const probeCanvas = document.createElement('canvas')
        return Boolean(probeCanvas.getContext('webgl2'))
    } catch {
        return false
    }
}

export const isFiniteVector3 = (value: unknown): value is Vector3Like => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const candidate = value as Partial<Vector3Like>
    return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)
}

const readShipEntries = (state: FixedTickSceneState | undefined): Array<[string, FixedTickShipState]> => {
    const ships = state?.ships
    if (!ships) {
        return []
    }
    if (ships instanceof Map) {
        return Array.from(ships.entries())
    }
    if (typeof ships.forEach === 'function') {
        const entries: Array<[string, FixedTickShipState]> = []
        ships.forEach((value, key) => entries.push([key, value]))
        return entries
    }
    if (typeof ships === 'object') {
        return Object.entries(ships as Record<string, FixedTickShipState>)
    }
    return []
}

const readAuthoritativePosition = (state: FixedTickSceneState | undefined, localShipId: string | null): Vector3Like | null => {
    const localShip = localShipId
        ? readShipEntries(state).find(([id, ship]) => id === localShipId || ship.shipId === localShipId)?.[1]
        : null
    const position = localShip?.position ?? state?.ship?.position
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
        return null
    }
    return { x: position.x, y: position.y, z: position.z }
}

const resolveRealtimeEndpoint = (apiBaseUrl: string) => {
    if (typeof window === 'undefined') {
        return 'ws://127.0.0.1:2567'
    }

    const runtimeApiUrl = new URL(apiBaseUrl.trim() || '/api/v1', window.location.origin)
    const protocol = runtimeApiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${runtimeApiUrl.host}`
}

const buildRuntimeApiUrl = (apiBaseUrl: string, path: string): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`
    return /^https?:\/\//i.test(normalizedBase) ? new URL(apiPath).toString() : new URL(apiPath, window.location.origin).toString()
}

const resolveCsrfToken = async (apiBaseUrl: string): Promise<string> => {
    const response = await fetch(buildRuntimeApiUrl(apiBaseUrl, '/auth/csrf'), { credentials: 'include' })
    if (!response.ok) {
        throw Object.assign(new Error('Realtime authorization failed'), { status: response.status })
    }

    const payload = (await response.json()) as { csrfToken?: unknown }
    if (typeof payload.csrfToken !== 'string' || payload.csrfToken.trim().length === 0) {
        throw Object.assign(new Error('Realtime authorization failed'), { status: 403 })
    }
    return payload.csrfToken
}

export interface PlayCanvasRuntimeSceneConfig {
    intentDistance?: number
    cruiseSpeed?: number
}

export interface UsePlayCanvasCanvasRuntimeOptions {
    sceneReady: boolean
    canvasRef: MutableRefObject<HTMLCanvasElement | null>
    containerRef: MutableRefObject<HTMLDivElement | null>
    applicationId?: string
    apiBaseUrl: string
    canControlScene: boolean
    currentWorkspaceId?: string | null
    objectCollectionId?: string | null
    moduleCodename: string | null
    runtimeAccessMode: 'member' | 'public'
    widgetId?: string
    sceneObjects: SceneObjectConfig[]
    controlledObjectId: string
    targetObjectId?: string
    visualLabScene?: MmoommVisualLabScene
    requiresRuntimeModule: boolean
    publishedManifestScripts: PlayCanvasRuntimeScriptManifest[]
    selectedModuleCodename?: string | null
    sceneConfig?: PlayCanvasRuntimeSceneConfig
    cameraConfig?: unknown
    loadFailedMessageRef: MutableRefObject<string>
    scriptLoadFailedMessageRef: MutableRefObject<string>
    webglUnavailableMessageRef: MutableRefObject<string>
    setError: Dispatch<SetStateAction<string | null>>
    setReady: Dispatch<SetStateAction<boolean>>
    setRealtimeStatus: Dispatch<SetStateAction<RealtimeStatus>>
    setParticipantSummary: Dispatch<SetStateAction<{ total: number; remote: number }>>
    setLocalShipAssigned: Dispatch<SetStateAction<boolean>>
}

export const usePlayCanvasCanvasRuntime = ({
    sceneReady,
    canvasRef,
    containerRef,
    applicationId,
    apiBaseUrl,
    canControlScene,
    currentWorkspaceId,
    objectCollectionId,
    moduleCodename,
    runtimeAccessMode,
    widgetId,
    sceneObjects,
    controlledObjectId,
    targetObjectId,
    visualLabScene,
    requiresRuntimeModule,
    publishedManifestScripts,
    selectedModuleCodename,
    sceneConfig,
    cameraConfig,
    loadFailedMessageRef,
    scriptLoadFailedMessageRef,
    webglUnavailableMessageRef,
    setError,
    setReady,
    setRealtimeStatus,
    setParticipantSummary,
    setLocalShipAssigned
}: UsePlayCanvasCanvasRuntimeOptions): void => {
    useEffect(() => {
        if (!sceneReady) {
            setError(null)
            setReady(false)
            setRealtimeStatus('connecting')
            setParticipantSummary({ total: 0, remote: 0 })
            setLocalShipAssigned(false)
            return undefined
        }

        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) {
            return undefined
        }

        if (!isWebGL2Available()) {
            setError(webglUnavailableMessageRef.current)
            setReady(false)
            setRealtimeStatus('unavailable')
            return undefined
        }

        let disposed = false
        let app: pc.Application | null = null
        let destroyApplication: (() => void) | null = null
        let room: Room<unknown, FixedTickSceneState> | null = null
        const leaveRoom = (target: Room<unknown, FixedTickSceneState> | null): void => {
            const leaving = target?.leave(true)
            if (leaving) {
                void leaving.catch(() => undefined)
            }
        }
        let scriptLoadFailed = false
        let scriptsReady = publishedManifestScripts.length === 0
        let realtimeReady = !applicationId
        let runtimeStartRequested = false
        const entities = new Map<string, pc.Entity>()
        const localShipIdRef = { current: null as string | null }
        const intentSeqRef = { current: 0 }
        const predictionQueueRef = { current: [] as Array<{ seq: number; target: Vector3Like | null }> }
        const authoritativeUpdateCountRef = { current: 0 }
        const controlledSceneObject = sceneObjects.find((object) => object.id === controlledObjectId)
        const controlledHalfExtents = controlledSceneObject
            ? {
                  x: Math.abs(controlledSceneObject.scale.x) / 2,
                  y: Math.abs(controlledSceneObject.scale.y) / 2,
                  z: Math.abs(controlledSceneObject.scale.z) / 2
              }
            : { x: 0, y: 0, z: 0 }
        try {
            setError(null)
            if (visualLabScene) {
                const unmountVisualLab = mountVisualLinkupLabRuntime({
                    canvas,
                    container,
                    visualLabScene,
                    requiresRuntimeModule,
                    applicationId: resolveWidgetCanvasApplicationId(widgetId)
                })
                setRealtimeStatus('unavailable')
                setReady(true)

                return () => {
                    disposed = true
                    setReady(false)
                    unmountVisualLab()
                }
            }

            const application = createBasicApplication({
                canvas,
                applicationId: resolveWidgetCanvasApplicationId(widgetId)
            })
            app = application.app
            destroyApplication = application.destroy
            app.scene.ambientLight = new pc.Color(0.25, 0.25, 0.25)

            const light = new pc.Entity('main-light')
            light.addComponent('light', { type: 'directional', intensity: 1.5 })
            light.setEulerAngles(45, 45, 0)
            app.root.addChild(light)

            const cameraObject = sceneObjects.find((object) => object.role === 'camera')
            const camera = new pc.Entity(cameraObject?.id ?? 'follow-camera')
            camera.addComponent('camera', { clearColor: new pc.Color(0.02, 0.025, 0.035) })
            if (cameraObject) {
                camera.setPosition(cameraObject.position.x, cameraObject.position.y, cameraObject.position.z)
                entities.set(cameraObject.id, camera)
            }
            app.root.addChild(camera)

            const material = createStandardMaterial(new pc.Color(1, 1, 1))
            for (const object of sceneObjects) {
                if (object.role === 'camera') continue
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

            const resolveFlightControl = (): FlightControlRuntimeApi | null =>
                getEntityScriptInstance<FlightControlRuntimeApi>(controlled, FLIGHT_CONTROL_SCRIPT_NAME)
            const resolveFollowCameraApi = (): FollowCameraRuntimeApi | null =>
                getEntityScriptInstance<FollowCameraRuntimeApi>(camera, FOLLOW_CAMERA_SCRIPT_NAME)
            const resolveRemoteShips = (): RemoteShipsRuntimeApi | null =>
                getEntityScriptInstance<RemoteShipsRuntimeApi>(controlled, REMOTE_SHIPS_SCRIPT_NAME)

            const observer = new ResizeObserver(([entry]) => {
                if (!app || disposed) return
                resizeApplicationCanvas(app, entry.contentRect.width, entry.contentRect.height)
            })
            observer.observe(container)

            // DOM input stays in the widget; camera state and math live in the
            // follow-camera script, reached through its runtime API.
            const handleCameraControl = (event: Event) => {
                const detail = (event as CustomEvent<string>).detail
                const cameraApi = resolveFollowCameraApi()
                if (!cameraApi) {
                    return
                }
                if (detail === 'zoomIn') {
                    cameraApi.zoomBy(-12)
                } else if (detail === 'zoomOut') {
                    cameraApi.zoomBy(12)
                } else if (detail === 'rotateLeft') {
                    cameraApi.rotateBy(-0.25)
                } else if (detail === 'rotateRight') {
                    cameraApi.rotateBy(0.25)
                } else if (detail === 'reset') {
                    cameraApi.resetView()
                }
            }
            const handleCameraDrag = (event: Event) => {
                const detail = (event as CustomEvent<{ deltaX?: number; deltaY?: number }>).detail ?? {}
                resolveFollowCameraApi()?.setDragDelta(detail.deltaX ?? 0, detail.deltaY ?? 0)
            }
            const handleNativeWheel = (event: WheelEvent) => {
                const scrollX = window.scrollX
                const scrollY = window.scrollY
                event.preventDefault()
                event.stopPropagation()
                canvas.focus({ preventScroll: true })
                resolveFollowCameraApi()?.zoomBy(event.deltaY < 0 ? -12 : 12)
                if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
                    window.scrollTo(scrollX, scrollY)
                }
            }
            canvas.addEventListener('playcanvas-camera-control', handleCameraControl)
            canvas.addEventListener('playcanvas-camera-drag', handleCameraDrag)
            container.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true })

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

            const pickAt = (clientX: number, clientY: number, includeFlightPlane: boolean): CanvasPickResult | null => {
                const ray = resolveCanvasRay(clientX, clientY)
                if (!ray) {
                    return null
                }
                const rect = canvas.getBoundingClientRect()

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
                const distance = sceneConfig?.intentDistance ?? DEFAULT_INTENT_DISTANCE
                const centerRay = resolveCanvasRay(rect.left + rect.width / 2, rect.top + rect.height / 2)
                const centerForward = normalizeVector(
                    centerRay
                        ? { x: centerRay.direction.x, y: centerRay.direction.y, z: centerRay.direction.z }
                        : resolveFlightControl()?.getForward() ?? { x: 1, y: 0, z: 0 }
                )
                const worldUp = { x: 0, y: 1, z: 0 }
                const right = normalizeForward(crossVector(centerForward, worldUp), { x: 1, y: 0, z: 0 })
                const up = normalizeForward(crossVector(right, centerForward), worldUp)
                const horizontalOffset = rect.width > 0 ? ((clientX - rect.left) / rect.width - 0.5) * 1.5 : 0
                const verticalOffset = rect.height > 0 ? (0.5 - (clientY - rect.top) / rect.height) * 1.5 : 0
                const farFromShip = {
                    x: ray.origin.x + ray.direction.x * distance - controlledPosition.x,
                    y: ray.origin.y + ray.direction.y * distance - controlledPosition.y,
                    z: ray.origin.z + ray.direction.z * distance - controlledPosition.z
                }
                const farDirection = normalizeVector(farFromShip)
                const isBehindCameraForward = dotVector(farDirection, centerForward) < 0.05
                const direction = normalizeVector(
                    isBehindCameraForward
                        ? addVector(addVector(centerForward, scaleVector(right, horizontalOffset)), scaleVector(up, verticalOffset))
                        : farDirection
                )
                return {
                    point: {
                        x: controlledPosition.x + direction.x * distance,
                        y: controlledPosition.y + direction.y * distance,
                        z: controlledPosition.z + direction.z * distance
                    }
                }
            }

            // PlayCanvas invokes update/postUpdate on manifest-attached scripts;
            // the widget only projects room/camera state into HUD markers here.
            app.on('update', () => {
                const controlledEntity = entities.get(controlledObjectId)
                if (!controlledEntity) return

                const nextPosition = controlledEntity.getPosition()
                const nextPositionValue = { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z }
                canvas.dataset.authoritativeUpdates = String(authoritativeUpdateCountRef.current)

                const flightControl = resolveFlightControl()
                const shipForward = flightControl?.getForward() ?? { x: 1, y: 0, z: 0 }
                if (!flightControl) {
                    canvas.dataset.shipX = nextPosition.x.toFixed(2)
                    canvas.dataset.shipY = nextPosition.y.toFixed(2)
                    canvas.dataset.shipZ = nextPosition.z.toFixed(2)
                    canvas.dataset.shipForwardX = shipForward.x.toFixed(4)
                    canvas.dataset.shipForwardY = shipForward.y.toFixed(4)
                    canvas.dataset.shipForwardZ = shipForward.z.toFixed(4)
                }
                const cameraComponent = camera.camera
                const stationEntity = targetObjectId ? entities.get(targetObjectId) : null
                if (cameraComponent && stationEntity) {
                    const shipScreen = cameraComponent.worldToScreen(new pc.Vec3(nextPosition.x, nextPosition.y, nextPosition.z))
                    const nosePosition = {
                        x: nextPositionValue.x + shipForward.x * controlledHalfExtents.x,
                        y: nextPositionValue.y + shipForward.y * controlledHalfExtents.x,
                        z: nextPositionValue.z + shipForward.z * controlledHalfExtents.x
                    }
                    const noseScreen = cameraComponent.worldToScreen(new pc.Vec3(nosePosition.x, nosePosition.y, nosePosition.z))
                    const stationScreen = cameraComponent.worldToScreen(stationEntity.getPosition())
                    canvas.dataset.shipScreenX = shipScreen.x.toFixed(1)
                    canvas.dataset.shipScreenY = shipScreen.y.toFixed(1)
                    canvas.dataset.shipNoseScreenX = noseScreen.x.toFixed(1)
                    canvas.dataset.shipNoseScreenY = noseScreen.y.toFixed(1)
                    canvas.dataset.stationScreenX = stationScreen.x.toFixed(1)
                    canvas.dataset.stationScreenY = stationScreen.y.toFixed(1)
                }
            })

            const dispatchHostIntent = (intent: PlayCanvasHostIntent): number | null => {
                const currentRealtimeStatus = (canvas.dataset.realtimeStatus as RealtimeStatus | undefined) ?? 'connecting'
                if (!room || !localShipIdRef.current || !isRealtimeMovementEnabled(currentRealtimeStatus, canControlScene)) {
                    return null
                }

                const sequence = intentSeqRef.current + 1
                if (!Number.isInteger(sequence) || sequence <= 0 || sequence > 2147483647) {
                    return null
                }

                const controlledEntity = entities.get(controlledObjectId)
                const currentPosition = controlledEntity?.getPosition()
                const currentPositionValue = currentPosition ? { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z } : null
                let predictionTarget: Vector3Like | null = null
                let sentIntent: MovementIntent
                if (intent.type === 'stop') {
                    sentIntent = createStopIntent(sequence)
                } else if (intent.type === 'move_to_object') {
                    const objectId = intent.objectId.trim()
                    if (!objectId || objectId.length > 128) {
                        return null
                    }
                    sentIntent = createMoveToObjectIntent(objectId, sequence)
                    const object = sceneObjects.find((item) => item.id === objectId)
                    predictionTarget = object?.position ?? null
                } else {
                    if (!isFiniteVector3(intent.target)) {
                        return null
                    }
                    const target = { x: intent.target.x, y: intent.target.y, z: intent.target.z }
                    sentIntent = createMoveToPointIntent(target, sequence)
                    predictionTarget = target
                }

                try {
                    room.send('intent', sentIntent)
                } catch {
                    return null
                }
                intentSeqRef.current = sequence

                if (intent.type === 'stop') {
                    predictionQueueRef.current = [{ seq: sequence, target: null }]
                    resolveFlightControl()?.setPredictionTarget(null)
                    canvas.dataset.lastIntentKind = 'stop'
                    canvas.dataset.predictionActive = 'false'
                    delete canvas.dataset.lastIntentObjectId
                    delete canvas.dataset.lastIntentTargetX
                    delete canvas.dataset.lastIntentTargetY
                    delete canvas.dataset.lastIntentTargetZ
                } else {
                    const remoteShipCount = Number(canvas.dataset.remoteShipCount)
                    const shouldPredictMovement = !Number.isFinite(remoteShipCount) || remoteShipCount <= 0
                    const flightControl = resolveFlightControl()
                    const safeTarget =
                        currentPositionValue && predictionTarget
                            ? flightControl?.resolveTarget?.(predictionTarget) ?? predictionTarget
                            : predictionTarget
                    const canPredictMovement = Boolean(flightControl)
                    const predictedTarget = canPredictMovement && shouldPredictMovement ? safeTarget : null
                    predictionQueueRef.current.push({ seq: sequence, target: predictedTarget })
                    flightControl?.setPredictionTarget(predictedTarget)
                    if (currentPositionValue && predictedTarget) {
                        flightControl?.updateDesiredOrientation(currentPositionValue, predictedTarget)
                    }
                    canvas.dataset.lastIntentKind = intent.type
                    canvas.dataset.predictionActive = predictedTarget ? 'true' : 'false'
                    if (intent.type === 'move_to_object') {
                        canvas.dataset.lastIntentObjectId = intent.objectId.trim()
                    } else {
                        delete canvas.dataset.lastIntentObjectId
                    }
                    if (safeTarget) {
                        canvas.dataset.lastIntentTargetX = safeTarget.x.toFixed(2)
                        canvas.dataset.lastIntentTargetY = safeTarget.y.toFixed(2)
                        canvas.dataset.lastIntentTargetZ = safeTarget.z.toFixed(2)
                    } else {
                        delete canvas.dataset.lastIntentTargetX
                        delete canvas.dataset.lastIntentTargetY
                        delete canvas.dataset.lastIntentTargetZ
                    }
                }
                resolveFlightControl()?.setPendingPredictionCount(predictionQueueRef.current.length)
                return sequence
            }

            ;(canvas as PlayCanvasControlCanvas).__playcanvasMoveToTarget = (target, objectId) => {
                const intent: PlayCanvasHostIntent = !target
                    ? { type: 'stop' }
                    : typeof objectId === 'string' && objectId.trim()
                    ? { type: 'move_to_object', objectId: objectId.trim() }
                    : { type: 'move_to_point', target }
                void dispatchHostIntent(intent)
            }
            ;(canvas as PlayCanvasControlCanvas).__playcanvasPickAt = pickAt

            const getParticipants = (): { total: number; remote: number } => {
                const total = Number(canvas.dataset.shipCount)
                const remote = Number(canvas.dataset.remoteShipCount)
                return {
                    total: Number.isInteger(total) && total >= 0 ? total : 0,
                    remote: Number.isInteger(remote) && remote >= 0 ? remote : 0
                }
            }
            const sendIntent = (intent: PlayCanvasHostIntent): boolean => dispatchHostIntent(intent) !== null
            const attachHostBridge = (): void => {
                if (!app) return
                ;(app as unknown as { __universoHost?: PlayCanvasHostBridge }).__universoHost = Object.freeze({
                    sendIntent,
                    pickAt,
                    getParticipants
                })
            }

            let runtimeStarted = false
            const startRuntime = (): void => {
                runtimeStartRequested = true
                if (!realtimeReady || !scriptsReady || runtimeStarted || disposed || !app || scriptLoadFailed) return
                runtimeStarted = true
                // Publish the stable host contract before app.start() invokes
                // any script initialize/postInitialize lifecycle callbacks.
                attachHostBridge()
                app.start()
                canvas.dataset.runtimeModuleExecuted = requiresRuntimeModule ? 'true' : 'not_required'
                if (selectedModuleCodename) {
                    canvas.dataset.runtimeModuleCodename = selectedModuleCodename
                } else {
                    delete canvas.dataset.runtimeModuleCodename
                }
                setReady(true)
            }

            const manifestScripts = publishedManifestScripts
            if (manifestScripts.length > 0) {
                void loadManifestScripts(app, manifestScripts)
                    .then(() => {
                        if (disposed) return
                        attachManifestScripts(entities, manifestScripts)
                        scriptsReady = true
                        canvas.dataset.scriptsLoaded = 'true'
                        startRuntime()
                    })
                    .catch((error: unknown) => {
                        scriptLoadFailed = true
                        canvas.dataset.scriptsLoaded = 'failed'
                        const scriptName = error instanceof ManifestScriptAssetError ? ` (${error.scriptName})` : ''
                        leaveRoom(room)
                        room = null
                        destroyApplication?.()
                        destroyApplication = null
                        app = null
                        if (!disposed) {
                            setError(`${scriptLoadFailedMessageRef.current}${scriptName}`)
                        }
                    })
            } else {
                canvas.dataset.scriptsLoaded = 'none'
                startRuntime()
            }

            let restoredTimer: number | null = null
            let lastRealtimeStatus: RealtimeStatus = 'connecting'

            const clearRealtimeTimers = () => {
                if (restoredTimer) {
                    window.clearTimeout(restoredTimer)
                    restoredTimer = null
                }
            }

            const updateRealtimeStatus = (status: RealtimeStatus) => {
                if (disposed) return
                lastRealtimeStatus = status
                setRealtimeStatus(status)
                canvas.dataset.realtimeStatus = status
            }

            const resolveRealtimeFailureStatus = (cause: unknown, isReconnect: boolean): RealtimeStatus => {
                const code = Number((cause as { code?: unknown; status?: unknown; statusCode?: unknown })?.code)
                const status = Number((cause as { code?: unknown; status?: unknown; statusCode?: unknown })?.status)
                const statusCode = Number((cause as { code?: unknown; status?: unknown; statusCode?: unknown })?.statusCode)
                const values = [code, status, statusCode]
                if (values.some((value) => value === 401 || value === 403 || value === 4423)) {
                    return 'unauthorized'
                }
                if (values.some((value) => value === 409 || value === 426)) {
                    return 'version_mismatch'
                }
                if (values.some((value) => value === 421 || value === 429 || value === 4421)) {
                    return 'room_full'
                }
                return isReconnect ? 'failed_reconnect' : 'disconnected'
            }

            const handleWebGLContextLost = (): void => {
                leaveRoom(room)
                room = null
                clearRealtimeTimers()
                if (app) {
                    delete (app as unknown as { __universoHost?: unknown }).__universoHost
                }
                destroyApplication?.()
                destroyApplication = null
                app = null
                setError(webglUnavailableMessageRef.current)
                setReady(false)
            }
            canvas.addEventListener('webglcontextlost', handleWebGLContextLost)
            const connectRealtime = async () => {
                if (!applicationId || scriptLoadFailed) {
                    updateRealtimeStatus('unavailable')
                    realtimeReady = true
                    startRuntime()
                    return
                }

                updateRealtimeStatus('connecting')
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
                    if (disposed || scriptLoadFailed) {
                        await joinedRoom.leave(true)
                        return
                    }
                    joinedRoom.reconnection.enabled = true
                    joinedRoom.reconnection.minUptime = 0
                    joinedRoom.reconnection.maxRetries = 10
                    joinedRoom.reconnection.minDelay = 250
                    joinedRoom.reconnection.maxDelay = 2000
                    room = joinedRoom
                    const updateAuthoritativeState = (state: FixedTickSceneState): void => {
                        if (disposed) return
                        const shipEntries = readShipEntries(state)
                        const localShip = localShipIdRef.current
                            ? shipEntries.find(([id, ship]) => id === localShipIdRef.current || ship.shipId === localShipIdRef.current)?.[1]
                            : null
                        const primaryShipId =
                            localShipIdRef.current ??
                            (!canControlScene && shipEntries.length > 0 ? shipEntries[0][1].shipId ?? shipEntries[0][0] : null)
                        const remoteShips = new Map<string, RemoteShipRenderState>()
                        for (const [shipId, ship] of shipEntries) {
                            const id = ship.shipId ?? shipId
                            if (id === primaryShipId || !ship.position) {
                                continue
                            }
                            remoteShips.set(id, {
                                position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
                                heading: ship.heading ? normalizeForward(ship.heading) : null
                            })
                        }
                        if (localShip && typeof localShip.lastProcessedInputSeq === 'number') {
                            intentSeqRef.current = Math.max(intentSeqRef.current, localShip.lastProcessedInputSeq)
                            predictionQueueRef.current = dropAcknowledgedPredictions(
                                predictionQueueRef.current,
                                localShip.lastProcessedInputSeq
                            )
                            const nextPredictedTarget =
                                predictionQueueRef.current[predictionQueueRef.current.length - 1]?.target ??
                                (remoteShips.size === 0 && localShip.hasTarget === true && localShip.target ? localShip.target : null)
                            resolveFlightControl()?.applyPredictionAck(nextPredictedTarget, localShip.speed)
                            resolveFlightControl()?.setPendingPredictionCount(predictionQueueRef.current.length)
                            canvas.dataset.lastProcessedInputSeq = String(localShip.lastProcessedInputSeq)
                            canvas.dataset.pendingPredictionCount = String(predictionQueueRef.current.length)
                        }
                        if (primaryShipId && !localShipIdRef.current && !canControlScene) {
                            canvas.dataset.observedShipAssigned = 'true'
                        }
                        const authoritativeVelocity =
                            localShip?.velocity && isFiniteVector3(localShip.velocity)
                                ? { x: localShip.velocity.x, y: localShip.velocity.y, z: localShip.velocity.z }
                                : null
                        const authoritativePosition = readAuthoritativePosition(state, primaryShipId)
                        const flightControl = resolveFlightControl()
                        flightControl?.setAuthoritativeState(authoritativePosition, authoritativeVelocity)
                        if (!flightControl && authoritativePosition) {
                            const controlledEntity = entities.get(controlledObjectId)
                            controlledEntity?.setPosition(authoritativePosition.x, authoritativePosition.y, authoritativePosition.z)
                        }
                        resolveRemoteShips()?.applySnapshot(remoteShips)
                        const nextParticipantSummary = {
                            total: shipEntries.length || (state.ship?.position ? 1 : 0),
                            remote: remoteShips.size
                        }
                        setParticipantSummary((current) =>
                            current.total === nextParticipantSummary.total && current.remote === nextParticipantSummary.remote
                                ? current
                                : nextParticipantSummary
                        )
                        canvas.dataset.shipCount = String(nextParticipantSummary.total)
                        canvas.dataset.remoteShipCount = String(nextParticipantSummary.remote)
                        const firstRemoteShip = remoteShips.values().next().value as RemoteShipRenderState | undefined
                        if (firstRemoteShip) {
                            canvas.dataset.remoteShipX = firstRemoteShip.position.x.toFixed(2)
                            canvas.dataset.remoteShipY = firstRemoteShip.position.y.toFixed(2)
                            canvas.dataset.remoteShipZ = firstRemoteShip.position.z.toFixed(2)
                            if (firstRemoteShip.heading) {
                                canvas.dataset.remoteShipForwardX = firstRemoteShip.heading.x.toFixed(4)
                                canvas.dataset.remoteShipForwardY = firstRemoteShip.heading.y.toFixed(4)
                                canvas.dataset.remoteShipForwardZ = firstRemoteShip.heading.z.toFixed(4)
                            } else {
                                delete canvas.dataset.remoteShipForwardX
                                delete canvas.dataset.remoteShipForwardY
                                delete canvas.dataset.remoteShipForwardZ
                            }
                        } else {
                            delete canvas.dataset.remoteShipX
                            delete canvas.dataset.remoteShipY
                            delete canvas.dataset.remoteShipZ
                            delete canvas.dataset.remoteShipForwardX
                            delete canvas.dataset.remoteShipForwardY
                            delete canvas.dataset.remoteShipForwardZ
                        }
                        if (authoritativePosition) {
                            authoritativeUpdateCountRef.current += 1
                            canvas.dataset.authoritativeUpdates = String(authoritativeUpdateCountRef.current)
                        }
                    }
                    ;(joinedRoom as unknown as { onMessage?: (type: string, callback: (payload: unknown) => void) => void }).onMessage?.(
                        'local_ship_assigned',
                        (payload) => {
                            const shipId = (payload as { shipId?: unknown })?.shipId
                            if (typeof shipId === 'string' && shipId.trim()) {
                                localShipIdRef.current = shipId
                                setLocalShipAssigned(true)
                                canvas.dataset.localShipIdAssigned = 'true'
                                updateAuthoritativeState(joinedRoom.state)
                                const assignedPosition = readAuthoritativePosition(joinedRoom.state, shipId)
                                const controlledEntity = entities.get(controlledObjectId)
                                if (assignedPosition && controlledEntity) {
                                    controlledEntity.setPosition(assignedPosition.x, assignedPosition.y, assignedPosition.z)
                                    resolveFlightControl()?.syncPosition(assignedPosition)
                                }
                            }
                        }
                    )
                    joinedRoom.send('identify_local_ship', {})
                    updateRealtimeStatus('connected')
                    updateAuthoritativeState(joinedRoom.state)
                    joinedRoom.onStateChange(updateAuthoritativeState)
                    ;(joinedRoom as unknown as { onDrop?: (callback: () => void) => void }).onDrop?.(() => {
                        if (!disposed) {
                            updateRealtimeStatus('reconnecting')
                            clearRealtimeTimers()
                        }
                    })
                    ;(joinedRoom as unknown as { onReconnect?: (callback: () => void) => void }).onReconnect?.(() => {
                        if (disposed) {
                            return
                        }
                        updateRealtimeStatus('restored')
                        canvas.dataset.reconnectRestored = 'true'
                        clearRealtimeTimers()
                        restoredTimer = window.setTimeout(() => {
                            if (!disposed) {
                                updateRealtimeStatus('connected')
                            }
                            restoredTimer = null
                        }, 1200)
                        joinedRoom.send('identify_local_ship', {})
                        updateAuthoritativeState(joinedRoom.state)
                    })
                    joinedRoom.onLeave((code?: number) => {
                        if (disposed) {
                            return
                        }
                        room = null
                        clearRealtimeTimers()
                        updateRealtimeStatus(
                            code === 4421
                                ? 'room_full'
                                : code === 4423
                                ? 'unauthorized'
                                : code === 4214 || lastRealtimeStatus === 'reconnecting'
                                ? 'failed_reconnect'
                                : 'disconnected'
                        )
                    })
                    realtimeReady = true
                    if (runtimeStartRequested) {
                        startRuntime()
                    }
                } catch (cause) {
                    room = null
                    resolveFlightControl()?.clearAuthoritativeState()
                    setLocalShipAssigned(false)
                    updateRealtimeStatus(resolveRealtimeFailureStatus(cause, false))
                    realtimeReady = true
                    if (runtimeStartRequested) {
                        startRuntime()
                    }
                }
            }

            void connectRealtime()

            return () => {
                disposed = true
                setParticipantSummary({ total: 0, remote: 0 })
                setLocalShipAssigned(false)
                clearRealtimeTimers()
                leaveRoom(room)
                observer.disconnect()
                canvas.removeEventListener('webglcontextlost', handleWebGLContextLost)
                canvas.removeEventListener('playcanvas-camera-control', handleCameraControl)
                canvas.removeEventListener('playcanvas-camera-drag', handleCameraDrag)
                container.removeEventListener('wheel', handleNativeWheel, { capture: true })
                setReady(false)
                predictionQueueRef.current = []
                delete (canvas as PlayCanvasControlCanvas).__playcanvasMoveToTarget
                delete (canvas as PlayCanvasControlCanvas).__playcanvasPickAt
                if (app) {
                    delete (app as unknown as { __universoHost?: unknown }).__universoHost
                }
                delete canvas.dataset.scriptsLoaded
                delete canvas.dataset.remoteShipCount
                delete canvas.dataset.remoteShipX
                delete canvas.dataset.remoteShipY
                delete canvas.dataset.remoteShipZ
                delete canvas.dataset.remoteShipForwardX
                delete canvas.dataset.remoteShipForwardY
                delete canvas.dataset.remoteShipForwardZ
                destroyApplication?.()
            }
        } catch {
            setError(loadFailedMessageRef.current)
            destroyApplication?.()
            return undefined
        }
    }, [
        apiBaseUrl,
        applicationId,
        canControlScene,
        canvasRef,
        containerRef,
        controlledObjectId,
        currentWorkspaceId,
        loadFailedMessageRef,
        moduleCodename,
        objectCollectionId,
        publishedManifestScripts,
        requiresRuntimeModule,
        runtimeAccessMode,
        sceneReady,
        sceneObjects,
        selectedModuleCodename,
        scriptLoadFailedMessageRef,
        setError,
        setLocalShipAssigned,
        setParticipantSummary,
        setReady,
        setRealtimeStatus,
        targetObjectId,
        widgetId,
        visualLabScene,
        cameraConfig,
        sceneConfig?.cruiseSpeed,
        sceneConfig?.intentDistance,
        webglUnavailableMessageRef
    ])
}
