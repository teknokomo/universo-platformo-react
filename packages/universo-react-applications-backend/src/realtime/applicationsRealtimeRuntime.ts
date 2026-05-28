import type { Server as HttpServer } from 'http'
import { createRequire } from 'module'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { verifySupabaseJwt } from '@universo-react/auth-backend'
import { getPoolExecutor, qSchemaTable } from '@universo-react/database'
import { playcanvasCanvasWidgetConfigSchema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import {
    Room,
    Server,
    applyMoveToPointIntent,
    applyStopIntent,
    createStoppedMovementState,
    matchMaker,
    resolveSafeTargetOutsideGuards,
    stepFixedTickMovement,
    type Client as RoomClient,
    type Transport
} from '@universo-react/colyseus-server'
import { ensureApplicationAccess, resolveEffectiveRolePermissions, type ApplicationRole, type RolePermission } from '../routes/guards'
import { findApplicationSchemaInfo } from '../persistence/applicationsStore'
import { resolveRuntimeWorkspaceAccess } from '../services/applicationWorkspaces'
import { RuntimeModulesService } from '../services/runtimeModulesService'
import { resolvePublicRuntimeSchema } from '../shared/publicRuntimeAccess'
import { isRealtimeMatchmakeMethodAllowed, resolveRealtimeClientCanControl, selectRealtimeControllerSessionId } from './realtimeAccess'

const requireModule = createRequire(__filename)

interface RealtimeVector3 {
    x: number
    y: number
    z: number
}

interface MovementIntent {
    type: 'move_to_point' | 'move_to_object' | 'stop'
    target?: RealtimeVector3
    objectId?: string
}

interface FixedTickSceneRoomOptions {
    scopeId: string
    accessMode: 'member' | 'public'
    applicationId: string
    clientCanControl: boolean
    initialPosition: RealtimeVector3
    targetObjects: Record<string, RealtimeVector3>
    guardBoxes: Array<{ center: RealtimeVector3; halfExtents: RealtimeVector3 }>
    controlledHalfExtents: RealtimeVector3
    cruiseSpeed: number
    acceleration: number
    deceleration: number
    arrivalRadius: number
    runtimeModuleId: string | null
    runtimeModuleChecksum: string | null
}

const DEFAULT_POSITION: RealtimeVector3 = { x: 0, y: 0, z: 0 }
const DEFAULT_TARGET_OBJECT: RealtimeVector3 = { x: 72, y: 0, z: -48 }
const DEFAULT_GUARD = {
    center: DEFAULT_TARGET_OBJECT,
    halfExtents: { x: 24, y: 8, z: 8 }
}
const DEFAULT_ROOM_OPTIONS: FixedTickSceneRoomOptions = {
    scopeId: 'default',
    accessMode: 'member',
    applicationId: 'default',
    clientCanControl: false,
    initialPosition: DEFAULT_POSITION,
    targetObjects: { target: DEFAULT_TARGET_OBJECT },
    guardBoxes: [DEFAULT_GUARD],
    controlledHalfExtents: { x: 6, y: 2, z: 2 },
    cruiseSpeed: 36,
    acceleration: 48,
    deceleration: 48,
    arrivalRadius: 0.5,
    runtimeModuleId: null,
    runtimeModuleChecksum: null
}

let matchMakerAcceptPromise: Promise<void> | null = null
const MAX_MATCHMAKE_BODY_BYTES = 64 * 1024
const MAX_SCENE_COORDINATE_ABS = 100000

const readJsonRequestBody = (req: Request): Promise<unknown> =>
    new Promise((resolve, reject) => {
        if (req.body && typeof req.body === 'object') {
            if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_MATCHMAKE_BODY_BYTES) {
                reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }))
                return
            }
            resolve(req.body)
            return
        }

        let data = ''
        let size = 0

        req.on('data', (chunk: Buffer | string) => {
            size += Buffer.byteLength(chunk)
            if (size > MAX_MATCHMAKE_BODY_BYTES) {
                reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }))
                req.destroy()
                return
            }
            data += chunk.toString()
        })
        req.on('end', () => {
            if (!data) {
                resolve({})
                return
            }
            try {
                resolve(JSON.parse(data))
            } catch (cause) {
                reject(cause)
            }
        })
        req.on('error', reject)
    })

interface MatchmakeAccessOptions {
    accessMode?: unknown
    applicationId?: unknown
    moduleCodename?: unknown
    objectCollectionId?: unknown
    widgetId?: unknown
    workspaceId?: unknown
}

interface NormalizedMatchmakeAccessOptions {
    accessMode: 'member' | 'public'
    applicationId: string
    moduleCodename?: string
    objectCollectionId?: string
    widgetId?: string
    workspaceId?: string
}

type AuthenticatedRequest = Request & {
    user?: { id?: string }
    session?: {
        tokens?: {
            access?: string
        }
    }
}

const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const normalizeAccessOptions = (value: unknown): NormalizedMatchmakeAccessOptions => {
    const candidate = value && typeof value === 'object' ? (value as MatchmakeAccessOptions) : {}
    const applicationId = typeof candidate.applicationId === 'string' ? candidate.applicationId.trim() : ''
    if (!isUuid(applicationId)) {
        throw Object.assign(new Error('Invalid realtime application'), { statusCode: 400 })
    }
    const workspaceId = typeof candidate.workspaceId === 'string' ? candidate.workspaceId.trim() : ''
    if (workspaceId && !isUuid(workspaceId)) {
        throw Object.assign(new Error('Invalid realtime workspace'), { statusCode: 400 })
    }

    const accessMode = candidate.accessMode === 'public' ? 'public' : 'member'
    return {
        accessMode,
        applicationId,
        moduleCodename: typeof candidate.moduleCodename === 'string' ? candidate.moduleCodename.trim().slice(0, 128) : undefined,
        objectCollectionId:
            typeof candidate.objectCollectionId === 'string' && candidate.objectCollectionId.trim().length > 0
                ? candidate.objectCollectionId.trim().slice(0, 128)
                : undefined,
        widgetId:
            typeof candidate.widgetId === 'string' && isUuid(candidate.widgetId.trim())
                ? candidate.widgetId.trim().slice(0, 128)
                : undefined,
        workspaceId: workspaceId || undefined
    }
}

const resolveUserIdFromRequest = async (token: string | null, req?: Request): Promise<string | null> => {
    const authenticatedReq = req as AuthenticatedRequest | undefined
    const sessionToken = authenticatedReq?.session?.tokens?.access
    const tokenToVerify = token || sessionToken || null
    if (!tokenToVerify) {
        return authenticatedReq?.user?.id ?? null
    }

    const { payload } = await verifySupabaseJwt(tokenToVerify)
    const userId = payload.sub || payload.user_id || payload.uid
    return typeof userId === 'string' && userId.length > 0 ? userId : null
}

const toBoundedVector = (value: unknown): RealtimeVector3 | null =>
    isBoundedVector3(value) ? { x: value.x, y: value.y, z: value.z } : null

const toRoomOptionRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const toTargetObjects = (value: unknown): Record<string, RealtimeVector3> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }

    const targetObjects: Record<string, RealtimeVector3> = {}
    for (const [id, position] of Object.entries(value)) {
        if (typeof id !== 'string' || id.length === 0 || id.length > 128) {
            continue
        }
        const vector = toBoundedVector(position)
        if (vector) {
            targetObjects[id] = vector
        }
    }
    return Object.keys(targetObjects).length ? targetObjects : null
}

const toGuardBoxes = (value: unknown): Array<{ center: RealtimeVector3; halfExtents: RealtimeVector3 }> | null => {
    if (!Array.isArray(value)) {
        return null
    }

    const boxes = value
        .map((guard) => {
            const record = toRoomOptionRecord(guard)
            const center = toBoundedVector(record.center)
            const halfExtents = toBoundedVector(record.halfExtents)
            return center && halfExtents ? { center, halfExtents } : null
        })
        .filter((guard): guard is { center: RealtimeVector3; halfExtents: RealtimeVector3 } => Boolean(guard))
        .slice(0, 16)

    return boxes.length ? boxes : null
}

const loadRoomOptionsFromApplicationSchema = async (
    executor: DbExecutor,
    params: {
        applicationId: string
        accessMode: 'member' | 'public'
        moduleCodename?: unknown
        objectCollectionId?: unknown
        widgetId?: unknown
        workspaceId?: string | null
        currentUserId?: string | null
        permissions?: Record<RolePermission, boolean> | null
    }
): Promise<FixedTickSceneRoomOptions> => {
    const application = await findApplicationSchemaInfo(executor, params.applicationId)
    if (!application?.schemaName) {
        throw Object.assign(new Error('Application runtime is not configured'), { statusCode: 404 })
    }

    const layoutsTable = qSchemaTable(application.schemaName, '_app_layouts')
    const widgetsTable = qSchemaTable(application.schemaName, '_app_widgets')
    const rows = await executor.query<{ widgetId: string; config: unknown }>(
        `
        SELECT w.id::text AS "widgetId", w.config
        FROM ${widgetsTable} w
        INNER JOIN ${layoutsTable} l ON l.id = w.layout_id
        WHERE w.widget_key = $1
          AND w.is_active = true
          AND w._upl_deleted = false
          AND w._app_deleted = false
          AND l.is_active = true
          AND l._upl_deleted = false
          AND l._app_deleted = false
          AND ($2::text IS NULL OR w.id::text = $2)
          AND ($3::text IS NULL OR w.config->>'moduleCodename' = $3)
        ORDER BY l.is_default DESC, l.sort_order ASC, w.sort_order ASC, w.id ASC
        LIMIT 1
        `,
        [
            'playcanvasCanvas',
            typeof params.widgetId === 'string' && isUuid(params.widgetId.trim()) ? params.widgetId.trim() : null,
            typeof params.moduleCodename === 'string' && params.moduleCodename.trim() ? params.moduleCodename.trim() : null
        ]
    )

    if (!rows[0]) {
        throw Object.assign(new Error('Realtime scene configuration is not available'), { statusCode: 404 })
    }

    const parsed = playcanvasCanvasWidgetConfigSchema.safeParse(rows[0].config)
    if (!parsed.success) {
        throw Object.assign(new Error('Realtime scene configuration is invalid'), { statusCode: 400 })
    }
    const modulesService = new RuntimeModulesService()
    const widgetModuleCodename =
        typeof parsed.data.moduleCodename === 'string' && parsed.data.moduleCodename.trim().length > 0
            ? parsed.data.moduleCodename.trim()
            : null
    if (params.moduleCodename && widgetModuleCodename !== params.moduleCodename) {
        throw Object.assign(new Error('Realtime scene module is not available'), { statusCode: 404 })
    }
    if (widgetModuleCodename) {
        const widgetModule = await modulesService.getActiveModuleByCodename({
            executor,
            schemaName: application.schemaName,
            codename: widgetModuleCodename,
            attachedToKind: parsed.data.attachedToKind ?? 'metahub',
            moduleRole: 'widget'
        })
        if (!widgetModule?.clientBundle) {
            throw Object.assign(new Error('Realtime scene module is not available'), { statusCode: 404 })
        }
    }

    const serverModuleCodename =
        typeof parsed.data.serverModuleCodename === 'string' && parsed.data.serverModuleCodename.trim().length > 0
            ? parsed.data.serverModuleCodename.trim()
            : null

    const sceneObjects = parsed.data.scene?.objects?.length
        ? parsed.data.scene.objects.map((object) => ({
              id: object.id,
              position: object.position,
              scale: object.scale,
              guard: object.guard
          }))
        : [
              { id: 'controlled', position: DEFAULT_POSITION, scale: { x: 12, y: 4, z: 4 }, guard: false },
              { id: 'target', position: DEFAULT_TARGET_OBJECT, scale: { x: 48, y: 16, z: 16 }, guard: true }
          ]
    const controlledObjectId = parsed.data.scene?.controlledObjectId ?? sceneObjects[0]?.id ?? 'controlled'
    const targetObjects: Record<string, RealtimeVector3> = {}
    const guardBoxes: Array<{ center: RealtimeVector3; halfExtents: RealtimeVector3 }> = []

    for (const object of sceneObjects) {
        const position = toBoundedVector(object.position)
        const scale = toBoundedVector(object.scale)
        if (!position || !scale) {
            continue
        }
        if (object.id !== controlledObjectId) {
            targetObjects[object.id] = position
        }
        if (object.guard) {
            guardBoxes.push({
                center: position,
                halfExtents: {
                    x: Math.abs(scale.x) / 2,
                    y: Math.abs(scale.y) / 2,
                    z: Math.abs(scale.z) / 2
                }
            })
        }
    }

    const controlled = sceneObjects.find((object) => object.id === controlledObjectId)
    const controlledScale = toBoundedVector(controlled?.scale)
    let moduleRoomOptions: Record<string, unknown> = {}
    let runtimeModuleId: string | null = null
    let runtimeModuleChecksum: string | null = null

    if (serverModuleCodename) {
        const serverModule = await modulesService.getActiveModuleByCodename({
            executor,
            schemaName: application.schemaName,
            codename: serverModuleCodename,
            attachedToKind: 'metahub',
            moduleRole: 'module'
        })
        if (
            !serverModule?.serverBundle ||
            !serverModule.manifest.methods.some(
                (method) =>
                    method.name === 'createRealtimeRoomOptions' &&
                    (method.target === 'server' || method.target === 'server_and_client') &&
                    !method.eventName
            )
        ) {
            throw Object.assign(new Error('Realtime server module is not available'), { statusCode: 404 })
        }

        moduleRoomOptions = toRoomOptionRecord(
            await modulesService.callInternalServerMethod({
                executor,
                applicationId: params.applicationId,
                schemaName: application.schemaName,
                moduleCodename: serverModuleCodename,
                attachedToKind: 'metahub',
                moduleRole: 'module',
                methodName: 'createRealtimeRoomOptions',
                currentWorkspaceId: params.workspaceId ?? null,
                currentUserId: params.currentUserId ?? null,
                permissions: params.permissions ?? null,
                args: [
                    {
                        accessMode: params.accessMode,
                        widgetId: rows[0].widgetId,
                        workspaceId: params.workspaceId ?? null,
                        scene: parsed.data.scene ?? null
                    }
                ]
            })
        )
        runtimeModuleId = serverModule.id
        runtimeModuleChecksum = serverModule.checksum
    } else if (widgetModuleCodename) {
        throw Object.assign(new Error('Realtime server module is not configured'), { statusCode: 404 })
    }

    const moduleKey = runtimeModuleId ? `${runtimeModuleId}:${runtimeModuleChecksum ?? 'runtime'}` : widgetModuleCodename ?? 'playcanvas'
    const workspaceKey = params.workspaceId && isUuid(params.workspaceId) ? params.workspaceId : 'global'
    const moduleTargetObjects = toTargetObjects(moduleRoomOptions.targetObjects)
    const moduleGuardBoxes = toGuardBoxes(moduleRoomOptions.guardBoxes)

    return {
        scopeId: `${params.applicationId}:${params.accessMode}:${workspaceKey}:${rows[0].widgetId}:${moduleKey}`,
        accessMode: params.accessMode,
        applicationId: params.applicationId,
        clientCanControl: false,
        initialPosition:
            toBoundedVector(moduleRoomOptions.initialPosition) ??
            toBoundedVector(controlled?.position) ??
            DEFAULT_ROOM_OPTIONS.initialPosition,
        targetObjects: moduleTargetObjects ?? (Object.keys(targetObjects).length ? targetObjects : DEFAULT_ROOM_OPTIONS.targetObjects),
        guardBoxes: moduleGuardBoxes ?? (guardBoxes.length ? guardBoxes : DEFAULT_ROOM_OPTIONS.guardBoxes),
        controlledHalfExtents:
            toBoundedVector(moduleRoomOptions.controlledHalfExtents) ??
            (controlledScale
                ? { x: Math.abs(controlledScale.x) / 2, y: Math.abs(controlledScale.y) / 2, z: Math.abs(controlledScale.z) / 2 }
                : DEFAULT_ROOM_OPTIONS.controlledHalfExtents),
        cruiseSpeed: clampNumber(
            moduleRoomOptions.cruiseSpeed,
            parsed.data.scene?.cruiseSpeed ?? DEFAULT_ROOM_OPTIONS.cruiseSpeed,
            1,
            1000
        ),
        acceleration: clampNumber(moduleRoomOptions.acceleration, DEFAULT_ROOM_OPTIONS.acceleration, 1, 1000),
        deceleration: clampNumber(moduleRoomOptions.deceleration, DEFAULT_ROOM_OPTIONS.deceleration, 1, 1000),
        arrivalRadius: clampNumber(moduleRoomOptions.arrivalRadius, DEFAULT_ROOM_OPTIONS.arrivalRadius, 0.1, 100),
        runtimeModuleId,
        runtimeModuleChecksum
    }
}

const authorizeAndBuildRoomOptions = async (token: string | null, options: unknown, req?: Request): Promise<FixedTickSceneRoomOptions> => {
    const access = normalizeAccessOptions(options)
    const executor = getPoolExecutor()
    let currentWorkspaceId: string | null = null
    let currentUserId: string | null = null
    let permissions: Record<RolePermission, boolean> | null = null
    let clientCanControl = false

    if (access.accessMode === 'public') {
        const publicRuntime = await resolvePublicRuntimeSchema(getPoolExecutor, access.applicationId, undefined, {
            workspaceId: typeof access.workspaceId === 'string' ? access.workspaceId : null,
            requireResolvedWorkspace: false
        })
        if (!publicRuntime) {
            throw Object.assign(new Error('Realtime runtime is not available'), { statusCode: 403 })
        }
        currentWorkspaceId = publicRuntime.currentWorkspaceId
    } else {
        const userId = await resolveUserIdFromRequest(token, req)
        if (!userId) {
            throw Object.assign(new Error('Realtime authentication is required'), { statusCode: 401 })
        }
        currentUserId = userId
        const accessContext = await ensureApplicationAccess(executor, userId, access.applicationId)
        const application = await findApplicationSchemaInfo(executor, access.applicationId)
        if (!application?.schemaName) {
            throw Object.assign(new Error('Application runtime is not configured'), { statusCode: 404 })
        }
        const role = (accessContext.membership.role || 'member') as ApplicationRole
        permissions = resolveEffectiveRolePermissions(role, application.settings ?? {})
        clientCanControl = resolveRealtimeClientCanControl(access.accessMode, role, application.settings ?? {})
        if (application.workspacesEnabled) {
            const workspaceAccess = await resolveRuntimeWorkspaceAccess(executor, {
                schemaName: application.schemaName,
                workspacesEnabled: application.workspacesEnabled,
                userId,
                actorUserId: userId,
                ensurePersonalWorkspace: false
            })
            const requestedWorkspaceId = typeof access.workspaceId === 'string' ? access.workspaceId : null
            currentWorkspaceId = requestedWorkspaceId ?? workspaceAccess.defaultWorkspaceId
            if (!currentWorkspaceId || !workspaceAccess.allowedWorkspaceIds.includes(currentWorkspaceId)) {
                throw Object.assign(new Error('Realtime workspace is not available'), { statusCode: 403 })
            }
        }
    }

    const roomOptions = await loadRoomOptionsFromApplicationSchema(executor, {
        applicationId: access.applicationId,
        accessMode: access.accessMode,
        moduleCodename: access.moduleCodename,
        objectCollectionId: access.objectCollectionId,
        widgetId: access.widgetId,
        workspaceId: currentWorkspaceId,
        currentUserId,
        permissions
    })
    return { ...roomOptions, clientCanControl }
}

const createSharedServerMatchmakingMiddleware =
    () =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.path.startsWith(`/${matchMaker.controller.matchmakeRoute}/`)) {
            next()
            return
        }

        if (req.method === 'OPTIONS') {
            res.status(204).end()
            return
        }

        if (req.method !== 'POST') {
            next()
            return
        }

        const match = req.path.match(/^\/matchmake\/(\w+)\/(.+)/)
        if (!match) {
            next()
            return
        }

        const [, method, roomName] = match
        try {
            if (!isRealtimeMatchmakeMethodAllowed(method)) {
                res.status(403).json({ error: 'Forbidden' })
                return
            }

            const headers = new Headers(req.headers as Record<string, string>)
            const requestBody = await readJsonRequestBody(req)
            const roomOptions = await authorizeAndBuildRoomOptions(
                headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null,
                requestBody,
                req
            )
            const response = await matchMaker.controller.invokeMethod(method, roomName, roomOptions, {
                token: headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
                headers,
                ip: req.ip ?? req.socket.remoteAddress ?? '',
                req
            })

            res.type('application/json').send(JSON.stringify(response))
        } catch (cause) {
            const error = cause as { code?: number; statusCode?: number; status?: number }
            const status = error.statusCode ?? error.status ?? (error.code && error.code >= 400 ? error.code : 500)
            res.status(status).json({
                error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Matchmaking request failed'
            })
        }
    }

const isVector3 = (value: unknown): value is RealtimeVector3 => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const candidate = value as Partial<RealtimeVector3>
    return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)
}

const isBoundedVector3 = (value: unknown): value is RealtimeVector3 =>
    isVector3(value) &&
    Math.abs(value.x) <= MAX_SCENE_COORDINATE_ABS &&
    Math.abs(value.y) <= MAX_SCENE_COORDINATE_ABS &&
    Math.abs(value.z) <= MAX_SCENE_COORDINATE_ABS

const parseMovementIntent = (value: unknown): MovementIntent | null => {
    if (!value || typeof value !== 'object') {
        return null
    }

    const candidate = value as Partial<MovementIntent>
    if (candidate.type === 'stop') {
        return { type: 'stop' }
    }
    if (candidate.type === 'move_to_point') {
        const target = toBoundedVector(candidate.target)
        return target ? { type: 'move_to_point', target } : null
    }
    if (candidate.type === 'move_to_object' && typeof candidate.objectId === 'string') {
        return { type: 'move_to_object', objectId: candidate.objectId }
    }
    return null
}

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Number(value))) : fallback

const parseRoomOptions = (value: unknown): FixedTickSceneRoomOptions => {
    if (!value || typeof value !== 'object') {
        return DEFAULT_ROOM_OPTIONS
    }

    const candidate = value as Partial<FixedTickSceneRoomOptions>
    const targetObjects: Record<string, RealtimeVector3> = {}
    if (candidate.targetObjects && typeof candidate.targetObjects === 'object') {
        for (const [id, position] of Object.entries(candidate.targetObjects)) {
            if (typeof id === 'string' && id.length > 0 && id.length <= 128 && isBoundedVector3(position)) {
                targetObjects[id] = position
            }
        }
    }

    const guardBoxes = Array.isArray(candidate.guardBoxes)
        ? candidate.guardBoxes
              .filter(
                  (guard): guard is { center: RealtimeVector3; halfExtents: RealtimeVector3 } =>
                      isBoundedVector3(guard?.center) && isBoundedVector3(guard?.halfExtents)
              )
              .slice(0, 16)
        : DEFAULT_ROOM_OPTIONS.guardBoxes

    return {
        scopeId:
            typeof candidate.scopeId === 'string' && candidate.scopeId.trim()
                ? candidate.scopeId.slice(0, 256)
                : DEFAULT_ROOM_OPTIONS.scopeId,
        accessMode: candidate.accessMode === 'public' ? 'public' : DEFAULT_ROOM_OPTIONS.accessMode,
        applicationId:
            typeof candidate.applicationId === 'string' && candidate.applicationId.trim()
                ? candidate.applicationId.slice(0, 128)
                : DEFAULT_ROOM_OPTIONS.applicationId,
        clientCanControl: candidate.accessMode === 'member' && candidate.clientCanControl === true,
        initialPosition: isBoundedVector3(candidate.initialPosition) ? candidate.initialPosition : DEFAULT_ROOM_OPTIONS.initialPosition,
        targetObjects: Object.keys(targetObjects).length ? targetObjects : DEFAULT_ROOM_OPTIONS.targetObjects,
        guardBoxes,
        controlledHalfExtents: isBoundedVector3(candidate.controlledHalfExtents)
            ? candidate.controlledHalfExtents
            : DEFAULT_ROOM_OPTIONS.controlledHalfExtents,
        cruiseSpeed: clampNumber(candidate.cruiseSpeed, DEFAULT_ROOM_OPTIONS.cruiseSpeed, 1, 1000),
        acceleration: clampNumber(candidate.acceleration, DEFAULT_ROOM_OPTIONS.acceleration, 1, 1000),
        deceleration: clampNumber(candidate.deceleration, DEFAULT_ROOM_OPTIONS.deceleration, 1, 1000),
        arrivalRadius: clampNumber(candidate.arrivalRadius, DEFAULT_ROOM_OPTIONS.arrivalRadius, 0.1, 100),
        runtimeModuleId:
            typeof candidate.runtimeModuleId === 'string' && candidate.runtimeModuleId.trim()
                ? candidate.runtimeModuleId.slice(0, 128)
                : null,
        runtimeModuleChecksum:
            typeof candidate.runtimeModuleChecksum === 'string' && candidate.runtimeModuleChecksum.trim()
                ? candidate.runtimeModuleChecksum.slice(0, 128)
                : null
    }
}

interface MutableVector3State {
    x: number
    y: number
    z: number
}

interface MutableShipState {
    position: MutableVector3State
    velocity: MutableVector3State
    target: MutableVector3State
    hasTarget: boolean
    speed: number
}

interface MutableFixedTickSceneState {
    ship: MutableShipState
    blocked: boolean
    arrived: boolean
}

interface RealtimeClientAuth {
    clientCanControl?: unknown
}

const assignVector3State = (target: MutableVector3State, source: RealtimeVector3): void => {
    target.x = source.x
    target.y = source.y
    target.z = source.z
}

const assignMovementState = (target: MutableShipState, source: ReturnType<typeof createStoppedMovementState>): void => {
    assignVector3State(target.position, source.position)
    assignVector3State(target.velocity, source.velocity)
    if (source.target) {
        assignVector3State(target.target, source.target)
        target.hasTarget = true
    } else {
        assignVector3State(target.target, DEFAULT_POSITION)
        target.hasTarget = false
    }
    target.speed = source.speed
}

const createFixedTickSceneRoom = (SchemaBase: new () => object, defineTypes: (type: unknown, fields: Record<string, unknown>) => void) => {
    class Vector3State extends SchemaBase implements MutableVector3State {
        x = 0
        y = 0
        z = 0
    }

    defineTypes(Vector3State, {
        x: 'number',
        y: 'number',
        z: 'number'
    })

    class ShipState extends SchemaBase implements MutableShipState {
        position = new Vector3State()
        velocity = new Vector3State()
        target = new Vector3State()
        hasTarget = false
        speed = 0
    }

    defineTypes(ShipState, {
        position: Vector3State,
        velocity: Vector3State,
        target: Vector3State,
        hasTarget: 'boolean',
        speed: 'number'
    })

    class FixedTickSceneState extends SchemaBase implements MutableFixedTickSceneState {
        ship = new ShipState()
        blocked = false
        arrived = false
    }

    defineTypes(FixedTickSceneState, {
        ship: ShipState,
        blocked: 'boolean',
        arrived: 'boolean'
    })

    return class FixedTickSceneRoom extends Room {
        private movement = createStoppedMovementState(DEFAULT_POSITION)
        private roomOptions = DEFAULT_ROOM_OPTIONS
        private controllerSessionId: string | null = null
        private readonly clientControl = new Map<string, boolean>()

        onCreate(options?: unknown) {
            this.roomOptions = parseRoomOptions(options)
            this.movement = createStoppedMovementState(this.roomOptions.initialPosition)
            this.setPatchRate(50)
            this.setMetadata({ scopeId: this.roomOptions.scopeId })
            const state = new FixedTickSceneState()
            assignMovementState(state.ship, this.movement)
            this.setState(state)

            this.onMessage('intent', (client, payload) => {
                if (!this.canControl(client)) {
                    return
                }

                const intent = parseMovementIntent(payload)
                if (!intent) {
                    return
                }

                if (intent.type === 'stop') {
                    this.movement = applyStopIntent(this.movement)
                } else if (intent.type === 'move_to_point' && intent.target) {
                    this.movement = applyMoveToPointIntent(this.movement, intent.target)
                } else if (intent.type === 'move_to_object') {
                    const objectTarget = this.roomOptions.targetObjects[intent.objectId ?? '']
                    if (objectTarget) {
                        this.movement = applyMoveToPointIntent(
                            this.movement,
                            resolveSafeTargetOutsideGuards(
                                this.movement.position,
                                objectTarget,
                                this.roomOptions.guardBoxes,
                                this.roomOptions.controlledHalfExtents
                            )
                        )
                    }
                }
            })

            this.setSimulationInterval((deltaMs) => {
                const result = stepFixedTickMovement(this.movement, deltaMs / 1000, {
                    cruiseSpeed: this.roomOptions.cruiseSpeed,
                    acceleration: this.roomOptions.acceleration,
                    deceleration: this.roomOptions.deceleration,
                    arrivalRadius: this.roomOptions.arrivalRadius,
                    guards: this.roomOptions.guardBoxes,
                    controlledHalfExtents: this.roomOptions.controlledHalfExtents
                })
                this.movement = result.state
                const currentState = this.state as MutableFixedTickSceneState
                assignMovementState(currentState.ship, this.movement)
                currentState.blocked = result.blocked
                currentState.arrived = result.arrived
            })
        }

        onJoin(client: RoomClient, options?: unknown) {
            const clientAuth = (client as RoomClient & { auth?: RealtimeClientAuth }).auth
            const clientOptions = parseRoomOptions(options)
            const clientCanControl = clientAuth?.clientCanControl === true || clientOptions.clientCanControl
            this.clientControl.set(client.sessionId, clientCanControl)
            if (this.roomOptions.accessMode === 'member' && clientCanControl && !this.controllerSessionId) {
                this.controllerSessionId = client.sessionId
            }
        }

        onLeave(client: RoomClient) {
            this.clientControl.delete(client.sessionId)
            if (this.controllerSessionId !== client.sessionId) {
                return
            }
            this.controllerSessionId =
                this.roomOptions.accessMode === 'member'
                    ? selectRealtimeControllerSessionId(this.clients, this.clientControl, client.sessionId)
                    : null
        }

        private canControl(client: RoomClient): boolean {
            return (
                this.roomOptions.accessMode === 'member' &&
                this.controllerSessionId === client.sessionId &&
                this.clientControl.get(client.sessionId) === true
            )
        }

        static async onAuth(_token: string, options: unknown) {
            const parsed = parseRoomOptions(options)
            const authorized =
                isUuid(parsed.applicationId) &&
                parsed.scopeId !== DEFAULT_ROOM_OPTIONS.scopeId &&
                parsed.scopeId.startsWith(`${parsed.applicationId}:`) &&
                Object.keys(parsed.targetObjects).length > 0

            return authorized
                ? {
                      applicationId: parsed.applicationId,
                      scopeId: parsed.scopeId,
                      clientCanControl: parsed.clientCanControl
                  }
                : false
        }
    }
}

export interface ApplicationsRealtimeRuntimeHandle {
    gameServer: Server
    roomName: string
    matchmakeMiddleware: RequestHandler
}

export const __applicationsRealtimeRuntimeTestUtils = {
    loadRoomOptionsFromApplicationSchema,
    parseRoomOptions
}

export const attachApplicationsRealtimeRuntime = async (server: HttpServer): Promise<ApplicationsRealtimeRuntimeHandle> => {
    const { WebSocketTransport } = requireModule('@colyseus/ws-transport') as {
        WebSocketTransport: new (options: { server: HttpServer }) => Transport
    }
    const { Schema, defineTypes } = requireModule('@colyseus/schema') as {
        Schema: new () => object
        defineTypes: (type: unknown, fields: Record<string, unknown>) => void
    }
    const roomName = 'fixed_tick_scene'
    const gameServer = new Server({
        transport: new WebSocketTransport({ server }),
        gracefullyShutdown: false,
        greet: false
    })

    gameServer
        .define(roomName, createFixedTickSceneRoom(Schema, defineTypes as (type: unknown, fields: Record<string, unknown>) => void))
        .filterBy(['scopeId'])
    matchMakerAcceptPromise ??= matchMaker.accept()
    await matchMakerAcceptPromise

    return { gameServer, roomName, matchmakeMiddleware: createSharedServerMatchmakingMiddleware() }
}
