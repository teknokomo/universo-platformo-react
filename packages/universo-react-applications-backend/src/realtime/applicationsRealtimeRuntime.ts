import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto'
import type { Server as HttpServer } from 'http'
import { createRequire } from 'module'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import stableStringify from 'json-stable-stringify'
import { verifySupabaseJwt } from '@universo-react/auth-backend'
import { getPoolExecutor, qSchemaTable } from '@universo-react/database'
import { playcanvasCanvasWidgetConfigSchema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { z } from 'zod'
import {
    Room,
    Server,
    applyMoveToPointIntent,
    applyStopIntent,
    createStoppedMovementState,
    findFreeSpawnPosition,
    matchMaker,
    orientedBodyBoxesOverlap,
    resolveSafeTargetOutsideGuards,
    resolveSafeTargetOutsideOccupiedEntities,
    resolveSweptOrientedBodyContact,
    stepFixedTickMovement,
    type Client as RoomClient,
    type FixedTickMovementState,
    type FixedTickMovementResult,
    type Transport
} from '@universo-react/colyseus-server'
import { ensureApplicationAccess, resolveEffectiveRolePermissions, type ApplicationRole, type RolePermission } from '../routes/guards'
import { findApplicationSchemaInfo } from '../persistence/applicationsStore'
import { resolveRuntimeWorkspaceAccess } from '../services/applicationWorkspaces'
import { RuntimeModulesService } from '../services/runtimeModulesService'
import { resolvePublicRuntimeSchema } from '../shared/publicRuntimeAccess'
import { getRequestDbExecutor } from '../utils'
import { isRealtimeMatchmakeMethodAllowed, resolveRealtimeClientCanControl } from './realtimeAccess'

const requireModule = createRequire(__filename)

interface RealtimeVector3 {
    x: number
    y: number
    z: number
}

interface MovementIntent {
    type: 'move_to_point' | 'move_to_object' | 'stop'
    seq: number
    target?: RealtimeVector3
    objectId?: string
}

type MovementCommandType = MovementIntent['type']

interface MovementCommandState {
    type: MovementCommandType
    objectId: string
}

interface FixedTickSceneRoomOptions {
    scopeId: string
    accessMode: 'member' | 'public'
    applicationId: string
    workspaceId: string | null
    objectCollectionId: string | null
    currentUserId: string | null
    displayName: string | null
    clientCanControl: boolean
    initialPosition: RealtimeVector3
    targetObjects: Record<string, RealtimeVector3>
    guardBoxes: Array<{ center: RealtimeVector3; halfExtents: RealtimeVector3 }>
    controlledHalfExtents: RealtimeVector3
    spawnSafetyMargin: number
    spawnMaxAttempts: number
    spawnRingSpacing: number
    cruiseSpeed: number
    acceleration: number
    deceleration: number
    arrivalRadius: number
    runtimeModuleId: string | null
    runtimeModuleChecksum: string | null
    roomConfigHash: string | null
    authIssuedAt: number
    authNonce: string | null
    serverAuthSignature: string | null
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
    workspaceId: null,
    objectCollectionId: null,
    currentUserId: null,
    displayName: null,
    clientCanControl: false,
    initialPosition: DEFAULT_POSITION,
    targetObjects: { target: DEFAULT_TARGET_OBJECT },
    guardBoxes: [DEFAULT_GUARD],
    controlledHalfExtents: { x: 6, y: 2, z: 2 },
    spawnSafetyMargin: 8,
    spawnMaxAttempts: 64,
    spawnRingSpacing: 24,
    cruiseSpeed: 36,
    acceleration: 48,
    deceleration: 48,
    arrivalRadius: 0.5,
    runtimeModuleId: null,
    runtimeModuleChecksum: null,
    roomConfigHash: null,
    authIssuedAt: 0,
    authNonce: null,
    serverAuthSignature: null
}

let matchMakerAcceptPromise: Promise<void> | null = null
const MAX_MATCHMAKE_BODY_BYTES = 64 * 1024
const MAX_SCENE_COORDINATE_ABS = 100000
const MAX_INTENT_SEQ = 2147483647
const MAX_QUEUED_INPUTS_PER_SHIP = 32
const MAX_FORWARD_INPUT_SEQ_WINDOW = MAX_QUEUED_INPUTS_PER_SHIP
const MAX_MESSAGES_PER_SECOND_PER_CLIENT = 30
const RECONNECT_WINDOW_SECONDS = 30
const ROOM_AUTH_MAX_AGE_MS = 60_000
const USED_ROOM_AUTH_NONCES_MAX = 10_000
const ACCESS_REVALIDATION_INTERVAL_MS = 5000
const ACCESS_DENIED_CLOSE_CODE = 4423
const ROOM_UNAVAILABLE_CLOSE_CODE = 4421
const ROOM_AUTH_SIGNATURE_SECRET = process.env.UNIVERSO_REALTIME_ROOM_AUTH_SECRET || process.env.SESSION_SECRET || randomUUID()

const boundedVector3Schema = z
    .object({
        x: z.number().finite().min(-MAX_SCENE_COORDINATE_ABS).max(MAX_SCENE_COORDINATE_ABS),
        y: z.number().finite().min(-MAX_SCENE_COORDINATE_ABS).max(MAX_SCENE_COORDINATE_ABS),
        z: z.number().finite().min(-MAX_SCENE_COORDINATE_ABS).max(MAX_SCENE_COORDINATE_ABS)
    })
    .strict()

const movementIntentSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('stop'), seq: z.number().int().positive().max(MAX_INTENT_SEQ) }).strict(),
    z
        .object({ type: z.literal('move_to_point'), seq: z.number().int().positive().max(MAX_INTENT_SEQ), target: boundedVector3Schema })
        .strict(),
    z
        .object({
            type: z.literal('move_to_object'),
            seq: z.number().int().positive().max(MAX_INTENT_SEQ),
            objectId: z.string().min(1).max(128)
        })
        .strict()
])

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

        req.setEncoding('utf8')
        req.on('data', (chunk: string) => {
            size += Buffer.byteLength(chunk, 'utf8')
            if (size > MAX_MATCHMAKE_BODY_BYTES) {
                reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }))
                req.destroy()
                return
            }
            data += chunk
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

const toPositiveHalfExtents = (value: unknown): RealtimeVector3 | null => {
    const vector = toBoundedVector(value)
    if (!vector) {
        return null
    }
    const halfExtents = { x: Math.abs(vector.x), y: Math.abs(vector.y), z: Math.abs(vector.z) }
    return halfExtents.x > 0 && halfExtents.y > 0 && halfExtents.z > 0 ? halfExtents : null
}

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
            const halfExtents = toPositiveHalfExtents(record.halfExtents)
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

    const workspaceKey = params.workspaceId && isUuid(params.workspaceId) ? params.workspaceId : 'global'
    const objectCollectionKey =
        typeof params.objectCollectionId === 'string' && params.objectCollectionId.trim() ? params.objectCollectionId.trim() : 'default'
    const moduleTargetObjects = toTargetObjects(moduleRoomOptions.targetObjects)
    const moduleGuardBoxes = toGuardBoxes(moduleRoomOptions.guardBoxes)
    const roomConfigHash = hashRoomConfig({
        applicationSettings: application.settings ?? null,
        widgetConfig: parsed.data as Record<string, unknown>,
        serverRoomOptions: moduleRoomOptions
    })
    const moduleKey = runtimeModuleId
        ? `${runtimeModuleId}:${runtimeModuleChecksum ?? 'runtime'}:${roomConfigHash}`
        : `${widgetModuleCodename ?? 'playcanvas'}:${roomConfigHash}`

    return {
        scopeId: `${params.applicationId}:${params.accessMode}:${workspaceKey}:${objectCollectionKey}:${rows[0].widgetId}:${moduleKey}`,
        accessMode: params.accessMode,
        applicationId: params.applicationId,
        workspaceId: params.workspaceId ?? null,
        objectCollectionId: objectCollectionKey === 'default' ? null : objectCollectionKey,
        clientCanControl: false,
        currentUserId: params.currentUserId ?? null,
        displayName: null,
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
        spawnSafetyMargin: clampNumber(moduleRoomOptions.spawnSafetyMargin, DEFAULT_ROOM_OPTIONS.spawnSafetyMargin, 0, 1000),
        spawnMaxAttempts: Math.floor(clampNumber(moduleRoomOptions.spawnMaxAttempts, DEFAULT_ROOM_OPTIONS.spawnMaxAttempts, 1, 10000)),
        spawnRingSpacing: clampNumber(moduleRoomOptions.spawnRingSpacing, DEFAULT_ROOM_OPTIONS.spawnRingSpacing, 1, 10000),
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
        runtimeModuleChecksum,
        roomConfigHash,
        authIssuedAt: 0,
        authNonce: null,
        serverAuthSignature: null
    }
}

const authorizeAndBuildRoomOptions = async (token: string | null, options: unknown, req?: Request): Promise<FixedTickSceneRoomOptions> => {
    const access = normalizeAccessOptions(options)
    const executor = selectRealtimeDbExecutor(access.accessMode, req, getPoolExecutor())
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
    const authIssuedAt = Date.now()
    const authNonce = randomUUID()
    const signedRoomOptions = {
        ...roomOptions,
        clientCanControl,
        currentUserId,
        displayName: currentUserId ? 'Pilot' : null,
        authIssuedAt,
        authNonce
    }
    return {
        ...signedRoomOptions,
        serverAuthSignature: signRoomAuthOptions(signedRoomOptions)
    }
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
    const parsed = movementIntentSchema.safeParse(value)
    return parsed.success ? parsed.data : null
}

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Number(value))) : fallback

const hashRoomConfig = (value: unknown): string =>
    createHash('sha256')
        .update(stableStringify(value) ?? '{}')
        .digest('hex')
        .slice(0, 16)

const parseRoomOptions = (value: unknown): FixedTickSceneRoomOptions => {
    if (!value || typeof value !== 'object') {
        return DEFAULT_ROOM_OPTIONS
    }

    const candidate = value as Partial<FixedTickSceneRoomOptions>
    const authIssuedAt = Number.isFinite(candidate.authIssuedAt) ? Math.floor(Number(candidate.authIssuedAt)) : 0
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
              .map((guard) => {
                  const center = toBoundedVector(guard?.center)
                  const halfExtents = toPositiveHalfExtents(guard?.halfExtents)
                  return center && halfExtents ? { center, halfExtents } : null
              })
              .filter((guard): guard is { center: RealtimeVector3; halfExtents: RealtimeVector3 } => Boolean(guard))
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
        workspaceId: typeof candidate.workspaceId === 'string' && isUuid(candidate.workspaceId) ? candidate.workspaceId : null,
        objectCollectionId:
            typeof candidate.objectCollectionId === 'string' && candidate.objectCollectionId.trim()
                ? candidate.objectCollectionId.slice(0, 128)
                : null,
        clientCanControl: candidate.accessMode === 'member' && candidate.clientCanControl === true,
        currentUserId:
            typeof candidate.currentUserId === 'string' && candidate.currentUserId.trim() ? candidate.currentUserId.slice(0, 128) : null,
        displayName:
            typeof candidate.displayName === 'string' && candidate.displayName.trim() ? candidate.displayName.trim().slice(0, 80) : null,
        initialPosition: isBoundedVector3(candidate.initialPosition) ? candidate.initialPosition : DEFAULT_ROOM_OPTIONS.initialPosition,
        targetObjects: Object.keys(targetObjects).length ? targetObjects : DEFAULT_ROOM_OPTIONS.targetObjects,
        guardBoxes,
        controlledHalfExtents: isBoundedVector3(candidate.controlledHalfExtents)
            ? candidate.controlledHalfExtents
            : DEFAULT_ROOM_OPTIONS.controlledHalfExtents,
        spawnSafetyMargin: clampNumber(candidate.spawnSafetyMargin, DEFAULT_ROOM_OPTIONS.spawnSafetyMargin, 0, 1000),
        spawnMaxAttempts: Math.floor(clampNumber(candidate.spawnMaxAttempts, DEFAULT_ROOM_OPTIONS.spawnMaxAttempts, 1, 10000)),
        spawnRingSpacing: clampNumber(candidate.spawnRingSpacing, DEFAULT_ROOM_OPTIONS.spawnRingSpacing, 1, 10000),
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
                : null,
        roomConfigHash:
            typeof candidate.roomConfigHash === 'string' && candidate.roomConfigHash.trim() ? candidate.roomConfigHash.slice(0, 128) : null,
        authIssuedAt,
        authNonce:
            typeof candidate.authNonce === 'string' && /^[0-9a-f-]{16,64}$/i.test(candidate.authNonce.trim())
                ? candidate.authNonce.trim().slice(0, 64)
                : null,
        serverAuthSignature:
            typeof candidate.serverAuthSignature === 'string' && candidate.serverAuthSignature.trim()
                ? candidate.serverAuthSignature.slice(0, 128)
                : null
    }
}

interface MutableVector3State {
    x: number
    y: number
    z: number
}

interface MutableShipState {
    shipId: string
    displayName: string
    connected: boolean
    currentCommand: string
    currentCommandObjectId: string
    lastProcessedInputSeq: number
    lastServerTick: number
    position: MutableVector3State
    velocity: MutableVector3State
    heading: MutableVector3State
    target: MutableVector3State
    hasTarget: boolean
    speed: number
}

interface MutableFixedTickSceneState {
    ships: {
        get(key: string): MutableShipState | undefined
        set(key: string, value: MutableShipState): unknown
        delete(key: string): boolean
        values(): IterableIterator<MutableShipState>
    }
    serverTick: number
}

interface RealtimeClientAuth {
    clientCanControl?: unknown
    userId?: unknown
    displayName?: unknown
    applicationId?: unknown
    scopeId?: unknown
    workspaceId?: unknown
    objectCollectionId?: unknown
    roomConfigHash?: unknown
}

interface ShipRuntime {
    shipId: string
    ownerUserId: string
    canControl: boolean
    movement: FixedTickMovementState
    heading: RealtimeVector3
    currentCommand: MovementCommandState
    inputQueue: MovementIntent[]
    sessionIds: Set<string>
    reconnectingUntil: number | null
}

interface RoomClientSession {
    client: RoomClient
    userId: string | null
    canControl: boolean
    shipId: string | null
}

interface RuntimeAccessSubject {
    ownerUserId: string | null
    canControl: boolean
}

type RuntimeAccessValidator = (subject: RuntimeAccessSubject, roomOptions: FixedTickSceneRoomOptions) => Promise<boolean>
const usedRoomAuthNonces = new Map<string, number>()

const readRoomAuthSignaturePayload = (options: FixedTickSceneRoomOptions): Record<string, unknown> => {
    const { serverAuthSignature: _serverAuthSignature, ...payload } = options
    return payload
}

const signRoomAuthOptions = (options: FixedTickSceneRoomOptions): string =>
    createHmac('sha256', ROOM_AUTH_SIGNATURE_SECRET)
        .update(stableStringify(readRoomAuthSignaturePayload(options)) ?? '{}')
        .digest('hex')

const isRoomAuthSignatureValid = (options: FixedTickSceneRoomOptions): boolean => {
    if (typeof options.serverAuthSignature !== 'string' || !/^[a-f0-9]{64}$/i.test(options.serverAuthSignature)) {
        return false
    }
    const expected = signRoomAuthOptions(options)
    return timingSafeEqual(Buffer.from(options.serverAuthSignature, 'hex'), Buffer.from(expected, 'hex'))
}

const pruneUsedRoomAuthNonces = (now: number): void => {
    for (const [nonce, issuedAt] of usedRoomAuthNonces) {
        if (now - issuedAt > ROOM_AUTH_MAX_AGE_MS || usedRoomAuthNonces.size > USED_ROOM_AUTH_NONCES_MAX) {
            usedRoomAuthNonces.delete(nonce)
        }
    }
}

const consumeRoomAuthNonce = (options: FixedTickSceneRoomOptions, now = Date.now()): boolean => {
    if (!options.authNonce || !Number.isFinite(options.authIssuedAt) || options.authIssuedAt <= 0) {
        return false
    }
    if (Math.abs(now - options.authIssuedAt) > ROOM_AUTH_MAX_AGE_MS) {
        return false
    }
    pruneUsedRoomAuthNonces(now)
    if (usedRoomAuthNonces.has(options.authNonce)) {
        return false
    }
    usedRoomAuthNonces.set(options.authNonce, options.authIssuedAt)
    return true
}

const selectRealtimeDbExecutor = (accessMode: 'member' | 'public', req: Request | undefined, fallback: DbExecutor): DbExecutor =>
    accessMode === 'member' && req ? getRequestDbExecutor(req, fallback) : fallback

const validateRuntimeAccess: RuntimeAccessValidator = async (subject, roomOptions) => {
    if (roomOptions.accessMode === 'public') {
        try {
            const publicRuntime = await resolvePublicRuntimeSchema(getPoolExecutor, roomOptions.applicationId, undefined, {
                workspaceId: roomOptions.workspaceId,
                requireResolvedWorkspace: false
            })
            return Boolean(publicRuntime && (publicRuntime.currentWorkspaceId ?? null) === (roomOptions.workspaceId ?? null))
        } catch {
            return false
        }
    }
    if (!subject.ownerUserId) {
        return false
    }
    try {
        const executor = getPoolExecutor()
        const accessContext = await ensureApplicationAccess(executor, subject.ownerUserId, roomOptions.applicationId)
        const application = await findApplicationSchemaInfo(executor, roomOptions.applicationId)
        if (!application?.schemaName) {
            return false
        }
        const role = (accessContext.membership.role || 'member') as ApplicationRole
        if (subject.canControl && !resolveRealtimeClientCanControl(roomOptions.accessMode, role, application.settings ?? {})) {
            return false
        }
        if (application.workspacesEnabled) {
            const workspaceAccess = await resolveRuntimeWorkspaceAccess(executor, {
                schemaName: application.schemaName,
                workspacesEnabled: application.workspacesEnabled,
                userId: subject.ownerUserId,
                actorUserId: subject.ownerUserId,
                ensurePersonalWorkspace: false
            })
            return Boolean(roomOptions.workspaceId && workspaceAccess.allowedWorkspaceIds.includes(roomOptions.workspaceId))
        }
        return true
    } catch {
        return false
    }
}

let runtimeAccessValidator: RuntimeAccessValidator = validateRuntimeAccess

const isClientAuthScopedForRoom = (auth: RealtimeClientAuth | undefined, roomOptions: FixedTickSceneRoomOptions): boolean =>
    Boolean(
        auth &&
            (roomOptions.accessMode !== 'member' || (typeof auth.userId === 'string' && auth.userId.trim().length > 0)) &&
            auth.applicationId === roomOptions.applicationId &&
            auth.scopeId === roomOptions.scopeId &&
            (auth.workspaceId ?? null) === roomOptions.workspaceId &&
            (auth.objectCollectionId ?? null) === roomOptions.objectCollectionId &&
            (auth.roomConfigHash ?? null) === roomOptions.roomConfigHash
    )

const isClientAuthControllingForRoom = (
    auth: RealtimeClientAuth | undefined,
    roomOptions: FixedTickSceneRoomOptions
): auth is RealtimeClientAuth & { userId: string; clientCanControl: true } =>
    isClientAuthScopedForRoom(auth, roomOptions) && auth?.clientCanControl === true

const assignVector3State = (target: MutableVector3State, source: RealtimeVector3): void => {
    target.x = source.x
    target.y = source.y
    target.z = source.z
}

const assignMovementState = (target: MutableShipState, source: FixedTickMovementState): void => {
    assignVector3State(target.position, source.position)
    assignVector3State(target.velocity, source.velocity)
    if (source.velocity.x !== 0 || source.velocity.y !== 0 || source.velocity.z !== 0) {
        assignVector3State(target.heading, source.velocity)
    }
    if (source.target) {
        assignVector3State(target.target, source.target)
        target.hasTarget = true
    } else {
        assignVector3State(target.target, DEFAULT_POSITION)
        target.hasTarget = false
    }
    target.speed = source.speed
}

const resolveBodyRadius = (halfExtents: RealtimeVector3): number => Math.max(Math.abs(halfExtents.x), Math.abs(halfExtents.z))

const createStoppedCommandState = (): MovementCommandState => ({ type: 'stop', objectId: '' })

const assignMovementCommandState = (target: MutableShipState, source: MovementCommandState): void => {
    target.currentCommand = source.type
    target.currentCommandObjectId = source.objectId
}

const cloneMovementVector = (source: RealtimeVector3): RealtimeVector3 => ({ x: source.x, y: source.y, z: source.z })

const cloneMovementState = (source: FixedTickMovementState): FixedTickMovementState => ({
    position: cloneMovementVector(source.position),
    velocity: cloneMovementVector(source.velocity),
    target: source.target ? cloneMovementVector(source.target) : null,
    speed: source.speed
})

const stopMovementAt = (position: RealtimeVector3): FixedTickMovementState => ({
    position: cloneMovementVector(position),
    velocity: { x: 0, y: 0, z: 0 },
    target: null,
    speed: 0
})

const resolveMovementHeading = (movement: FixedTickMovementState, fallback: RealtimeVector3): RealtimeVector3 => {
    if (movement.velocity.x !== 0 || movement.velocity.y !== 0 || movement.velocity.z !== 0) {
        return cloneMovementVector(movement.velocity)
    }
    if (movement.target) {
        return {
            x: movement.target.x - movement.position.x,
            y: movement.target.y - movement.position.y,
            z: movement.target.z - movement.position.z
        }
    }
    return cloneMovementVector(fallback)
}

const createFixedTickSceneRoom = (
    SchemaBase: new () => object,
    MapSchemaBase: new () => MutableFixedTickSceneState['ships'],
    defineTypes: (type: unknown, fields: Record<string, unknown>) => void
): new () => Room => {
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
        shipId = ''
        displayName = ''
        connected = true
        currentCommand = 'stop'
        currentCommandObjectId = ''
        lastProcessedInputSeq = 0
        lastServerTick = 0
        position = new Vector3State()
        velocity = new Vector3State()
        heading = new Vector3State()
        target = new Vector3State()
        hasTarget = false
        speed = 0
    }

    defineTypes(ShipState, {
        shipId: 'string',
        displayName: 'string',
        connected: 'boolean',
        currentCommand: 'string',
        currentCommandObjectId: 'string',
        lastProcessedInputSeq: 'number',
        lastServerTick: 'number',
        position: Vector3State,
        velocity: Vector3State,
        heading: Vector3State,
        target: Vector3State,
        hasTarget: 'boolean',
        speed: 'number'
    })

    class FixedTickSceneState extends SchemaBase implements MutableFixedTickSceneState {
        ships = new MapSchemaBase()
        serverTick = 0
    }

    defineTypes(FixedTickSceneState, {
        ships: { map: ShipState },
        serverTick: 'number'
    })

    return class FixedTickSceneRoom extends Room {
        private roomOptions = DEFAULT_ROOM_OPTIONS
        private readonly ships = new Map<string, ShipRuntime>()
        private readonly userShips = new Map<string, string>()
        private readonly clientShips = new Map<string, string>()
        private readonly clientSessions = new Map<string, RoomClientSession>()
        private accessRevalidationTimer: NodeJS.Timeout | null = null

        onCreate(options?: unknown) {
            this.roomOptions = parseRoomOptions(options)
            this.maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND_PER_CLIENT
            this.setPatchRate(50)
            this.setMetadata({ scopeId: this.roomOptions.scopeId })
            this.setState(new FixedTickSceneState())

            this.onMessage('intent', (client, payload) => {
                const runtime = this.getRuntimeForClient(client)
                if (!runtime?.canControl) {
                    return
                }

                const intent = parseMovementIntent(payload)
                if (!intent) {
                    return
                }
                void this.enqueueAuthorizedIntent(client, runtime, intent)
            })

            this.onMessage('identify_local_ship', (client) => {
                const shipId = this.clientShips.get(client.sessionId)
                if (shipId) {
                    client.send('local_ship_assigned', { shipId })
                }
            })

            this.setSimulationInterval((deltaMs) => {
                const currentState = this.state as MutableFixedTickSceneState
                currentState.serverTick += 1
                const activeRuntimes = Array.from(this.ships.values())
                const lastProcessedInputSeqByShip = new Map<string, number>()
                for (const runtime of activeRuntimes) {
                    let lastProcessedInputSeq = currentState.ships.get(runtime.shipId)?.lastProcessedInputSeq ?? 0
                    const queued = runtime.inputQueue.splice(0).sort((a, b) => a.seq - b.seq)
                    for (const intent of queued) {
                        if (intent.seq <= lastProcessedInputSeq) {
                            continue
                        }
                        if (intent.seq > lastProcessedInputSeq + MAX_FORWARD_INPUT_SEQ_WINDOW) {
                            runtime.inputQueue = []
                            break
                        }
                        this.applyIntent(runtime, intent)
                        lastProcessedInputSeq = intent.seq
                    }
                    lastProcessedInputSeqByShip.set(runtime.shipId, lastProcessedInputSeq)
                }

                const movementSnapshot = new Map(activeRuntimes.map((runtime) => [runtime.shipId, cloneMovementState(runtime.movement)]))
                const movementResults = new Map<string, FixedTickMovementResult>()
                for (const runtime of activeRuntimes) {
                    movementResults.set(
                        runtime.shipId,
                        stepFixedTickMovement(runtime.movement, deltaMs / 1000, {
                            cruiseSpeed: this.roomOptions.cruiseSpeed,
                            acceleration: this.roomOptions.acceleration,
                            deceleration: this.roomOptions.deceleration,
                            arrivalRadius: this.roomOptions.arrivalRadius,
                            guards: this.roomOptions.guardBoxes,
                            controlledHalfExtents: this.roomOptions.controlledHalfExtents
                        })
                    )
                }

                const collisionContactStates = new Map<string, { state: FixedTickMovementState; contactTime: number }>()
                const registerCollisionContact = (shipId: string, state: FixedTickMovementState, contactTime: number): void => {
                    const current = collisionContactStates.get(shipId)
                    if (!current || contactTime < current.contactTime) {
                        collisionContactStates.set(shipId, { state, contactTime })
                    }
                }
                for (let leftIndex = 0; leftIndex < activeRuntimes.length; leftIndex += 1) {
                    for (let rightIndex = leftIndex + 1; rightIndex < activeRuntimes.length; rightIndex += 1) {
                        const left = activeRuntimes[leftIndex]
                        const right = activeRuntimes[rightIndex]
                        const leftResult = movementResults.get(left.shipId)
                        const rightResult = movementResults.get(right.shipId)
                        const leftBefore = movementSnapshot.get(left.shipId)
                        const rightBefore = movementSnapshot.get(right.shipId)
                        if (!leftResult || !rightResult) {
                            continue
                        }
                        const leftHeading = resolveMovementHeading(leftResult.state, left.heading)
                        const rightHeading = resolveMovementHeading(rightResult.state, right.heading)
                        const contact =
                            leftBefore && rightBefore
                                ? resolveSweptOrientedBodyContact({
                                      leftFrom: leftBefore.position,
                                      leftTo: leftResult.state.position,
                                      leftHalfExtents: this.roomOptions.controlledHalfExtents,
                                      leftHeading,
                                      rightFrom: rightBefore.position,
                                      rightTo: rightResult.state.position,
                                      rightHalfExtents: this.roomOptions.controlledHalfExtents,
                                      rightHeading
                                  })
                                : null
                        const finalOverlap = orientedBodyBoxesOverlap(
                            leftResult.state.position,
                            this.roomOptions.controlledHalfExtents,
                            leftHeading,
                            rightResult.state.position,
                            this.roomOptions.controlledHalfExtents,
                            rightHeading
                        )
                        if (contact || finalOverlap) {
                            registerCollisionContact(
                                left.shipId,
                                stopMovementAt(contact?.left ?? leftBefore?.position ?? left.movement.position),
                                contact?.contactTime ?? 0
                            )
                            registerCollisionContact(
                                right.shipId,
                                stopMovementAt(contact?.right ?? rightBefore?.position ?? right.movement.position),
                                contact?.contactTime ?? 0
                            )
                        }
                    }
                }

                for (const runtime of activeRuntimes) {
                    const result = movementResults.get(runtime.shipId)
                    if (!result) {
                        continue
                    }
                    const collisionState = collisionContactStates.get(runtime.shipId)?.state
                    const resolvedResult = collisionState ? { state: collisionState, arrived: false, blocked: true } : result
                    runtime.movement = resolvedResult.state
                    runtime.heading = resolveMovementHeading(runtime.movement, runtime.heading)
                    if (resolvedResult.arrived || resolvedResult.blocked || !runtime.movement.target) {
                        runtime.currentCommand = createStoppedCommandState()
                    }
                    const shipState = currentState.ships.get(runtime.shipId)
                    if (shipState) {
                        assignMovementState(shipState, runtime.movement)
                        assignVector3State(shipState.heading, runtime.heading)
                        assignMovementCommandState(shipState, runtime.currentCommand)
                        shipState.lastProcessedInputSeq = lastProcessedInputSeqByShip.get(runtime.shipId) ?? shipState.lastProcessedInputSeq
                        shipState.lastServerTick = currentState.serverTick
                    }
                }
            })
            this.accessRevalidationTimer = setInterval(() => {
                void this.revalidateConnectedClients()
            }, ACCESS_REVALIDATION_INTERVAL_MS)
            this.accessRevalidationTimer.unref?.()
        }

        async onJoin(client: RoomClient) {
            const clientAuth = (client as RoomClient & { auth?: RealtimeClientAuth }).auth
            if (!isClientAuthScopedForRoom(clientAuth, this.roomOptions)) {
                this.rejectInvalidClient(client)
                return
            }
            if (!isClientAuthControllingForRoom(clientAuth, this.roomOptions)) {
                const userId = typeof clientAuth?.userId === 'string' ? clientAuth.userId : null
                const hasAccess = await runtimeAccessValidator(
                    {
                        ownerUserId: userId,
                        canControl: false
                    },
                    this.roomOptions
                )
                if (!hasAccess) {
                    this.rejectInvalidClient(client)
                    return
                }
                this.clientSessions.set(client.sessionId, {
                    client,
                    userId,
                    canControl: false,
                    shipId: null
                })
                return
            }

            const hasAccess = await runtimeAccessValidator(
                {
                    ownerUserId: clientAuth.userId,
                    canControl: true
                },
                this.roomOptions
            )
            if (!hasAccess) {
                this.rejectInvalidClient(client)
                return
            }

            const shipId = this.getOrCreateShipForUser(clientAuth.userId, {
                displayName:
                    (typeof clientAuth?.displayName === 'string' && clientAuth.displayName.trim()) || `Player ${this.ships.size + 1}`,
                canControl: true
            })
            if (!shipId) {
                this.rejectRoomUnavailableClient(client)
                return
            }
            const runtime = this.ships.get(shipId)
            runtime?.sessionIds.add(client.sessionId)
            this.clientShips.set(client.sessionId, shipId)
            this.clientSessions.set(client.sessionId, {
                client,
                userId: clientAuth.userId,
                canControl: true,
                shipId
            })
            client.send('local_ship_assigned', { shipId })
        }

        onDrop(client: RoomClient) {
            this.reserveClientShipForReconnect(client)
        }

        onLeave(client: RoomClient) {
            this.removeClientShip(client, { force: true })
        }

        private reserveClientShipForReconnect(client: RoomClient): void {
            const shipId = this.clientShips.get(client.sessionId)
            const runtime = shipId ? this.ships.get(shipId) : null
            if (runtime?.reconnectingUntil && runtime.reconnectingUntil > Date.now()) {
                return
            }
            if (runtime) {
                runtime.sessionIds.delete(client.sessionId)
                const hasOtherActiveSession = Array.from(runtime.sessionIds).some((sessionId) => sessionId !== client.sessionId)
                if (!hasOtherActiveSession) {
                    runtime.reconnectingUntil = Date.now() + RECONNECT_WINDOW_SECONDS * 1000
                    const shipState = (this.state as MutableFixedTickSceneState).ships.get(runtime.shipId)
                    if (shipState) {
                        shipState.connected = false
                    }
                }
            }
            void (this as unknown as { allowReconnection: (client: RoomClient, seconds: number) => Promise<RoomClient> })
                .allowReconnection(client, RECONNECT_WINDOW_SECONDS)
                .catch(() => this.removeClientShip(client, { force: true }))
        }

        async onReconnect(client: RoomClient) {
            const clientAuth = (client as RoomClient & { auth?: RealtimeClientAuth }).auth
            if (!isClientAuthScopedForRoom(clientAuth, this.roomOptions)) {
                this.removeClientShip(client, { force: true })
                this.rejectInvalidClient(client)
                return
            }
            if (!isClientAuthControllingForRoom(clientAuth, this.roomOptions)) {
                const userId = typeof clientAuth?.userId === 'string' ? clientAuth.userId : null
                const hasAccess = await runtimeAccessValidator(
                    {
                        ownerUserId: userId,
                        canControl: false
                    },
                    this.roomOptions
                )
                if (!hasAccess) {
                    this.removeClientShip(client, { force: true })
                    this.rejectInvalidClient(client)
                    return
                }
                this.clientSessions.set(client.sessionId, {
                    client,
                    userId,
                    canControl: false,
                    shipId: null
                })
                return
            }
            const shipId = this.clientShips.get(client.sessionId)
            const runtime = shipId ? this.ships.get(shipId) : null
            if (!runtime) {
                this.rejectInvalidClient(client)
                return
            }
            if (!(await runtimeAccessValidator(runtime, this.roomOptions))) {
                this.removeClientShip(client, { force: true })
                this.rejectInvalidClient(client)
                return
            }
            runtime.reconnectingUntil = null
            runtime.sessionIds.add(client.sessionId)
            this.clientSessions.set(client.sessionId, {
                client,
                userId: runtime.ownerUserId,
                canControl: true,
                shipId: runtime.shipId
            })
            const shipState = (this.state as MutableFixedTickSceneState).ships.get(runtime.shipId)
            if (shipState) {
                shipState.connected = true
            }
            client.send('local_ship_assigned', { shipId: runtime.shipId })
        }

        onDispose() {
            if (this.accessRevalidationTimer) {
                clearInterval(this.accessRevalidationTimer)
                this.accessRevalidationTimer = null
            }
            this.ships.clear()
            this.userShips.clear()
            this.clientShips.clear()
            this.clientSessions.clear()
        }

        private getRuntimeForClient(client: RoomClient): ShipRuntime | null {
            const shipId = this.clientShips.get(client.sessionId)
            return shipId ? this.ships.get(shipId) ?? null : null
        }

        private rejectInvalidClient(client: RoomClient): void {
            const closeClient = client as RoomClient & { leave?: (code?: number) => unknown; close?: (code?: number) => unknown }
            closeClient.leave?.(ACCESS_DENIED_CLOSE_CODE)
            closeClient.close?.(ACCESS_DENIED_CLOSE_CODE)
        }

        private rejectRoomUnavailableClient(client: RoomClient): void {
            const closeClient = client as RoomClient & { leave?: (code?: number) => unknown; close?: (code?: number) => unknown }
            closeClient.leave?.(ROOM_UNAVAILABLE_CLOSE_CODE)
            closeClient.close?.(ROOM_UNAVAILABLE_CLOSE_CODE)
        }

        private getOrCreateShipForUser(userId: string, options: { displayName: string; canControl: boolean }): string | null {
            const existingShipId = this.userShips.get(userId)
            if (existingShipId && this.ships.has(existingShipId)) {
                const existingRuntime = this.ships.get(existingShipId)
                if (existingRuntime) {
                    existingRuntime.reconnectingUntil = null
                    const existingShipState = (this.state as MutableFixedTickSceneState).ships.get(existingShipId)
                    if (existingShipState) {
                        existingShipState.connected = true
                    }
                }
                return existingShipId
            }
            const shipId = `ship:${randomUUID()}`
            const spawn = findFreeSpawnPosition({
                origin: this.roomOptions.initialPosition,
                blockers: this.roomOptions.guardBoxes,
                occupiedEntities: Array.from(this.ships.values()).map((runtime) => ({
                    position: runtime.movement.position,
                    radius: resolveBodyRadius(this.roomOptions.controlledHalfExtents),
                    halfExtents: this.roomOptions.controlledHalfExtents,
                    heading: runtime.heading
                })),
                bodyRadius: resolveBodyRadius(this.roomOptions.controlledHalfExtents),
                safetyMargin: this.roomOptions.spawnSafetyMargin,
                maxAttempts: this.roomOptions.spawnMaxAttempts,
                ringSpacing: this.roomOptions.spawnRingSpacing
            })
            if (!spawn) {
                return null
            }
            const movement = createStoppedMovementState(spawn)
            const runtime: ShipRuntime = {
                shipId,
                ownerUserId: userId,
                canControl: options.canControl,
                movement,
                heading: { x: 1, y: 0, z: 0 },
                currentCommand: createStoppedCommandState(),
                inputQueue: [],
                sessionIds: new Set(),
                reconnectingUntil: null
            }
            this.ships.set(shipId, runtime)
            this.userShips.set(userId, shipId)

            const shipState = new ShipState()
            shipState.shipId = shipId
            shipState.displayName = options.displayName
            shipState.connected = true
            assignMovementState(shipState, movement)
            assignVector3State(shipState.heading, runtime.heading)
            assignMovementCommandState(shipState, runtime.currentCommand)
            ;(this.state as MutableFixedTickSceneState).ships.set(shipId, shipState)
            return shipId
        }

        private removeClientShip(client: RoomClient, options: { force?: boolean } = {}): void {
            const shipId = this.clientShips.get(client.sessionId)
            this.clientSessions.delete(client.sessionId)
            if (!shipId) {
                return
            }
            const runtime = this.ships.get(shipId)
            if (!runtime) {
                this.clientShips.delete(client.sessionId)
                return
            }
            runtime.sessionIds.delete(client.sessionId)
            if (runtime.sessionIds.size > 0 || (!options.force && runtime.reconnectingUntil && runtime.reconnectingUntil > Date.now())) {
                if (!runtime.reconnectingUntil || runtime.sessionIds.size > 0) {
                    this.clientShips.delete(client.sessionId)
                }
                const shipState = (this.state as MutableFixedTickSceneState).ships.get(runtime.shipId)
                if (shipState && runtime.sessionIds.size > 0) {
                    shipState.connected = true
                    runtime.reconnectingUntil = null
                }
                return
            }
            this.clientShips.delete(client.sessionId)
            this.ships.delete(shipId)
            this.userShips.delete(runtime.ownerUserId)
            ;(this.state as MutableFixedTickSceneState).ships.delete(shipId)
        }

        private async revalidateConnectedClients(): Promise<void> {
            const revokedShipIds = new Set<string>()
            await Promise.all(
                Array.from(this.clientSessions.values()).map(async (session) => {
                    const hasAccess = await runtimeAccessValidator(
                        {
                            ownerUserId: session.userId,
                            canControl: session.canControl
                        },
                        this.roomOptions
                    )
                    if (hasAccess) {
                        return
                    }
                    if (session.shipId) {
                        revokedShipIds.add(session.shipId)
                    } else {
                        this.removeClientSession(session, { close: true })
                    }
                })
            )
            for (const shipId of revokedShipIds) {
                const runtime = this.ships.get(shipId)
                if (runtime) {
                    this.removeShipRuntime(runtime, { closeClients: true })
                }
            }
        }

        private removeClientSession(session: RoomClientSession, options: { close?: boolean } = {}): void {
            this.clientSessions.delete(session.client.sessionId)
            if (session.shipId) {
                this.clientShips.delete(session.client.sessionId)
            }
            if (options.close) {
                this.rejectInvalidClient(session.client)
            }
        }

        private removeShipRuntime(runtime: ShipRuntime, options: { closeClients?: boolean } = {}): void {
            runtime.canControl = false
            runtime.inputQueue = []
            const mappedSessionIds = new Set(runtime.sessionIds)
            for (const [sessionId, mappedShipId] of this.clientShips) {
                if (mappedShipId === runtime.shipId) {
                    mappedSessionIds.add(sessionId)
                }
            }
            for (const [sessionId, session] of this.clientSessions) {
                if (session.shipId === runtime.shipId) {
                    mappedSessionIds.add(sessionId)
                }
            }
            for (const sessionId of mappedSessionIds) {
                const session = this.clientSessions.get(sessionId)
                if (session && options.closeClients) {
                    this.rejectInvalidClient(session.client)
                }
                this.clientSessions.delete(sessionId)
                this.clientShips.delete(sessionId)
            }
            this.ships.delete(runtime.shipId)
            this.userShips.delete(runtime.ownerUserId)
            ;(this.state as MutableFixedTickSceneState).ships.delete(runtime.shipId)
        }

        private async enqueueAuthorizedIntent(client: RoomClient, runtime: ShipRuntime, intent: MovementIntent): Promise<void> {
            const shipId = this.clientShips.get(client.sessionId)
            if (shipId !== runtime.shipId || !runtime.canControl) {
                return
            }
            if (!(await runtimeAccessValidator(runtime, this.roomOptions))) {
                this.removeShipRuntime(runtime, { closeClients: true })
                return
            }
            if (runtime.inputQueue.length >= MAX_QUEUED_INPUTS_PER_SHIP) {
                runtime.inputQueue.shift()
            }
            runtime.inputQueue.push(intent)
        }

        private applyIntent(runtime: ShipRuntime, intent: MovementIntent): void {
            const occupiedEntities = Array.from(this.ships.values())
                .filter((candidate) => candidate.shipId !== runtime.shipId)
                .map((candidate) => ({
                    position: candidate.movement.position,
                    radius: resolveBodyRadius(this.roomOptions.controlledHalfExtents),
                    halfExtents: this.roomOptions.controlledHalfExtents,
                    heading: candidate.heading
                }))
            const resolveSafeIntentTarget = (target: RealtimeVector3): RealtimeVector3 =>
                resolveSafeTargetOutsideOccupiedEntities(
                    runtime.movement.position,
                    resolveSafeTargetOutsideGuards(
                        runtime.movement.position,
                        target,
                        this.roomOptions.guardBoxes,
                        this.roomOptions.controlledHalfExtents
                    ),
                    occupiedEntities,
                    this.roomOptions.controlledHalfExtents,
                    resolveBodyRadius(this.roomOptions.controlledHalfExtents)
                )

            if (intent.type === 'stop') {
                runtime.movement = applyStopIntent(runtime.movement)
                runtime.currentCommand = createStoppedCommandState()
                return
            }
            if (intent.type === 'move_to_point' && intent.target) {
                runtime.movement = applyMoveToPointIntent(runtime.movement, resolveSafeIntentTarget(intent.target))
                runtime.currentCommand = { type: 'move_to_point', objectId: '' }
                return
            }
            if (intent.type === 'move_to_object') {
                const objectTarget = this.roomOptions.targetObjects[intent.objectId ?? '']
                if (objectTarget) {
                    runtime.movement = applyMoveToPointIntent(runtime.movement, resolveSafeIntentTarget(objectTarget))
                    runtime.currentCommand = { type: 'move_to_object', objectId: intent.objectId ?? '' }
                }
            }
        }

        static async onAuth(_token: string, options: unknown) {
            const parsed = parseRoomOptions(options)
            const authorized =
                isUuid(parsed.applicationId) &&
                parsed.scopeId !== DEFAULT_ROOM_OPTIONS.scopeId &&
                parsed.scopeId.startsWith(`${parsed.applicationId}:`) &&
                Object.keys(parsed.targetObjects).length > 0 &&
                isRoomAuthSignatureValid(parsed) &&
                consumeRoomAuthNonce(parsed) &&
                (parsed.accessMode !== 'member' || !parsed.clientCanControl || Boolean(parsed.currentUserId))

            return authorized
                ? {
                      applicationId: parsed.applicationId,
                      scopeId: parsed.scopeId,
                      clientCanControl: parsed.clientCanControl,
                      userId: parsed.currentUserId,
                      displayName: parsed.displayName,
                      workspaceId: parsed.workspaceId,
                      objectCollectionId: parsed.objectCollectionId,
                      roomConfigHash: parsed.roomConfigHash
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
    MAX_MESSAGES_PER_SECOND_PER_CLIENT,
    createFixedTickSceneRoom,
    loadRoomOptionsFromApplicationSchema,
    parseMovementIntent,
    parseRoomOptions,
    selectRealtimeDbExecutor,
    signRoomAuthOptions,
    setRuntimeAccessValidatorForTests: (validator: RuntimeAccessValidator | null) => {
        runtimeAccessValidator = validator ?? validateRuntimeAccess
    }
}

export const attachApplicationsRealtimeRuntime = async (server: HttpServer): Promise<ApplicationsRealtimeRuntimeHandle> => {
    const { WebSocketTransport } = requireModule('@colyseus/ws-transport') as {
        WebSocketTransport: new (options: { server: HttpServer }) => Transport
    }
    const { Schema, MapSchema, defineTypes } = requireModule('@colyseus/schema') as {
        Schema: new () => object
        MapSchema: new () => MutableFixedTickSceneState['ships']
        defineTypes: (type: unknown, fields: Record<string, unknown>) => void
    }
    const roomName = 'fixed_tick_scene'
    const gameServer = new Server({
        transport: new WebSocketTransport({ server }),
        gracefullyShutdown: false,
        greet: false
    })

    gameServer
        .define(
            roomName,
            createFixedTickSceneRoom(Schema, MapSchema, defineTypes as (type: unknown, fields: Record<string, unknown>) => void)
        )
        .filterBy(['scopeId'])
    matchMakerAcceptPromise ??= matchMaker.accept()
    await matchMakerAcceptPromise

    return { gameServer, roomName, matchmakeMiddleware: createSharedServerMatchmakingMiddleware() }
}
