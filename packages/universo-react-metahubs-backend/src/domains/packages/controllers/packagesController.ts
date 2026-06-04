import fs from 'node:fs/promises'
import path from 'node:path'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '../../../utils'
import type {
    MetahubPackageAttachment,
    PackageAuthoringHostDescriptor,
    PlayCanvasEditorAuthoringSurfaceDescriptor
} from '@universo-react/types'
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
import { findPlayCanvasProject } from '../../playcanvas-projects/services/playCanvasProjectsStore'

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
    path.resolve(__dirname, '../../../../../../packages/universo-react-playcanvas-editor/dist/editor')
const artifactTokenSecret =
    process.env.PLAYCANVAS_EDITOR_ARTIFACT_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? randomUUID()
const artifactTokenTtlMs = 5 * 60 * 1000

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

const encodeArtifactTokenPart = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')

const signArtifactTokenPayload = (encodedPayload: string): string =>
    createHmac('sha256', artifactTokenSecret).update(encodedPayload).digest('base64url')

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

const sendEditorArtifactFile = async (res: Response, filePath: string): Promise<Response | void> => {
    const extension = path.extname(filePath).toLowerCase()
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', extension === '.html' ? 'no-store' : 'private, max-age=300')
    res.setHeader(
        'Content-Security-Policy',
        "sandbox allow-scripts; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'"
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
            const [hasManifest, hasIndex] = await Promise.all([isArtifactFileAvailable(manifestPath), isArtifactFileAvailable(indexPath)])
            const hasArtifact = hasManifest && hasIndex
            const displayMode = attachmentConfig.kind === 'display' ? attachmentConfig.display.mode : 'disabled'
            const shouldServeArtifact =
                !isAttachmentConfigBlocked && hasArtifact && (displayMode === 'embeddedIframe' || displayMode === 'openSeparately')
            const artifactToken = shouldServeArtifact
                ? createArtifactToken({
                      metahubId,
                      packageSlug: item.authoringSurface.packageSlug,
                      userId
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
                    : hasArtifact
                    ? 'available'
                    : 'missing',
                artifactUrl: shouldServeArtifact
                    ? `/api/v1/metahub/${encodeURIComponent(metahubId)}/packages/${encodeURIComponent(
                          item.authoringSurface.packageSlug
                      )}/editor-artifact-token/${encodeURIComponent(artifactToken ?? '')}/index.html`
                    : null
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
            const filePath = resolveArtifactPath(relativePath)
            const manifestPath = resolveArtifactPath(item.authoringSurface.artifact.manifestFileName)
            const [manifestAvailable, fileAvailable] = await Promise.all([
                isArtifactFileAvailable(manifestPath),
                isArtifactFileAvailable(filePath)
            ])

            if (!manifestAvailable || !fileAvailable) {
                throw new MetahubNotFoundError('Package artifact')
            }

            return sendEditorArtifactFile(res, filePath)
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
        try {
            await ensureMetahubAccess(exec, payload.userId, payload.metahubId, 'manageMetahub')

            const item = await getPlayCanvasEditorAttachment(exec, payload.metahubId, slug.data)
            if (!item?.authoringSurface.artifact) {
                return res.status(404).json({ error: 'Package artifact' })
            }
            manifestFileName = item.authoringSurface.artifact.manifestFileName

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
            isArtifactFileAvailable(manifestPath),
            isArtifactFileAvailable(filePath)
        ])
        if (!manifestAvailable || !fileAvailable) {
            return res.status(404).json({ error: 'Package artifact' })
        }

        return sendEditorArtifactFile(res, filePath)
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
