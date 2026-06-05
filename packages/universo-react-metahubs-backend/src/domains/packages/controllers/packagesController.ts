import fs from 'node:fs/promises'
import path from 'node:path'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '../../../utils'
import type {
    MetahubPackageAttachment,
    PackageAuthoringHostDescriptor,
    PlayCanvasEditorBridgeCapability,
    PlayCanvasEditorAuthoringSurfaceDescriptor
} from '@universo-react/types'
import { PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES } from '@universo-react/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { ensureMetahubAccess } from '../../shared/guards'
import {
    packageAttachmentConfigSchema,
    resolveAllowedPackageDisplayModes,
    resolvePackageAttachmentConfig
} from '../services/packageConfigValidation'
import {
    attachMetahubPackage,
    changeMetahubPackageVersion,
    detachMetahubPackage,
    findBranchByIdAndMetahub,
    findMetahubByIdNotDeleted,
    listMetahubPackages,
    listPackageCatalog,
    updateMetahubPackageConfig
} from '../../../persistence'
import { findPlayCanvasProject, summarizePlayCanvasProject } from '../../playcanvas-projects/services/playCanvasProjectsStore'
import { PlayCanvasEditorBridgeSessionService } from '../../playcanvas-projects/services/PlayCanvasEditorBridgeSessionService'

const packageNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(214)
    .regex(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/, 'Package name must be a scoped npm package name')
const versionSchema = z.string().trim().min(1).max(64)
const packageSlugSchema = z
    .string()
    .trim()
    .min(1)
    .max(96)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
const artifactRoot =
    process.env.PLAYCANVAS_EDITOR_ARTIFACT_ROOT ??
    path.resolve(__dirname, '../../../../../../packages/universo-react-playcanvas-editor-frontend/dist/editor')
const artifactTokenTtlMs = 5 * 60 * 1000
let artifactDevelopmentTokenSecret: string | null = null
const resolveArtifactTokenSecret = (): string => {
    const resolved = process.env.PLAYCANVAS_EDITOR_ARTIFACT_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? process.env.SUPABASE_JWT_SECRET
    if (resolved) {
        return resolved
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('PLAYCANVAS_EDITOR_ARTIFACT_TOKEN_SECRET, SESSION_SECRET, or SUPABASE_JWT_SECRET must be configured in production')
    }
    artifactDevelopmentTokenSecret ??= `dev-playcanvas-editor-artifact-${randomUUID()}`
    return artifactDevelopmentTokenSecret
}

const attachPackageSchema = z
    .object({
        packageName: packageNameSchema,
        version: versionSchema
    })
    .strict()

const changePackageVersionSchema = z
    .object({
        version: versionSchema,
        resetConfig: z.boolean().optional()
    })
    .strict()

const updatePackageConfigSchema = z
    .object({
        config: packageAttachmentConfigSchema
    })
    .strict()

const contentTypesByExtension = new Map<string, string>([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.mjs', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.ico', 'image/x-icon'],
    ['.wasm', 'application/wasm'],
    ['.ttf', 'font/ttf'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2']
])

interface ArtifactTokenPayload {
    metahubId: string
    packageSlug: string
    userId: string
    parentOrigin: string
    expiresAt: number
}

type PlayCanvasEditorAttachment = MetahubPackageAttachment & {
    authoringSurface: PlayCanvasEditorAuthoringSurfaceDescriptor
}

const redactAttachmentConfigForList = (item: MetahubPackageAttachment): MetahubPackageAttachment => {
    const redacted: MetahubPackageAttachment = {
        ...item,
        authoringSurface:
            item.authoringSurface.kind === 'playcanvasEditor'
                ? {
                      ...item.authoringSurface,
                      artifact: undefined
                  }
                : item.authoringSurface
    }

    if (item.config.kind !== 'display' || !item.config.display.developmentUrl) {
        return redacted
    }

    return {
        ...redacted,
        config: {
            ...item.config,
            display: {
                ...item.config.display,
                developmentUrl: null
            }
        }
    }
}

const redactCatalogItemForList = <Item extends { authoringSurface: MetahubPackageAttachment['authoringSurface'] }>(item: Item): Item => ({
    ...item,
    authoringSurface:
        item.authoringSurface.kind === 'playcanvasEditor'
            ? {
                  ...item.authoringSurface,
                  artifact: undefined
              }
            : item.authoringSurface
})

const isPlayCanvasEditorAttachment = (item: MetahubPackageAttachment, packageSlug: string): item is PlayCanvasEditorAttachment =>
    item.authoringSurface.kind === 'playcanvasEditor' && item.authoringSurface.packageSlug === packageSlug

const getPlayCanvasEditorAttachment = async (
    exec: Parameters<typeof listMetahubPackages>[0],
    metahubId: string,
    packageSlug: string
): Promise<PlayCanvasEditorAttachment | undefined> => {
    const packages = await listMetahubPackages(exec, metahubId)
    const matches = packages.filter((item) => isPlayCanvasEditorAttachment(item, packageSlug))
    if (matches.length > 1) {
        throw new MetahubValidationError('Package authoring surface slug is not unique for this metahub')
    }
    return matches[0]
}

const resolveDefaultBranchSchemaName = async (
    exec: Parameters<typeof findMetahubByIdNotDeleted>[0],
    metahubId: string
): Promise<string> => {
    const metahub = await findMetahubByIdNotDeleted(exec, metahubId)
    if (!metahub?.defaultBranchId) {
        throw new MetahubValidationError('Metahub default branch is not configured', {
            messageCode: 'metahubs.defaultBranchMissing',
            metahubId
        })
    }

    const branch = await findBranchByIdAndMetahub(exec, metahub.defaultBranchId, metahubId)
    if (!branch) {
        throw new MetahubValidationError('Metahub default branch was not found', {
            messageCode: 'metahubs.defaultBranchNotFound',
            metahubId,
            branchId: metahub.defaultBranchId
        })
    }

    return branch.schemaName
}

const parseSafeHttpOrigin = (value: string | undefined): string | null => {
    if (!value) return null
    try {
        const parsed = new URL(value)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            return null
        }
        return parsed.origin
    } catch {
        return null
    }
}

const resolveRequestOrigin = (req: Request): string | null => {
    const configuredParentOrigin = parseSafeHttpOrigin(process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN)
    if (configuredParentOrigin) {
        return configuredParentOrigin
    }

    const trustProxyHeaders = process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS === 'true'
    const forwardedHost = trustProxyHeaders ? req.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined
    const host = forwardedHost || req.get('host')
    if (!host) return null
    const forwardedProto = trustProxyHeaders ? req.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
    const protocol = forwardedProto || req.protocol || 'http'
    return parseSafeHttpOrigin(`${protocol}://${host}`)
}

const resolveLoopbackSiblingOrigin = (origin: string): string | null => {
    const parsed = new URL(origin)
    if (parsed.hostname === '127.0.0.1') {
        parsed.hostname = 'localhost'
        return parsed.origin
    }
    if (parsed.hostname === 'localhost') {
        parsed.hostname = '127.0.0.1'
        return parsed.origin
    }
    return null
}

const resolveArtifactPublicOrigin = (req: Request): { artifactOrigin: string; parentOrigin: string } | null => {
    const parentOrigin = resolveRequestOrigin(req)
    if (!parentOrigin) return null

    const configuredOrigin = parseSafeHttpOrigin(process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN)
    const artifactOrigin = configuredOrigin ?? resolveLoopbackSiblingOrigin(parentOrigin)
    if (!artifactOrigin || artifactOrigin === parentOrigin) {
        return null
    }

    return { artifactOrigin, parentOrigin }
}

const resolveArtifactPath = (relativePath: string): string => {
    const normalized = relativePath.replace(/^\/+/, '') || 'index.html'
    if (normalized.includes('\0')) {
        throw new MetahubValidationError('Invalid package artifact path')
    }

    const resolved = path.resolve(artifactRoot, normalized)
    const relative = path.relative(artifactRoot, resolved)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new MetahubValidationError('Invalid package artifact path')
    }
    return resolved
}

const isPathInsideArtifactRoot = (resolvedRoot: string, resolvedPath: string): boolean => {
    const relative = path.relative(resolvedRoot, resolvedPath)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const isArtifactFileAvailable = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath)
        const [realRoot, realFile] = await Promise.all([fs.realpath(artifactRoot), fs.realpath(filePath)])
        return isPathInsideArtifactRoot(realRoot, realFile)
    } catch {
        return false
    }
}

type ArtifactManifestStatus = 'expected' | 'artifactOnly' | 'missing'

const resolveArtifactManifestStatus = async (manifestPath: string, expectedSmokeMode: string): Promise<ArtifactManifestStatus> => {
    if (!(await isArtifactFileAvailable(manifestPath))) {
        return 'missing'
    }
    try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
            mode?: unknown
            smokeMode?: unknown
            bridgeBootstrap?: unknown
        }
        if (manifest.mode === 'artifact-only' && manifest.smokeMode === 'artifact-only') {
            if (expectedSmokeMode === 'universo-hosted') {
                return 'missing'
            }
            return 'artifactOnly'
        }
        if (manifest.mode !== expectedSmokeMode || manifest.smokeMode !== expectedSmokeMode) {
            return 'missing'
        }
        if (expectedSmokeMode !== 'universo-hosted') {
            return 'expected'
        }
        if (manifest.bridgeBootstrap !== 'universo-bridge-bootstrap.js') {
            return 'missing'
        }
        return (await isArtifactFileAvailable(resolveArtifactPath(manifest.bridgeBootstrap))) ? 'expected' : 'missing'
    } catch {
        return 'missing'
    }
}

const encodeArtifactTokenPart = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')

const signArtifactTokenPayload = (encodedPayload: string): string =>
    createHmac('sha256', resolveArtifactTokenSecret()).update(encodedPayload).digest('base64url')

const createArtifactToken = (payload: Omit<ArtifactTokenPayload, 'expiresAt'>): string => {
    const encodedPayload = encodeArtifactTokenPart(
        JSON.stringify({
            ...payload,
            expiresAt: Date.now() + artifactTokenTtlMs
        } satisfies ArtifactTokenPayload)
    )
    return `${encodedPayload}.${signArtifactTokenPayload(encodedPayload)}`
}

const readArtifactTokenPayload = (token: string): ArtifactTokenPayload | null => {
    const [encodedPayload, signature, extra] = token.split('.')
    if (!encodedPayload || !signature || extra) {
        return null
    }

    const expectedSignature = signArtifactTokenPayload(encodedPayload)
    const provided = Buffer.from(signature)
    const expected = Buffer.from(expectedSignature)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return null
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<ArtifactTokenPayload>
        if (
            typeof payload.metahubId !== 'string' ||
            typeof payload.packageSlug !== 'string' ||
            typeof payload.userId !== 'string' ||
            typeof payload.parentOrigin !== 'string' ||
            !parseSafeHttpOrigin(payload.parentOrigin) ||
            typeof payload.expiresAt !== 'number' ||
            payload.expiresAt < Date.now()
        ) {
            return null
        }
        return payload as ArtifactTokenPayload
    } catch {
        return null
    }
}

const sendEditorArtifactFile = async (
    req: Request,
    res: Response,
    filePath: string,
    frameAncestorOrigins: readonly string[] = []
): Promise<Response | void> => {
    const extension = path.extname(filePath).toLowerCase()
    const frameAncestors = Array.from(new Set(frameAncestorOrigins.map((origin) => parseSafeHttpOrigin(origin)).filter(Boolean)))
    const corsOrigin = frameAncestors[0]
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', extension === '.html' ? 'no-store' : 'private, max-age=300')
    res.setHeader('Referrer-Policy', 'no-referrer')
    if (corsOrigin) {
        const requestOrigin = req.get('origin')
        if (requestOrigin && parseSafeHttpOrigin(requestOrigin) !== corsOrigin) {
            return res.status(403).json({ error: 'Package artifact' })
        }
        res.setHeader('Access-Control-Allow-Origin', corsOrigin)
        res.setHeader('Vary', 'Origin')
    }
    res.setHeader(
        'Content-Security-Policy',
        `sandbox allow-scripts allow-same-origin; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'${
            frameAncestors.length > 0 ? ` ${frameAncestors.join(' ')}` : ''
        }`
    )
    const contentType = contentTypesByExtension.get(extension)
    if (contentType) {
        res.type(contentType)
    }
    return res.sendFile(filePath)
}

export function createPackagesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>, getDbExecutor: () => DbExecutor) {
    const listCatalog = createHandler(async ({ res, metahubId, exec }) => {
        const items = (await listPackageCatalog(exec, metahubId)).map(redactCatalogItemForList)
        return res.json({ items, total: items.length })
    })

    const listAttached = createHandler(async ({ res, metahubId, exec }) => {
        const items = (await listMetahubPackages(exec, metahubId)).map(redactAttachmentConfigForList)
        return res.json({ items, total: items.length })
    })

    const getAuthoringHost = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const slug = packageSlugSchema.safeParse(req.params.packageSlug)
            if (!slug.success) {
                throw new MetahubValidationError('Invalid package slug', { details: slug.error.flatten() })
            }

            const item = await getPlayCanvasEditorAttachment(exec, metahubId, slug.data)
            if (!item) {
                throw new MetahubNotFoundError('Metahub package')
            }
            if (!item.authoringSurface.artifact) {
                throw new MetahubValidationError('Package authoring surface artifact is not configured')
            }

            let attachmentConfig = item.config
            let isAttachmentConfigBlocked = false
            try {
                attachmentConfig = resolvePackageAttachmentConfig(item.config, item.authoringSurface)
            } catch {
                attachmentConfig = item.authoringSurface.defaultConfig
                isAttachmentConfigBlocked = true
            }

            const manifestPath = resolveArtifactPath(item.authoringSurface.artifact.manifestFileName)
            const indexPath = resolveArtifactPath('index.html')
            const [manifestStatus, hasIndex] = await Promise.all([
                resolveArtifactManifestStatus(manifestPath, item.authoringSurface.artifact.smokeMode),
                isArtifactFileAvailable(indexPath)
            ])
            const hasArtifact = manifestStatus !== 'missing' && hasIndex
            const displayMode = attachmentConfig.kind === 'display' ? attachmentConfig.display.mode : 'disabled'
            const defaultProjectId =
                attachmentConfig.kind === 'display' ? attachmentConfig.playcanvasProject?.defaultProjectId ?? null : null
            const shouldServeArtifact =
                !isAttachmentConfigBlocked && hasArtifact && (displayMode === 'embeddedIframe' || displayMode === 'openSeparately')
            const artifactPublicOrigin = shouldServeArtifact ? resolveArtifactPublicOrigin(req) : null
            const canServeIsolatedArtifact = shouldServeArtifact && artifactPublicOrigin != null
            const shouldEnableBridge = canServeIsolatedArtifact && manifestStatus === 'expected' && defaultProjectId != null
            const branchSchemaName = shouldEnableBridge ? await resolveDefaultBranchSchemaName(exec, metahubId) : null
            const selectedProjectRow =
                shouldEnableBridge && branchSchemaName ? await findPlayCanvasProject(exec, branchSchemaName, defaultProjectId) : null
            const selectedProject =
                shouldEnableBridge && branchSchemaName && selectedProjectRow
                    ? await summarizePlayCanvasProject(exec, branchSchemaName, selectedProjectRow)
                    : null
            const isSelectedProjectBridgeReady = Boolean(selectedProject)
            const isHostedBridgeProjectUnavailable = shouldEnableBridge && !isSelectedProjectBridgeReady
            const bridgeCapabilities = [...PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES] as PlayCanvasEditorBridgeCapability[]
            const bridgeSession =
                shouldEnableBridge && selectedProject && isSelectedProjectBridgeReady
                    ? new PlayCanvasEditorBridgeSessionService().create({
                          metahubId,
                          packageSlug: item.authoringSurface.packageSlug,
                          projectId: selectedProject.id,
                          defaultSceneId: selectedProject.defaultSceneId ?? null,
                          userId,
                          capabilities: bridgeCapabilities
                      })
                    : null
            const artifactToken =
                canServeIsolatedArtifact && !isHostedBridgeProjectUnavailable
                    ? createArtifactToken({
                          metahubId,
                          packageSlug: item.authoringSurface.packageSlug,
                          userId,
                          parentOrigin: artifactPublicOrigin.parentOrigin
                      })
                    : null
            const descriptor: PackageAuthoringHostDescriptor = {
                packageSlug: item.authoringSurface.packageSlug,
                packageName: item.packageName,
                version: item.version,
                displayName: item.displayName,
                description: item.description,
                attachmentConfig,
                authoringSurface: item.authoringSurface,
                allowedDisplayModes: resolveAllowedPackageDisplayModes(item.authoringSurface),
                artifactStatus: isAttachmentConfigBlocked
                    ? 'blocked'
                    : displayMode === 'disabled'
                    ? 'disabled'
                    : displayMode === 'developmentUrl'
                    ? 'available'
                    : shouldServeArtifact && !canServeIsolatedArtifact
                    ? 'misconfigured'
                    : isHostedBridgeProjectUnavailable
                    ? 'blocked'
                    : hasArtifact
                    ? 'available'
                    : 'missing',
                artifactUrl:
                    canServeIsolatedArtifact && !isHostedBridgeProjectUnavailable
                        ? `${artifactPublicOrigin.artifactOrigin}/api/v1/metahub/${encodeURIComponent(
                              metahubId
                          )}/packages/${encodeURIComponent(item.authoringSurface.packageSlug)}/editor-artifact-token/${encodeURIComponent(
                              artifactToken ?? ''
                          )}/index.html`
                        : null,
                playcanvasEditor: bridgeSession
                    ? {
                          schemaVersion: bridgeSession.payload.bridgeVersion,
                          bridge: {
                              sessionId: bridgeSession.payload.sessionId,
                              sessionToken: bridgeSession.token,
                              nonce: bridgeSession.payload.nonce,
                              expiresAt: new Date(bridgeSession.payload.expiresAt).toISOString(),
                              bridgeVersion: bridgeSession.payload.bridgeVersion,
                              writeMode: 'manager',
                              capabilities: bridgeSession.payload.capabilities
                          },
                          selectedProject: selectedProject
                              ? {
                                    project: selectedProject,
                                    defaultSceneId: selectedProject.defaultSceneId ?? null
                                }
                              : null,
                          compatibilityStatus: selectedProject && isSelectedProjectBridgeReady ? 'ready' : 'projectUnavailable'
                      }
                    : null
            }

            if (bridgeSession) {
                res.setHeader('Cache-Control', 'no-store')
            }
            return res.json(descriptor)
        },
        { permission: 'manageMetahub' }
    )

    const serveEditorArtifact = createHandler(
        async ({ req, res, metahubId, exec }) => {
            const slug = packageSlugSchema.safeParse(req.params.packageSlug)
            if (!slug.success) {
                throw new MetahubValidationError('Invalid package slug', { details: slug.error.flatten() })
            }

            const item = await getPlayCanvasEditorAttachment(exec, metahubId, slug.data)
            if (!item) {
                throw new MetahubNotFoundError('Metahub package')
            }
            if (!item.authoringSurface.artifact) {
                throw new MetahubValidationError('Package authoring surface artifact is not configured')
            }

            const attachmentConfig = resolvePackageAttachmentConfig(item.config, item.authoringSurface)
            const displayMode = attachmentConfig.kind === 'display' ? attachmentConfig.display.mode : 'disabled'
            if (displayMode !== 'embeddedIframe' && displayMode !== 'openSeparately') {
                throw new MetahubNotFoundError('Package artifact')
            }

            const relativePath = typeof req.params[0] === 'string' ? req.params[0] : 'index.html'
            if (relativePath.replace(/^\/+/, '') === 'index.html') {
                throw new MetahubNotFoundError('Package artifact')
            }

            const filePath = resolveArtifactPath(relativePath)
            const manifestPath = resolveArtifactPath(item.authoringSurface.artifact.manifestFileName)
            const [manifestAvailable, fileAvailable] = await Promise.all([
                resolveArtifactManifestStatus(manifestPath, item.authoringSurface.artifact.smokeMode),
                isArtifactFileAvailable(filePath)
            ])

            if (manifestAvailable === 'missing' || !fileAvailable) {
                throw new MetahubNotFoundError('Package artifact')
            }

            return sendEditorArtifactFile(req, res, filePath)
        },
        { permission: 'manageMetahub' }
    )

    const serveEditorArtifactWithToken = async (req: Request, res: Response): Promise<Response | void> => {
        const slug = packageSlugSchema.safeParse(req.params.packageSlug)
        if (!slug.success) {
            return res.status(404).json({ error: 'Package artifact' })
        }

        const token = typeof req.params.artifactToken === 'string' ? req.params.artifactToken : ''
        const payload = readArtifactTokenPayload(token)
        if (!payload || payload.metahubId !== req.params.metahubId || payload.packageSlug !== slug.data) {
            return res.status(404).json({ error: 'Package artifact' })
        }

        const exec = getDbExecutor()
        let manifestFileName: string | null = null
        let expectedSmokeMode: string | null = null
        try {
            await ensureMetahubAccess(exec, payload.userId, payload.metahubId, 'manageMetahub')

            const item = await getPlayCanvasEditorAttachment(exec, payload.metahubId, slug.data)
            if (!item?.authoringSurface.artifact) {
                return res.status(404).json({ error: 'Package artifact' })
            }
            manifestFileName = item.authoringSurface.artifact.manifestFileName
            expectedSmokeMode = item.authoringSurface.artifact.smokeMode

            const attachmentConfig = resolvePackageAttachmentConfig(item.config, item.authoringSurface)
            const displayMode = attachmentConfig.kind === 'display' ? attachmentConfig.display.mode : 'disabled'
            if (displayMode !== 'embeddedIframe' && displayMode !== 'openSeparately') {
                return res.status(404).json({ error: 'Package artifact' })
            }
        } catch {
            return res.status(404).json({ error: 'Package artifact' })
        }

        const relativePath = typeof req.params[0] === 'string' ? req.params[0] : 'index.html'
        let filePath: string
        let manifestPath: string
        try {
            if (!manifestFileName) {
                return res.status(404).json({ error: 'Package artifact' })
            }
            filePath = resolveArtifactPath(relativePath)
            manifestPath = resolveArtifactPath(manifestFileName)
        } catch {
            return res.status(404).json({ error: 'Package artifact' })
        }

        const [manifestAvailable, fileAvailable] = await Promise.all([
            expectedSmokeMode
                ? resolveArtifactManifestStatus(manifestPath, expectedSmokeMode)
                : Promise.resolve<ArtifactManifestStatus>('missing'),
            isArtifactFileAvailable(filePath)
        ])
        if (manifestAvailable === 'missing' || !fileAvailable) {
            return res.status(404).json({ error: 'Package artifact' })
        }

        return sendEditorArtifactFile(req, res, filePath, [payload.parentOrigin])
    }

    const attach = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const parsed = attachPackageSchema.safeParse(req.body)
            if (!parsed.success) {
                throw new MetahubValidationError('Invalid package attach payload', { details: parsed.error.flatten() })
            }

            const item = await attachMetahubPackage(exec, {
                metahubId,
                packageName: parsed.data.packageName,
                version: parsed.data.version,
                userId
            })

            if (!item) {
                throw new MetahubNotFoundError('Package')
            }

            return res.status(201).json(item)
        },
        { permission: 'manageMetahub' }
    )

    const changeVersion = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const parsed = changePackageVersionSchema.safeParse(req.body)
            if (!parsed.success) {
                throw new MetahubValidationError('Invalid package version payload', { details: parsed.error.flatten() })
            }

            const item = await changeMetahubPackageVersion(exec, {
                metahubId,
                attachmentId: req.params.attachmentId,
                version: parsed.data.version,
                resetConfig: parsed.data.resetConfig,
                userId
            })

            if (!item) {
                throw new MetahubNotFoundError('Metahub package', req.params.attachmentId)
            }

            return res.json(item)
        },
        { permission: 'manageMetahub' }
    )

    const updateConfig = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const parsed = updatePackageConfigSchema.safeParse(req.body)
            if (!parsed.success) {
                throw new MetahubValidationError('Invalid package config payload', { details: parsed.error.flatten() })
            }
            const packages = await listMetahubPackages(exec, metahubId)
            const attachment = packages.find((item) => item.id === req.params.attachmentId)
            if (!attachment) {
                throw new MetahubNotFoundError('Metahub package', req.params.attachmentId)
            }
            const config = resolvePackageAttachmentConfig(parsed.data.config, attachment.authoringSurface)
            if (config.kind === 'display' && config.playcanvasProject?.defaultProjectId) {
                const schemaName = await resolveDefaultBranchSchemaName(exec, metahubId)
                const project = await findPlayCanvasProject(exec, schemaName, config.playcanvasProject.defaultProjectId)
                if (!project) {
                    throw new MetahubValidationError('PlayCanvas default project was not found', {
                        messageCode: 'playcanvas.projects.defaultProjectNotFound',
                        projectId: config.playcanvasProject.defaultProjectId
                    })
                }
            }

            const item = await updateMetahubPackageConfig(exec, {
                metahubId,
                attachmentId: req.params.attachmentId,
                config,
                userId,
                expectedPackageId: attachment.packageId
            })

            if (!item) {
                throw new MetahubNotFoundError('Metahub package', req.params.attachmentId)
            }

            return res.json(item)
        },
        { permission: 'manageMetahub' }
    )

    const detach = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const result = await detachMetahubPackage(exec, {
                metahubId,
                attachmentId: req.params.attachmentId,
                userId
            })

            if (!result) {
                throw new MetahubNotFoundError('Metahub package', req.params.attachmentId)
            }

            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return {
        listCatalog,
        listAttached,
        getAuthoringHost,
        serveEditorArtifact,
        attach,
        changeVersion,
        updateConfig,
        detach,
        serveEditorArtifactWithToken
    }
}
