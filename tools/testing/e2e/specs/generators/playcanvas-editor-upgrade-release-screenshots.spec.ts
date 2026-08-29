import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    createPublicationLinkedApplication,
    createLoggedInApiContext,
    disposeApiContext,
    getApplication,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { repoRoot, storageStatePath } from '../../support/env/load-e2e-env.mjs'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import { expectMmoommCanvasPainted, MMOOMM_RUNTIME_EXPECT_TIMEOUT, openMmoommSpaceSection } from '../../support/mmoommRuntimeProof'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type Locale = 'en' | 'ru'

const DOCS_VIEWPORT = { width: 1920, height: 1080 } as const
const DEVICE_SCALE_FACTOR = 1 as const
const APP_RUNTIME_TIMEOUT = 180_000
const SKELETON_ATTEMPTS = 2
const SKELETON_ROUTE_DELAY_MS = 2_500
const SKELETON_CHUNK_GLOB = '**/PlayCanvasCanvasWidget-*.js'
const SKELETON_VISIBLE_TIMEOUT = 5_000

const releaseAssetRelativeDirs: Record<Locale, string> = {
    en: 'docs/en/.gitbook/assets/playcanvas-editor-upgrade/release',
    ru: 'docs/ru/.gitbook/assets/playcanvas-editor-upgrade/release'
}
const releaseAssetDir = (locale: Locale) => path.join(repoRoot, releaseAssetRelativeDirs[locale])
const evidenceRelativePath = 'tools/testing/e2e/.artifacts/playcanvas-editor-upgrade-release-evidence.json'
const evidencePath = path.join(repoRoot, evidenceRelativePath)
const generatorPath = path.join(repoRoot, 'tools/testing/e2e/specs/generators/playcanvas-editor-upgrade-release-screenshots.spec.ts')

const RELEASE_CAPTURES = [
    { id: 'packages-registry', filename: 'packages-registry.png' },
    { id: 'canvas-runtime', filename: 'canvas-runtime.png' },
    { id: 'canvas-webgl2-unavailable', filename: 'canvas-webgl2-unavailable.png' },
    { id: 'canvas-loading-skeleton', filename: 'canvas-loading-skeleton.png' }
] as const

const LOCALIZED_TEXT: Record<string, Record<Locale, string>> = {
    resourcesHeading: { en: 'Resources', ru: 'Ресурсы' },
    packagesTab: { en: 'Packages', ru: 'Пакеты' },
    connectedCount: { en: '4 connected', ru: 'Подключено: 4' },
    statusConnected: { en: 'Connected', ru: 'Подключён' },
    webglUnavailable: {
        en: '3D rendering is not available on this device or browser.',
        ru: '3D-рендеринг недоступен на этом устройстве или в браузере.'
    },
    skeletonLoading: { en: 'Loading 3D scene...', ru: 'Загрузка 3D-сцены...' }
}

const PACKAGE_ROW_NAMES: Array<Record<Locale, RegExp>> = [
    { en: /Colyseus Client/, ru: /Клиент Colyseus/ },
    { en: /Colyseus Server/, ru: /Сервер Colyseus/ },
    { en: /PlayCanvas Editor/, ru: /PlayCanvas Editor/ },
    { en: /PlayCanvas Engine/, ru: /PlayCanvas Engine/ }
]

const WELCOME_HEADING = /(Welcome to Universo MMOOMM|Добро пожаловать)/i
const REALTIME_CONNECTED_TEXT = /Realtime (connected|restored|подключён|восстановлен)/i
const ID_LIKE_PATH_SEGMENT = /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})(?=\/|$|\?)/gi

type CaptureStatus = 'captured' | 'skipped'

type ReleaseCaptureEvidence = {
    id: string
    locale: Locale
    status: CaptureStatus
    path?: string
    route?: string
    note?: string
}

const captureEvidence: ReleaseCaptureEvidence[] = []

const sha256 = (buffer: Buffer | string): string => createHash('sha256').update(buffer).digest('hex')

function readPngDimensions(buffer: Buffer) {
    if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
        throw new Error('not a valid PNG file')
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function normalizeRoute(page: Page): string {
    const currentUrl = new URL(page.url())
    const normalizedPath = currentUrl.pathname.replace(ID_LIKE_PATH_SEGMENT, '/{routeId}')
    return normalizedPath
}

const localized = (locale: Locale, key: keyof typeof LOCALIZED_TEXT): string => LOCALIZED_TEXT[key][locale]

async function removeStaleReleaseCaptures(): Promise<void> {
    for (const locale of ['en', 'ru'] as const) {
        await fs.mkdir(releaseAssetDir(locale), { recursive: true })
        for (const entry of RELEASE_CAPTURES) {
            await fs.rm(path.join(releaseAssetDir(locale), entry.filename), { force: true })
        }
    }
}

async function writeCaptureEvidence(): Promise<void> {
    await fs.mkdir(path.dirname(evidencePath), { recursive: true })
    await fs.writeFile(
        evidencePath,
        `${JSON.stringify(
            {
                version: 1,
                featureId: 'playcanvas-editor-upgrade-release',
                generator: path.relative(repoRoot, generatorPath),
                generatorSha256: sha256(await fs.readFile(generatorPath)),
                generatedAt: new Date().toISOString(),
                viewport: DOCS_VIEWPORT,
                deviceScaleFactor: DEVICE_SCALE_FACTOR,
                captures: captureEvidence
            },
            null,
            4
        )}\n`
    )
}

async function captureViewportScreenshot(page: Page, locale: Locale, id: string, filename: string): Promise<void> {
    const outputRelative = `${releaseAssetRelativeDirs[locale]}/${filename}`
    const outputPath = path.join(repoRoot, outputRelative)
    await page.screenshot({ path: outputPath, fullPage: false })
    const buffer = await fs.readFile(outputPath)
    const dimensions = readPngDimensions(buffer)
    expect(dimensions, `${id} ${locale} PNG dimensions`).toEqual(DOCS_VIEWPORT)
    captureEvidence.push({
        id,
        locale,
        status: 'captured',
        path: outputRelative.replaceAll(path.sep, '/'),
        route: normalizeRoute(page)
    })
}

async function expectPublishedAppWorkspaceReady(page: Page, applicationId: string): Promise<void> {
    await page.goto(`/a/${applicationId}`)
    await expect(page.getByRole('heading', { name: WELCOME_HEADING })).toBeVisible({
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(page.getByTestId('playcanvas-canvas-widget')).toHaveCount(0)
}

async function expectPublishedAppRuntimeConnected(page: Page): Promise<{ widget: ReturnType<Page['getByTestId']> }> {
    await openMmoommSpaceSection(page)
    const widget = page.getByTestId('playcanvas-canvas-widget')
    await expect(widget).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    const canvas = page.getByTestId('playcanvas-canvas')
    await expect(canvas).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(canvas).toHaveAttribute('data-runtime-module-executed', 'not_required', {
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(canvas).toHaveAttribute('data-scripts-loaded', 'true', {
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(widget.getByTestId('playcanvas-realtime-status')).toContainText(REALTIME_CONNECTED_TEXT, {
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(canvas).toHaveAttribute('data-realtime-status', /connected|restored/, {
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expectMmoommCanvasPainted(page, canvas)
    return { widget }
}

async function capturePackagesRegistry(page: Page, locale: Locale, metahubId: string): Promise<void> {
    await page.setViewportSize(DOCS_VIEWPORT)
    await page.goto(`/metahub/${metahubId}/resources`)
    await expect(page.getByRole('heading', { name: localized(locale, 'resourcesHeading') })).toBeVisible({
        timeout: 30_000
    })

    const tabsBar = page.getByTestId('metahub-shared-resources-tabs')
    await expect(tabsBar.getByRole('tab', { name: localized(locale, 'packagesTab') })).toHaveAttribute('aria-selected', 'true')

    const packagesTab = page.getByTestId('metahub-packages-tab')
    await expect(packagesTab.getByText(localized(locale, 'connectedCount'))).toBeVisible({ timeout: 30_000 })
    for (const rowName of PACKAGE_ROW_NAMES) {
        await expect(packagesTab.getByRole('row', { name: rowName[locale] })).toBeVisible({ timeout: 30_000 })
    }
    await expect(packagesTab.getByText(localized(locale, 'statusConnected'), { exact: true })).toHaveCount(4)

    await expectNoTechnicalLeakage(packagesTab, {
        label: `packages registry ${locale}`,
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, `packages registry ${locale}`)

    await page.evaluate(() => document.fonts.ready)
    await captureViewportScreenshot(page, locale, 'packages-registry', 'packages-registry.png')
}

async function captureCanvasRuntime(page: Page, locale: Locale, applicationId: string): Promise<void> {
    await page.setViewportSize(DOCS_VIEWPORT)
    await expectPublishedAppWorkspaceReady(page, applicationId)
    await expectPublishedAppRuntimeConnected(page)
    await expectNoPageHorizontalOverflow(page, `canvas runtime ${locale}`)

    await page.evaluate(() => document.fonts.ready)
    await captureViewportScreenshot(page, locale, 'canvas-runtime', 'canvas-runtime.png')
}

async function withIsolatedContext(
    browser: Browser,
    locale: Locale,
    configure?: (context: BrowserContext) => Promise<void>
): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        viewport: DOCS_VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        storageState: storageStatePath
    })
    const page = await context.newPage()
    await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
    if (configure) {
        await configure(context)
    }
    return { context, page }
}

async function captureWebgl2Unavailable(browser: Browser, locale: Locale, applicationId: string): Promise<void> {
    const { context, page } = await withIsolatedContext(browser, locale, async (context) => {
        await context.addInitScript(() => {
            const originalGetContext = HTMLCanvasElement.prototype.getContext
            HTMLCanvasElement.prototype.getContext = function getContextOverride(contextType: string, ...rest: unknown[]) {
                if (contextType === 'webgl2') {
                    return null
                }
                return originalGetContext.call(this, contextType, ...rest)
            } as typeof HTMLCanvasElement.prototype.getContext
        })
    })

    try {
        await expectPublishedAppWorkspaceReady(page, applicationId)
        await openMmoommSpaceSection(page)
        const widget = page.getByTestId('playcanvas-canvas-widget')
        await expect(widget).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(widget.getByText(localized(locale, 'webglUnavailable'))).toBeVisible({
            timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
        })
        await expectNoPageHorizontalOverflow(page, `webgl2 unavailable ${locale}`)

        await captureViewportScreenshot(page, locale, 'canvas-webgl2-unavailable', 'canvas-webgl2-unavailable.png')
    } finally {
        await context.close()
    }
}

async function captureLoadingSkeletonOnce(
    browser: Browser,
    locale: Locale,
    applicationId: string
): Promise<{ context: BrowserContext; page: Page }> {
    const { context, page } = await withIsolatedContext(browser, locale, async (context) => {
        await context.route(SKELETON_CHUNK_GLOB, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, SKELETON_ROUTE_DELAY_MS))
            await route.continue()
        })
    })

    try {
        await expectPublishedAppWorkspaceReady(page, applicationId)
        await openMmoommSpaceSection(page)
        // The lazy chunk carries the playcanvas-canvas-widget test id, so the
        // Suspense fallback is identified by its localized loading status role.
        const skeleton = page.getByRole('status', { name: localized(locale, 'skeletonLoading'), exact: true })
        await expect(skeleton).toBeVisible({ timeout: SKELETON_VISIBLE_TIMEOUT })
        await expect(page.getByTestId('playcanvas-canvas-widget')).toHaveCount(0)

        await captureViewportScreenshot(page, locale, 'canvas-loading-skeleton', 'canvas-loading-skeleton.png')
        return { context, page }
    } catch (error) {
        await context.close().catch(() => {})
        throw error
    }
}

async function captureLoadingSkeletonWithRetry(browser: Browser, locale: Locale, applicationId: string): Promise<boolean> {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= SKELETON_ATTEMPTS; attempt += 1) {
        try {
            const { context } = await captureLoadingSkeletonOnce(browser, locale, applicationId)
            await context.close()
            return true
        } catch (error) {
            lastError = error
            console.warn(`[playcanvas-release-screenshots] skeleton attempt ${attempt} (${locale}) failed:`, error)
        }
    }
    captureEvidence.push({
        id: 'canvas-loading-skeleton',
        locale,
        status: 'skipped',
        note: `Skipped after ${SKELETON_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    })
    return false
}

test.describe('PlayCanvas Editor upgrade release screenshots @generator', () => {
    test('@generator playcanvas editor upgrade release screenshots capture EN/RU release evidence at 1920x1080', async ({
        browser,
        page,
        runManifest
    }) => {
        test.setTimeout(1_200_000)

        const api = await createLoggedInApiContext(runManifest.testUser)
        await removeStaleReleaseCaptures()

        try {
            for (const locale of ['en', 'ru'] as const) {
                await applyBrowserPreferences(page, { language: locale, isDarkMode: false })

                const imported = await importMmoommAppSnapshotThroughUi(page)
                await recordCreatedMetahub({
                    id: imported.metahubId,
                    name: imported.metahubName,
                    codename: 'UniversoMmoomm'
                })
                await recordCreatedPublication({
                    id: imported.publicationId,
                    metahubId: imported.metahubId,
                    schemaName: null
                })

                await capturePackagesRegistry(page, locale, imported.metahubId)

                const linked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
                    name: { en: 'Universo MMOOMM Release Evidence' },
                    namePrimaryLocale: 'en',
                    createApplicationSchema: false
                })
                const applicationId = linked?.application?.id ?? linked?.id
                const applicationSlug = linked?.application?.slug ?? linked?.slug
                if (typeof applicationId !== 'string') {
                    throw new Error('MMOOMM release linked application did not return an application id')
                }
                await recordCreatedApplication({ id: applicationId, slug: applicationSlug })

                await syncApplicationSchema(api, applicationId)
                await expect
                    .poll(
                        async () => {
                            const persisted = await getApplication(api as ApiContext, applicationId)
                            return persisted?.schemaStatus ?? null
                        },
                        { timeout: APP_RUNTIME_TIMEOUT }
                    )
                    .toBe('synced')

                await captureCanvasRuntime(page, locale, applicationId)
                await captureWebgl2Unavailable(browser, locale, applicationId)
                await captureLoadingSkeletonWithRetry(browser, locale, applicationId)

                await page.goto('about:blank')
            }

            await writeCaptureEvidence()
        } catch (error) {
            await writeCaptureEvidence().catch(() => {})
            throw error
        } finally {
            await disposeApiContext(api)
        }
    })
})
