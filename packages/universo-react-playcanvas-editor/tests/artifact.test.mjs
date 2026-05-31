import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
    assertBuildScriptsDoNotInstall,
    assertNodeVersion,
    assertNoNestedPackageManifests,
    assertRootLockfileHash,
    assertVendorMetadata,
    createArtifactManifest,
    packageRoot,
    readRootLockfileHash,
    upstreamCommit,
    upstreamPackageVersion,
    validateArtifactManifest
} from '../scripts/lib/playcanvas-editor-artifact.mjs'
import { resolveArtifactRequest } from '../scripts/serve-editor.mjs'

describe('PlayCanvas Editor artifact metadata', () => {
    it('keeps upstream metadata and license attribution consistent', () => {
        expect(() => assertVendorMetadata()).not.toThrow()
        expect(upstreamPackageVersion).toBe('2.22.1')
        expect(upstreamCommit).toBe('0fcd44253ba1bba39c13d45b069265167249ecb6')
    })

    it('validates the pinned artifact manifest and rejects drift', () => {
        const manifest = createArtifactManifest('2026-05-31T00:00:00.000Z')
        expect(() => validateArtifactManifest(manifest)).not.toThrow()
        expect(() => validateArtifactManifest({ ...manifest, upstreamCommit: 'unexpected' })).toThrow(/upstreamCommit mismatch/)
        expect(() => validateArtifactManifest({ ...manifest, localPath: packageRoot })).toThrow(/keys/)
    })

    it('fails closed on unsupported Node versions', () => {
        expect(() => assertNodeVersion('22.21.9')).toThrow(/requires Node.js/)
        expect(() => assertNodeVersion('22.22.0')).not.toThrow()
        expect(() => assertNodeVersion('23.0.0')).not.toThrow()
        expect(() => assertNodeVersion('not-a-version')).toThrow(/Unsupported/)
    })

    it('does not leave upstream package manifests under the package tree', () => {
        expect(() => assertNoNestedPackageManifests()).not.toThrow()
        expect(fs.existsSync(path.join(packageRoot, 'vendor', 'playcanvas-editor', 'package.json'))).toBe(false)
    })

    it('does not run unpinned install or network source commands in build/smoke scripts', () => {
        expect(() => assertBuildScriptsDoNotInstall()).not.toThrow()
    })

    it('rejects direct and split-argument install or network source commands in scripts', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-scripts-'))

        try {
            const samples = [
                ['npm-install.mjs', 'npm install'],
                ['npm-ci.mjs', 'npm ci'],
                ['pnpm-add.mjs', 'pnpm add left-pad'],
                ['pnpm-short-install.mjs', 'pnpm i'],
                ['yarn-bare-install.mjs', 'yarn'],
                ['yarn-install.mjs', 'yarn install'],
                ['corepack-prepare.mjs', 'corepack prepare pnpm@10.33.2 --activate'],
                ['corepack-pnpm-install.mjs', 'corepack pnpm install'],
                ['npx-package.mjs', 'npx package-name'],
                ['npx-dlx.mjs', 'npx dlx package-name'],
                ['bun-install.mjs', 'bun install'],
                ['bunx-package.mjs', 'bunx package-name'],
                ['git-clone.mjs', 'git clone https://example.invalid/repo.git'],
                ['git-submodule.mjs', 'git submodule update --init'],
                ['exec-install.mjs', "exec('npm install')"],
                ['exec-sync-fetch.mjs', "execSync('git fetch')"],
                ['split-install.mjs', "spawnSync('pnpm', ['install'])"],
                ['split-ci.mjs', "spawnSync('npm', ['ci'])"],
                ['split-short-install.mjs', "spawnSync('pnpm', ['i'])"],
                ['split-yarn-bare.mjs', "spawnSync('yarn', [])"],
                ['split-corepack-prepare.mjs', "spawnSync('corepack', ['prepare', 'pnpm@10.33.2', '--activate'])"],
                ['split-corepack-pnpm-install.mjs', "spawnSync('corepack', ['pnpm', 'install'])"],
                ['split-npx.mjs', "execFile('npx', ['package-name'])"],
                ['split-bun-install.mjs', "execFile('bun', ['install'])"],
                ['split-bunx.mjs', "execFile('bunx', ['package-name'])"],
                ['split-shell-install.mjs', "spawnSync('bash', ['-lc', 'pnpm install'])"],
                ['split-fetch.mjs', "execFile('git', ['fetch'])"]
            ]

            for (const [fileName, source] of samples) {
                const sampleDir = fs.mkdtempSync(path.join(tempRoot, 'sample-'))
                fs.writeFileSync(path.join(sampleDir, fileName), source)
                expect(() => assertBuildScriptsDoNotInstall(sampleDir), fileName).toThrow(/must not run/)
            }
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
    })

    it('keeps the root lockfile stable during package checks', () => {
        expect(() => assertRootLockfileHash(readRootLockfileHash())).not.toThrow()
        expect(() => assertRootLockfileHash('unexpected')).toThrow(/pnpm-lock/)
    })

    it('rejects artifact server traversal outside the exact artifact root', () => {
        const root = path.join(packageRoot, 'dist', 'editor')

        expect(resolveArtifactRequest('/js/editor.js', root)).toMatchObject({
            status: 200,
            absolutePath: path.join(root, 'js', 'editor.js')
        })
        expect(resolveArtifactRequest('/..%2feditor2/file.js', root)).toMatchObject({ status: 403 })
        expect(resolveArtifactRequest('/%2e%2e%2feditor-evil/file.js', root)).toMatchObject({ status: 403 })
        expect(resolveArtifactRequest('/%E0%A4%A', root)).toMatchObject({ status: 400 })
    })

    it('rejects artifact server symlink escapes outside the real artifact root', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-test-'))
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-outside-'))

        try {
            fs.writeFileSync(path.join(tempRoot, 'index.html'), '<!doctype html>')
            fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret')
            fs.symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(tempRoot, 'secret-link.txt'))

            expect(resolveArtifactRequest('/secret-link.txt', tempRoot)).toMatchObject({ status: 403 })
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true })
            fs.rmSync(outsideDir, { recursive: true, force: true })
        }
    })
})
