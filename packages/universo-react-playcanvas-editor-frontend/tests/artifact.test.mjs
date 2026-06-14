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
    inlineAjaxLoaderImage,
    inlineBlankProjectImage,
    inlineEditorLogoImage,
    inlineEntityIconImage,
    inlineHelpInstructionImage,
    inlinePlayCanvasTextImage,
    inlineRemoveIconImage,
    packageRoot,
    patchUniversoHostedArtifact,
    readRootLockfileHash,
    upstreamCommit,
    upstreamPackageVersion,
    validateArtifactManifest,
    writeBridgeBootstrap,
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
        expect(config.url.static).toBe('http://127.0.0.1/editor')
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
            expect(source).toContain("sendBridgeCommand('scene.saveStatus'")
            expect(source).toContain('const observerToJson = (value, visited = new Set()) => {')
            expect(source).toContain('if (!value || visited.has(value)) return null;')
            expect(source).toContain('if (value._observer && value._observer !== value) return observerToJson(value._observer, visited);')
            expect(source).toContain('if (value._observer) return value._observer;')
            expect(source).toContain('rawChildren.map(getEntityReferenceId).filter(Boolean)')
            expect(source).toContain('editorInstance.api?.globals?.entities?.raw')
            expect(source).toContain('readApiEntitiesArray(editorInstance.api?.globals?.entities)')
            expect(source).toContain('marker.lastSerializedEntityIds = entities.map((entity) => entity.id);')
            expect(source).toContain(
                'marker.lastObservedEntityObserverIds = observedEntityObservers.map((observer) => getEntityObserverId(observer)).filter(Boolean);'
            )
            expect(source).toContain('const rememberScenePayloadEntities = (payload) => {')
            expect(source).toContain('const normalizePlayCanvasEntityComponents = (componentsInput) => {')
            expect(source).toContain('render.materialAssets = Array.isArray(render.materialAssets) ? render.materialAssets : [null];')
            expect(source).toContain("light.type = typeof light.type === 'string' && light.type ? light.type : 'directional';")
            expect(source).toContain('const rebindUpstreamHierarchy = () => {')
            expect(source).toContain("const treeView = editorInstance.call('entities:hierarchy');")
            expect(source).toContain('treeView.entities = rawEntities;')
            expect(source).toContain("querySelector?.('.progress-overlay')")
            expect(source).toContain("overlay.style.pointerEvents = 'none';")
            expect(source).toContain('const hydratePersistedSceneEntities = () => {')
            expect(source).toContain('const withSuppressedHydrationRealtimeOps = (editorInstance, callback) => {')
            expect(source).toContain('marker.suppressedHydrationRealtimeOps')
            expect(source).toContain('editorInstance?.api?.globals?.realtime?.scenes?.current?.data?.entities')
            expect(source).toContain("if (!byId.has('root')) {")
            expect(source).toContain("entity.parent = 'root';")
            expect(source).toContain('let wrappedEditorCallSource = null;')
            expect(source).toContain('let wrappedEditorEmit = null;')
            expect(source).toContain('let wrappedEditorEmitSource = null;')
            expect(source).toContain('const normalizeRealtimeSceneEntitiesForUpstream = (entitiesInput) =>')
            expect(source).toContain('const normalizeSceneRawDataForUpstream = (data) => {')
            expect(source).toContain('marker.lastNormalizedSceneRawEntityIds = Object.keys(normalizedEntities);')
            expect(source).toContain("if (eventName === 'scene:raw') {")
            expect(source).toContain('args[0] = normalizeSceneRawDataForUpstream(args[0]);')
            expect(source).toContain('marker.editorEmitWrapped = true;')
            expect(source).toContain('const deleteStalePersistedSceneEntities = (editorInstance, apiEntities, expectedIds) => {')
            expect(source).toContain('apiEntity.delete({ history: false, preserveEntityReferences: true });')
            expect(source).toContain('marker.lastDeletedStalePersistedEntityCount = deleted;')
            expect(source).toContain('marker.lastHydratedPersistedEntityCount = hydrated;')
            expect(source).toContain('marker.lastMaterializedPersistedEntityCount = materialized;')
            expect(source).toContain('marker.lastPersistedEntityParentLinkCount = parentLinks;')
            expect(source).toContain('const readLoadedScenePayload = (response = marker.lastLoadedScene) => {')
            expect(source).toContain('const toPersistedHydrationCreateData = (entity) => ({')
            expect(source).toContain('const materializePersistedSceneEntity = (editorInstance, entity) => {')
            expect(source).toContain("typeof apiEntities.serverAdd === 'function'")
            expect(source).toContain('apiEntities.serverAdd({')
            expect(source).toContain('const linkPersistedSceneEntityParent = (existing, entity) => {')
            expect(source).toContain('created = materializePersistedSceneEntity(editorInstance, entity);')
            expect(source).toContain('const isEntityRealtimeOp = (op) =>')
            expect(source).toContain('const recordSuppressedHydrationRealtimeOp = (op) => {')
            expect(source).toContain('const shouldSuppressHydrationRealtimeEntityOp = (op) =>')
            expect(source).toContain('const repairRealtimeDocumentForEntityListOp = (realtimeScene, op) => {')
            expect(source).toContain('const repairRealtimeDocumentForSubmitArgs = (realtimeScene, args) => {')
            expect(source).toContain('const ensureRealtimeSceneDocumentShape = (realtimeScene) => {')
            expect(source).toContain('const getRealtimeEntityChildId = (value) => {')
            expect(source).toContain('const repairShareDbDocumentForSubmitArgs = (document, args) => {')
            expect(source).toContain('const wrapShareDbDocumentSubmitOp = (document) => {')
            expect(source).toContain('const installShareDbConnectionRepairAdapter = (connection) => {')
            expect(source).toContain('const installShareDbDocumentRepairAdapter = (editorInstance) => {')
            expect(source).toContain("if (methodName === 'realtime:connection') {")
            expect(source).toContain('installShareDbConnectionRepairAdapter(result);')
            expect(source).toContain('wrapShareDbDocumentSubmitOp(currentRealtimeScene?._document);')
            expect(source).toContain('realtimeScene?._document?._data')
            expect(source).toContain('ensureRealtimeSceneDocumentShape(realtimeScene);')
            expect(source).toContain('ensureRealtimeSceneDocumentShape(editorInstance.api?.globals?.realtime?.scenes?.current);')
            expect(source).toContain(
                'entity.children = Array.isArray(entity.children) ? entity.children.map(getRealtimeEntityChildId).filter(Boolean) : [];'
            )
            expect(source).toContain('Number.isInteger(op.p[op.p.length - 1])')
            expect(source).toContain("Object.prototype.hasOwnProperty.call(op, 'li')")
            expect(source).toContain("marker.lastRealtimeEntityListRepairPath = path.join('.');")
            expect(source).toContain('marker.wrappedRealtimeSceneDocumentSubmitOp')
            expect(source).toContain("methodName === 'realtime:scene:op' && shouldSuppressHydrationRealtimeEntityOp(args[0])")
            expect(source).toContain("if (methodName === 'realtime:scene:op') {")
            expect(source).toContain('repairRealtimeDocumentForSubmitArgs(realtimeScene, args);')
            expect(source).toContain('return previousEditorCall.apply(editorInstance, [methodName, ...args]);')
            expect(source).toContain('return previousSubmitOp.apply(realtimeScene, args);')
            expect(source).toContain("writeEntityObserverPath(observer, 'components.' + componentName, componentData)")
            expect(source).not.toContain("writeEntityObserverPath(observer, 'components', entity.components)")
            expect(source).toContain('const selectUsablePersistedSceneEntries = (entitiesInput) => {')
            expect(source).toContain("entity.resource_id && entity.resource_id !== 'root'")
            expect(source).toContain(
                "writeEntityObserverPath(observer, 'children', entity.children.filter((child) => typeof child === 'string'))"
            )
            expect(source).toContain(
                "children: Array.isArray(entity.children) ? entity.children.filter((child) => typeof child === 'string') : []"
            )
            expect(source).toContain('const loadedScenePayloadReferencesAssets = () => {')
            expect(source).toContain('if (loadedScenePayloadReferencesAssets()) return;')
            expect(source).toContain('if (!hydratingPersistedScene) {')
            expect(source).toContain(
                'const cleanLoadedPayloadObservers = marker.dirty === true ? [] : scenePayloadEntitiesToObservers(fallbackPayload);'
            )
            expect(source).toContain('rememberScenePayloadEntities(readLoadedScenePayload(marker.lastLoadedScene));')
            expect(source).not.toContain('rememberScenePayloadEntities(marker.lastLoadedScene?.data?.payload);')
            expect(source).toContain('hydratePersistedSceneEntities();')
            expect(source).toContain("if (sync && 'enabled' in sync) sync.enabled = false;")
            expect(source).toContain("if (history && 'enabled' in history) history.enabled = false;")
            expect(source).toContain("editorInstance.on('scene:raw', () => {")
            expect(source).toContain('const force = options && options.force === true;')
            expect(source).toContain('if (!force && (!marker.initialHydrationComplete || Date.now() < (marker.ignoreDirtyUntil || 0)))')
            expect(source).toContain('const rememberCreatedEntityInputFallback = (inputData) => {')
            expect(source).toContain('const installApiEntitiesCreateBridgeWrapper = (editorInstance) => {')
            expect(source).toContain('apiEntities.create = wrappedApiEntitiesCreate;')
            expect(source).toContain('const fallbackCreatedEntityId =')
            expect(source).toContain('marker.lastCreatedEntityFallbackId = fallbackCreatedEntityId;')
            expect(source).toContain('markDirty({ force: true });')
            expect(source).toContain("typeof input.resource_id === 'string' && input.resource_id")
            expect(source).toContain('const createFullBootProjectPayload = () => {')
            expect(source).toContain("url.pathname === '/api/projects/' + numericProjectId")
            expect(source).toContain("url.pathname === '/api/projects/' + numericProjectId + '/branches'")
            expect(source).toContain('pagination: { hasMore: false }')
            expect(source).toContain("url.pathname === '/api/projects/' + numericProjectId + '/assets'")
            expect(source).toContain('loadFullBootAssets().then((assets) => createJsonResponse(assets))')
            expect(source).not.toContain('return Promise.resolve(createJsonResponse([]));')
            expect(source).toContain("'/config?mode=universo-compatibility-rest-minimal'")
            expect(source).toContain('const installFullBootXmlHttpRequestAuthAdapter = () => {')
            expect(source).toContain('const SyntheticXMLHttpRequest = function UniversoFullBootXmlHttpRequest() {')
            expect(source).toContain('const cloudApiResponse = createFullBootCloudApiResponse')
            expect(source).toContain('native.setRequestHeader(restConfig.auth.headerName, restConfig.auth.accessToken);')
            expect(source).toContain('window.XMLHttpRequest = SyntheticXMLHttpRequest;')
            expect(source).toContain('void resolveRestCompatibilityConfig().finally(startEditorBundle);')
            expect(source).toContain("safeEditorCall(editorInstance, 'sceneSettings')")
            expect(source).toContain('settings: normalizeSceneSettings(')
            expect(source).toContain('priority_scripts: nextPriorityScripts,')
            expect(source).not.toContain('...next,\n        physics:')
            expect(source).toContain("url.searchParams.set('artifactBaseUrl', artifactBaseUrl);")
            expect(source).toContain("url.searchParams.set('artifactOrigin', window.location.origin);")
            expect(source).toContain("url.hostname !== 'api.github.com'")
            expect(source).toContain("url.pathname === '/rate_limit'")
            expect(source).toContain("url.pathname === '/repos/playcanvas/editor/issues'")
            expect(source).toContain('await refreshCurrentSceneChecksum();')
            expect(source).not.toContain('settings: projectSettings')
            expect(source).toMatch(
                /if\s*\(\s*marker\.fullBootMode\s*!==\s*true\s*\)\s*{\s*postEditorReady\(\);[\s\S]*?bootstrapProjectStorage\(descriptor\);[\s\S]*?}\s*else\s*{[\s\S]*?waitForUpstreamLayout\(\)/
            )
            expect(source).toContain('postEditorReady();\n          bootstrapProjectStorage(descriptor);')
            expect(source).toContain(
                "if (urlText.includes('/disabled')) throw new Error('Full upstream Editor config must not use disabled realtime endpoints');"
            )
            expect(source).toContain("static: artifactBaseUrl.replace(/\\\\/$/, '')")
            expect(source).toContain("config.url.static = config.url.frontend.replace(/\\\\/$/, '');")

            expect(() => writeBridgeBootstrap(tempRoot)).not.toThrow()
            expect(fs.readFileSync(path.join(tempRoot, bridgeBootstrapFileName), 'utf8')).toContain(
                "static: artifactBaseUrl.replace(/\\/$/, '')"
            )

            writeUniversoHostedShell(tempRoot, { mode: fullUpstreamUiMode })
            const fullBootHtml = fs.readFileSync(path.join(tempRoot, 'index.html'), 'utf8')
            expect(fullBootHtml).not.toContain('/disabled')
            expect(fullBootHtml).not.toContain('UniversoHostedWebSocket')

            writeUniversoHostedShell(tempRoot, { mode: 'universo-hosted' })
            const hostedHtml = fs.readFileSync(path.join(tempRoot, 'index.html'), 'utf8')
            expect(hostedHtml).toContain('/disabled')
            expect(hostedHtml).toContain('UniversoHostedWebSocket')

            fs.mkdirSync(path.join(tempRoot, 'js'), { recursive: true })
            fs.mkdirSync(path.join(tempRoot, 'css'), { recursive: true })
            fs.mkdirSync(path.join(tempRoot, 'static', 'json'), { recursive: true })
            fs.writeFileSync(
                path.join(tempRoot, 'js', 'editor.js'),
                [
                    "const spinner = '../../static/platform/images/ajax-loader.gif';",
                    "const logo = 'https://playcanvas.com/static-assets/images/play_text_252_white.png';",
                    "const editorLogo = 'https://playcanvas.com/static-assets/images/editor_logo.png';",
                    "const close = 'https://playcanvas.com/static-assets/images/icons/fa/16x16/remove.png';",
                    'icon.src = `/editor/scene/img/entity-icons/${textureName}.png`;',
                    'profile.src = `${config.url.api}/users/${user.id}/thumbnail?size=32`;'
                ].join('\n')
            )
            fs.writeFileSync(
                path.join(tempRoot, 'css', 'editor.css'),
                '@font-face{font-family:Proxima;src:url("https://playcanvas.com/static-assets/fonts/proxima_nova_regular.woff2")}.blank{background:url("../static/platform/images/home/blank_project.png")}'
            )
            fs.writeFileSync(
                path.join(tempRoot, 'static', 'json', 'howdoi.json'),
                JSON.stringify({
                    html: '<img src="https://playcanvas.com/static-assets/instructions/new_box.gif"><a href="https://developer.playcanvas.com/user-manual/scenes/components/render/">docs</a>'
                })
            )

            expect(patchUniversoHostedArtifact(tempRoot).sort()).toEqual(['css/editor.css', 'js/editor.js', 'static/json/howdoi.json'])
            const patchedEditorSource = fs.readFileSync(path.join(tempRoot, 'js', 'editor.js'), 'utf8')
            const patchedCssSource = fs.readFileSync(path.join(tempRoot, 'css', 'editor.css'), 'utf8')
            const patchedHelpSource = fs.readFileSync(path.join(tempRoot, 'static', 'json', 'howdoi.json'), 'utf8')
            expect(patchedEditorSource).toContain(inlineAjaxLoaderImage)
            expect(patchedEditorSource).toContain(inlinePlayCanvasTextImage)
            expect(patchedEditorSource).toContain(inlineEditorLogoImage)
            expect(patchedEditorSource).toContain(inlineRemoveIconImage)
            expect(patchedEditorSource).toContain(inlineEntityIconImage)
            expect(patchedEditorSource).not.toContain('ajax-loader.gif')
            expect(patchedEditorSource).not.toContain('editor_logo.png')
            expect(patchedEditorSource).not.toContain('/editor/scene/img/entity-icons/')
            expect(patchedEditorSource).not.toContain('/users/${user.id}/thumbnail')
            expect(patchedCssSource).toContain(inlineBlankProjectImage)
            expect(patchedCssSource).not.toContain('blank_project.png')
            expect(patchedCssSource).not.toContain('@font-face')
            expect(patchedCssSource).not.toContain('static-assets/fonts')
            expect(patchedHelpSource).toContain(inlineHelpInstructionImage)
            expect(patchedHelpSource).toContain('https://developer.playcanvas.com/user-manual/scenes/components/render/')
            expect(patchedHelpSource).not.toContain('static-assets/instructions')
            expect(JSON.parse(patchedHelpSource).html).toContain(inlineHelpInstructionImage)
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
