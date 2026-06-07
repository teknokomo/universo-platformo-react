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
    bridgeBootstrapFileName,
    createArtifactManifest,
    createHostedEditorConfig,
    fullUpstreamUiMode,
    packageRoot,
    readRootLockfileHash,
    upstreamCommit,
    upstreamPackageVersion,
    validateArtifactManifest,
    writeUniversoHostedShell
} from '../scripts/lib/playcanvas-editor-artifact.mjs'
import { resolveArtifactRequest } from '../scripts/serve-editor.mjs'
import {
    createPlayCanvasEditorArtifactManifest,
    PLAYCANVAS_EDITOR_SMOKE_MODE,
    PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION
} from '../src/index.ts'

describe('PlayCanvas Editor artifact metadata', () => {
    it('keeps upstream metadata and license attribution consistent', () => {
        expect(() => assertVendorMetadata()).not.toThrow()
        expect(upstreamPackageVersion).toBe('2.23.4')
        expect(upstreamCommit).toBe('c4916f4973963341984499f2d919f8bfd38e417c')
    })

    it('validates the pinned artifact manifest and rejects drift', () => {
        const manifest = createArtifactManifest('2026-06-05T00:00:00.000Z')
        expect(() => validateArtifactManifest(manifest)).not.toThrow()
        expect(() => validateArtifactManifest({ ...manifest, upstreamCommit: 'unexpected' })).toThrow(/upstreamCommit mismatch/)
        expect(() => validateArtifactManifest({ ...manifest, localPath: packageRoot })).toThrow(/keys/)
    })

    it('keeps the public package manifest aligned with the full upstream artifact mode', () => {
        expect(PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION).toBe('2.23.4')
        expect(PLAYCANVAS_EDITOR_SMOKE_MODE).toBe(fullUpstreamUiMode)
        expect(createPlayCanvasEditorArtifactManifest('2026-06-05T00:00:00.000Z').smokeMode).toBe(fullUpstreamUiMode)
    })

    it('declares the bridge bootstrap for full upstream UI mode', () => {
        const manifest = createArtifactManifest('2026-06-05T00:00:00.000Z', fullUpstreamUiMode)

        expect(manifest.mode).toBe(fullUpstreamUiMode)
        expect(manifest.bridgeBootstrap).toBe(bridgeBootstrapFileName)
        expect(() => validateArtifactManifest(manifest)).not.toThrow()
    })

    it('builds a schema-valid hosted Editor config without synthetic admin privileges', () => {
        const config = createHostedEditorConfig(
            {
                selectedProject: {
                    project: {
                        id: '019e9146-fd1b-7d1d-a858-d1e96485d901',
                        displayName: {
                            _primary: 'en',
                            locales: { en: { content: 'Sandbox PlayCanvas Project' } }
                        }
                    },
                    defaultSceneId: '019e9147-16c4-738c-ab0f-b98c443ee676'
                }
            },
            'http://127.0.0.1/editor/'
        )

        expect(config.project.permissions.admin).toEqual([])
        expect(config.self.flags.superUser).toBe(false)
        expect(config.project.name).toBe('Sandbox PlayCanvas Project')
    })

    it('fails closed on unsupported Node versions', () => {
        expect(() => assertNodeVersion('22.21.9')).toThrow(/requires Node.js/)
        expect(() => assertNodeVersion('22.22.0')).not.toThrow()
        expect(() => assertNodeVersion('22.22.0+universo.1')).not.toThrow()
        expect(() => assertNodeVersion('23.0.0')).not.toThrow()
        expect(() => assertNodeVersion('not-a-version')).toThrow(/Unsupported/)
        expect(() => assertNodeVersion('22.22.0-rc.1')).toThrow(/Unsupported/)
    })

    it('does not leave upstream package manifests under the package tree', () => {
        expect(() => assertNoNestedPackageManifests()).not.toThrow()
        expect(fs.existsSync(path.join(packageRoot, 'vendor', 'playcanvas-editor', 'package.json'))).toBe(false)
    })

    it('ignores generated temporary directories when checking nested package manifests', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-manifests-'))

        try {
            fs.mkdirSync(path.join(tempRoot, '.tmp'), { recursive: true })
            fs.writeFileSync(path.join(tempRoot, '.tmp', 'package.json'), '{}')

            expect(() => assertNoNestedPackageManifests(tempRoot)).not.toThrow()
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
    })

    it('does not run unpinned install or network source commands in build/smoke scripts', () => {
        expect(() => assertBuildScriptsDoNotInstall()).not.toThrow()
    })

    it('keeps full upstream UI bootstrap wired to the upstream editor without the hosted entity fallback', () => {
        const sourcePath = path.join(packageRoot, 'scripts', 'lib', 'playcanvas-editor-artifact.mjs')
        const source = fs.readFileSync(sourcePath, 'utf8')
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-shell-'))

        try {
            expect(source).toContain("script.src = './js/editor.js'")
            expect(source).toMatch(/if\s*\(\s*marker\.fullBootMode\s*!==\s*true\s*\)\s*{\s*installHostedEntityAdapter\(editorInstance\);/)
            expect(source).toContain('const observerToJson = (value, visited = new Set()) => {')
            expect(source).toContain('if (!value || visited.has(value)) return null;')
            expect(source).toContain('if (value._observer && value._observer !== value) return observerToJson(value._observer, visited);')
            expect(source).toContain('if (value._observer) return value._observer;')
            expect(source).toContain('rawChildren.map(getEntityReferenceId).filter(Boolean)')
            expect(source).toContain('editorInstance.api?.globals?.entities?.raw')
            expect(source).toContain('marker.lastSerializedEntityIds = entities.map((entity) => entity.id);')
            expect(source).toContain('const rememberScenePayloadEntities = (payload) => {')
            expect(source).toContain('const rebindUpstreamHierarchy = () => {')
            expect(source).toContain("const treeView = editorInstance.call('entities:hierarchy');")
            expect(source).toContain('treeView.entities = rawEntities;')
            expect(source).toContain("querySelector?.('.progress-overlay')")
            expect(source).toContain("overlay.style.pointerEvents = 'none';")
            expect(source).toContain('const hydratePersistedSceneEntities = () => {')
            expect(source).toContain('editorInstance?.api?.globals?.realtime?.scenes?.current?.data?.entities')
            expect(source).toContain('marker.lastHydratedPersistedEntityCount = hydrated;')
            expect(source).toContain('if (!hydratingPersistedScene) {')
            expect(source).toContain(
                'const cleanLoadedPayloadObservers = marker.dirty === true ? [] : scenePayloadEntitiesToObservers(fallbackPayload);'
            )
            expect(source).toContain('rememberScenePayloadEntities(marker.lastLoadedScene?.data?.payload);')
            expect(source).toContain('hydratePersistedSceneEntities();')
            expect(source).toContain("editorInstance.on('scene:raw', () => {")
            expect(source).toContain('const force = options && options.force === true;')
            expect(source).toContain('if (!force && (!marker.initialHydrationComplete || Date.now() < (marker.ignoreDirtyUntil || 0)))')
            expect(source).toContain('markDirty({ force: true });')
            expect(source).toContain("typeof input.resource_id === 'string' && input.resource_id")
            expect(source).toContain("url.pathname === '/api/projects/' + numericProjectId + '/assets'")
            expect(source).toContain('loadFullBootAssets().then((assets) => createJsonResponse(assets))')
            expect(source).not.toContain('return Promise.resolve(createJsonResponse([]));')
            expect(source).toContain("'/config?mode=universo-compatibility-rest-minimal'")
            expect(source).toMatch(
                /if\s*\(\s*marker\.fullBootMode\s*!==\s*true\s*\)\s*{\s*postEditorReady\(\);[\s\S]*?bootstrapProjectStorage\(descriptor\);[\s\S]*?}\s*else\s*{[\s\S]*?waitForUpstreamLayout\(\)/
            )
            expect(source).toContain('postEditorReady();\n          bootstrapProjectStorage(descriptor);')
            expect(source).toContain(
                "if (urlText.includes('/disabled')) throw new Error('Full upstream Editor config must not use disabled realtime endpoints');"
            )

            writeUniversoHostedShell(tempRoot, { mode: fullUpstreamUiMode })
            const fullBootHtml = fs.readFileSync(path.join(tempRoot, 'index.html'), 'utf8')
            expect(fullBootHtml).not.toContain('/disabled')
            expect(fullBootHtml).not.toContain('UniversoHostedWebSocket')

            writeUniversoHostedShell(tempRoot, { mode: 'universo-hosted' })
            const hostedHtml = fs.readFileSync(path.join(tempRoot, 'index.html'), 'utf8')
            expect(hostedHtml).toContain('/disabled')
            expect(hostedHtml).toContain('UniversoHostedWebSocket')
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
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
        expect(resolveArtifactRequest('/bad%00path', root)).toMatchObject({ status: 400 })
    })

    it('rejects artifact server symlink escapes outside the real artifact root', () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-test-'))
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-outside-'))

        try {
            fs.writeFileSync(path.join(tempRoot, 'index.html'), '<!doctype html>')
            fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret')
            try {
                fs.symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(tempRoot, 'secret-link.txt'))
            } catch (error) {
                if (process.platform === 'win32' && error?.code === 'EPERM') {
                    return
                }
                throw error
            }

            expect(resolveArtifactRequest('/secret-link.txt', tempRoot)).toMatchObject({ status: 403 })
        } finally {
            fs.rmSync(tempRoot, { recursive: true, force: true })
            fs.rmSync(outsideDir, { recursive: true, force: true })
        }
    })
})
