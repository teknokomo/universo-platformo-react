import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
    assertSafeRelativePlayCanvasProjectPath,
    computePlayCanvasProjectFileChecksum,
    PlayCanvasProjectFileService
} from '../../domains/playcanvas-projects/services/PlayCanvasProjectFileService'

describe('PlayCanvasProjectFileService', () => {
    let root: string
    let service: PlayCanvasProjectFileService
    const scope = { metahubId: 'metahub-1', branchSlug: 'main' }

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-playcanvas-files-'))
        service = new PlayCanvasProjectFileService(root)
    })

    afterEach(async () => {
        await fs.rm(root, { recursive: true, force: true })
    })

    it('accepts only playcanvas-projects scoped JSON, JS, shader, and small image asset paths', () => {
        expect(assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/scenes/main.json')).toBe(
            'playcanvas-projects/project/scenes/main.json'
        )
        expect(assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/generated/script.mjs')).toBe(
            'playcanvas-projects/project/generated/script.mjs'
        )
        expect(assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/sourcefiles/script.mjs')).toBe(
            'playcanvas-projects/project/sourcefiles/script.mjs'
        )
        expect(assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/assets/texture.png')).toBe(
            'playcanvas-projects/project/assets/texture.png'
        )
        expect(assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/assets/material.glsl')).toBe(
            'playcanvas-projects/project/assets/material.glsl'
        )
        expect(() => assertSafeRelativePlayCanvasProjectPath('modules/project/main.ts')).toThrow('playcanvas-projects/')
        expect(() => assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/../main.json')).toThrow('hidden or parent')
        expect(() => assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/.secret.json')).toThrow('hidden or parent')
        expect(() => assertSafeRelativePlayCanvasProjectPath('playcanvas-projects/project/assets/texture.svg')).toThrow('not supported')
    })

    it('writes and reads files with checksum validation', async () => {
        const content = JSON.stringify({ entities: [] })
        const checksum = computePlayCanvasProjectFileChecksum(content)
        const written = await service.write(scope, 'playcanvas-projects/project/scenes/main.json', content, {
            expectedChecksum: checksum,
            mime: 'application/json'
        })

        expect(written.checksum).toBe(checksum)
        expect(written.mime).toBe('application/json')

        const read = await service.read(scope, 'playcanvas-projects/project/scenes/main.json')
        expect(read.content.toString('utf8')).toBe(content)
        expect(read.absolutePath).toContain(path.join('metahubs', 'metahub-1', 'branches', 'main'))
    })

    it('writes and reads image assets with extension-bound MIME validation', async () => {
        const image = Buffer.from([0x89, 0x50, 0x4e, 0x47])
        const written = await service.write(scope, 'playcanvas-projects/project/assets/crosshair.png', image, {
            mime: 'image/png'
        })

        expect(written.mime).toBe('image/png')
        expect(written.size).toBe(image.length)

        await expect(
            service.write(scope, 'playcanvas-projects/project/assets/crosshair.png', image, {
                mime: 'image/jpeg'
            })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.mime.extensionMismatch' })
        })
    })

    it('writes shader source files using the upstream glsl extension', async () => {
        const source = '#version 300 es\nvoid main() {}\n'
        const written = await service.write(scope, 'playcanvas-projects/project/assets/new.glsl', source, {
            mime: 'text/plain'
        })

        expect(written.mime).toBe('text/plain')
        await expect(service.read(scope, 'playcanvas-projects/project/assets/new.glsl')).resolves.toMatchObject({
            content: Buffer.from(source),
            checksum: computePlayCanvasProjectFileChecksum(source)
        })
    })

    it('rejects checksum mismatches', async () => {
        await expect(
            service.write(scope, 'playcanvas-projects/project/scenes/main.json', '{}', { expectedChecksum: 'wrong' })
        ).rejects.toThrow('checksum')
    })

    it('guards writes with the current stored checksum', async () => {
        const path = 'playcanvas-projects/project/scenes/main.json'
        const initial = await service.write(scope, path, '{"version":1}')

        await expect(service.write(scope, path, '{"version":2}', { expectedCurrentChecksum: null })).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.currentChecksumMismatch' })
        })
        await expect(
            service.write(scope, path, '{"version":2}', { expectedCurrentChecksum: computePlayCanvasProjectFileChecksum('stale') })
        ).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.currentChecksumMismatch' })
        })

        const updated = await service.write(scope, path, '{"version":2}', { expectedCurrentChecksum: initial.checksum })
        expect(updated.checksum).toBe(computePlayCanvasProjectFileChecksum('{"version":2}'))
    })

    it('serializes checksum-guarded concurrent writes for the same path', async () => {
        const sourcePath = 'playcanvas-projects/project/scenes/main.json'
        const initial = await service.write(scope, sourcePath, '{"version":1}')

        const results = await Promise.allSettled([
            service.write(scope, sourcePath, '{"version":2}', { expectedCurrentChecksum: initial.checksum }),
            service.write(scope, sourcePath, '{"version":3}', { expectedCurrentChecksum: initial.checksum })
        ])

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    })

    it('serializes project-tree deletion with a concurrent child-file write', async () => {
        const sourcePath = 'playcanvas-projects/project/scenes/main.json'
        const initial = await service.write(scope, sourcePath, '{"version":1}')
        let writeStarted!: () => void
        let releaseWrite!: () => void
        const writeStartedPromise = new Promise<void>((resolve) => {
            writeStarted = resolve
        })
        const writeGate = new Promise<void>((resolve) => {
            releaseWrite = resolve
        })
        const originalWriteFile = fs.writeFile
        const writeFileSpy = jest.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
            const target = String(args[0])
            if (target.includes(`${path.sep}main.json.`) && target.endsWith('.tmp')) {
                writeStarted()
                await writeGate
            }
            return originalWriteFile(...args)
        })

        try {
            const writePromise = service.write(scope, sourcePath, '{"version":2}', { expectedCurrentChecksum: initial.checksum })
            await writeStartedPromise

            let deletionFinished = false
            const deletionPromise = service.deleteProjectTree(scope, 'project').then(() => {
                deletionFinished = true
            })
            await Promise.resolve()
            expect(deletionFinished).toBe(false)

            releaseWrite()
            await Promise.all([writePromise, deletionPromise])
            await expect(service.stat(scope, sourcePath)).resolves.toMatchObject({ exists: false })
        } finally {
            writeFileSpy.mockRestore()
        }
    })

    it('allows creating a new file only when the current checksum expectation is null', async () => {
        const path = 'playcanvas-projects/project/scenes/new.json'
        const written = await service.write(scope, path, '{"created":true}', { expectedCurrentChecksum: null })

        expect(written.checksum).toBe(computePlayCanvasProjectFileChecksum('{"created":true}'))
    })

    it('skips checksum-guarded deletes when newer content replaced the rollback candidate', async () => {
        const sourcePath = 'playcanvas-projects/project/scenes/main.json'
        const rollbackCandidate = await service.write(scope, sourcePath, '{"version":1}')
        const newer = await service.write(scope, sourcePath, '{"version":2}', {
            expectedCurrentChecksum: rollbackCandidate.checksum
        })

        await expect(service.deleteIfCurrentChecksum(scope, sourcePath, rollbackCandidate.checksum)).resolves.toBe(false)

        const current = await service.read(scope, sourcePath)
        expect(current.checksum).toBe(newer.checksum)
        expect(current.content.toString('utf8')).toBe('{"version":2}')
    })

    it('deletes only when the current checksum still matches the rollback candidate', async () => {
        const sourcePath = 'playcanvas-projects/project/scenes/main.json'
        const rollbackCandidate = await service.write(scope, sourcePath, '{"version":1}')

        await expect(service.deleteIfCurrentChecksum(scope, sourcePath, rollbackCandidate.checksum)).resolves.toBe(true)

        await expect(service.stat(scope, sourcePath)).resolves.toMatchObject({ exists: false })
    })

    it('renames files while preserving checksum and refusing to clobber the target', async () => {
        const sourcePath = 'playcanvas-projects/project/assets/source.mjs'
        const targetPath = 'playcanvas-projects/project/assets/renamed.mjs'
        const source = await service.write(scope, sourcePath, 'export default 1')

        const moved = await service.rename(scope, sourcePath, targetPath, { expectedChecksum: source.checksum })

        expect(moved.checksum).toBe(source.checksum)
        await expect(service.stat(scope, sourcePath)).resolves.toMatchObject({ exists: false })
        await expect(service.stat(scope, targetPath)).resolves.toMatchObject({ exists: true, checksum: source.checksum })

        const replacementPath = 'playcanvas-projects/project/assets/replacement.mjs'
        const replacement = await service.write(scope, replacementPath, 'export default 2')
        await expect(service.rename(scope, targetPath, replacementPath)).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.targetAlreadyExists' })
        })
        await expect(service.read(scope, replacementPath)).resolves.toMatchObject({ checksum: replacement.checksum })
        await expect(service.read(scope, targetPath)).resolves.toMatchObject({ checksum: source.checksum })
    })

    it('rejects symlink escapes', async () => {
        const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'upl-playcanvas-outside-'))
        const branchRoot = service.branchRoot(scope)
        await fs.mkdir(path.join(branchRoot, 'playcanvas-projects', 'project'), { recursive: true })
        await fs.symlink(outsideRoot, path.join(branchRoot, 'playcanvas-projects', 'project', 'linked'))

        await expect(service.write(scope, 'playcanvas-projects/project/linked/main.json', '{}')).rejects.toThrow()
        await fs.rm(outsideRoot, { recursive: true, force: true })
    })

    it('rejects symlinked files that still resolve inside the branch root', async () => {
        const branchRoot = service.branchRoot(scope)
        const projectRoot = path.join(branchRoot, 'playcanvas-projects', 'project')
        await fs.mkdir(path.join(projectRoot, 'scenes'), { recursive: true })
        await fs.writeFile(path.join(projectRoot, 'scenes', 'target.json'), '{}')
        await fs.symlink(path.join(projectRoot, 'scenes', 'target.json'), path.join(projectRoot, 'scenes', 'link.json'))

        await expect(service.read(scope, 'playcanvas-projects/project/scenes/link.json')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.symlinkUnsupported' })
        })
        await expect(service.write(scope, 'playcanvas-projects/project/scenes/link.json', '{"next":true}')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.symlinkUnsupported' })
        })
        await expect(service.delete(scope, 'playcanvas-projects/project/scenes/link.json')).rejects.toMatchObject({
            details: expect.objectContaining({ messageCode: 'playcanvas.files.path.symlinkUnsupported' })
        })
    })

    it('copies and deletes project trees without symlinks', async () => {
        await service.write(scope, 'playcanvas-projects/project/scenes/main.json', '{}')
        await service.copyTree(scope, { metahubId: 'metahub-2', branchSlug: 'main' })

        const copied = await service.read({ metahubId: 'metahub-2', branchSlug: 'main' }, 'playcanvas-projects/project/scenes/main.json')
        expect(copied.content.toString('utf8')).toBe('{}')

        await service.deleteMetahubTree('metahub-2')
        const stat = await service.stat({ metahubId: 'metahub-2', branchSlug: 'main' }, 'playcanvas-projects/project/scenes/main.json')
        expect(stat.exists).toBe(false)
    })

    it('keeps an existing target tree intact when staging the copy fails', async () => {
        const target = { metahubId: 'metahub-2', branchSlug: 'main' }
        const sourcePath = 'playcanvas-projects/project/scenes/main.json'
        const targetPath = 'playcanvas-projects/project/scenes/main.json'
        await service.write(scope, sourcePath, '{"source":true}')
        await service.write(target, targetPath, '{"target":true}')

        const copySpy = jest.spyOn(fs, 'cp').mockRejectedValueOnce(new Error('copy failed'))
        try {
            await expect(service.copyTree(scope, target)).rejects.toThrow('copy failed')
        } finally {
            copySpy.mockRestore()
        }

        await expect(service.read(target, targetPath)).resolves.toMatchObject({
            content: Buffer.from('{"target":true}')
        })
    })

    it('quarantines project trees before recursive cleanup', async () => {
        const sourcePath = 'playcanvas-projects/project/scenes/main.json'
        await service.write(scope, sourcePath, '{}')

        await service.deleteProjectTree(scope, 'project')

        const stat = await service.stat(scope, sourcePath)
        expect(stat.exists).toBe(false)
        const trashRoot = path.join(service.branchRoot(scope), '.trash', 'playcanvas-projects')
        await expect(fs.readdir(trashRoot)).resolves.toEqual([])
    })
})
