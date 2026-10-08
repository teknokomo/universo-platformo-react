import type { Browser, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createLoggedInBrowserContext, type UserCredentials } from './browser/auth'
import { applyBrowserPreferences } from './browser/preferences'
import { expectNoPageHorizontalOverflow, expectRuntimeUxViewportMatrix } from './browser/runtimeUx'
import {
    expectMmoommCameraClipEvidence,
    expectMmoommCameraControlsResponsive,
    expectMmoommCanvasContained,
    expectMmoommCanvasKeyboardFocus,
    expectMmoommCanvasPainted,
    expectMmoommCanvasToFillAvailableViewport,
    expectMmoommRuntimeControlAccessibleNames,
    expectMmoommRuntimeNoTechnicalLeakage,
    expectMmoommVisualLabCameraControlsResponsive,
    expectMmoommVisualLinkupCanvasFramed,
    expectMmoommVisualLinkupCanvasPainted,
    expectMmoommVisualLinkupDistinctMaterialEvidence,
    expectMmoommVisualLinkupVariantLegendUsable
} from './mmoommRuntimeProof.canvas'
import {
    MMOOMM_CANVAS_LABEL,
    MMOOMM_MOVE_TO_TARGET_BUTTON_NAME,
    MMOOMM_REALTIME_CONNECTED_STATUS_TEXT,
    MMOOMM_RESET_CAMERA_BUTTON_NAME,
    MMOOMM_ROTATE_LEFT_BUTTON_NAME,
    MMOOMM_ROTATE_RIGHT_BUTTON_NAME,
    MMOOMM_RUNTIME_EXPECT_TIMEOUT,
    MMOOMM_STOP_BUTTON_NAME,
    MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME,
    MMOOMM_WELCOME_BUTTON_NAME,
    MMOOMM_WELCOME_PAGE_BLOCK_TEXT_BY_LOCALE,
    MMOOMM_VISUAL_LAB_STATUS_TEXT,
    MMOOMM_ZOOM_IN_BUTTON_NAME,
    MMOOMM_ZOOM_OUT_BUTTON_NAME,
    expectMmoommOverviewTitle,
    expectMmoommGeneratedNavigation,
    getMmoommNavigation,
    getMmoommNavigationItem,
    openMmoommSpaceSection,
    openMmoommVisualLinkupLabSection
} from './mmoommRuntimeProof.navigation'

export interface MmoommRuntimeProofOptions {
    checkViewportMatrix?: boolean
    /**
     * Require a browser client runtime module in addition to the PlayCanvas
     * script-assets runtime. MMOOMM app snapshots intentionally use the
     * generic canvas widget with a server-only realtime module, so their
     * expected state is `not_required`.
     */
    expectClientRuntimeModule?: boolean
    label?: string
    locale?: 'en' | 'ru'
}

const expectMmoommRuntimeLocaleLabels = async (page: Page, widget: Locator, canvas: Locator, locale: 'en' | 'ru', label: string) => {
    const navigation = getMmoommNavigation(page)
    for (const name of ['Flight Ship', 'Flight Station']) {
        await expect(
            navigation.getByRole('link', { name, exact: true }),
            `${label} must keep ordinary Objects out of the generated primary navigation`
        ).toHaveCount(0)
    }
    if (locale === 'ru') {
        await expect(getMmoommNavigationItem(page, 'Добро пожаловать'), `${label} must expose the Russian welcome menu item`).toBeVisible()
        await expect(getMmoommNavigationItem(page, 'Космос'), `${label} must expose the Russian space menu item`).toBeVisible()
        await expect(canvas, `${label} canvas must expose a Russian accessible name`).toHaveAttribute(
            'aria-label',
            'Интерактивная 3D-сцена полёта'
        )
        for (const name of [
            'Лететь к цели',
            'Остановить',
            'Сбросить камеру',
            'Приблизить',
            'Отдалить',
            'Повернуть влево',
            'Повернуть вправо'
        ]) {
            await expect(widget.getByRole('button', { name }), `${label} must expose Russian control "${name}"`).toBeVisible()
        }
    } else {
        await expect(getMmoommNavigationItem(page, 'Welcome'), `${label} must expose the English welcome menu item`).toBeVisible()
        await expect(getMmoommNavigationItem(page, 'Space'), `${label} must expose the English space menu item`).toBeVisible()
    }
}

export const expectMmoommRuntimeReady = async (page: Page, applicationId: string, options: MmoommRuntimeProofOptions = {}) => {
    const label = options.label ?? 'MMOOMM app snapshot runtime'
    const locale = options.locale ?? 'en'
    await page.goto(`/a/${applicationId}`)
    await expectMmoommGeneratedNavigation(page, locale, label)
    await expectMmoommOverviewTitle(page, locale, label)
    const welcomeNavigationItem = getMmoommNavigationItem(page, MMOOMM_WELCOME_BUTTON_NAME)
    await expect(welcomeNavigationItem, `${label} must have one Welcome Page link`).toHaveCount(1)
    await expect(welcomeNavigationItem).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await welcomeNavigationItem.click()
    await page.waitForURL(
        (url) => url.searchParams.get('targetKind') === 'page' && url.searchParams.get('entityTypeCodename') === 'WelcomePage',
        { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
    )
    const welcomePageBlocks = page.getByTestId('runtime-page-blocks')
    const welcomePageHeading = welcomePageBlocks.getByRole('heading', {
        name: MMOOMM_WELCOME_PAGE_BLOCK_TEXT_BY_LOCALE[locale],
        exact: true
    })
    await expect(welcomePageHeading, `${label} must render the ${locale} welcome-page heading exactly once`).toHaveCount(1)
    await expect(welcomePageHeading).toBeVisible()
    await expect(page.getByTestId('playcanvas-canvas-widget')).toHaveCount(0)
    await openMmoommSpaceSection(page)

    const widget = page.getByTestId('playcanvas-canvas-widget')
    await expect(widget).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    const canvas = page.getByTestId('playcanvas-canvas')
    await expect(canvas).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(canvas).toHaveAttribute(
        'data-runtime-module-executed',
        options.expectClientRuntimeModule === false ? 'not_required' : 'true',
        { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
    )
    await expect(canvas).toHaveAttribute('data-realtime-status', /^(connected|restored)$/, { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    const realtimeStatus = await canvas.getAttribute('data-realtime-status')
    if (realtimeStatus !== 'connected' && realtimeStatus !== 'restored') {
        throw new Error(`${label} did not reach a connected MMOOMM realtime state`)
    }
    await expect(widget.getByTestId('playcanvas-realtime-status')).toHaveText(
        MMOOMM_REALTIME_CONNECTED_STATUS_TEXT[locale][realtimeStatus],
        { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
    )
    await expect(canvas).not.toHaveAttribute('data-realtime-status', 'version_mismatch')
    await expectMmoommCanvasPainted(page, canvas)
    await expectMmoommCanvasToFillAvailableViewport(page, canvas, label)
    await expectMmoommRuntimeControlAccessibleNames(widget, canvas, label)
    if (options.locale) {
        await expectMmoommRuntimeLocaleLabels(page, widget, canvas, options.locale, label)
    }
    await expectMmoommCameraClipEvidence(canvas, label)
    await widget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
    await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
    await widget.getByRole('button', { name: MMOOMM_STOP_BUTTON_NAME }).click()
    await expect(canvas).toHaveAttribute('data-last-intent-kind', 'stop', { timeout: 15_000 })
    await expectMmoommCameraControlsResponsive(page, widget, canvas, label)
    await expectMmoommCanvasKeyboardFocus(page, canvas, label)
    await expectMmoommCanvasContained(widget, canvas, label)
    await expectMmoommRuntimeNoTechnicalLeakage(widget, label)
    await expectNoPageHorizontalOverflow(page, label)

    if (options.checkViewportMatrix) {
        await expectRuntimeUxViewportMatrix(page, label, {
            beforeEachViewport: async () => {
                await expect(widget).toBeVisible()
                await expect(canvas).toBeVisible()
                await expectMmoommCanvasPainted(page, canvas)
                await expectMmoommCanvasToFillAvailableViewport(page, canvas, `${label} viewport matrix`)
                await expectMmoommCameraClipEvidence(canvas, `${label} viewport matrix`)
                await expectMmoommCanvasContained(widget, canvas, label)
            }
        })
    }

    return { widget, canvas }
}

export const expectMmoommVisualLinkupLabRuntimeReady = async (
    page: Page,
    applicationId: string,
    options: MmoommRuntimeProofOptions = {}
) => {
    const label = options.label ?? 'MMOOMM Visual Linkup Lab runtime'
    await page.goto(`/a/${applicationId}`)
    const locale = options.locale ?? 'en'
    await expectMmoommGeneratedNavigation(page, locale, label)
    await expect(getMmoommNavigationItem(page, MMOOMM_WELCOME_BUTTON_NAME)).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(getMmoommNavigationItem(page, MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME)).toBeVisible({
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(page.getByTestId('playcanvas-canvas-widget')).toHaveCount(0)
    await openMmoommVisualLinkupLabSection(page)

    const widget = page.getByTestId('playcanvas-canvas-widget')
    await expect(widget).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    const canvas = page.getByTestId('playcanvas-canvas')
    await expect(canvas).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(canvas).toHaveAttribute('data-runtime-scene-mode', 'visual_lab', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(canvas).toHaveAttribute('data-visual-lab-variant-count', '16')
    await expect
        .poll(async () => Number((await canvas.getAttribute('data-visual-lab-object-count')) ?? 0), {
            timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
        })
        .toBeGreaterThanOrEqual(64)
    await expect(widget.getByTestId('playcanvas-runtime-mode-status')).toHaveText(MMOOMM_VISUAL_LAB_STATUS_TEXT[locale])
    await expectMmoommVisualLinkupCanvasPainted(page, canvas)
    await expectMmoommVisualLinkupCanvasFramed(page, canvas, `${label} initial overview`)
    const variantEvidence = await expectMmoommVisualLinkupVariantLegendUsable(page, widget, canvas, label, options.locale ?? 'en')
    await expectMmoommVisualLinkupDistinctMaterialEvidence(canvas, label, variantEvidence)
    await expectMmoommCanvasToFillAvailableViewport(page, canvas, label)
    await expect(canvas, `${label} canvas must expose a localized accessible name`).toHaveAttribute('aria-label', MMOOMM_CANVAS_LABEL)
    await expect(widget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME })).toBeDisabled()
    await expect(widget.getByRole('button', { name: MMOOMM_STOP_BUTTON_NAME })).toBeDisabled()
    await expect(widget.getByRole('button', { name: MMOOMM_RESET_CAMERA_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ZOOM_IN_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ZOOM_OUT_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ROTATE_LEFT_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ROTATE_RIGHT_BUTTON_NAME })).toBeVisible()
    await expectMmoommVisualLabCameraControlsResponsive(page, widget, canvas, label)
    await expectMmoommCanvasKeyboardFocus(page, canvas, label)
    await expectMmoommCanvasContained(widget, canvas, label)
    await expectMmoommRuntimeNoTechnicalLeakage(widget, label)
    await expectNoPageHorizontalOverflow(page, label)

    if (options.checkViewportMatrix) {
        await expectRuntimeUxViewportMatrix(page, label, {
            beforeEachViewport: async () => {
                await expect(widget).toBeVisible()
                await expect(canvas).toBeVisible()
                await expectMmoommVisualLinkupCanvasPainted(page, canvas)
                await expectMmoommVisualLinkupCanvasFramed(page, canvas, `${label} viewport matrix`)
                await expectMmoommCanvasToFillAvailableViewport(page, canvas, `${label} viewport matrix`)
                await expectMmoommCanvasContained(widget, canvas, label)
            }
        })
    }

    return { widget, canvas }
}

export const expectMmoommConnectedRuntimeLocale = async (
    browser: Browser,
    credentials: UserCredentials,
    applicationId: string,
    locale: 'en' | 'ru',
    options: Pick<MmoommRuntimeProofOptions, 'expectClientRuntimeModule'> = {}
) => {
    const session = await createLoggedInBrowserContext(browser, credentials)
    try {
        await applyBrowserPreferences(session.page, { language: locale })
        await expectMmoommRuntimeReady(session.page, applicationId, {
            label: `MMOOMM connected runtime ${locale}`,
            locale,
            expectClientRuntimeModule: options.expectClientRuntimeModule ?? false
        })
    } finally {
        await session.context.close()
    }
}

export const expectMmoommUnauthorizedRuntime = async (
    browser: Browser,
    credentials: UserCredentials,
    applicationId: string,
    options: { locale?: 'en' | 'ru' } = {}
) => {
    const session = await createLoggedInBrowserContext(browser, credentials)
    try {
        const page = session.page
        if (options.locale) {
            await applyBrowserPreferences(page, { language: options.locale })
        }
        await page.route('**/matchmake/joinOrCreate/fixed_tick_scene', async (route) => {
            await route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'forbidden' })
            })
        })
        await page.goto(`/a/${applicationId}`)
        await openMmoommSpaceSection(page)
        const widget = page.getByTestId('playcanvas-canvas-widget')
        const canvas = page.getByTestId('playcanvas-canvas')
        await expect(canvas).toHaveAttribute('data-realtime-status', 'unauthorized', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        if (options.locale === 'ru') {
            await expect(
                widget.getByText('Управление в реальном времени недоступно для вашей учётной записи.', { exact: true })
            ).toBeVisible()
        } else {
            await expect(widget.getByText(/realtime control is not available for your account/i)).toBeVisible()
        }
        const moveButtonName = options.locale === 'ru' ? /лететь к цели/i : MMOOMM_MOVE_TO_TARGET_BUTTON_NAME
        const stopButtonName = options.locale === 'ru' ? /остановить/i : MMOOMM_STOP_BUTTON_NAME
        await expect(widget.getByRole('button', { name: moveButtonName })).toBeDisabled()
        await expect(widget.getByRole('button', { name: stopButtonName })).toBeDisabled()
        await expectMmoommRuntimeNoTechnicalLeakage(widget, 'MMOOMM unauthorized runtime widget')
        await expectMmoommCanvasContained(widget, canvas, 'MMOOMM unauthorized runtime')
        await expectNoPageHorizontalOverflow(page, 'MMOOMM unauthorized runtime')
    } finally {
        await session.context.close()
    }
}
