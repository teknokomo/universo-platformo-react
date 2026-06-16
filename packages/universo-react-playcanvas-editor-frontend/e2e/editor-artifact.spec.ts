import { expect, test, type FrameLocator, type Locator } from '@playwright/test'
import { PNG } from 'pngjs'

const expectHeaderContains = (headers: Record<string, string>, name: string, expected: string) => {
    expect(headers[name.toLowerCase()]).toContain(expected)
}

const expectNonBlankScreenshot = async (locator: Locator, path: string) => {
    const screenshot = await locator.screenshot({ path })
    const png = PNG.sync.read(screenshot)
    const buckets = new Set<string>()
    let sampledOpaquePixels = 0
    const { data, height, width } = png
    const sampleStepX = Math.max(1, Math.floor(width / 24))
    const sampleStepY = Math.max(1, Math.floor(height / 24))
    for (let y = 0; y < height; y += sampleStepY) {
        for (let x = 0; x < width; x += sampleStepX) {
            const index = (y * width + x) * 4
            const alpha = data[index + 3] ?? 0
            if (alpha === 0) continue
            sampledOpaquePixels += 1
            const red = Math.floor((data[index] ?? 0) / 32)
            const green = Math.floor((data[index + 1] ?? 0) / 32)
            const blue = Math.floor((data[index + 2] ?? 0) / 32)
            buckets.add(`${red}:${green}:${blue}`)
        }
    }
    for (let index = 0; index < data.length && buckets.size <= 1; index += 4 * 97) {
        const alpha = data[index + 3] ?? 0
        if (alpha === 0) continue
        sampledOpaquePixels += 1
        const red = Math.floor((data[index] ?? 0) / 32)
        const green = Math.floor((data[index + 1] ?? 0) / 32)
        const blue = Math.floor((data[index + 2] ?? 0) / 32)
        buckets.add(`${red}:${green}:${blue}`)
    }
    expect(sampledOpaquePixels).toBeGreaterThan(20)
    expect(buckets.size).toBeGreaterThan(1)
    expect(new Set(screenshot).size).toBeGreaterThan(16)
}

const expectHostedEditorApiReady = async (frame: FrameLocator) => {
    await expect(frame.locator('#layout-hierarchy')).toBeVisible()
    await expect(frame.locator('#layout-assets')).toBeVisible()
    await expect(frame.locator('#layout-attributes')).toBeVisible()
    await expect
        .poll(
            () =>
                frame.locator('body').evaluate(() => {
                    const bridge = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const editor = window.editor
                    if (
                        !bridge?.editorSaveAdapterInstalled ||
                        bridge?.apiEntitiesCreateWrapped !== true ||
                        typeof editor?.call !== 'function'
                    )
                        return false
                    try {
                        return Array.isArray(editor.call('entities:list'))
                    } catch {
                        return false
                    }
                }),
            { timeout: 15_000 }
        )
        .toBe(true)
    await expect
        .poll(
            () =>
                frame.locator('body').evaluate(() => {
                    const bridge = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    return bridge?.initialHydrationComplete === true && Date.now() >= (bridge?.ignoreDirtyUntil ?? 0)
                }),
            { timeout: 15_000 }
        )
        .toBe(true)
}

test('PlayCanvas Editor hosted artifact shell is safe and nonblank', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text())
        }
    })
    page.on('requestfailed', (request) => {
        failedRequests.push(`${request.method()} ${request.url()}`)
    })
    page.on('pageerror', (error) => {
        consoleErrors.push(error.message)
    })

    const rootResponse = await page.goto('/', { waitUntil: 'networkidle' })
    expect(rootResponse?.ok()).toBe(true)
    expectHeaderContains(rootResponse?.headers() ?? {}, 'content-type', 'text/html')
    expect(rootResponse?.headers()['x-content-type-options']).toBe('nosniff')
    expect(rootResponse?.headers()['cache-control']).toBe('no-cache')

    await expect(page.locator('body')).toHaveAttribute('data-universo-playcanvas-editor-hosted', 'true')
    await expect(page.locator('body')).not.toContainText('Artifact Unavailable')
    await expect(page.locator('body')).not.toContainText('artifact-only integration surface')
    await expect.poll(() => page.evaluate(() => Boolean(window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.ready))).toBe(true)
    await expect.poll(() => page.evaluate(() => Boolean(window.config?.universoHosted))).toBe(true)
    const shellNonBlank = await page.evaluate(() => {
        const rect = document.body.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
    })
    expect(shellNonBlank).toBe(true)
    await expect(page.locator('body')).not.toContainText('[object Object]')
    await expect(page.locator('body')).not.toContainText(/\{[\s\S]*"[^"]+"\s*:/)
    await expect(page.locator('body')).not.toContainText(/stack trace|Zod|Vite|absolute filesystem/i)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    const jsResponse = await page.request.get('/js/editor-empty.js')
    expect(jsResponse.ok()).toBe(true)
    expectHeaderContains(jsResponse.headers(), 'content-type', 'application/javascript')
    expect(jsResponse.headers()['x-content-type-options']).toBe('nosniff')
    expect(jsResponse.headers()['cache-control']).toBe('no-cache')

    const cssResponse = await page.request.get('/css/editor.css')
    expect(cssResponse.ok()).toBe(true)
    expectHeaderContains(cssResponse.headers(), 'content-type', 'text/css')
    expect(cssResponse.headers()['x-content-type-options']).toBe('nosniff')

    const forbiddenResponse = await page.request.get('/..%2feditor2/file.js')
    expect(forbiddenResponse.status()).toBe(403)
    expectHeaderContains(forbiddenResponse.headers(), 'content-type', 'text/plain')
    expect(forbiddenResponse.headers()['x-content-type-options']).toBe('nosniff')

    const encodedForbiddenResponse = await page.request.get('/%2e%2e%2feditor-evil/file.js')
    expect(encodedForbiddenResponse.status()).toBe(403)
    expect(encodedForbiddenResponse.headers()['x-content-type-options']).toBe('nosniff')

    const notFoundResponse = await page.request.get('/js/not-found.js')
    expect(notFoundResponse.status()).toBe(404)
    expectHeaderContains(notFoundResponse.headers(), 'content-type', 'text/plain')
    expect(notFoundResponse.headers()['x-content-type-options']).toBe('nosniff')

    await expect
        .poll(() =>
            page.locator('body').evaluate((body) => {
                const rect = body.getBoundingClientRect()
                return rect.width > 100 && rect.height > 100 && body.childElementCount > 0
            })
        )
        .toBe(true)
    await expectNonBlankScreenshot(
        page.locator('body'),
        testInfo.outputPath(`playcanvas-editor-artifact-smoke-${testInfo.project.name}.png`)
    )
    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
})

test('PlayCanvas Editor hosted artifact keeps bridge shell stable with locale query', async ({ page }) => {
    const response = await page.goto('/?locale=ru', { waitUntil: 'networkidle' })
    expect(response?.ok()).toBe(true)

    await expect(page.locator('body')).toHaveAttribute('data-universo-playcanvas-editor-hosted', 'true')
    await expect(page.locator('body')).not.toContainText('Artifact Unavailable')
    await expect.poll(() => page.evaluate(() => Boolean(window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.ready))).toBe(true)
})

test('PlayCanvas Editor hosted artifact disables persistent service worker registration', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'networkidle' })
    expect(response?.ok()).toBe(true)

    const result = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.register('/editor/scene/js/url-map.sw.js', { scope: '/' })
        const registrations = await navigator.serviceWorker.getRegistrations()
        return {
            hasActiveWorker: Boolean(registration.active || registration.installing || registration.waiting),
            registrationCount: registrations.length
        }
    })

    expect(result).toEqual({ hasActiveWorker: false, registrationCount: 0 })
})

test('PlayCanvas Editor hosted artifact renders inside the platform sandbox iframe', async ({ page, baseURL }, testInfo) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text())
        }
    })
    page.on('requestfailed', (request) => {
        failedRequests.push(`${request.method()} ${request.url()}`)
    })
    page.on('pageerror', (error) => {
        consoleErrors.push(error.message)
    })

    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()
    const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
    const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <head><title>Sandbox host</title></head>
            <body style="margin:0">
                <script>
                    window.bridgeCommands = [];
                    window.bridgePayloads = [];
	                    window.addEventListener('message', (event) => {
	                        if (!event.data) return;
	                        if (event.data.requestId) {
                            window.bridgeCommands.push(event.data.type);
                            window.bridgePayloads.push(event.data);
                            const isSave = event.data.type === 'scene.save';
                            const protocolData = {
                                protocol: {
                                    schemaVersion: '1',
                                    mode: 'universo-bridge-minimal',
                                    upstream: {
                                        repository: 'https://github.com/playcanvas/editor',
                                        minimumTag: 'v2.24.2'
                                    },
                                    defaultSceneId: '${sceneId}'
                                }
                            };
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
	                            frame.contentWindow.postMessage({
	                                type: 'bridge.response',
	                                source: 'universo-playcanvas-editor-host',
	                                commandType: event.data.type,
	                                requestId: event.data.requestId,
	                                response: {
	                                    ok: true,
                                    requestId: event.data.requestId,
                                    type: event.data.type,
                                    data: event.data.type === 'protocol.describe'
                                        ? protocolData
                                        : isSave
                                        ? {
                                            checksum: '${'b'.repeat(64)}',
                                            scene: { checksum: '${'b'.repeat(64)}' }
                                        }
                                        : event.data.type === 'scene.read'
                                            ? {
                                                scene: { checksum: '${'a'.repeat(64)}' },
                                                payload: { schemaVersion: '1', entities: [] }
                                            }
                                            : {}
                                }
                            }, '*');
	                            return;
	                        }
	                        if (event.data.type !== 'editor.bootstrap.requestInit') return;
	                        const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
	                        frame.contentWindow.postMessage({
	                            type: 'editor.bootstrap.init',
	                            source: 'universo-playcanvas-editor-host',
	                            bootstrapRequestId: event.data.bootstrapRequestId,
	                            descriptor: {
	                                schemaVersion: '0',
	                                bridge: {
	                                    sessionId: 'spoofed-session',
	                                    nonce: 'spoofed-nonce',
	                                    expiresAt: new Date(Date.now() + 60000).toISOString(),
	                                    bridgeVersion: '0',
	                                    writeMode: 'manager',
	                                    capabilities: []
	                                },
	                                selectedProject: {
	                                    project: {
	                                        id: 'spoofed-project',
	                                        displayName: {
	                                            _primary: 'en',
	                                            locales: { en: { content: 'Spoofed Project' } }
	                                        }
	                                    },
	                                    defaultSceneId: 'spoofed-scene'
	                                },
	                                compatibilityStatus: 'ready'
	                            },
	                        }, '*');
	                        window.setTimeout(() => {
	                            frame.contentWindow.postMessage({
	                                type: 'editor.bootstrap.init',
	                                source: 'universo-playcanvas-editor-host',
	                                bootstrapRequestId: event.data.bootstrapRequestId,
	                                descriptor: {
                                    schemaVersion: '1',
                                    bridge: {
                                        sessionId: '019e9147-510a-7527-afb2-732e3ad7eb16',
                                        nonce: '019e9147510a7527afb2732e3ad7eb16019e9147510a7527afb2732e3ad7eb16',
                                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                                        bridgeVersion: '1',
                                        writeMode: 'manager',
                                        capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read']
                                    },
                                    selectedProject: {
                                        project: {
                                            id: '${projectId}',
                                            displayName: {
                                                _primary: 'en',
                                                locales: { en: { content: 'Sandbox PlayCanvas Project' } }
                                            },
                                            codename: {
                                                _primary: 'en',
                                                locales: { en: { content: 'sandbox-playcanvas-project' } }
                                            },
                                            version: 1,
                                            defaultSceneId: '${sceneId}',
                                            compatibilityStatus: 'compatible',
                                            status: 'ready',
                                            sceneCount: 1,
                                            assetCount: 0,
                                            scriptCount: 0,
                                            generatedArtifactCount: 0,
                                            publishable: true
                                        },
                                        defaultSceneId: '${sceneId}'
                                    },
                                    compatibilityStatus: 'ready'
                                },
                            }, '*');
                        }, 1200);
                    });
                </script>
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    sandbox="allow-scripts allow-same-origin"
                    referrerpolicy="no-referrer"
                    style="width:960px;height:640px;border:0"
                ></iframe>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    await expect(frame.locator('body')).toHaveAttribute('data-universo-playcanvas-editor-hosted', 'true')
    await expect(frame.locator('body')).not.toContainText('Artifact Unavailable')
    await expect
        .poll(() => frame.locator('body').evaluate(() => window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.lastRejectedMessageReason), {
            timeout: 5_000
        })
        .toBe('invalid-bootstrap-descriptor')
    await expect
        .poll(() => frame.locator('body').evaluate(() => Boolean(window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.ready)), {
            timeout: 10_000
        })
        .toBe(true)
    const initializedConfig = await frame.locator('body').evaluate(() => ({
        projectId: window.config?.project?.id,
        projectName: window.config?.project?.name,
        sceneId: window.config?.scene?.id,
        adminPermissions: window.config?.project?.permissions?.admin,
        superUser: window.config?.self?.flags?.superUser
    }))
    expect(initializedConfig).toEqual({
        projectId,
        projectName: 'Sandbox PlayCanvas Project',
        sceneId,
        adminPermissions: [],
        superUser: false
    })
    const initialSecurityState = await frame.locator('body').evaluate(() => {
        const bridge = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        return {
            rejectedMessages: bridge.securityRejectedMessages,
            lastReason: bridge.lastRejectedMessageReason,
            trustedParentOrigin: bridge.trustedParentOrigin,
            projectId: window.config?.project?.id
        }
    })
    expect(initialSecurityState).toEqual(
        expect.objectContaining({
            rejectedMessages: expect.any(Number),
            projectId
        })
    )
    expect(['duplicate-bootstrap', 'invalid-bootstrap-descriptor']).toContain(initialSecurityState.lastReason)
    expect(initialSecurityState.rejectedMessages).toBeGreaterThanOrEqual(1)
    expect(initialSecurityState.trustedParentOrigin).toBeTruthy()
    await expect
        .poll(() => page.evaluate(() => (window as unknown as { bridgeCommands?: string[] }).bridgeCommands ?? []), { timeout: 20_000 })
        .toEqual(['protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read'])
    const protocolState = await frame.locator('body').evaluate(() => ({
        markerMode: window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.compatibilityProtocol?.data?.protocol?.mode,
        configMode: window.config?.universoCompatibilityProtocol?.mode
    }))
    expect(protocolState).toEqual({
        markerMode: 'universo-bridge-minimal',
        configMode: 'universo-bridge-minimal'
    })

    const saveResult = await frame.locator('body').evaluate(async () => {
        const bridge = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        await bridge.saveCurrentScene({
            schemaVersion: '1',
            entities: [{ id: 'sandbox-entity', name: 'Sandbox Entity' }]
        })
        return {
            checksum: bridge.currentSceneChecksum,
            savedChecksum: bridge.lastSavedScene?.data?.checksum,
            dirty: bridge.dirty
        }
    })
    expect(saveResult).toEqual({
        checksum: 'b'.repeat(64),
        savedChecksum: 'b'.repeat(64),
        dirty: false
    })
    await expect
        .poll(() => page.evaluate(() => (window as unknown as { bridgeCommands?: string[] }).bridgeCommands ?? []), { timeout: 20_000 })
        .toEqual(['protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save'])
    const savePayload = await page.evaluate(
        () =>
            (
                window as unknown as { bridgePayloads?: Array<{ type?: string; payload?: unknown; expectedCurrentChecksum?: unknown }> }
            ).bridgePayloads?.find((item) => item.type === 'scene.save') ?? null
    )
    expect(savePayload).toMatchObject({
        type: 'scene.save',
        expectedCurrentChecksum: 'a'.repeat(64),
        payload: {
            schemaVersion: '1',
            entities: [{ id: 'sandbox-entity', name: 'Sandbox Entity' }]
        }
    })
    await page.evaluate(() => {
        const frame = document.querySelector('iframe[title="PlayCanvas Editor"]') as HTMLIFrameElement | null
        frame?.contentWindow?.postMessage(
            {
                type: 'bridge.saveRequested',
                source: 'universo-playcanvas-editor-host',
                requestId: '019e9147-6000-7000-8000-000000000001',
                sessionId: '019e9147-510a-7527-afb2-732e3ad7eb16',
                nonce: '019e9147510a7527afb2732e3ad7eb16019e9147510a7527afb2732e3ad7eb16'
            },
            '*'
        )
    })
    await expect
        .poll(() => page.evaluate(() => (window as unknown as { bridgeCommands?: string[] }).bridgeCommands ?? []), { timeout: 20_000 })
        .toEqual(['protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save', 'scene.save'])
    const rejectedBeforeSpoofedResponse = await frame
        .locator('body')
        .evaluate(() => window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.securityRejectedMessages ?? 0)
    await page.evaluate(() => {
        const spoofFrame = document.createElement('iframe')
        spoofFrame.srcdoc = `
	            <script>
	                const editorFrame = parent.document.querySelector('iframe[title="PlayCanvas Editor"]');
	                editorFrame.contentWindow.postMessage({
	                    type: 'bridge.response',
	                    source: 'universo-playcanvas-editor-host',
	                    commandType: 'bridge.capabilities',
	                    requestId: '019e9147-510a-7527-afb2-732e3ad7eb16',
	                    response: {
	                        ok: true,
	                        requestId: '019e9147-510a-7527-afb2-732e3ad7eb16',
	                        data: { capabilities: ['scene.save'] }
	                    }
	                }, '*');
            </script>
	        `
        document.body.appendChild(spoofFrame)
    })
    await expect
        .poll(() => frame.locator('body').evaluate(() => window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.securityRejectedMessages ?? 0), {
            timeout: 5000
        })
        .toBeGreaterThan(rejectedBeforeSpoofedResponse)
    await expect
        .poll(() => frame.locator('body').evaluate(() => window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.rejectedMessageReasons ?? []))
        .toContain('untrusted-bridge-response')

    await expectNonBlankScreenshot(
        page.locator('iframe[title="PlayCanvas Editor"]'),
        testInfo.outputPath(`playcanvas-editor-artifact-sandbox-${testInfo.project.name}.png`)
    )
    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
})

test('PlayCanvas Editor hosted artifact updates legacy default scene state before saving', async ({ page, baseURL }) => {
    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()
    const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
    const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <body style="margin:0">
                <script>
                    window.bridgePayloads = [];
                    window.addEventListener('message', (event) => {
                        if (!event.data) return;
                        if (event.data.requestId) {
                            window.bridgePayloads.push(event.data);
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            const project = {
                                id: '${projectId}',
                                displayName: {
                                    _primary: 'en',
                                    locales: { en: { content: 'Legacy Project' } }
                                },
                                codename: {
                                    _primary: 'en',
                                    locales: { en: { content: 'legacy-project' } }
                                },
                                version: 2,
                                defaultSceneId: '${sceneId}',
                                compatibilityStatus: 'compatible',
                                status: 'ready',
                                sceneCount: 1,
                                assetCount: 0,
                                scriptCount: 0,
                                generatedArtifactCount: 0,
                                publishable: false
                            };
                            const responseData =
                                event.data.type === 'protocol.describe'
                                    ? {
                                          protocol: {
                                              schemaVersion: '1',
                                              mode: 'universo-bridge-minimal',
                                              upstream: {
                                                  repository: 'https://github.com/playcanvas/editor',
                                                  minimumTag: 'v2.24.2'
                                              },
                                              defaultSceneId: '${sceneId}'
                                          }
                                      }
                                    : event.data.type === 'project.loadSelected'
                                      ? { project }
                                      : event.data.type === 'scene.read'
                                        ? {
                                              scene: { id: '${sceneId}', checksum: '${'a'.repeat(64)}' },
                                              payload: { schemaVersion: '1', entities: [] }
                                          }
                                        : event.data.type === 'scene.save'
                                          ? { checksum: '${'b'.repeat(64)}', scene: { id: '${sceneId}', checksum: '${'b'.repeat(64)}' } }
                                          : {};
	                            frame.contentWindow.postMessage({
	                                type: 'bridge.response',
	                                source: 'universo-playcanvas-editor-host',
	                                commandType: event.data.type,
	                                requestId: event.data.requestId,
                                response: {
                                    ok: true,
                                    requestId: event.data.requestId,
                                    type: event.data.type,
                                    data: responseData
                                }
                            }, '*');
                            return;
                        }
                        if (event.data.type !== 'editor.bootstrap.requestInit') return;
                        window.setTimeout(() => {
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
	                            frame.contentWindow.postMessage({
	                                type: 'editor.bootstrap.init',
	                                source: 'universo-playcanvas-editor-host',
	                                bootstrapRequestId: event.data.bootstrapRequestId,
	                                descriptor: {
                                    schemaVersion: '1',
                                    bridge: {
                                        sessionId: '019e9147-510a-7527-afb2-732e3ad7eb16',
                                        nonce: '019e9147510a7527afb2732e3ad7eb16019e9147510a7527afb2732e3ad7eb16',
                                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                                        bridgeVersion: '1',
                                        writeMode: 'manager',
                                        capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save']
                                    },
                                    selectedProject: {
                                        project: {
                                            id: '${projectId}',
                                            displayName: {
                                                _primary: 'en',
                                                locales: { en: { content: 'Legacy Project' } }
                                            },
                                            codename: {
                                                _primary: 'en',
                                                locales: { en: { content: 'legacy-project' } }
                                            },
                                            version: 1,
                                            defaultSceneId: null,
                                            compatibilityStatus: 'compatible',
                                            status: 'ready',
                                            sceneCount: 0,
                                            assetCount: 0,
                                            scriptCount: 0,
                                            generatedArtifactCount: 0,
                                            publishable: false
                                        },
                                        defaultSceneId: null
                                    },
                                    compatibilityStatus: 'ready'
                                },
                            }, '*');
                        }, 100);
                    });
                </script>
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    sandbox="allow-scripts allow-same-origin"
                    referrerpolicy="no-referrer"
                    style="width:960px;height:640px;border:0"
                ></iframe>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    await expect.poll(() => frame.locator('body').evaluate(() => Boolean(window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.ready))).toBe(true)
    await expect
        .poll(
            () =>
                frame.locator('body').evaluate(() => ({
                    markerSceneId: window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.selectedProject?.defaultSceneId,
                    configSceneId: window.config?.scene?.id
                })),
            { timeout: 10_000 }
        )
        .toEqual({ markerSceneId: sceneId, configSceneId: sceneId })

    await frame.locator('body').evaluate(async () => {
        await window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.saveCurrentScene({
            schemaVersion: '1',
            entities: [{ id: 'legacy-entity', name: 'Legacy Entity' }]
        })
    })
    const savePayload = await page.evaluate(
        () =>
            (window as unknown as { bridgePayloads?: Array<{ type?: string; sceneId?: string; projectId?: string }> }).bridgePayloads?.find(
                (item) => item.type === 'scene.save'
            ) ?? null
    )
    expect(savePayload).toMatchObject({
        type: 'scene.save',
        projectId,
        sceneId
    })
})

test('PlayCanvas Editor hosted upstream UI saves serializable entities', async ({ page, baseURL }) => {
    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()
    const projectId = '019e9148-7207-753f-bbb8-4797ef174025'
    const sceneId = '019e9148-8d3e-7386-9bee-398f22a2ef92'

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <body style="margin:0">
                <script>
                    window.bridgePayloads = [];
                    window.addEventListener('message', (event) => {
                        if (!event.data) return;
                        if (event.data.requestId) {
                            window.bridgePayloads.push(event.data);
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            const responseData =
                                event.data.type === 'protocol.describe'
                                    ? {
                                          protocol: {
                                              schemaVersion: '1',
                                              mode: 'universo-bridge-minimal',
                                              upstream: {
                                                  repository: 'https://github.com/playcanvas/editor',
                                                  minimumTag: 'v2.24.2'
                                              },
                                              defaultSceneId: '${sceneId}'
                                          }
                                      }
                                    : event.data.type === 'project.loadSelected'
                                      ? {
                                            project: {
                                                id: '${projectId}',
                                                displayName: {
                                                    _primary: 'en',
                                                    locales: { en: { content: 'Hosted Adapter Project' } }
                                                },
                                                version: 1,
                                                defaultSceneId: '${sceneId}',
                                                compatibilityStatus: 'compatible',
                                                status: 'ready',
                                                sceneCount: 1,
                                                assetCount: 0,
                                                scriptCount: 0,
                                                generatedArtifactCount: 0,
                                                publishable: false
                                            }
                                        }
                                      : event.data.type === 'scene.read'
                                        ? {
                                              scene: { id: '${sceneId}', checksum: '${'a'.repeat(64)}' },
                                              payload: { schemaVersion: '1', entities: [] }
                                          }
                                        : event.data.type === 'scene.save'
                                          ? { checksum: '${'c'.repeat(64)}', scene: { id: '${sceneId}', checksum: '${'c'.repeat(64)}' } }
                                          : {};
                            frame.contentWindow.postMessage({
                                type: 'bridge.response',
                                source: 'universo-playcanvas-editor-host',
                                commandType: event.data.type,
                                requestId: event.data.requestId,
                                response: {
                                    ok: true,
                                    requestId: event.data.requestId,
                                    type: event.data.type,
                                    data: responseData
                                }
                            }, '*');
                            return;
                        }
                        if (event.data.type !== 'editor.bootstrap.requestInit') return;
                        window.setTimeout(() => {
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            frame.contentWindow.postMessage({
                                type: 'editor.bootstrap.init',
                                source: 'universo-playcanvas-editor-host',
                                bootstrapRequestId: event.data.bootstrapRequestId,
                                descriptor: {
                                    schemaVersion: '1',
                                    bridge: {
                                        sessionId: '019e9148-a649-7218-b147-1e0d5ca9e45c',
                                        nonce: '019e9148a6497218b1471e0d5ca9e45c019e9148a6497218b1471e0d5ca9e45c',
                                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                                        bridgeVersion: '1',
                                        writeMode: 'manager',
                                        capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save']
                                    },
                                    selectedProject: {
                                        project: {
                                            id: '${projectId}',
                                            displayName: {
                                                _primary: 'en',
                                                locales: { en: { content: 'Hosted Adapter Project' } }
                                            },
                                            version: 1,
                                            defaultSceneId: '${sceneId}',
                                            compatibilityStatus: 'compatible',
                                            status: 'ready',
                                            sceneCount: 1,
                                            assetCount: 0,
                                            scriptCount: 0,
                                            generatedArtifactCount: 0,
                                            publishable: false
                                        },
                                        defaultSceneId: '${sceneId}'
                                    },
                                    compatibilityStatus: 'ready'
                                },
                            }, '*');
                        }, 100);
                    });
                </script>
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    sandbox="allow-scripts allow-same-origin"
                    referrerpolicy="no-referrer"
                    style="width:960px;height:640px;border:0"
                ></iframe>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    await expect(frame.locator('#layout-toolbar .pcui-button.logo')).toHaveCount(0)
    await expectHostedEditorApiReady(frame)
    const editorOverflow = await frame
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(editorOverflow).toBeLessThanOrEqual(1)

    await frame.locator('body').evaluate(() => {
        window.editor?.call?.('entities:new', {
            name: 'Smoke Entity',
            resource_id: 'smoke-entity',
            enabled: true,
            components: {}
        })
    })
    await expect
        .poll(
            () =>
                frame.locator('body').evaluate(() => {
                    const scene = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.serializeCurrentScene?.()
                    return scene?.entities?.find((entity) => entity.id === 'smoke-entity') ?? null
                }),
            { timeout: 10_000 }
        )
        .toBeTruthy()
    const entity = await frame.locator('body').evaluate(() => {
        const scene = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.serializeCurrentScene?.()
        return scene?.entities?.find((item) => item.id === 'smoke-entity') ?? null
    })
    expect(entity).toEqual(expect.objectContaining({ id: 'smoke-entity', name: 'Smoke Entity' }))
    const actualEntityName = 'Smoke Entity'
    await expect(frame.locator('body')).not.toContainText('[object Object]')
    await expect(frame.locator('body')).not.toContainText(/\{[\s\S]*"[^"]+"\s*:/)
    await expect(frame.locator('body')).not.toContainText(/\b[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)
    await expect.poll(() => frame.locator('body').evaluate(() => window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.dirty === true)).toBe(true)

    await frame.locator('body').evaluate(async () => {
        await window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.saveCurrentScene()
    })
    const savePayload = await page.evaluate(
        () =>
            (
                window as unknown as { bridgePayloads?: Array<{ type?: string; payload?: { entities?: Array<{ name?: string }> } }> }
            ).bridgePayloads?.find((item) => item.type === 'scene.save') ?? null
    )
    expect(savePayload?.payload?.entities).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                id: (entity as { id?: string }).id,
                name: actualEntityName
            })
        ])
    )
})

test('PlayCanvas Editor hosted upstream UI authors MMOOMM native renderable entities without projection controls', async ({
    page,
    baseURL
}) => {
    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()
    const projectId = '019e9148-7207-753f-bbb8-4797ef174025'
    const sceneId = '019e9148-8d3e-7386-9bee-398f22a2ef92'

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <body style="margin:0">
                <script>
                    window.bridgePayloads = [];
                    window.addEventListener('message', (event) => {
                        if (!event.data) return;
                        if (event.data.requestId) {
                            window.bridgePayloads.push(event.data);
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            const responseData =
                                event.data.type === 'protocol.describe'
                                    ? {
                                          protocol: {
                                              schemaVersion: '1',
                                              mode: 'universo-bridge-minimal',
                                              upstream: {
                                                  repository: 'https://github.com/playcanvas/editor',
                                                  minimumTag: 'v2.24.2'
                                              },
                                              defaultSceneId: '${sceneId}'
                                          }
                                      }
                                    : event.data.type === 'project.loadSelected'
                                      ? {
                                            project: {
                                                id: '${projectId}',
                                                displayName: {
                                                    _primary: 'en',
                                                    locales: { en: { content: 'MMOOMM Authoring Project' } }
                                                },
                                                version: 1,
                                                defaultSceneId: '${sceneId}',
                                                compatibilityStatus: 'compatible',
                                                status: 'ready',
                                                sceneCount: 1,
                                                assetCount: 0,
                                                scriptCount: 0,
                                                generatedArtifactCount: 0,
                                                publishable: false
                                            }
                                        }
                                      : event.data.type === 'scene.read'
                                        ? {
                                              scene: { id: '${sceneId}', checksum: '${'a'.repeat(64)}' },
                                              payload: { schemaVersion: '1', entities: [] }
                                          }
                                        : event.data.type === 'scene.save'
                                          ? { checksum: '${'c'.repeat(64)}', scene: { id: '${sceneId}', checksum: '${'c'.repeat(64)}' } }
                                          : {};
                            frame.contentWindow.postMessage({
                                type: 'bridge.response',
                                source: 'universo-playcanvas-editor-host',
                                commandType: event.data.type,
                                requestId: event.data.requestId,
                                response: {
                                    ok: true,
                                    requestId: event.data.requestId,
                                    type: event.data.type,
                                    data: responseData
                                }
                            }, '*');
                            return;
                        }
                        if (event.data.type !== 'editor.bootstrap.requestInit') return;
                        const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                        frame.contentWindow.postMessage({
                            type: 'editor.bootstrap.init',
                            source: 'universo-playcanvas-editor-host',
                            bootstrapRequestId: event.data.bootstrapRequestId,
                            locale: 'en',
                            descriptor: {
                                schemaVersion: '1',
                                compatibilityStatus: 'ready',
                                selectedProject: {
                                    project: { id: '${projectId}', displayName: { _primary: 'en', locales: { en: { content: 'MMOOMM Authoring Project' } } } },
                                    defaultSceneId: '${sceneId}'
                                },
                                bridge: {
                                    sessionId: '019e9148-aaaa-7000-8000-000000000001',
                                    sessionToken: 'session-token',
                                    nonce: 'nonce-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                                    expiresAt: new Date(Date.now() + 60000).toISOString(),
                                    bridgeVersion: '1',
                                    writeMode: 'manager',
                                    capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save']
                                }
                            }
                        }, '*');
                    });
                </script>
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    sandbox="allow-scripts allow-same-origin"
                    referrerpolicy="no-referrer"
                    style="width:960px;height:640px;border:0"
                ></iframe>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    await expectHostedEditorApiReady(frame)
    await frame.locator('body').evaluate(() => {
        const editor = window.editor
        if (!editor?.call) {
            throw new Error('PlayCanvas Editor API is not available')
        }
        const createEntity = (input) => {
            const observer = editor.call('entities:new', {
                resource_id: input.id,
                id: input.id,
                name: input.name,
                parent: 'root',
                enabled: true,
                position: input.position,
                rotation: input.rotation,
                scale: input.scale,
                components: { render: { enabled: true, type: 'box', materialAssets: [null] } },
                noHistory: false,
                noSelect: false
            })
            for (const [path, value] of Object.entries({
                name: input.name,
                parent: 'root',
                enabled: true,
                position: input.position,
                rotation: input.rotation,
                scale: input.scale,
                'components.render': { enabled: true, type: 'box', materialAssets: [null] }
            })) {
                observer?.set?.(path, value)
            }
            return input.id
        }
        const shipId = createEntity({
            id: 'stable-ship',
            name: 'MMOOMM Ship',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [12, 4, 4]
        })
        const stationId = createEntity({
            id: 'stable-station',
            name: 'MMOOMM Station',
            position: [72, 0, -48],
            rotation: [0, 0, 0],
            scale: [48, 16, 16]
        })
        if (!shipId || !stationId) {
            throw new Error('MMOOMM native entities were not created')
        }
        window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.dirty = true
    })
    const lateLoadState = await frame.locator('body').evaluate(() => {
        const editor = window.editor
        const bridge = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        if (!editor?.emit || !bridge) {
            throw new Error('PlayCanvas Editor bridge is not available')
        }
        bridge.lastLoadedScene = {
            data: {
                payload: {
                    schemaVersion: '1',
                    entities: [
                        {
                            resource_id: 'root',
                            name: 'Root',
                            parent: null,
                            children: ['stale-persisted'],
                            position: [0, 0, 0],
                            rotation: [0, 0, 0],
                            scale: [1, 1, 1],
                            components: {}
                        },
                        {
                            resource_id: 'stale-persisted',
                            name: 'Stale Persisted Entity',
                            parent: 'root',
                            children: [],
                            position: [9, 9, 9],
                            rotation: [0, 0, 0],
                            scale: [1, 1, 1],
                            components: {}
                        }
                    ]
                }
            }
        }
        editor.emit('realtime:load:scene')
        const scene = bridge.serializeCurrentScene?.()
        return {
            dirty: bridge.dirty === true,
            names: (scene?.entities ?? []).map((entity) => entity.name)
        }
    })
    expect(lateLoadState).toEqual(
        expect.objectContaining({
            dirty: true,
            names: expect.arrayContaining(['MMOOMM Ship', 'MMOOMM Station'])
        })
    )
    expect(lateLoadState.names).not.toContain('Stale Persisted Entity')
    await expect
        .poll(
            () =>
                frame.locator('body').evaluate(() => {
                    const scene = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.serializeCurrentScene?.()
                    return {
                        dirty: window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.dirty === true,
                        entities: scene?.entities ?? [],
                        names: (scene?.entities ?? []).map((entity) => entity.name),
                        mmoomm: scene?.metadata?.mmoomm
                    }
                }),
            { timeout: 10_000 }
        )
        .toEqual(
            expect.objectContaining({
                dirty: true,
                names: expect.arrayContaining(['MMOOMM Ship', 'MMOOMM Station']),
                mmoomm: undefined
            })
        )

    const currentNamesAfterLateLoad = await frame.locator('body').evaluate(() => {
        const scene = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.serializeCurrentScene?.()
        return (scene?.entities ?? []).map((entity) => entity.name)
    })
    expect(currentNamesAfterLateLoad).not.toContain('Stale Persisted Entity')

    await frame.locator('body').evaluate(async () => {
        await window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.saveCurrentScene()
    })
    const savePayload = await page.evaluate(
        () =>
            (
                window as unknown as {
                    bridgePayloads?: Array<{ type?: string; payload?: { entities?: Array<{ name?: string }>; metadata?: unknown } }>
                }
            ).bridgePayloads?.find((item) => item.type === 'scene.save') ?? null
    )
    expect(savePayload?.payload?.entities).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                name: 'MMOOMM Ship',
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [12, 4, 4],
                components: expect.objectContaining({ render: expect.any(Object) })
            }),
            expect.objectContaining({
                name: 'MMOOMM Station',
                position: [72, 0, -48],
                rotation: [0, 0, 0],
                scale: [48, 16, 16],
                components: expect.objectContaining({ render: expect.any(Object) })
            })
        ])
    )
    expect((savePayload?.payload?.entities ?? []).map((entity) => entity.name)).not.toContain('Stale Persisted Entity')
    expect(savePayload?.payload?.metadata).not.toEqual(expect.objectContaining({ mmoomm: expect.anything() }))
})

test('PlayCanvas Editor v2.24.2 exposes the new version-control picker and builds panel', async ({ page, baseURL }) => {
    const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'
    const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()

    await page.route('**/api/v1/metahub/**/playcanvas/editor-bridge/commands', async (route) => {
        const request = route.request()
        const body = JSON.parse(request.postData() ?? '{}') as {
            type?: string
            requestId?: string
        }
        const reply = (data: unknown) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    requestId: body.requestId,
                    type: body.type,
                    data
                })
            })
        if (body.type === 'protocol.describe') {
            return reply({
                protocol: {
                    schemaVersion: '1',
                    mode: 'universo-bridge-minimal',
                    upstream: {
                        repository: 'https://github.com/playcanvas/editor',
                        minimumTag: 'v2.24.2'
                    },
                    defaultSceneId: sceneId
                }
            })
        }
        return reply({})
    })

    // Network probes registered BEFORE the iframe loads so that early
    // asset requests are visible. We assert no remote PlayCanvas font
    // URLs leak from the vendored bundle (per brief acceptance criterion #9).
    const staticAssetRequests: string[] = []
    page.on('request', (req) => {
        const url = req.url()
        if (url.includes('playcanvas.com/static-assets/')) staticAssetRequests.push(url)
    })

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <head><title>v2.24.2 picker probe</title></head>
            <body style="margin:0">
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    allow="autoplay; clipboard-read; clipboard-write"
                    sandbox="allow-scripts allow-same-origin"
                    style="width:1280px;height:720px;border:0"
                ></iframe>
                <script>
                    window.bridgePayloads = [];
                    window.addEventListener('message', (event) => {
                        if (!event.data) return;
                        if (event.data.requestId) {
                            window.bridgePayloads.push(event.data);
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            const responseData =
                                event.data.type === 'protocol.describe'
                                    ? {
                                          protocol: {
                                              schemaVersion: '1',
                                              mode: 'universo-bridge-minimal',
                                              upstream: {
                                                  repository: 'https://github.com/playcanvas/editor',
                                                  minimumTag: 'v2.24.2'
                                              },
                                              defaultSceneId: '${sceneId}'
                                          }
                                      }
                                    : event.data.type === 'project.loadSelected'
                                      ? {
                                            project: {
                                                id: '${projectId}',
                                                displayName: {
                                                    _primary: 'en',
                                                    locales: { en: { content: 'v2.24.2 Probe Project' } }
                                                },
                                                version: 1,
                                                defaultSceneId: '${sceneId}',
                                                compatibilityStatus: 'compatible',
                                                status: 'ready',
                                                sceneCount: 1,
                                                assetCount: 0,
                                                scriptCount: 0,
                                                generatedArtifactCount: 0,
                                                publishable: false
                                            }
                                        }
                                      : event.data.type === 'scene.read'
                                        ? {
                                              scene: { id: '${sceneId}', checksum: '${'a'.repeat(64)}' },
                                              payload: { schemaVersion: '1', entities: [] }
                                          }
                                        : {};
                            frame.contentWindow.postMessage({
                                type: 'bridge.response',
                                source: 'universo-playcanvas-editor-host',
                                commandType: event.data.type,
                                requestId: event.data.requestId,
                                response: {
                                    ok: true,
                                    requestId: event.data.requestId,
                                    type: event.data.type,
                                    data: responseData
                                }
                            }, '*');
                            return;
                        }
                        if (event.data.type !== 'editor.bootstrap.requestInit') return;
                        window.setTimeout(() => {
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            frame.contentWindow.postMessage({
                                type: 'editor.bootstrap.init',
                                source: 'universo-playcanvas-editor-host',
                                bootstrapRequestId: event.data.bootstrapRequestId,
                                descriptor: {
                                    schemaVersion: '1',
                                    bridge: {
                                        sessionId: '019e9146-a649-7218-b147-1e0d5ca9e45d',
                                        nonce: '019e9146a6497218b1471e0d5ca9e45d019e9146a6497218b1471e0d5ca9e45d',
                                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                                        bridgeVersion: '1',
                                        writeMode: 'manager',
                                        capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read']
                                    },
                                    selectedProject: {
                                        project: {
                                            id: '${projectId}',
                                            displayName: {
                                                _primary: 'en',
                                                locales: { en: { content: 'v2.24.2 Probe Project' } }
                                            },
                                            version: 1,
                                            defaultSceneId: '${sceneId}',
                                            compatibilityStatus: 'compatible',
                                            status: 'ready',
                                            sceneCount: 1,
                                            assetCount: 0,
                                            scriptCount: 0,
                                            generatedArtifactCount: 0,
                                            publishable: false
                                        },
                                        defaultSceneId: '${sceneId}'
                                    },
                                    compatibilityStatus: 'ready'
                                },
                            }, '*');
                        }, 100);
                    });
                </script>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')

    // The artifact is served from the editor package's own smoke server.
    // Wait for the upstream UI to fully boot (real boot, not a domcontentloaded
    // placeholder). This is the v2.24.2 acceptance gate.
    await expectHostedEditorApiReady(frame)

    // Confirm the v2.24.2 manifest metadata is exposed on the iframe.
    // The bridge marker does not surface upstreamTag directly; the
    // canonical metadata lives in the static
    // `universo-artifact-manifest.json` next to the artifact's index.html.
    const manifestRes = await page.request.get(`${baseURL ?? 'http://127.0.0.1:3487'}/universo-artifact-manifest.json`)
    expect(manifestRes.status()).toBe(200)
    const artifactMetadata = (await manifestRes.json()) as {
        upstreamTag?: string
        upstreamCommit?: string
        upstreamPackageVersion?: string
    }
    expect(artifactMetadata.upstreamTag).toBe('v2.24.2')
    expect(artifactMetadata.upstreamCommit).toBe('00360100b3b5747648eb3d7287421ef25491f5c7')
    expect(artifactMetadata.upstreamPackageVersion).toBe('2.24.2')

    // The v2.24.2 picker rewrite registers the new methods on
    // `window.editor`. Verify the methods are wired and accept benign
    // arguments (this is the concrete acceptance gate for the
    // version-control picker rewrite). If any of these calls throws
    // or returns undefined, the new `picker-version-control.ts`
    // orchestrator is missing.
    const pickerApi = await frame.locator('body').evaluate(() => {
        const editor = (window as unknown as { editor?: { call?: (name: string, ...args: unknown[]) => unknown } }).editor
        if (typeof editor?.call !== 'function') return null
        // The conflict manager probe MUST distinguish "method missing" from
        // "method registered with no active merge". The three registered
        // methods on the v2.24.2 orchestrator are:
        //   - picker:conflictManager(data)            -> action, returns void
        //   - picker:conflictManager:currentMerge()    -> returns currentMergeObject (initially null)
        //   - picker:conflictManager:rightPanel()      -> returns panelRight
        // `Caller.call` returns `null` when a method is missing, and the
        // registered action handler returns `undefined` when the picker
        // has not been opened. Distinguish the two by checking the
        // action-handler return: `null` == missing method,
        // `undefined` == registered method.
        const conflictManagerActionResult = editor.call('picker:conflictManager')
        const conflictManagerWired = conflictManagerActionResult === undefined
        return {
            hasRetainedDiff: typeof editor.call('picker:versioncontrol:hasRetainedDiff', 'probe-id') === 'boolean',
            releaseDiffReturned: editor.call('picker:versioncontrol:releaseDiff', 'probe-id') === undefined,
            transformCheckpointData: typeof editor.call('picker:versioncontrol:transformCheckpointData', { id: 'p' }) === 'object',
            buildsPublishIsMethod: typeof editor.call('picker:builds-publish') === 'undefined',
            conflictManagerWired
        }
    })
    expect(pickerApi).not.toBeNull()
    expect((pickerApi as { hasRetainedDiff: boolean }).hasRetainedDiff).toBe(true)
    expect((pickerApi as { releaseDiffReturned: boolean }).releaseDiffReturned).toBe(true)
    expect((pickerApi as { transformCheckpointData: boolean }).transformCheckpointData).toBe(true)
    expect((pickerApi as { buildsPublishIsMethod: boolean }).buildsPublishIsMethod).toBe(true)
    // The conflict manager must be a registered object, not `null`.
    // A falsy check would pass for both "method missing" and
    // "method registered, no merge active" — assert object type instead.
    expect((pickerApi as { conflictManagerWired: boolean }).conflictManagerWired).toBe(true)

    // No remote PlayCanvas font/asset URLs should leak from the v2.24.2
    // vendored bundle (per brief acceptance criterion #9).
    await page.waitForTimeout(500)
    expect(staticAssetRequests).toEqual([])

    // Take a screenshot of the iframe (real picker surface), not the
    // synthetic host page. `page.locator('iframe[...').screenshot()`
    // captures the iframe's viewport only.
    await page.locator('iframe[title="PlayCanvas Editor"]').screenshot({ path: 'e2e/screenshots/v2-24-2-picker.png' })
    void projectId
    void sceneId
})

test('PlayCanvas Editor hosted upstream UI does not expose MMOOMM projection controls without host capability', async ({
    page,
    baseURL
}) => {
    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()
    const projectId = '019e9148-7207-753f-bbb8-4797ef174025'
    const sceneId = '019e9148-8d3e-7386-9bee-398f22a2ef92'

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <body style="margin:0">
                <script>
                    window.addEventListener('message', (event) => {
                        if (!event.data || event.data.type !== 'editor.bootstrap.requestInit') return;
                        const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                        frame.contentWindow.postMessage({
                            type: 'editor.bootstrap.init',
                            source: 'universo-playcanvas-editor-host',
                            bootstrapRequestId: event.data.bootstrapRequestId,
                            locale: 'en',
                            descriptor: {
                                schemaVersion: '1',
                                compatibilityStatus: 'ready',
                                selectedProject: {
                                    project: { id: '${projectId}', displayName: { _primary: 'en', locales: { en: { content: 'Plain PlayCanvas Project' } } } },
                                    defaultSceneId: '${sceneId}'
                                },
                                bridge: {
                                    sessionId: '019e9148-bbbb-7000-8000-000000000001',
                                    sessionToken: 'session-token',
                                    nonce: 'nonce-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                                    expiresAt: new Date(Date.now() + 60000).toISOString(),
                                    bridgeVersion: '1',
                                    writeMode: 'manager',
                                    capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save']
                                }
                            }
                        }, '*');
                    });
                </script>
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    sandbox="allow-scripts allow-same-origin"
                    referrerpolicy="no-referrer"
                    style="width:960px;height:640px;border:0"
                ></iframe>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    await expect
        .poll(() => frame.locator('body').evaluate(() => window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.initialized === true))
        .toBe(true)
})

test('PlayCanvas Editor hosted artifact saves through compatibility REST when config is available', async ({ page, baseURL }) => {
    const iframeUrl = new URL('/?locale=en', baseURL ?? 'http://127.0.0.1:3487').toString()
    const metahubId = '019e9148-9999-7000-8000-000000000001'
    const projectId = '019e9148-9999-7000-8000-000000000002'
    const sceneId = '019e9148-9999-7000-8000-000000000003'
    const checksumBefore = 'a'.repeat(64)
    const checksumAfter = 'd'.repeat(64)
    const compatibilityToken = 'test-compatibility-token-'.padEnd(48, 'x')
    let configRequestCount = 0
    let csrfRequestCount = 0
    let forceSceneSaveConflict = false
    const restSceneSaves: Array<{ headers: Record<string, string>; body: { expectedCurrentChecksum?: string; payload?: unknown } }> = []

    await page.route(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/config$/, async (route) => {
        configRequestCount += 1
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                item: {
                    mode: 'universo-compatibility-rest-minimal',
                    projectId,
                    defaultSceneId: sceneId,
                    permissions: { read: true, write: true, admin: false },
                    auth: {
                        scheme: 'signed-header',
                        headerName: 'X-PlayCanvas-Editor-Token',
                        accessToken: compatibilityToken,
                        expiresAt: new Date(Date.now() + 60_000).toISOString()
                    },
                    csrf: { tokenUrl: '/api/v1/auth/csrf', headerName: 'X-CSRF-Token' },
                    endpoints: {
                        scenes: `/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/scenes`,
                        assets: `/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/assets`,
                        settings: `/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/settings`,
                        cloudOnly: `/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/cloud-only`
                    }
                }
            })
        })
    })
    await page.route('**/api/v1/auth/csrf', async (route) => {
        csrfRequestCount += 1
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-csrf' }) })
    })
    await page.route('**/xhr-proxy-property-callback.txt', async (route) => {
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'xhr-property-callback-ok' })
    })
    await page.route(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/scenes\/[^/]+$/, async (route) => {
        const request = route.request()
        const requestBody = request.postDataJSON() as { expectedCurrentChecksum?: string; payload?: unknown; requestId?: unknown }
        if (forceSceneSaveConflict && request.method() === 'PUT') {
            await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: false,
                    requestId: requestBody.requestId,
                    code: 'saveConflict',
                    status: 409
                })
            })
            return
        }
        restSceneSaves.push({
            headers: request.headers(),
            body: requestBody
        })
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                requestId: restSceneSaves[0]?.body ? (restSceneSaves[0].body as { requestId?: unknown }).requestId : undefined,
                item: {
                    checksum: checksumAfter,
                    scene: { id: sceneId, checksum: checksumAfter },
                    payload: (request.postDataJSON() as { payload?: unknown })?.payload
                }
            })
        })
    })

    await page.setContent(`
        <!doctype html>
        <html lang="en">
            <body style="margin:0">
                <script>
                    window.bridgePayloads = [];
                    window.addEventListener('message', (event) => {
                        if (!event.data) return;
                        if (event.data.requestId) {
                            window.bridgePayloads.push(event.data);
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            const responseData =
                                event.data.type === 'protocol.describe'
                                    ? { protocol: { schemaVersion: '1', mode: 'universo-bridge-minimal', defaultSceneId: '${sceneId}' } }
                                    : event.data.type === 'project.loadSelected'
                                      ? {
                                            project: {
                                                id: '${projectId}',
                                                displayName: { _primary: 'en', locales: { en: { content: 'REST Project' } } },
                                                version: 1,
                                                defaultSceneId: '${sceneId}',
                                                compatibilityStatus: 'compatible',
                                                status: 'ready',
                                                sceneCount: 1,
                                                assetCount: 0,
                                                scriptCount: 0,
                                                generatedArtifactCount: 0,
                                                publishable: false
                                            },
                                            defaultSceneId: '${sceneId}'
                                        }
                                      : event.data.type === 'scene.read'
                                        ? {
                                              scene: { id: '${sceneId}', checksum: '${checksumBefore}' },
                                              payload: { schemaVersion: '1', entities: [] }
                                          }
                                        : {};
                            frame.contentWindow.postMessage({
                                type: 'bridge.response',
                                source: 'universo-playcanvas-editor-host',
                                commandType: event.data.type,
                                requestId: event.data.requestId,
                                response: { ok: true, requestId: event.data.requestId, type: event.data.type, data: responseData }
                            }, '*');
                            return;
                        }
                        if (event.data.type !== 'editor.bootstrap.requestInit') return;
                        window.setTimeout(() => {
                            const frame = document.querySelector('iframe[title="PlayCanvas Editor"]');
                            frame.contentWindow.postMessage({
                                type: 'editor.bootstrap.init',
                                source: 'universo-playcanvas-editor-host',
                                bootstrapRequestId: event.data.bootstrapRequestId,
                                descriptor: {
                                    schemaVersion: '1',
                                    metahubId: '${metahubId}',
                                    bridge: {
                                        sessionId: '019e9148-a649-7218-b147-1e0d5ca9e45d',
                                        nonce: '019e9148a6497218b1471e0d5ca9e45d019e9148a6497218b1471e0d5ca9e45d',
                                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                                        bridgeVersion: '1',
                                        writeMode: 'manager',
                                        capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save']
                                    },
                                    selectedProject: {
                                        project: {
                                            id: '${projectId}',
                                            displayName: { _primary: 'en', locales: { en: { content: 'REST Project' } } },
                                            version: 1,
                                            defaultSceneId: '${sceneId}',
                                            compatibilityStatus: 'compatible',
                                            status: 'ready',
                                            sceneCount: 1,
                                            assetCount: 0,
                                            scriptCount: 0,
                                            generatedArtifactCount: 0,
                                            publishable: false
                                        },
                                        defaultSceneId: '${sceneId}'
                                    },
                                    compatibilityConfig: {
                                        mode: 'universo-compatibility-rest-minimal',
                                        projectId: '${projectId}',
                                        defaultSceneId: '${sceneId}',
                                        permissions: { read: true, write: true, admin: false },
                                        auth: {
                                            scheme: 'signed-header',
                                            headerName: 'X-PlayCanvas-Editor-Token',
                                            accessToken: '${compatibilityToken}',
                                            expiresAt: new Date(Date.now() + 60000).toISOString()
                                        },
                                        csrf: { tokenUrl: '/api/v1/auth/csrf', headerName: 'X-CSRF-Token' },
                                        endpoints: {
                                            scenes: '/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/scenes',
                                            assets: '/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/assets',
                                            settings: '/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/settings',
                                            cloudOnly: '/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/${projectId}/cloud-only'
                                        }
                                    },
                                    compatibilityCsrfToken: {
                                        headerName: 'X-CSRF-Token',
                                        token: 'host-provided-csrf'
                                    },
                                    compatibilityStatus: 'ready'
                                },
                            }, '*');
                        }, 100);
                    });
                </script>
                <iframe
                    title="PlayCanvas Editor"
                    src="${iframeUrl}"
                    sandbox="allow-scripts allow-same-origin"
                    referrerpolicy="no-referrer"
                    style="width:960px;height:640px;border:0"
                ></iframe>
            </body>
        </html>
    `)

    const frame = page.frameLocator('iframe[title="PlayCanvas Editor"]')
    await expect
        .poll(
            () =>
                frame.locator('body').evaluate(
                    (_body, requestCount) => ({
                        scheme: window.config?.universoCompatibilityConfig?.auth?.scheme,
                        storageError: String(window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.storageError?.message ?? ''),
                        metahubId: window.config?.universoBridge?.metahubId,
                        selectedProjectId: window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.selectedProject?.project?.id,
                        selectedSceneId: window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?.selectedProject?.defaultSceneId,
                        configRequestCount: requestCount.config,
                        csrfRequestCount: requestCount.csrf
                    }),
                    { config: configRequestCount, csrf: csrfRequestCount }
                ),
            { timeout: 10_000 }
        )
        .toEqual({
            scheme: 'signed-header',
            storageError: '',
            metahubId,
            selectedProjectId: projectId,
            selectedSceneId: sceneId,
            configRequestCount: 0,
            csrfRequestCount: 0
        })
    expect(configRequestCount).toBe(0)
    expect(csrfRequestCount).toBe(0)

    const xhrPropertyCallbackResult = await frame.locator('body').evaluate(
        () =>
            new Promise((resolve) => {
                const xhr = new XMLHttpRequest()
                const events: string[] = []
                const timer = window.setTimeout(() => {
                    resolve({ ok: false, timeout: true, events })
                }, 5_000)
                xhr.onreadystatechange = () => {
                    events.push(`readystatechange:${xhr.readyState}`)
                }
                xhr.onload = () => {
                    window.clearTimeout(timer)
                    resolve({ ok: true, status: xhr.status, responseText: xhr.responseText, events })
                }
                xhr.onerror = () => {
                    window.clearTimeout(timer)
                    resolve({ ok: false, error: true, status: xhr.status, events })
                }
                xhr.open('GET', '/xhr-proxy-property-callback.txt')
                xhr.send()
            })
    )
    expect(xhrPropertyCallbackResult).toEqual({
        ok: true,
        status: 200,
        responseText: 'xhr-property-callback-ok',
        events: expect.arrayContaining(['readystatechange:4'])
    })

    await frame.locator('body').evaluate(async () => {
        await window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.saveCurrentScene({
            schemaVersion: '1',
            entities: [{ id: 'rest-entity', name: 'REST Entity' }]
        })
    })

    expect(restSceneSaves).toHaveLength(1)
    expect(restSceneSaves[0]?.headers['x-playcanvas-editor-token']).toBe(compatibilityToken)
    expect(restSceneSaves[0]?.headers['x-csrf-token']).toBe('host-provided-csrf')
    expect(restSceneSaves[0]?.body).toMatchObject({
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        expectedCurrentChecksum: checksumBefore,
        payload: { entities: [{ id: 'rest-entity', name: 'REST Entity' }] }
    })
    const bridgeSavePayload = await page.evaluate(
        () =>
            (window as unknown as { bridgePayloads?: Array<{ type?: string }> }).bridgePayloads?.find(
                (item) => item.type === 'scene.save'
            ) ?? null
    )
    expect(bridgeSavePayload).toBeNull()

    forceSceneSaveConflict = true
    const conflictResult = await frame.locator('body').evaluate(async () => {
        const bridge = window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        try {
            await bridge.saveCurrentScene({
                schemaVersion: '1',
                entities: [{ id: 'conflict-entity', name: 'Conflict Entity' }]
            })
            return { ok: true }
        } catch (error) {
            const envelope = error as { ok?: unknown; code?: unknown; status?: unknown }
            return {
                ok: envelope.ok,
                code: envelope.code,
                status: envelope.status
            }
        }
    })
    expect(conflictResult).toEqual({ ok: false, code: 'saveConflict', status: 409 })
    await expect
        .poll(
            () =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as { bridgePayloads?: Array<{ type?: string; code?: string; status?: number }> }
                        ).bridgePayloads?.find((item) => item.type === 'bridge.saveError') ?? null
                ),
            { timeout: 5_000 }
        )
        .toEqual(expect.objectContaining({ code: 'saveConflict', status: 409 }))
})
