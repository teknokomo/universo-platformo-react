import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent
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
    dropAcknowledgedPredictions,
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
    ships?:
        | Map<string, FixedTickShipState>
        | Record<string, FixedTickShipState>
        | { forEach?: (callback: (value: FixedTickShipState, key: string) => void) => void }
    ship?: {
        position?: Vector3Like
    }
}

interface FixedTickShipState {
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

interface RemoteShipRenderState {
    position: Vector3Like
    heading: Vector3Like | null
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

const isRealtimeMovementEnabled = (status: RealtimeStatus, canControlScene: boolean): boolean =>
    (status === 'connected' || status === 'restored') && canControlScene

interface CanvasPickResult {
    point: Vector3Like
    objectId?: string
}

interface AabbLike {
    center: Vector3Like
    halfExtents: Vector3Like
}

interface OrientedBoxLike {
    center: Vector3Like
    halfExtents: Vector3Like
    axes: [Vector3Like, Vector3Like, Vector3Like]
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
const CONTACT_EPSILON = 0.02
const DEFAULT_GUARD_CLEARANCE = CONTACT_EPSILON
const REMOTE_SHIP_RENDER_CLEARANCE = 0.35
const DEFAULT_PREDICTION_ACCELERATION = 48
const DEFAULT_PREDICTION_DECELERATION = 48
const DEFAULT_TURN_RESPONSE = 1.8
const MAX_TURN_RADIANS_PER_FRAME = 0.18
const AUTHORITATIVE_HARD_RESYNC_DISTANCE = 2

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

const moveNumberTowards = (current: number, target: number, maxDelta: number): number => {
    if (Math.abs(target - current) <= maxDelta) {
        return target
    }
    return current + Math.sign(target - current) * maxDelta
}

const createHalfExtents = (scale: Vector3Like): Vector3Like => ({
    x: Math.abs(scale.x) / 2,
    y: Math.abs(scale.y) / 2,
    z: Math.abs(scale.z) / 2
})

const vectorLength = (value: Vector3Like): number => Math.hypot(value.x, value.y, value.z)

const expandAabb = (box: AabbLike, halfExtents: Vector3Like | null): AabbLike => {
    if (!halfExtents) {
        return {
            center: box.center,
            halfExtents: box.halfExtents
        }
    }

    return {
        center: box.center,
        halfExtents: {
            x: box.halfExtents.x + Math.max(0, Math.abs(halfExtents.x)),
            y: box.halfExtents.y + Math.max(0, Math.abs(halfExtents.y)),
            z: box.halfExtents.z + Math.max(0, Math.abs(halfExtents.z))
        }
    }
}

const resolveOrientedBodyHalfExtents = (halfExtents: Vector3Like, direction: Vector3Like): Vector3Like => {
    const forward = normalizeVector(direction)
    const referenceUp = Math.abs(dotVector(forward, { x: 0, y: 1, z: 0 })) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalizeVector(crossVector(referenceUp, forward))
    const up = normalizeVector(crossVector(forward, right))
    const hx = Math.max(0, Math.abs(halfExtents.x))
    const hy = Math.max(0, Math.abs(halfExtents.y))
    const hz = Math.max(0, Math.abs(halfExtents.z))

    return {
        x: Math.abs(forward.x) * hx + Math.abs(up.x) * hy + Math.abs(right.x) * hz,
        y: Math.abs(forward.y) * hx + Math.abs(up.y) * hy + Math.abs(right.y) * hz,
        z: Math.abs(forward.z) * hx + Math.abs(up.z) * hy + Math.abs(right.z) * hz
    }
}

const expandAabbForOrientedBody = (box: AabbLike, halfExtents: Vector3Like, direction: Vector3Like): AabbLike =>
    expandAabb(box, resolveOrientedBodyHalfExtents(halfExtents, direction))

const resolveBodyAxes = (direction: Vector3Like): [Vector3Like, Vector3Like, Vector3Like] => {
    const forward = normalizeVector(direction)
    const referenceUp = Math.abs(dotVector(forward, { x: 0, y: 1, z: 0 })) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalizeVector(crossVector(referenceUp, forward))
    const up = normalizeVector(crossVector(forward, right))
    return [forward, up, right]
}

const createOrientedBox = (center: Vector3Like, halfExtents: Vector3Like, heading: Vector3Like): OrientedBoxLike => ({
    center,
    halfExtents: {
        x: Math.max(0, Math.abs(halfExtents.x)),
        y: Math.max(0, Math.abs(halfExtents.y)),
        z: Math.max(0, Math.abs(halfExtents.z))
    },
    axes: resolveBodyAxes(heading)
})

const createAabbObstacleBox = (box: AabbLike): OrientedBoxLike => ({
    center: box.center,
    halfExtents: {
        x: Math.max(0, Math.abs(box.halfExtents.x)),
        y: Math.max(0, Math.abs(box.halfExtents.y)),
        z: Math.max(0, Math.abs(box.halfExtents.z))
    },
    axes: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }
    ]
})

const boxRadiusOnAxis = (box: OrientedBoxLike, axis: Vector3Like): number =>
    box.halfExtents.x * Math.abs(dotVector(box.axes[0], axis)) +
    box.halfExtents.y * Math.abs(dotVector(box.axes[1], axis)) +
    box.halfExtents.z * Math.abs(dotVector(box.axes[2], axis))

const orientedBoxesOverlap = (left: OrientedBoxLike, right: OrientedBoxLike): boolean => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector(leftAxis, rightAxis)
            if (vectorLength(cross) > 0.000001) {
                axes.push(normalizeVector(cross))
            }
        }
    }

    const centerDelta = {
        x: right.center.x - left.center.x,
        y: right.center.y - left.center.y,
        z: right.center.z - left.center.z
    }
    return axes.every((axis) => Math.abs(dotVector(centerDelta, axis)) <= boxRadiusOnAxis(left, axis) + boxRadiusOnAxis(right, axis))
}

const resolveSeparatingAxes = (left: OrientedBoxLike, right: OrientedBoxLike): Vector3Like[] => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector(leftAxis, rightAxis)
            if (vectorLength(cross) > 0.000001) {
                axes.push(normalizeVector(cross))
            }
        }
    }
    return axes
}

const findFirstObstacleContactDistance = (
    from: Vector3Like,
    to: Vector3Like,
    controlledHalfExtents: Vector3Like,
    controlledHeading: Vector3Like,
    obstacle: OrientedBoxLike
): number | null => {
    const movement = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
    const movementLength = vectorLength(movement)
    if (movementLength <= 0.000001) {
        return null
    }

    const movingBox = createOrientedBox(from, controlledHalfExtents, controlledHeading)

    if (orientedBoxesOverlap(movingBox, obstacle)) {
        return 0
    }

    let enter = 0
    let exit = 1
    const centerDelta = {
        x: obstacle.center.x - from.x,
        y: obstacle.center.y - from.y,
        z: obstacle.center.z - from.z
    }
    for (const axis of resolveSeparatingAxes(movingBox, obstacle)) {
        const radius = boxRadiusOnAxis(movingBox, axis) + boxRadiusOnAxis(obstacle, axis)
        const projectedStart = dotVector(centerDelta, axis)
        const projectedVelocity = -dotVector(movement, axis)

        if (Math.abs(projectedVelocity) <= 0.000001) {
            if (Math.abs(projectedStart) > radius) {
                return null
            }
            continue
        }

        const first = (-radius - projectedStart) / projectedVelocity
        const second = (radius - projectedStart) / projectedVelocity
        const axisEnter = Math.min(first, second)
        const axisExit = Math.max(first, second)
        enter = Math.max(enter, axisEnter)
        exit = Math.min(exit, axisExit)
        if (enter > exit) {
            return null
        }
    }

    return exit >= 0 && enter <= 1 ? Math.max(0, enter) * movementLength : null
}

const clampSegmentBeforeObstacleContact = (
    from: Vector3Like,
    to: Vector3Like,
    controlledHalfExtents: Vector3Like,
    controlledHeading: Vector3Like,
    obstacles: readonly OrientedBoxLike[]
): Vector3Like | null => {
    const movement = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
    const movementLength = vectorLength(movement)
    if (movementLength <= 0.000001) {
        return null
    }

    let nearestContactDistance: number | null = null
    for (const obstacle of obstacles) {
        const distance = findFirstObstacleContactDistance(from, to, controlledHalfExtents, controlledHeading, obstacle)
        if (distance !== null) {
            nearestContactDistance = nearestContactDistance === null ? distance : Math.min(nearestContactDistance, distance)
        }
    }

    if (nearestContactDistance === null) {
        return null
    }

    const safeRatio = Math.max(0, nearestContactDistance - CONTACT_EPSILON) / movementLength
    return {
        x: from.x + movement.x * safeRatio,
        y: from.y + movement.y * safeRatio,
        z: from.z + movement.z * safeRatio
    }
}

const resolvePositionOutsideObstacle = (
    position: Vector3Like,
    halfExtents: Vector3Like,
    heading: Vector3Like,
    obstacle: OrientedBoxLike,
    clearance = CONTACT_EPSILON
): Vector3Like => {
    const movingBox = createOrientedBox(position, halfExtents, heading)
    if (!orientedBoxesOverlap(movingBox, obstacle)) {
        return position
    }

    const away = normalizeForward(
        {
            x: position.x - obstacle.center.x,
            y: position.y - obstacle.center.y,
            z: position.z - obstacle.center.z
        },
        heading
    )
    const projectedDistance = dotVector(
        {
            x: position.x - obstacle.center.x,
            y: position.y - obstacle.center.y,
            z: position.z - obstacle.center.z
        },
        away
    )
    const requiredDistance = boxRadiusOnAxis(movingBox, away) + boxRadiusOnAxis(obstacle, away) + clearance
    let resolved = {
        x: position.x + away.x * Math.max(0, requiredDistance - projectedDistance),
        y: position.y + away.y * Math.max(0, requiredDistance - projectedDistance),
        z: position.z + away.z * Math.max(0, requiredDistance - projectedDistance)
    }

    for (let iteration = 0; iteration < 12; iteration += 1) {
        if (!orientedBoxesOverlap(createOrientedBox(resolved, halfExtents, heading), obstacle)) {
            return resolved
        }
        resolved = {
            x: resolved.x + away.x * clearance,
            y: resolved.y + away.y * clearance,
            z: resolved.z + away.z * clearance
        }
    }

    return resolved
}

const resolveSafeTargetOutsideGuardBoxes = (
    from: Vector3Like,
    target: Vector3Like,
    controlledHalfExtents: Vector3Like,
    guards: readonly AabbLike[],
    clearance = DEFAULT_GUARD_CLEARANCE
): Vector3Like => {
    if (!guards.length) {
        return { ...target }
    }

    const direction = normalizeVector({ x: target.x - from.x, y: target.y - from.y, z: target.z - from.z })
    let resolved = { ...target }
    for (const guard of guards) {
        const obstacle = createAabbObstacleBox(guard)
        const entryDistance = findFirstObstacleContactDistance(from, resolved, controlledHalfExtents, direction, obstacle)
        if (entryDistance === null) {
            continue
        }
        const safeDistance = Math.max(0, entryDistance - Math.max(0, clearance))
        resolved = moveTowards(from, target, safeDistance)
    }
    return resolved
}

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

const normalizeVector = (value: Vector3Like): Vector3Like => {
    const length = vectorLength(value)
    if (length <= 0.000001) {
        return { x: 1, y: 0, z: 0 }
    }
    return { x: value.x / length, y: value.y / length, z: value.z / length }
}

const addVector = (a: Vector3Like, b: Vector3Like): Vector3Like => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
})

const scaleVector = (value: Vector3Like, scale: number): Vector3Like => ({
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
})

const dotVector = (a: Vector3Like, b: Vector3Like): number => a.x * b.x + a.y * b.y + a.z * b.z

const crossVector = (a: Vector3Like, b: Vector3Like): Vector3Like => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
})

const normalizeForward = (value: Vector3Like, fallback: Vector3Like = { x: 1, y: 0, z: 0 }): Vector3Like => {
    const length = vectorLength(value)
    if (length > 0.000001) {
        return { x: value.x / length, y: value.y / length, z: value.z / length }
    }
    const fallbackLength = vectorLength(fallback)
    return fallbackLength > 0.000001
        ? { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength, z: fallback.z / fallbackLength }
        : { x: 1, y: 0, z: 0 }
}

const rotateForwardTowards = (current: Vector3Like, desired: Vector3Like, maxRadians: number): Vector3Like => {
    const currentForward = normalizeForward(current)
    const desiredForward = normalizeForward(desired, currentForward)
    const alignment = Math.max(-1, Math.min(1, dotVector(currentForward, desiredForward)))
    const angle = Math.acos(alignment)
    if (angle <= 0.000001 || angle <= maxRadians) {
        return desiredForward
    }

    const ratio = maxRadians / angle
    const sinAngle = Math.sin(angle)
    if (Math.abs(sinAngle) <= 0.000001) {
        return normalizeForward(
            {
                x: currentForward.x + (desiredForward.x - currentForward.x) * ratio,
                y: currentForward.y + (desiredForward.y - currentForward.y) * ratio,
                z: currentForward.z + (desiredForward.z - currentForward.z) * ratio
            },
            currentForward
        )
    }

    const currentScale = Math.sin((1 - ratio) * angle) / sinAngle
    const desiredScale = Math.sin(ratio * angle) / sinAngle
    return normalizeForward({
        x: currentForward.x * currentScale + desiredForward.x * desiredScale,
        y: currentForward.y * currentScale + desiredForward.y * desiredScale,
        z: currentForward.z * currentScale + desiredForward.z * desiredScale
    })
}

const readEntityXAxisForward = (entity: pc.Entity): Vector3Like | null => {
    const rotation = entity.getRotation?.()
    if (!rotation) {
        return null
    }
    const transformed = rotation.transformVector(new pc.Vec3(1, 0, 0), new pc.Vec3())
    return normalizeForward({ x: transformed.x, y: transformed.y, z: transformed.z })
}

const applyEntityForward = (entity: pc.Entity, forward: Vector3Like): Vector3Like => {
    const normalized = normalizeForward(forward)
    const rotation = new pc.Quat().setFromDirections(new pc.Vec3(1, 0, 0), new pc.Vec3(normalized.x, normalized.y, normalized.z))
    const localRotationTarget = entity as pc.Entity & { setLocalRotation?: (rotation: pc.Quat) => void }
    if (typeof localRotationTarget.setLocalRotation === 'function') {
        localRotationTarget.setLocalRotation(rotation)
    } else {
        entity.setRotation(rotation)
    }
    return readEntityXAxisForward(entity) ?? normalized
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
        throw Object.assign(new Error('Realtime authorization failed'), { status: response.status })
    }

    const payload = (await response.json()) as { csrfToken?: unknown }
    if (typeof payload.csrfToken !== 'string' || payload.csrfToken.trim().length === 0) {
        throw Object.assign(new Error('Realtime authorization failed'), { status: 403 })
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
    const [participantSummary, setParticipantSummary] = useState({ total: 0, remote: 0 })
    const [localShipAssigned, setLocalShipAssigned] = useState(false)
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
            setParticipantSummary({ total: 0, remote: 0 })
            setLocalShipAssigned(false)
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
        const remoteEntities = new Map<string, pc.Entity>()
        const remoteShipsRef = { current: new Map<string, RemoteShipRenderState>() }
        const remoteRenderedShipsRef = { current: new Map<string, RemoteShipRenderState>() }
        const remoteForwardsRef = { current: new Map<string, Vector3Like>() }
        const localShipIdRef = { current: null as string | null }
        const intentSeqRef = { current: 0 }
        const predictionQueueRef = { current: [] as Array<{ seq: number; target: Vector3Like | null }> }
        const authoritativePositionRef = { current: null as Vector3Like | null }
        const authoritativeVelocityRef = { current: null as Vector3Like | null }
        const predictedTargetRef = { current: null as Vector3Like | null }
        const predictionSpeedRef = { current: 0 }
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
        const guardBoxes = sceneObjects
            .filter((object) => object.guard === true && object.id !== controlledObjectId)
            .map((object) => ({
                center: object.position,
                halfExtents: createHalfExtents(object.scale)
            }))
        const guardObstacleBoxes = guardBoxes.map(createAabbObstacleBox)
        const resolveExpandedGuardBoxes = (direction: Vector3Like): AabbLike[] =>
            guardBoxes.map((guard) => expandAabbForOrientedBody(guard, controlledHalfExtents, direction))
        const resolveRemoteShipObstacleBoxes = (): OrientedBoxLike[] => {
            const boxes = new Map<string, OrientedBoxLike>()
            remoteShipsRef.current.forEach((remoteShip, shipId) => {
                boxes.set(shipId, createOrientedBox(remoteShip.position, controlledHalfExtents, remoteShip.heading ?? { x: 1, y: 0, z: 0 }))
            })
            remoteRenderedShipsRef.current.forEach((remoteShip, shipId) => {
                boxes.set(shipId, createOrientedBox(remoteShip.position, controlledHalfExtents, remoteShip.heading ?? { x: 1, y: 0, z: 0 }))
            })
            const fallbackRemoteX = Number(canvas.dataset.remoteShipX)
            const fallbackRemoteY = Number(canvas.dataset.remoteShipY)
            const fallbackRemoteZ = Number(canvas.dataset.remoteShipZ)
            if (boxes.size === 0 && Number.isFinite(fallbackRemoteX + fallbackRemoteY + fallbackRemoteZ)) {
                boxes.set(
                    'dataset-remote-ship',
                    createOrientedBox({ x: fallbackRemoteX, y: fallbackRemoteY, z: fallbackRemoteZ }, controlledHalfExtents, {
                        x: Number(canvas.dataset.remoteShipForwardX) || 1,
                        y: Number(canvas.dataset.remoteShipForwardY) || 0,
                        z: Number(canvas.dataset.remoteShipForwardZ) || 0
                    })
                )
            }
            return Array.from(boxes.values())
        }
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
            const remoteMaterial = createStandardMaterial(new pc.Color(0.45, 0.85, 1))
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
            const handleNativeWheel = (event: WheelEvent) => {
                const scrollX = window.scrollX
                const scrollY = window.scrollY
                event.preventDefault()
                event.stopPropagation()
                canvas.focus({ preventScroll: true })
                cameraState.distance = zoomFollowCamera(
                    cameraState.distance,
                    event.deltaY < 0 ? -12 : 12,
                    cameraState.minDistance,
                    cameraState.maxDistance
                )
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

            const updateDesiredOrientation = (from: Vector3Like, to: Vector3Like) => {
                const movement = {
                    x: to.x - from.x,
                    y: to.y - from.y,
                    z: to.z - from.z
                }
                if (vectorLength(movement) <= 0.001) {
                    return
                }

                desiredShipForwardRef.current = normalizeForward(movement, desiredShipForwardRef.current)
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
                const maxTurnRadians = Math.min(MAX_TURN_RADIANS_PER_FRAME, Math.max(0.01, dt * DEFAULT_TURN_RESPONSE))
                const forward =
                    alignment > 0.999
                        ? normalizeForward(desired, currentForward)
                        : rotateForwardTowards(currentForward, desired, maxTurnRadians)
                const visualForward = applyEntityForward(entity, forward)
                shipForwardRef.current = visualForward
                canvas.dataset.shipForwardX = visualForward.x.toFixed(4)
                canvas.dataset.shipForwardY = visualForward.y.toFixed(4)
                canvas.dataset.shipForwardZ = visualForward.z.toFixed(4)
                canvas.dataset.shipVisualForwardX = visualForward.x.toFixed(4)
                canvas.dataset.shipVisualForwardY = visualForward.y.toFixed(4)
                canvas.dataset.shipVisualForwardZ = visualForward.z.toFixed(4)
                canvas.dataset.shipTurning = alignment > 0.999 ? 'false' : 'true'
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
                const distance = widgetConfig?.scene?.intentDistance ?? DEFAULT_INTENT_DISTANCE
                const centerRay = resolveCanvasRay(rect.left + rect.width / 2, rect.top + rect.height / 2)
                const centerForward = normalizeVector(
                    centerRay
                        ? { x: centerRay.direction.x, y: centerRay.direction.y, z: centerRay.direction.z }
                        : desiredShipForwardRef.current
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

            const updateRemoteShipEntities = (dt: number, localPosition: Vector3Like, localHeading: Vector3Like): void => {
                const localObstacle = createOrientedBox(localPosition, controlledHalfExtents, localHeading)
                for (const [shipId, targetState] of remoteShipsRef.current.entries()) {
                    let remoteEntity = remoteEntities.get(shipId)
                    if (!remoteEntity) {
                        remoteEntity = createBoxEntity({
                            name: `remote-${shipId}`,
                            position: targetState.position,
                            scale: controlledSceneObject?.scale ?? { x: 12, y: 4, z: 4 },
                            material: remoteMaterial
                        })
                        remoteEntities.set(shipId, remoteEntity)
                        app?.root.addChild(remoteEntity)
                        remoteForwardsRef.current.set(shipId, normalizeForward(targetState.heading ?? { x: 1, y: 0, z: 0 }))
                    }
                    const currentRemote = remoteEntity.getPosition()
                    const nextRemote = lerpVector3(
                        { x: currentRemote.x, y: currentRemote.y, z: currentRemote.z },
                        targetState.position,
                        Math.min(1, dt * 10)
                    )
                    const currentRemoteForward = remoteForwardsRef.current.get(shipId) ?? { x: 1, y: 0, z: 0 }
                    const desiredRemoteForward = normalizeForward(
                        targetState.heading ?? {
                            x: targetState.position.x - currentRemote.x,
                            y: targetState.position.y - currentRemote.y,
                            z: targetState.position.z - currentRemote.z
                        },
                        currentRemoteForward
                    )
                    const nextRemoteForward = rotateForwardTowards(
                        currentRemoteForward,
                        desiredRemoteForward,
                        Math.min(MAX_TURN_RADIANS_PER_FRAME, Math.max(0.01, dt * DEFAULT_TURN_RESPONSE))
                    )
                    const visualRemoteForward = applyEntityForward(remoteEntity, nextRemoteForward)
                    const clampedRemote = clampSegmentBeforeObstacleContact(
                        { x: currentRemote.x, y: currentRemote.y, z: currentRemote.z },
                        nextRemote,
                        controlledHalfExtents,
                        visualRemoteForward,
                        [localObstacle]
                    )
                    const renderedRemote = resolvePositionOutsideObstacle(
                        clampedRemote ?? nextRemote,
                        controlledHalfExtents,
                        visualRemoteForward,
                        localObstacle,
                        REMOTE_SHIP_RENDER_CLEARANCE
                    )
                    remoteEntity.setPosition(renderedRemote.x, renderedRemote.y, renderedRemote.z)
                    remoteForwardsRef.current.set(shipId, visualRemoteForward)
                    remoteRenderedShipsRef.current.set(shipId, {
                        position: renderedRemote,
                        heading: visualRemoteForward
                    })
                }
                for (const [shipId, remoteEntity] of remoteEntities.entries()) {
                    if (!remoteShipsRef.current.has(shipId)) {
                        remoteEntity.destroy()
                        remoteEntities.delete(shipId)
                        remoteForwardsRef.current.delete(shipId)
                        remoteRenderedShipsRef.current.delete(shipId)
                    }
                }
            }

            const updateRemoteShipDataset = (): void => {
                const firstRenderedRemote = Array.from(remoteRenderedShipsRef.current.values())[0]
                if (firstRenderedRemote) {
                    canvas.dataset.remoteRenderedShipX = firstRenderedRemote.position.x.toFixed(2)
                    canvas.dataset.remoteRenderedShipY = firstRenderedRemote.position.y.toFixed(2)
                    canvas.dataset.remoteRenderedShipZ = firstRenderedRemote.position.z.toFixed(2)
                    const renderedHeading = firstRenderedRemote.heading ?? { x: 1, y: 0, z: 0 }
                    canvas.dataset.remoteRenderedShipForwardX = renderedHeading.x.toFixed(4)
                    canvas.dataset.remoteRenderedShipForwardY = renderedHeading.y.toFixed(4)
                    canvas.dataset.remoteRenderedShipForwardZ = renderedHeading.z.toFixed(4)
                } else {
                    delete canvas.dataset.remoteRenderedShipX
                    delete canvas.dataset.remoteRenderedShipY
                    delete canvas.dataset.remoteRenderedShipZ
                    delete canvas.dataset.remoteRenderedShipForwardX
                    delete canvas.dataset.remoteRenderedShipForwardY
                    delete canvas.dataset.remoteRenderedShipForwardZ
                }
            }

            app.on('update', (dt) => {
                const controlledEntity = entities.get(controlledObjectId)
                if (!controlledEntity) return

                const current = controlledEntity.getPosition()
                let currentPosition = { x: current.x, y: current.y, z: current.z }
                const predictedTarget = predictedTargetRef.current
                if (predictedTarget) {
                    const remainingPredictionDistance = Math.hypot(
                        predictedTarget.x - currentPosition.x,
                        predictedTarget.y - currentPosition.y,
                        predictedTarget.z - currentPosition.z
                    )
                    const acceleration = DEFAULT_PREDICTION_ACCELERATION
                    const deceleration = DEFAULT_PREDICTION_DECELERATION
                    const brakingDistance =
                        predictionSpeedRef.current > 0 && deceleration > 0
                            ? (predictionSpeedRef.current * predictionSpeedRef.current) / (2 * deceleration)
                            : 0
                    const desiredSpeed =
                        remainingPredictionDistance <= Math.max(DEFAULT_GUARD_CLEARANCE, brakingDistance)
                            ? 0
                            : Math.max(1, widgetConfig?.scene?.cruiseSpeed ?? 36)
                    predictionSpeedRef.current = moveNumberTowards(
                        predictionSpeedRef.current,
                        desiredSpeed,
                        (desiredSpeed > predictionSpeedRef.current ? acceleration : deceleration) * dt
                    )
                    const predictedPosition = moveTowards(currentPosition, predictedTarget, predictionSpeedRef.current * dt)
                    const predictionDirection = normalizeForward(
                        {
                            x: predictedPosition.x - currentPosition.x,
                            y: predictedPosition.y - currentPosition.y,
                            z: predictedPosition.z - currentPosition.z
                        },
                        shipForwardRef.current
                    )
                    const remoteShipBoxes = resolveRemoteShipObstacleBoxes()
                    const clampedPosition = clampSegmentBeforeObstacleContact(
                        currentPosition,
                        predictedPosition,
                        controlledHalfExtents,
                        predictionDirection,
                        [...guardObstacleBoxes, ...remoteShipBoxes]
                    )
                    if (clampedPosition) {
                        controlledEntity.setPosition(clampedPosition.x, clampedPosition.y, clampedPosition.z)
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
                            predictionSpeedRef.current = 0
                            canvas.dataset.predictionActive = 'false'
                        } else {
                            canvas.dataset.predictionActive = 'true'
                        }
                    }
                }
                const authoritativePosition = authoritativePositionRef.current
                if (authoritativePosition && predictionQueueRef.current.length === 0 && !predictedTargetRef.current) {
                    const authoritativeDelta = {
                        x: authoritativePosition.x - currentPosition.x,
                        y: authoritativePosition.y - currentPosition.y,
                        z: authoritativePosition.z - currentPosition.z
                    }
                    const next =
                        vectorLength(authoritativeDelta) > AUTHORITATIVE_HARD_RESYNC_DISTANCE
                            ? authoritativePosition
                            : lerpVector3(
                                  currentPosition,
                                  authoritativePosition,
                                  authoritativeVelocityRef.current && vectorLength(authoritativeVelocityRef.current) > 0.001
                                      ? Math.min(1, dt * 4)
                                      : Math.min(1, dt * 12)
                              )
                    const reconciliationDirection = normalizeForward(
                        {
                            x: next.x - currentPosition.x,
                            y: next.y - currentPosition.y,
                            z: next.z - currentPosition.z
                        },
                        shipForwardRef.current
                    )
                    if (
                        !clampSegmentBeforeObstacleContact(currentPosition, next, controlledHalfExtents, reconciliationDirection, [
                            ...guardObstacleBoxes,
                            ...resolveRemoteShipObstacleBoxes()
                        ])
                    ) {
                        controlledEntity.setPosition(next.x, next.y, next.z)
                    }
                }

                const nextPosition = controlledEntity.getPosition()
                const previousPosition = lastControlledPositionRef.current
                const nextPositionValue = { x: nextPosition.x, y: nextPosition.y, z: nextPosition.z }
                if (predictedTargetRef.current) {
                    updateDesiredOrientation(nextPositionValue, predictedTargetRef.current)
                } else if (previousPosition) {
                    updateDesiredOrientation(previousPosition, nextPositionValue)
                }
                applyControlledOrientation(controlledEntity, dt)
                lastControlledPositionRef.current = nextPositionValue
                updateRemoteShipEntities(dt, nextPositionValue, shipForwardRef.current)
                updateRemoteShipDataset()
                canvas.dataset.shipX = nextPosition.x.toFixed(2)
                canvas.dataset.shipY = nextPosition.y.toFixed(2)
                canvas.dataset.shipZ = nextPosition.z.toFixed(2)
                canvas.dataset.shipForwardX = shipForwardRef.current.x.toFixed(4)
                canvas.dataset.shipForwardY = shipForwardRef.current.y.toFixed(4)
                canvas.dataset.shipForwardZ = shipForwardRef.current.z.toFixed(4)
                canvas.dataset.authoritativeUpdates = String(authoritativeUpdateCountRef.current)
                const clearanceGuardBoxes = resolveExpandedGuardBoxes(shipForwardRef.current)
                const nearestGuardClearance = clearanceGuardBoxes.length
                    ? Math.min(...clearanceGuardBoxes.map((guard) => distanceToAabbSurface(nextPositionValue, guard)))
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
                    const nosePosition = {
                        x: nextPositionValue.x + shipForwardRef.current.x * controlledHalfExtents.x,
                        y: nextPositionValue.y + shipForwardRef.current.y * controlledHalfExtents.x,
                        z: nextPositionValue.z + shipForwardRef.current.z * controlledHalfExtents.x
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

            app.start()
            canvas.dataset.runtimeModuleExecuted = requiresRuntimeModule ? 'true' : 'not_required'
            if (selectedModule?.codename) {
                canvas.dataset.runtimeModuleCodename = selectedModule.codename
            } else {
                delete canvas.dataset.runtimeModuleCodename
            }
            setReady(true)
            ;(canvas as PlayCanvasControlCanvas).__playcanvasMoveToTarget = (target, objectId) => {
                const currentRealtimeStatus = (canvas.dataset.realtimeStatus as RealtimeStatus | undefined) ?? 'connecting'
                if (!room || !localShipIdRef.current || !isRealtimeMovementEnabled(currentRealtimeStatus, canControlScene)) {
                    return
                }
                const controlledEntity = entities.get(controlledObjectId)
                const currentPosition = controlledEntity?.getPosition()
                const currentPositionValue = currentPosition ? { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z } : null
                if (!target) {
                    intentSeqRef.current += 1
                    room.send('intent', createStopIntent(intentSeqRef.current))
                    predictionQueueRef.current = [{ seq: intentSeqRef.current, target: null }]
                    predictedTargetRef.current = null
                    canvas.dataset.lastIntentKind = 'stop'
                    canvas.dataset.predictionActive = 'false'
                    delete canvas.dataset.lastIntentObjectId
                    delete canvas.dataset.lastIntentTargetX
                    delete canvas.dataset.lastIntentTargetY
                    delete canvas.dataset.lastIntentTargetZ
                } else if (objectId) {
                    intentSeqRef.current += 1
                    room.send('intent', createMoveToObjectIntent(objectId, intentSeqRef.current))
                    const remoteShipCount = Number(canvas.dataset.remoteShipCount)
                    const shouldPredictObjectMovement = !Number.isFinite(remoteShipCount) || remoteShipCount <= 0
                    const safeTarget = currentPositionValue
                        ? resolveSafeTargetOutsideGuardBoxes(currentPositionValue, target, controlledHalfExtents, guardBoxes)
                        : target
                    predictionQueueRef.current.push({ seq: intentSeqRef.current, target: shouldPredictObjectMovement ? safeTarget : null })
                    predictedTargetRef.current = shouldPredictObjectMovement ? safeTarget : null
                    if (currentPositionValue && shouldPredictObjectMovement) {
                        updateDesiredOrientation(currentPositionValue, safeTarget)
                    }
                    canvas.dataset.lastIntentKind = 'move_to_object'
                    canvas.dataset.lastIntentObjectId = objectId
                    canvas.dataset.lastIntentTargetX = safeTarget.x.toFixed(2)
                    canvas.dataset.lastIntentTargetY = safeTarget.y.toFixed(2)
                    canvas.dataset.lastIntentTargetZ = safeTarget.z.toFixed(2)
                    canvas.dataset.predictionActive = shouldPredictObjectMovement ? 'true' : 'false'
                } else {
                    intentSeqRef.current += 1
                    room.send('intent', createMoveToPointIntent(target, intentSeqRef.current))
                    const remoteObstacleBoxes = resolveRemoteShipObstacleBoxes()
                    const remoteShipCount = Number(canvas.dataset.remoteShipCount)
                    const shouldPredictPointMovement = !Number.isFinite(remoteShipCount) || remoteShipCount <= 0
                    const safeTarget =
                        currentPositionValue && shouldPredictPointMovement
                            ? clampSegmentBeforeObstacleContact(
                                  currentPositionValue,
                                  target,
                                  controlledHalfExtents,
                                  normalizeForward(
                                      {
                                          x: target.x - currentPositionValue.x,
                                          y: target.y - currentPositionValue.y,
                                          z: target.z - currentPositionValue.z
                                      },
                                      shipForwardRef.current
                                  ),
                                  remoteObstacleBoxes
                              ) ?? target
                            : target
                    predictionQueueRef.current.push({ seq: intentSeqRef.current, target: shouldPredictPointMovement ? safeTarget : null })
                    predictedTargetRef.current = shouldPredictPointMovement ? safeTarget : null
                    if (currentPositionValue && shouldPredictPointMovement) {
                        updateDesiredOrientation(currentPositionValue, safeTarget)
                    }
                    canvas.dataset.lastIntentKind = 'move_to_point'
                    canvas.dataset.lastIntentTargetX = safeTarget.x.toFixed(2)
                    canvas.dataset.lastIntentTargetY = safeTarget.y.toFixed(2)
                    canvas.dataset.lastIntentTargetZ = safeTarget.z.toFixed(2)
                    canvas.dataset.predictionActive = shouldPredictPointMovement ? 'true' : 'false'
                    delete canvas.dataset.lastIntentObjectId
                }
            }
            ;(canvas as PlayCanvasControlCanvas).__playcanvasPickAt = pickAt

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

            const connectRealtime = async () => {
                if (!applicationId) {
                    updateRealtimeStatus('unavailable')
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
                    if (disposed) {
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
                            predictedTargetRef.current =
                                predictionQueueRef.current[predictionQueueRef.current.length - 1]?.target ??
                                (remoteShips.size === 0 && localShip.hasTarget === true && localShip.target ? localShip.target : null)
                            if (!predictedTargetRef.current) {
                                canvas.dataset.predictionActive = 'false'
                                predictionSpeedRef.current = Number.isFinite(localShip.speed) ? Math.max(0, localShip.speed ?? 0) : 0
                            }
                            canvas.dataset.lastProcessedInputSeq = String(localShip.lastProcessedInputSeq)
                            canvas.dataset.pendingPredictionCount = String(predictionQueueRef.current.length)
                        }
                        if (primaryShipId && !localShipIdRef.current && !canControlScene) {
                            canvas.dataset.observedShipAssigned = 'true'
                        }
                        authoritativePositionRef.current = readAuthoritativePosition(state, primaryShipId)
                        authoritativeVelocityRef.current =
                            localShip?.velocity && isFiniteVector3(localShip.velocity)
                                ? { x: localShip.velocity.x, y: localShip.velocity.y, z: localShip.velocity.z }
                                : null
                        if (localShip && typeof localShip.speed === 'number' && Number.isFinite(localShip.speed)) {
                            predictionSpeedRef.current = Math.max(0, localShip.speed)
                        }
                        remoteShipsRef.current = remoteShips
                        const nextParticipantSummary = {
                            total: shipEntries.length || (state.ship?.position ? 1 : 0),
                            remote: remoteShips.size
                        }
                        setParticipantSummary((current) =>
                            current.total === nextParticipantSummary.total && current.remote === nextParticipantSummary.remote
                                ? current
                                : nextParticipantSummary
                        )
                        canvas.dataset.remoteShipCount = String(remoteShips.size)
                        canvas.dataset.shipCount = String(nextParticipantSummary.total)
                        const firstRemote = Array.from(remoteShips.values())[0]
                        if (firstRemote) {
                            canvas.dataset.remoteShipX = firstRemote.position.x.toFixed(2)
                            canvas.dataset.remoteShipY = firstRemote.position.y.toFixed(2)
                            canvas.dataset.remoteShipZ = firstRemote.position.z.toFixed(2)
                            if (firstRemote.heading) {
                                canvas.dataset.remoteShipForwardX = firstRemote.heading.x.toFixed(4)
                                canvas.dataset.remoteShipForwardY = firstRemote.heading.y.toFixed(4)
                                canvas.dataset.remoteShipForwardZ = firstRemote.heading.z.toFixed(4)
                            }
                        } else {
                            delete canvas.dataset.remoteShipX
                            delete canvas.dataset.remoteShipY
                            delete canvas.dataset.remoteShipZ
                            delete canvas.dataset.remoteShipForwardX
                            delete canvas.dataset.remoteShipForwardY
                            delete canvas.dataset.remoteShipForwardZ
                        }
                        if (authoritativePositionRef.current) {
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
                                    lastControlledPositionRef.current = assignedPosition
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
                } catch (cause) {
                    room = null
                    authoritativePositionRef.current = null
                    predictedTargetRef.current = null
                    setLocalShipAssigned(false)
                    updateRealtimeStatus(resolveRealtimeFailureStatus(cause, false))
                }
            }

            void connectRealtime()

            return () => {
                disposed = true
                setParticipantSummary({ total: 0, remote: 0 })
                setLocalShipAssigned(false)
                clearRealtimeTimers()
                void room?.leave(true)
                observer.disconnect()
                canvas.removeEventListener('playcanvas-camera-control', handleCameraControl)
                canvas.removeEventListener('playcanvas-camera-drag', handleCameraDrag)
                container.removeEventListener('wheel', handleNativeWheel, { capture: true })
                setReady(false)
                predictedTargetRef.current = null
                predictionQueueRef.current = []
                remoteShipsRef.current = new Map()
                remoteRenderedShipsRef.current = new Map()
                remoteForwardsRef.current = new Map()
                remoteEntities.forEach((entity) => entity.destroy())
                remoteEntities.clear()
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

    const movementControlsEnabled = localShipAssigned && isRealtimeMovementEnabled(realtimeStatus, canControlScene)

    const moveToConfiguredTarget = () => {
        if (!movementControlsEnabled) {
            return
        }
        const target = sceneObjects.find((item) => item.id === targetObjectId)
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        if (target && canvas?.__playcanvasMoveToTarget) {
            canvas.__playcanvasMoveToTarget(target.position, target.id)
        }
    }

    const stop = () => {
        if (!movementControlsEnabled) {
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

    const releaseCapturedPointer = (canvas: HTMLCanvasElement | null) => {
        const pointerId = capturedPointerIdRef.current
        if (canvas && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
            canvas.releasePointerCapture(pointerId)
        }
        if (canvas) {
            canvas.dataset.pointerCaptured = 'false'
        }
        capturedPointerIdRef.current = null
    }

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        capturedPointerIdRef.current = event.pointerId
        event.currentTarget.dataset.pointerCaptured = 'true'
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
    const showViewOnlyState = (realtimeStatus === 'connected' || realtimeStatus === 'restored') && (!canControlScene || !localShipAssigned)

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
                {participantSummary.total > 0 ? (
                    <Typography variant='caption' color='text.secondary' data-testid='playcanvas-participants-status' sx={{ minWidth: 0 }}>
                        {canControlScene
                            ? t('playcanvasCanvas.participantsStatus', {
                                  defaultValue: `Ships: ${participantSummary.total} (you + ${participantSummary.remote} remote)`,
                                  total: participantSummary.total,
                                  remote: participantSummary.remote
                              })
                            : t('playcanvasCanvas.participantsViewOnlyStatus', {
                                  defaultValue: `Ships: ${participantSummary.total} (view only)`,
                                  total: participantSummary.total
                              })}
                    </Typography>
                ) : null}
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
