import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
    assertSafeRelativeModulePath,
    assertSafeModuleSourceScopeSegment,
    computeModuleSourceChecksum,
    ModuleSourceFileService
} from '../../domains/modules/services/ModuleSourceFileService'

describe('ModuleSourceFileService', () => {
    let root: string
    let service: ModuleSourceFileService

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-storage-'))
        service = new ModuleSourceFileService(root)
    })

    afterEach(async () => {
        await fs.rm(root, { recursive: true, force: true })
    })

    it('normalizes safe relative module paths', () => {
        expect(assertSafeRelativeModulePath('modules/general/shared.ts')).toBe('modules/general/shared.ts')
        expect(assertSafeRelativeModulePath('modules\\general\\shared.tsx')).toBe('modules/general/shared.tsx')
    })

    it('rejects unsafe metahub and branch scope segments before resolving filesystem paths', async () => {
        expect(assertSafeModuleSourceScopeSegment('metahub_1-branch', 'metahubId')).toBe('metahub_1-branch')
        expect(() => assertSafeModuleSourceScopeSegment('../escape', 'metahubId')).toThrow('unsafe characters')
        expect(() => service.branchRoot({ metahubId: '../escape', branchSlug: 'main' })).toThrow('unsafe characters')
        await expect(service.deleteMetahubTree('../escape')).rejects.toThrow('unsafe characters')
        await expect(
            service.copyTree({ metahubId: 'metahub-1', branchSlug: 'main' }, { metahubId: 'metahub-2', branchSlug: '../escape' })
        ).rejects.toThrow('unsafe characters')
    })

    it.each([
        '../modules/shared.ts',
        '/modules/shared.ts',
        'modules/.internal/shared.ts',
        'modules/general/shared.js',
        'modules/general/shared.jsx',
        'modules/general/shared.mjs',
        'modules/general/shared.mts',
        'other/general/shared.ts'
    ])('rejects unsafe module source path %s', (sourcePath) => {
        expect(() => assertSafeRelativeModulePath(sourcePath)).toThrow()
    })

    it('writes and reads source files with a stable checksum', async () => {
        const scope = { metahubId: 'metahub-1', branchSlug: 'branch-main' }
        const sourceCode = 'export default class SharedHelpers {}'

        const written = await service.write(scope, 'modules/general/shared-helpers.ts', sourceCode)
        const read = await service.read(scope, 'modules/general/shared-helpers.ts')

        expect(written.sourcePath).toBe('modules/general/shared-helpers.ts')
        expect(read.sourceCode).toBe(sourceCode)
        expect(read.checksum).toBe(computeModuleSourceChecksum(sourceCode))
    })

    it('uses a durable workspace storage root when no explicit root is configured', () => {
        const defaultService = new ModuleSourceFileService()

        expect(defaultService.getRootForTests()).toBe(path.resolve(process.cwd(), 'storage'))
    })

    it('rejects symlink escapes from the branch root', async () => {
        const scope = { metahubId: 'metahub-1', branchSlug: 'branch-main' }
        const branchRoot = service.branchRoot(scope)
        const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-module-outside-'))
        await fs.writeFile(path.join(outsideRoot, 'escape.ts'), 'export default class Escape {}', 'utf8')
        await fs.mkdir(path.join(branchRoot, 'modules'), { recursive: true })
        await fs.symlink(outsideRoot, path.join(branchRoot, 'modules', 'linked'))

        await expect(service.read(scope, 'modules/linked/escape.ts')).rejects.toThrow('escapes the configured source root')

        await fs.rm(outsideRoot, { recursive: true, force: true })
    })

    it('rejects branch roots that resolve outside the configured source root', async () => {
        const scope = { metahubId: 'metahub-1', branchSlug: 'branch-main' }
        const branchRoot = service.branchRoot(scope)
        const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-module-outside-'))
        await fs.mkdir(path.dirname(branchRoot), { recursive: true })
        await fs.symlink(outsideRoot, branchRoot)
        await fs.mkdir(path.join(outsideRoot, 'modules', 'general'), { recursive: true })
        await fs.writeFile(path.join(outsideRoot, 'modules', 'general', 'escape.ts'), 'export default class Escape {}', 'utf8')

        await expect(service.read(scope, 'modules/general/escape.ts')).rejects.toThrow('escapes the configured source root')

        await fs.rm(outsideRoot, { recursive: true, force: true })
    })

    it('rejects writes through symlinked ancestors before creating missing target files', async () => {
        const scope = { metahubId: 'metahub-1', branchSlug: 'branch-main' }
        const branchRoot = service.branchRoot(scope)
        const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-module-outside-'))
        await fs.mkdir(path.join(branchRoot, 'modules'), { recursive: true })
        await fs.symlink(outsideRoot, path.join(branchRoot, 'modules', 'linked'))

        await expect(service.write(scope, 'modules/linked/newdir/escape.ts', 'export default class Escape {}')).rejects.toThrow(
            'escapes the configured source root'
        )
        await expect(fs.stat(path.join(outsideRoot, 'newdir', 'escape.ts'))).rejects.toMatchObject({ code: 'ENOENT' })

        await fs.rm(outsideRoot, { recursive: true, force: true })
    })

    it('rejects copying module source trees that contain symlink artifacts', async () => {
        const sourceScope = { metahubId: 'metahub-1', branchSlug: 'branch-main' }
        const targetScope = { metahubId: 'metahub-2', branchSlug: 'branch-main' }
        const sourceRoot = service.branchRoot(sourceScope)
        const targetRoot = service.branchRoot(targetScope)
        const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-module-outside-'))

        await fs.mkdir(path.join(sourceRoot, 'modules', 'general'), { recursive: true })
        await fs.writeFile(path.join(sourceRoot, 'modules', 'general', 'shared.ts'), 'export default class Shared {}', 'utf8')
        await fs.symlink(outsideRoot, path.join(sourceRoot, 'modules', 'linked'))

        await expect(service.copyTree(sourceScope, targetScope)).rejects.toThrow('symbolic links')
        await expect(fs.stat(targetRoot)).rejects.toMatchObject({ code: 'ENOENT' })

        await fs.rm(outsideRoot, { recursive: true, force: true })
    })

    it('rejects copying module source trees when the source branch root is a symlink', async () => {
        const sourceScope = { metahubId: 'metahub-1', branchSlug: 'branch-main' }
        const targetScope = { metahubId: 'metahub-2', branchSlug: 'branch-main' }
        const sourceRoot = service.branchRoot(sourceScope)
        const targetRoot = service.branchRoot(targetScope)
        const linkedRoot = path.join(root, 'linked-branch-root')

        await fs.mkdir(path.dirname(sourceRoot), { recursive: true })
        await fs.mkdir(path.join(linkedRoot, 'modules', 'general'), { recursive: true })
        await fs.writeFile(path.join(linkedRoot, 'modules', 'general', 'shared.ts'), 'export default class Shared {}', 'utf8')
        await fs.symlink(linkedRoot, sourceRoot)

        await expect(service.copyTree(sourceScope, targetScope)).rejects.toThrow('symbolic links')
        await expect(fs.stat(targetRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    })
})
