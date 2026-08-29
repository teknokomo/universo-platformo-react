import fs from 'node:fs/promises'
import path from 'node:path'
import { PNG } from 'pngjs'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { loginThroughUi } from '../../support/browser/auth'
import { recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectNoVisibleTextPatterns } from '../../support/browser/runtimeUx'
import { expectPlayCanvasEditorFullscreenHost, expectPlayCanvasEditorIframeLoaded } from '../../support/playcanvasEditorAuthoring'
import { expectPlayCanvasEditorFrameNoHorizontalOverflow } from '../../support/mmoommScriptAssetsProof'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'

const EDITOR_FRAME_SELECTOR = 'iframe[data-testid="playcanvas-editor-frame"]'
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 } as const
const DESKTOP_ACCEPTANCE_VIEWPORT = { width: 1440, height: 900 } as const
const TABLET_VIEWPORT = { width: 768, height: 1024 } as const
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const
const MOBILE_ACCEPTANCE_VIEWPORT = { width: 375, height: 812 } as const
const MATRIX_VIEWPORTS = [
    { name: 'desktop-1920', ...DESKTOP_VIEWPORT },
    { name: 'desktop-1440', ...DESKTOP_ACCEPTANCE_VIEWPORT },
    { name: 'tablet-768', ...TABLET_VIEWPORT },
    { name: 'mobile-390', ...MOBILE_VIEWPORT },
    { name: 'mobile-375', ...MOBILE_ACCEPTANCE_VIEWPORT }
] as const
const CREATE_ASSET_LABELS = ['Folder', 'CSS', 'CubeMap', 'HTML', 'JSON', 'Material', 'Script', 'Shader', 'Text'] as const

const assertNonBlankPng = (screenshot: Buffer, label: string): { width: number; height: number } => {
    const png = PNG.sync.read(screenshot)
    expect(png.width, `${label} screenshot must have a positive width`).toBeGreaterThan(200)
    expect(png.height, `${label} screenshot must have a positive height`).toBeGreaterThan(120)

    const sampledColors = new Set<string>()
    for (let y = 0; y < png.height; y += Math.max(1, Math.floor(png.height / 24))) {
        for (let x = 0; x < png.width; x += Math.max(1, Math.floor(png.width / 24))) {
            const offset = (y * png.width + x) * 4
            if ((png.data[offset + 3] ?? 0) === 0) continue
            sampledColors.add(`${png.data[offset] ?? 0}:${png.data[offset + 1] ?? 0}:${png.data[offset + 2] ?? 0}`)
        }
    }
    expect(sampledColors.size, `${label} screenshot must contain visible UI content`).toBeGreaterThan(2)
    return { width: png.width, height: png.height }
}

const expectResponsiveEditorHost = async (page: import('@playwright/test').Page, label: string): Promise<void> => {
    await expect(page.getByTestId('playcanvas-editor-fullscreen-host'), `${label} host must remain visible`).toBeVisible()
    await expect(page.locator(EDITOR_FRAME_SELECTOR), `${label} iframe must remain visible`).toBeVisible()
    const viewport = page.viewportSize()
    const iframeBox = await page.locator(EDITOR_FRAME_SELECTOR).boundingBox()
    expect(iframeBox, `${label} iframe must retain layout bounds`).not.toBeNull()
    if (!viewport || !iframeBox) return
    expect(iframeBox.width, `${label} iframe must retain the viewport width`).toBeGreaterThan(viewport.width * 0.95)
    // Chromium may cap a dynamically resized headless viewport to the
    // available screen height. Keep the responsive assertion meaningful while
    // avoiding a false failure caused by that environment-level cap.
    expect(iframeBox.height, `${label} iframe must retain a usable editing height`).toBeGreaterThan(Math.min(viewport.height * 0.7, 600))
}

const resolveAuthoringProjectId = async (page: import('@playwright/test').Page, metahubId: string): Promise<string> => {
    const response = await page.request.get(`/api/v1/metahub/${encodeURIComponent(metahubId)}/playcanvas/projects`)
    expect(response.status()).toBe(200)
    const payload = (await response.json()) as { items?: Array<{ id?: unknown; displayName?: unknown }> }
    const project = payload.items?.find((item) =>
        JSON.stringify(item.displayName ?? {})
            .toLowerCase()
            .includes('mmoomm authoring')
    )
    expect(project?.id, 'the imported fixture must expose an authoring PlayCanvas project').toEqual(expect.any(String))
    return String(project?.id)
}

test('@visual @flow PlayCanvas Editor assets remain usable in localized light and dark matrix projects', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(420_000)
    const isDarkMode = testInfo.project.name.endsWith('-dark')
    const locale = testInfo.project.name.startsWith('en-') ? 'en' : 'ru'
    await applyBrowserPreferences(page, { language: locale, isDarkMode })
    await loginThroughUi(page, { email: runManifest.testUser.email, password: runManifest.testUser.password }, { authPath: '/auth' })

    const imported = await importMmoommAppSnapshotThroughUi(page)
    await recordCreatedMetahub({ id: imported.metahubId, name: imported.metahubName, codename: 'UniversoMmoomm' })
    await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId, schemaName: null })
    const projectId = await resolveAuthoringProjectId(page, imported.metahubId)

    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto(
        `/metahub/${encodeURIComponent(
            imported.metahubId
        )}/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${encodeURIComponent(projectId)}`
    )
    await expectPlayCanvasEditorIframeLoaded(page, locale, { readyTimeoutMs: 150_000 })
    await expectPlayCanvasEditorFullscreenHost(page)
    await expectNoPageHorizontalOverflow(page, `${testInfo.project.name} PlayCanvas Editor host`)

    const editorFrame = page.frameLocator(EDITOR_FRAME_SELECTOR)
    const frameBody = editorFrame.locator('body')
    await expectNoVisibleTextPatterns(frameBody, [/\b(?:artifactToken|sessionToken|bootstrapRequestId)\b/i, /\[object Object\]/], {
        label: `${testInfo.project.name} PlayCanvas Editor frame`
    })
    await expectNoTechnicalLeakage(frameBody, {
        label: `${testInfo.project.name} PlayCanvas Editor frame`,
        checkUuidSubstrings: true
    })

    const assetsPanel = editorFrame.locator('#layout-assets')
    await expect(assetsPanel).toBeVisible()
    const addAssetButton = assetsPanel.locator('.pcui-asset-panel-controls .pcui-asset-panel-btn-small').first()
    await expect(addAssetButton).toBeEnabled()
    const artifactDir = path.resolve(repoRoot, 'tools', 'testing', 'e2e', '.artifacts')
    await fs.mkdir(artifactDir, { recursive: true })

    for (const viewport of MATRIX_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        if (viewport.name.startsWith('mobile-')) {
            // The upstream Editor is intentionally unsupported below the
            // compact breakpoint. Verify the localized fallback instead of
            // capturing a clipped iframe that cannot be edited on mobile.
            await page.goto(`/metahub/${encodeURIComponent(imported.metahubId)}/resources/packages/playcanvas-editor/editor`)
            await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
            const compactNotice =
                locale === 'en'
                    ? 'PlayCanvas Editor is available on larger screens. Open it on a desktop or tablet to edit this project.'
                    : 'PlayCanvas Editor доступен на более крупных экранах. Откройте его на компьютере или планшете, чтобы редактировать этот проект.'
            await expect(page.getByText(compactNotice)).toBeVisible({ timeout: 30_000 })
            await expect(page.locator(EDITOR_FRAME_SELECTOR)).toHaveCount(0)
            const backToPackagesLabel = locale === 'en' ? 'Back to packages' : 'Назад к пакетам'
            const backToPackagesLink = page.getByRole('link', { name: backToPackagesLabel })
            await expect(backToPackagesLink).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `${testInfo.project.name} PlayCanvas Editor ${viewport.name} fallback`)
            await expectNoTechnicalLeakage(page.locator('body'), {
                label: `${testInfo.project.name} PlayCanvas Editor ${viewport.name} fallback`,
                checkUuidSubstrings: true
            })
            await backToPackagesLink.focus()
            await expect(backToPackagesLink).toBeFocused()
            await expect(page).toHaveScreenshot(`playcanvas-editor-assets-${viewport.name}.png`, {
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
                maxDiffPixelRatio: 0.015
            })
            continue
        }
        if (viewport.name === 'desktop-1920') {
            await expectPlayCanvasEditorFullscreenHost(page)
        } else {
            await expectResponsiveEditorHost(page, `${testInfo.project.name} PlayCanvas Editor ${viewport.name}`)
        }
        await expectNoPageHorizontalOverflow(page, `${testInfo.project.name} PlayCanvas Editor ${viewport.name} host`)
        await expectPlayCanvasEditorFrameNoHorizontalOverflow(page, `${testInfo.project.name} PlayCanvas Editor ${viewport.name} frame`)
        await expect(assetsPanel).toBeVisible()
        await expect(addAssetButton).toBeEnabled()
        await expectNoVisibleTextPatterns(frameBody, [/\[object Object\]/], {
            label: `${testInfo.project.name} PlayCanvas Editor ${viewport.name} frame`
        })

        // Exercise the control through the browser's keyboard path as well as
        // the pointer path. This catches an iframe focus regression that a
        // screenshot alone would not expose.
        await addAssetButton.focus()
        await page.keyboard.press('Enter')
        const createMenu = editorFrame.locator('.pcui-menu:visible').last()
        await expect(createMenu, `${viewport.name} Add Asset menu must open from the keyboard`).toBeVisible()
        for (const assetType of CREATE_ASSET_LABELS) {
            await expect(
                createMenu
                    .locator('.pcui-menu-item')
                    .filter({ hasText: new RegExp(`^${assetType}$`) })
                    .last(),
                `${viewport.name} Add Asset menu must expose ${assetType}`
            ).toBeVisible()
        }
        await expectNoTechnicalLeakage(createMenu, {
            label: `${testInfo.project.name} ${viewport.name} PlayCanvas Editor Add Asset menu`,
            checkUuidSubstrings: true
        })
        await page.keyboard.press('Escape')
        await expect(createMenu).toBeHidden()

        await expect(assetsPanel).toHaveScreenshot(`playcanvas-editor-assets-panel-${viewport.name}.png`, {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: 0.015
        })

        if (viewport.name === 'desktop-1920') {
            const screenshot = await assetsPanel.screenshot({ animations: 'disabled' })
            const screenshotDimensions = assertNonBlankPng(screenshot, `${testInfo.project.name} PlayCanvas assets panel`)
            const screenshotName = `playcanvas-editor-assets-${testInfo.project.name}.png`
            await testInfo.attach(screenshotName, { body: screenshot, contentType: 'image/png' })
            await fs.writeFile(path.join(artifactDir, screenshotName), screenshot)
            await fs.writeFile(
                path.join(artifactDir, `playcanvas-editor-assets-${testInfo.project.name}.json`),
                `${JSON.stringify(
                    {
                        version: 1,
                        source: 'playwright-browser',
                        locale,
                        theme: isDarkMode ? 'dark' : 'light',
                        project: testInfo.project.name,
                        viewport: { width: viewport.width, height: viewport.height },
                        screenshot: screenshotName,
                        screenshotDimensions,
                        capturedAt: new Date().toISOString()
                    },
                    null,
                    2
                )}\n`,
                'utf8'
            )
        }
    }
})
