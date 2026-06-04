import crypto from 'crypto'
import type { Stats } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import {
    PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES,
    PLAYCANVAS_PROJECT_FILE_MAX_BYTES,
    PLAYCANVAS_PROJECT_FILE_ROOT
} from '@universo-react/types'
import { MetahubValidationError } from '../../shared/domainErrors'

export interface PlayCanvasProjectFileScope {
    metahubId: string
    branchSlug: string
}

export interface PlayCanvasProjectFileReadResult {
    content: Buffer
    checksum: string
    sourcePath: string
    absolutePath: string
    size: number
}

export interface PlayCanvasProjectFileWriteResult extends PlayCanvasProjectFileReadResult {
    mime: string | null
}

const DEFAULT_PLAYCANVAS_PROJECT_FILE_ROOT = path.resolve(process.cwd(), 'storage')
const PLAYCANVAS_PROJECT_SCOPE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/
const PLAYCANVAS_PROJECT_FILE_EXTENSIONS = new Set(['.json', '.js', '.mjs'])
const PLAYCANVAS_PROJECT_EXTENSION_MIME_TYPES: Record<string, ReadonlySet<string>> = {
    '.json': new Set(['application/json']),
    '.js': new Set(['text/javascript', 'application/javascript']),
    '.mjs': new Set(['text/javascript', 'application/javascript'])
}

const normalizeStorageRoot = (root?: string | null): string => {
    const configured = root?.trim() || process.env.UPL_PLAYCANVAS_PROJECT_FILE_ROOT?.trim() || process.env.UPL_MODULE_SOURCE_ROOT?.trim()
    return path.resolve(configured || DEFAULT_PLAYCANVAS_PROJECT_FILE_ROOT)
}

export const computePlayCanvasProjectFileChecksum = (content: Buffer | string): string =>
    crypto.createHash('sha256').update(content).digest('hex')

export const isAllowedPlayCanvasProjectMime = (mime: string): boolean =>
    (PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)

export const assertPlayCanvasProjectMimeForPath = (sourcePath: string, mime?: string | null): string | null => {
    if (!mime) return null
    if (!isAllowedPlayCanvasProjectMime(mime)) {
        throw new MetahubValidationError('PlayCanvas project file MIME type is not supported', {
            messageCode: 'playcanvas.files.mime.unsupported'
        })
    }
    const extension = path.extname(sourcePath).toLowerCase()
    const allowedForExtension = PLAYCANVAS_PROJECT_EXTENSION_MIME_TYPES[extension]
    if (!allowedForExtension?.has(mime)) {
        throw new MetahubValidationError('PlayCanvas project file MIME type does not match the file extension', {
            messageCode: 'playcanvas.files.mime.extensionMismatch'
        })
    }
    return mime
}

export const assertSafeRelativePlayCanvasProjectPath = (value: string): string => {
    const normalized = value.replace(/\\/g, '/').trim()
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        throw new MetahubValidationError('PlayCanvas project file path must be relative', {
            messageCode: 'playcanvas.files.path.invalidRelative'
        })
    }

    const parts = normalized.split('/')
    if (parts.some((part) => part.length === 0)) {
        throw new MetahubValidationError('PlayCanvas project file path cannot contain empty segments', {
            messageCode: 'playcanvas.files.path.emptySegment'
        })
    }

    if (parts[0] !== PLAYCANVAS_PROJECT_FILE_ROOT) {
        throw new MetahubValidationError('PlayCanvas project file path must start with playcanvas-projects/', {
            messageCode: 'playcanvas.files.path.namespaceRequired'
        })
    }

    if (parts.some((part) => part === '..' || part.startsWith('.'))) {
        throw new MetahubValidationError('PlayCanvas project file path cannot contain hidden or parent segments', {
            messageCode: 'playcanvas.files.path.hiddenOrParentSegment'
        })
    }

    const extension = path.extname(parts[parts.length - 1] ?? '').toLowerCase()
    if (!PLAYCANVAS_PROJECT_FILE_EXTENSIONS.has(extension)) {
        throw new MetahubValidationError('PlayCanvas project file type is not supported in this storage slice', {
            messageCode: 'playcanvas.files.path.unsupportedExtension',
            extension
        })
    }

    return parts.join('/')
}

export const assertSafePlayCanvasProjectScopeSegment = (value: string, label: string): string => {
    const normalized = value.trim()
    if (
        !normalized ||
        normalized === '.' ||
        normalized === '..' ||
        normalized.includes('\0') ||
        !PLAYCANVAS_PROJECT_SCOPE_SEGMENT_PATTERN.test(normalized)
    ) {
        throw new MetahubValidationError(`PlayCanvas project ${label} contains unsafe characters`, {
            messageCode: 'playcanvas.files.path.invalidScope',
            scopeSegment: label
        })
    }

    return normalized
}

export class PlayCanvasProjectFileService {
    private static readonly pathLocks = new Map<string, Promise<void>>()

    private readonly root: string

    constructor(root?: string | null) {
        this.root = normalizeStorageRoot(root)
    }

    getRootForTests(): string {
        return this.root
    }

    getRoot(): string {
        return this.root
    }

    buildDefaultScenePath(projectId: string, sceneId: string): string {
        return `${PLAYCANVAS_PROJECT_FILE_ROOT}/${assertSafePlayCanvasProjectScopeSegment(
            projectId,
            'projectId'
        )}/scenes/${assertSafePlayCanvasProjectScopeSegment(sceneId, 'sceneId')}.json`
    }

    buildDefaultArtifactPath(projectId: string, artifactId: string, extension: '.js' | '.mjs' = '.mjs'): string {
        return `${PLAYCANVAS_PROJECT_FILE_ROOT}/${assertSafePlayCanvasProjectScopeSegment(
            projectId,
            'projectId'
        )}/generated/${assertSafePlayCanvasProjectScopeSegment(artifactId, 'artifactId')}${extension}`
    }

    async read(scope: PlayCanvasProjectFileScope, sourcePath: string): Promise<PlayCanvasProjectFileReadResult> {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        const absolutePath = await this.resolveExistingPath(scope, safePath)
        await this.assertSourcePathContainsNoSymlinks(scope, safePath)
        const stat = await fs.stat(absolutePath)
        if (!stat.isFile()) {
            throw new MetahubValidationError('PlayCanvas project path must reference a file', {
                messageCode: 'playcanvas.files.path.notFile'
            })
        }
        if (stat.size > PLAYCANVAS_PROJECT_FILE_MAX_BYTES) {
            throw new MetahubValidationError('PlayCanvas project file is too large', {
                messageCode: 'playcanvas.files.path.tooLarge',
                limitBytes: PLAYCANVAS_PROJECT_FILE_MAX_BYTES
            })
        }

        const content = await fs.readFile(absolutePath)
        return {
            content,
            checksum: computePlayCanvasProjectFileChecksum(content),
            sourcePath: safePath,
            absolutePath,
            size: stat.size
        }
    }

    async stat(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string
    ): Promise<{ exists: boolean; checksum: string | null; size: number | null }> {
        try {
            const read = await this.read(scope, sourcePath)
            return { exists: true, checksum: read.checksum, size: read.size }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { exists: false, checksum: null, size: null }
            }
            throw error
        }
    }

    async write(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string,
        content: Buffer | string,
        options: { expectedChecksum?: string | null; expectedCurrentChecksum?: string | null; mime?: string | null } = {}
    ): Promise<PlayCanvasProjectFileWriteResult> {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        const mime = assertPlayCanvasProjectMimeForPath(safePath, options.mime)
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
        if (buffer.byteLength > PLAYCANVAS_PROJECT_FILE_MAX_BYTES) {
            throw new MetahubValidationError('PlayCanvas project file is too large', {
                messageCode: 'playcanvas.files.path.tooLarge',
                limitBytes: PLAYCANVAS_PROJECT_FILE_MAX_BYTES
            })
        }

        const checksum = computePlayCanvasProjectFileChecksum(buffer)
        if (options.expectedChecksum && options.expectedChecksum !== checksum) {
            throw new MetahubValidationError('PlayCanvas project file checksum does not match declared content', {
                messageCode: 'playcanvas.files.path.checksumMismatch',
                expectedChecksum: options.expectedChecksum,
                actualChecksum: checksum
            })
        }

        const absolutePath = this.resolveTargetPath(scope, safePath)
        return this.withPathLock(absolutePath, async () => {
            await this.assertSourcePathContainsNoSymlinks(scope, safePath, { allowMissingLeaf: true })
            if (options.expectedCurrentChecksum !== undefined) {
                const current = await this.stat(scope, safePath)
                if (options.expectedCurrentChecksum === null) {
                    if (current.exists) {
                        throw new MetahubValidationError('PlayCanvas project file already exists', {
                            messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                            expectedCurrentChecksum: null,
                            actualCurrentChecksum: current.checksum
                        })
                    }
                } else if (!current.exists || current.checksum !== options.expectedCurrentChecksum) {
                    throw new MetahubValidationError('PlayCanvas project file current checksum does not match', {
                        messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                        expectedCurrentChecksum: options.expectedCurrentChecksum,
                        actualCurrentChecksum: current.checksum
                    })
                }
            }

            await this.assertParentWithinRoot(scope, absolutePath)
            await fs.mkdir(path.dirname(absolutePath), { recursive: true })
            const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
            try {
                await fs.writeFile(tempPath, buffer)
                await this.assertResolvedPathWithinBranch(scope, tempPath)
                await fs.rename(tempPath, absolutePath)
            } catch (error) {
                await fs.rm(tempPath, { force: true }).catch(() => undefined)
                throw error
            }
            return { ...(await this.read(scope, safePath)), mime }
        })
    }

    async delete(scope: PlayCanvasProjectFileScope, sourcePath: string): Promise<void> {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        const absolutePath = this.resolveTargetPath(scope, safePath)
        await this.assertResolvedPathWithinBranch(scope, absolutePath, { allowMissing: true })
        await this.assertSourcePathContainsNoSymlinks(scope, safePath, { allowMissingLeaf: true })
        await fs.rm(absolutePath, { force: true })
    }

    async copyTree(source: PlayCanvasProjectFileScope, target: PlayCanvasProjectFileScope): Promise<void> {
        const sourceRoot = this.playCanvasRoot(source)
        const targetRoot = this.playCanvasRoot(target)
        await this.assertResolvedPathWithinRoot(sourceRoot, { allowMissing: true })
        await this.assertResolvedPathWithinRoot(targetRoot, { allowMissing: true })
        const sourceStat = await fs.stat(sourceRoot).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return null
            throw error
        })
        if (!sourceStat) {
            return
        }
        await this.assertPathIsNotSymlink(sourceRoot)
        await this.assertTreeContainsNoSymlinks(sourceRoot)
        await fs.rm(targetRoot, { force: true, recursive: true })
        await fs.mkdir(path.dirname(targetRoot), { recursive: true })
        await fs.cp(sourceRoot, targetRoot, { recursive: true, force: false, errorOnExist: true })
        await this.assertResolvedPathWithinRoot(targetRoot)
    }

    async deleteMetahubTree(metahubId: string): Promise<void> {
        const safeMetahubId = assertSafePlayCanvasProjectScopeSegment(metahubId, 'metahubId')
        const metahubRoot = path.join(this.root, 'metahubs', safeMetahubId)
        await this.assertResolvedPathWithinRoot(metahubRoot, { allowMissing: true })
        await this.quarantineAndRemoveTree(metahubRoot, path.join(this.root, '.trash', 'metahubs'), safeMetahubId)
    }

    async deleteProjectTree(scope: PlayCanvasProjectFileScope, projectId: string): Promise<void> {
        const safeProjectId = assertSafePlayCanvasProjectScopeSegment(projectId, 'projectId')
        const projectRoot = path.join(this.playCanvasRoot(scope), safeProjectId)
        await this.assertResolvedPathWithinRoot(projectRoot, { allowMissing: true })
        await this.quarantineAndRemoveTree(
            projectRoot,
            path.join(this.branchRoot(scope), '.trash', PLAYCANVAS_PROJECT_FILE_ROOT),
            safeProjectId
        )
    }

    branchRoot(scope: PlayCanvasProjectFileScope): string {
        const safeMetahubId = assertSafePlayCanvasProjectScopeSegment(scope.metahubId, 'metahubId')
        const safeBranchSlug = assertSafePlayCanvasProjectScopeSegment(scope.branchSlug, 'branchSlug')
        return path.join(this.root, 'metahubs', safeMetahubId, 'branches', safeBranchSlug)
    }

    playCanvasRoot(scope: PlayCanvasProjectFileScope): string {
        return path.join(this.branchRoot(scope), PLAYCANVAS_PROJECT_FILE_ROOT)
    }

    resolveSourcePath(scope: PlayCanvasProjectFileScope, sourcePath: string): string {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        return this.resolveTargetPath(scope, safePath)
    }

    private resolveTargetPath(scope: PlayCanvasProjectFileScope, sourcePath: string): string {
        return path.join(this.branchRoot(scope), sourcePath)
    }

    private async resolveExistingPath(scope: PlayCanvasProjectFileScope, sourcePath: string): Promise<string> {
        const absolutePath = this.resolveTargetPath(scope, sourcePath)
        await this.assertResolvedPathWithinBranch(scope, absolutePath)
        return absolutePath
    }

    private async assertParentWithinRoot(scope: PlayCanvasProjectFileScope, absolutePath: string): Promise<void> {
        await this.assertResolvedPathWithinBranch(scope, path.dirname(absolutePath), { allowMissing: true })
    }

    private async assertResolvedPathWithinBranch(
        scope: PlayCanvasProjectFileScope,
        absolutePath: string,
        options: { allowMissing?: boolean } = {}
    ): Promise<void> {
        const branchRoot = this.branchRoot(scope)
        await fs.mkdir(branchRoot, { recursive: true })
        await this.assertResolvedPathWithinRoot(branchRoot)
        await this.assertResolvedPathWithinRoot(absolutePath, branchRoot, options)
    }

    private async assertResolvedPathWithinRoot(
        absolutePath: string,
        explicitRoot?: string | { allowMissing?: boolean },
        maybeOptions: { allowMissing?: boolean } = {}
    ): Promise<void> {
        const root = typeof explicitRoot === 'string' ? explicitRoot : this.root
        const options = typeof explicitRoot === 'string' ? maybeOptions : explicitRoot ?? {}
        const resolvedRoot = await fs.realpath(root).catch(async (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error
            await fs.mkdir(root, { recursive: true })
            return fs.realpath(root)
        })
        const resolvedPath = await fs.realpath(absolutePath).catch(async (error: NodeJS.ErrnoException) => {
            if (options.allowMissing && error.code === 'ENOENT') {
                return this.resolveMissingPathWithinExistingAncestor(absolutePath)
            }
            throw error
        })

        const relative = path.relative(resolvedRoot, resolvedPath)
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new MetahubValidationError('PlayCanvas project file path escapes the configured root', {
                messageCode: 'playcanvas.files.path.rootEscape'
            })
        }
    }

    private async resolveMissingPathWithinExistingAncestor(absolutePath: string): Promise<string> {
        const missingSegments: string[] = []
        let cursor = path.resolve(absolutePath)

        while (cursor !== path.dirname(cursor)) {
            try {
                const resolvedAncestor = await fs.realpath(cursor)
                return path.join(resolvedAncestor, ...missingSegments.reverse())
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error
                }

                const parent = path.dirname(cursor)
                if (parent === cursor) {
                    throw error
                }

                missingSegments.push(path.basename(cursor))
                cursor = parent
            }
        }

        throw new MetahubValidationError('PlayCanvas project file path escapes the configured root', {
            messageCode: 'playcanvas.files.path.rootEscape'
        })
    }

    private async assertTreeContainsNoSymlinks(root: string): Promise<void> {
        const entries = await fs.readdir(root, { withFileTypes: true })
        for (const entry of entries) {
            const absolutePath = path.join(root, entry.name)
            await this.assertPathIsNotSymlink(absolutePath)
            if (entry.isDirectory()) {
                await this.assertTreeContainsNoSymlinks(absolutePath)
            }
        }
    }

    private async assertPathIsNotSymlink(absolutePath: string): Promise<Stats> {
        const stat = await fs.lstat(absolutePath)
        if (stat.isSymbolicLink()) {
            throw new MetahubValidationError('PlayCanvas project file tree cannot contain symbolic links', {
                messageCode: 'playcanvas.files.path.symlinkUnsupported'
            })
        }
        return stat
    }

    private async assertSourcePathContainsNoSymlinks(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string,
        options: { allowMissingLeaf?: boolean } = {}
    ): Promise<void> {
        const branchRoot = this.branchRoot(scope)
        const parts = sourcePath.split('/')
        let cursor = branchRoot

        for (let index = 0; index < parts.length; index += 1) {
            cursor = path.join(cursor, parts[index])
            try {
                await this.assertPathIsNotSymlink(cursor)
            } catch (error) {
                if (options.allowMissingLeaf && index === parts.length - 1 && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                    return
                }
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    return
                }
                throw error
            }
        }
    }

    private async quarantineAndRemoveTree(activeRoot: string, trashRoot: string, label: string): Promise<void> {
        const activeStat = await fs.stat(activeRoot).catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return null
            throw error
        })
        if (!activeStat) {
            return
        }
        await this.assertPathIsNotSymlink(activeRoot)
        if (activeStat.isDirectory()) {
            await this.assertTreeContainsNoSymlinks(activeRoot)
        }

        await fs.mkdir(trashRoot, { recursive: true })
        await this.assertResolvedPathWithinRoot(trashRoot)
        const trashPath = path.join(trashRoot, `${label}.${Date.now()}.${crypto.randomUUID()}`)
        await fs.rename(activeRoot, trashPath)
        await fs.rm(trashPath, { force: true, recursive: true }).catch(() => undefined)
    }

    private async withPathLock<T>(absolutePath: string, work: () => Promise<T>): Promise<T> {
        const lockKey = path.resolve(absolutePath)
        const previous = PlayCanvasProjectFileService.pathLocks.get(lockKey) ?? Promise.resolve()
        let release!: () => void
        const current = new Promise<void>((resolve) => {
            release = resolve
        })
        const queued = previous.catch(() => undefined).then(() => current)
        PlayCanvasProjectFileService.pathLocks.set(lockKey, queued)

        await previous.catch(() => undefined)
        try {
            return await work()
        } finally {
            release()
            if (PlayCanvasProjectFileService.pathLocks.get(lockKey) === queued) {
                PlayCanvasProjectFileService.pathLocks.delete(lockKey)
            }
        }
    }
}
