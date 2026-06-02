import crypto from 'crypto'
import type { Stats } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { MetahubValidationError } from '../../shared/domainErrors'

export interface ModuleSourceScope {
    metahubId: string
    branchSlug: string
}

export interface ModuleSourceReadResult {
    sourceCode: string
    checksum: string
    sourcePath: string
    absolutePath: string
}

export const MODULE_SOURCE_MAX_BYTES = 512 * 1024

const DEFAULT_MODULE_SOURCE_ROOT = path.resolve(process.cwd(), 'storage')

const MODULE_SOURCE_PATH_PATTERN = /\.tsx?$/
const MODULE_SOURCE_SCOPE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

const normalizeStorageRoot = (root?: string | null): string => {
    const configured = root?.trim() || process.env.UPL_MODULE_SOURCE_ROOT?.trim() || DEFAULT_MODULE_SOURCE_ROOT
    return path.resolve(configured)
}

export const computeModuleSourceChecksum = (sourceCode: string): string =>
    crypto.createHash('sha256').update(sourceCode, 'utf8').digest('hex')

export const assertSafeRelativeModulePath = (value: string): string => {
    const normalized = value.replace(/\\/g, '/').trim()
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        throw new MetahubValidationError('Module source path must be a relative TypeScript file path', {
            messageCode: 'modules.sourcePath.invalidRelative'
        })
    }

    const parts = normalized.split('/')
    if (parts.some((part) => part.length === 0)) {
        throw new MetahubValidationError('Module source path cannot contain empty segments', {
            messageCode: 'modules.sourcePath.emptySegment'
        })
    }

    if (parts[0] !== 'modules') {
        throw new MetahubValidationError('Module source path must start with modules/', {
            messageCode: 'modules.sourcePath.modulesPrefixRequired'
        })
    }

    if (parts.some((part) => part === '..' || part.startsWith('.'))) {
        throw new MetahubValidationError('Module source path cannot contain hidden or parent segments', {
            messageCode: 'modules.sourcePath.hiddenOrParentSegment'
        })
    }

    const filename = parts[parts.length - 1] ?? ''
    if (!MODULE_SOURCE_PATH_PATTERN.test(filename) || /\.(mts|mjs|jsx|js)$/.test(filename)) {
        throw new MetahubValidationError('Module source path must end with .ts or .tsx', {
            messageCode: 'modules.sourcePath.unsupportedExtension'
        })
    }

    return parts.join('/')
}

export const assertSafeModuleSourceScopeSegment = (value: string, label: string): string => {
    const normalized = value.trim()
    if (
        !normalized ||
        normalized === '.' ||
        normalized === '..' ||
        normalized.includes('\0') ||
        !MODULE_SOURCE_SCOPE_SEGMENT_PATTERN.test(normalized)
    ) {
        throw new MetahubValidationError(`Module source ${label} contains unsafe characters`, {
            messageCode: 'modules.sourcePath.invalidScope',
            scopeSegment: label
        })
    }

    return normalized
}

export class ModuleSourceFileService {
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

    buildDefaultSourcePath(input: {
        codename: string
        attachedToKind: string
        attachedToId?: string | null
        moduleRole?: string | null
    }): string {
        const safeCodename = input.codename
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
        const safeKind = input.attachedToKind
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
        if (input.moduleRole === 'library' || input.attachedToKind === 'general') {
            return `modules/general/${safeCodename}.ts`
        }
        if (input.attachedToKind === 'metahub') {
            return `modules/metahub/${safeCodename}.ts`
        }
        return `modules/attached/${safeKind}/${safeCodename}.ts`
    }

    async read(scope: ModuleSourceScope, sourcePath: string): Promise<ModuleSourceReadResult> {
        const safePath = assertSafeRelativeModulePath(sourcePath)
        const absolutePath = await this.resolveExistingPath(scope, safePath)
        const stat = await fs.stat(absolutePath)
        if (!stat.isFile()) {
            throw new MetahubValidationError('Module source path must reference a file', {
                messageCode: 'modules.sourcePath.notFile'
            })
        }
        if (stat.size > MODULE_SOURCE_MAX_BYTES) {
            throw new MetahubValidationError('Module source file is too large', {
                messageCode: 'modules.sourcePath.tooLarge',
                limitBytes: MODULE_SOURCE_MAX_BYTES
            })
        }

        const sourceCode = await fs.readFile(absolutePath, 'utf8')
        return {
            sourceCode,
            checksum: computeModuleSourceChecksum(sourceCode),
            sourcePath: safePath,
            absolutePath
        }
    }

    async stat(scope: ModuleSourceScope, sourcePath: string): Promise<{ exists: boolean; checksum: string | null }> {
        try {
            const read = await this.read(scope, sourcePath)
            return { exists: true, checksum: read.checksum }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { exists: false, checksum: null }
            }
            throw error
        }
    }

    async write(scope: ModuleSourceScope, sourcePath: string, sourceCode: string): Promise<ModuleSourceReadResult> {
        const safePath = assertSafeRelativeModulePath(sourcePath)
        if (Buffer.byteLength(sourceCode, 'utf8') > MODULE_SOURCE_MAX_BYTES) {
            throw new MetahubValidationError('Module source file is too large', {
                messageCode: 'modules.sourcePath.tooLarge',
                limitBytes: MODULE_SOURCE_MAX_BYTES
            })
        }

        const absolutePath = this.resolveTargetPath(scope, safePath)
        await this.assertParentWithinRoot(scope, absolutePath)
        await fs.mkdir(path.dirname(absolutePath), { recursive: true })
        const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
        try {
            await fs.writeFile(tempPath, sourceCode, 'utf8')
            await this.assertResolvedPathWithinBranch(scope, tempPath)
            await fs.rename(tempPath, absolutePath)
        } catch (error) {
            await fs.rm(tempPath, { force: true }).catch(() => undefined)
            throw error
        }
        return this.read(scope, safePath)
    }

    async delete(scope: ModuleSourceScope, sourcePath: string): Promise<void> {
        const safePath = assertSafeRelativeModulePath(sourcePath)
        const absolutePath = this.resolveTargetPath(scope, safePath)
        await this.assertResolvedPathWithinBranch(scope, absolutePath, { allowMissing: true })
        await fs.rm(absolutePath, { force: true })
    }

    async copyTree(source: ModuleSourceScope, target: ModuleSourceScope): Promise<void> {
        const sourceRoot = this.branchRoot(source)
        const targetRoot = this.branchRoot(target)
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
        const safeMetahubId = assertSafeModuleSourceScopeSegment(metahubId, 'metahubId')
        const metahubRoot = path.join(this.root, 'metahubs', safeMetahubId)
        await this.assertResolvedPathWithinRoot(metahubRoot, { allowMissing: true })
        await fs.rm(metahubRoot, { force: true, recursive: true })
    }

    branchRoot(scope: ModuleSourceScope): string {
        const safeMetahubId = assertSafeModuleSourceScopeSegment(scope.metahubId, 'metahubId')
        const safeBranchSlug = assertSafeModuleSourceScopeSegment(scope.branchSlug, 'branchSlug')
        return path.join(this.root, 'metahubs', safeMetahubId, 'branches', safeBranchSlug)
    }

    resolveSourcePath(scope: ModuleSourceScope, sourcePath: string): string {
        const safePath = assertSafeRelativeModulePath(sourcePath)
        return this.resolveTargetPath(scope, safePath)
    }

    private resolveTargetPath(scope: ModuleSourceScope, sourcePath: string): string {
        return path.join(this.branchRoot(scope), sourcePath)
    }

    private async resolveExistingPath(scope: ModuleSourceScope, sourcePath: string): Promise<string> {
        const absolutePath = this.resolveTargetPath(scope, sourcePath)
        await this.assertResolvedPathWithinBranch(scope, absolutePath)
        return absolutePath
    }

    private async assertParentWithinRoot(scope: ModuleSourceScope, absolutePath: string): Promise<void> {
        await this.assertResolvedPathWithinBranch(scope, path.dirname(absolutePath), { allowMissing: true })
    }

    private async assertResolvedPathWithinBranch(
        scope: ModuleSourceScope,
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
            throw new MetahubValidationError('Module source path escapes the configured source root', {
                messageCode: 'modules.sourcePath.rootEscape'
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

        throw new MetahubValidationError('Module source path escapes the configured source root', {
            messageCode: 'modules.sourcePath.rootEscape'
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
            throw new MetahubValidationError('Module source tree cannot contain symbolic links', {
                messageCode: 'modules.sourcePath.symlinkUnsupported'
            })
        }
        return stat
    }
}
