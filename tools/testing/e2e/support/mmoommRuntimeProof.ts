import type { Browser, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { PNG } from 'pngjs'
import { createLoggedInApiContext, disposeApiContext } from './backend/api-session.mjs'
import { createLoggedInBrowserContext, type UserCredentials } from './browser/auth'
import { applyBrowserPreferences } from './browser/preferences'
import {
    expectLocatorFullyFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix
} from './browser/runtimeUx'
import { loadE2eEnvironment } from './env/load-e2e-env.mjs'

export const MMOOMM_RUNTIME_EXPECT_TIMEOUT = 60_000
export const MMOOMM_RECONNECT_TIMEOUT = 45_000
const MMOOMM_WELCOME_BUTTON_NAME = /^(Welcome|Добро пожаловать)$/i
const MMOOMM_WELCOME_TEXT = /(Welcome to Universo MMOOMM|Добро пожаловать)/i
const MMOOMM_REALTIME_CONNECTED_TEXT = /Realtime (connected|restored|подключён|восстановлен)/i
const MMOOMM_MOVE_TO_TARGET_BUTTON_NAME = /^(Move to target|Лететь к цели)$/i
const MMOOMM_STOP_BUTTON_NAME = /^(Stop|Остановить)$/i
const MMOOMM_RESET_CAMERA_BUTTON_NAME = /^(Reset camera|Сбросить камеру)$/i
const MMOOMM_ZOOM_IN_BUTTON_NAME = /^(Zoom in|Приблизить)$/i
const MMOOMM_ZOOM_OUT_BUTTON_NAME = /^(Zoom out|Отдалить)$/i
const MMOOMM_ROTATE_LEFT_BUTTON_NAME = /^(Rotate left|Повернуть влево)$/i
const MMOOMM_ROTATE_RIGHT_BUTTON_NAME = /^(Rotate right|Повернуть вправо)$/i
const MMOOMM_CANVAS_LABEL = /^(Interactive 3D flight scene|Интерактивная 3D-сцена полёта)$/i
const MMOOMM_RUNTIME_FORBIDDEN_VISIBLE_TEXT = [
    /\b(?:roomId|playerId|sessionId|projectId|sceneId|shipId|clientBundle|sourceCode|serverBundle|moduleRole|attachedToId)\b/i,
    /\b(?:matchmake|joinOrCreate|fixed_tick_scene|colyseus|websocket|schemaType)\b/i
]

export const openMmoommSpaceSection = async (page: Page) => {
    const existingWidget = page.getByTestId('playcanvas-canvas-widget')
    if (await existingWidget.isVisible().catch(() => false)) {
        return
    }
    const spaceButton = page.getByRole('button', { name: /^(Space|Космос)$/ })
    await expect(spaceButton).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await spaceButton.click()
}

const readCanvasColorEvidence = async (canvas: Locator) =>
    canvas.screenshot().then((buffer) => {
        const image = PNG.sync.read(buffer)
        const buckets = new Set<string>()
        let opaquePixels = 0
        const stepX = Math.max(1, Math.floor(image.width / 24))
        const stepY = Math.max(1, Math.floor(image.height / 24))

        for (let y = 0; y < image.height; y += stepY) {
            for (let x = 0; x < image.width; x += stepX) {
                const offset = (image.width * y + x) * 4
                const alpha = image.data[offset + 3] ?? 0
                if (alpha < 20) continue
                opaquePixels += 1
                buckets.add(`${image.data[offset] >> 4}:${image.data[offset + 1] >> 4}:${image.data[offset + 2] >> 4}`)
            }
        }

        return { width: image.width, height: image.height, opaquePixels, colorBuckets: buckets.size }
    })

export const expectMmoommCanvasPainted = async (canvas: Locator) => {
    const box = await canvas.boundingBox()
    expect(box?.width ?? 0, 'MMOOMM app canvas must have visible width').toBeGreaterThan(320)
    expect(box?.height ?? 0, 'MMOOMM app canvas must have visible height').toBeGreaterThan(240)
    await expect
        .poll(
            async () => {
                const evidence = await readCanvasColorEvidence(canvas)
                return evidence.opaquePixels > 20 && evidence.colorBuckets > 1
            },
            { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
        )
        .toBe(true)
    const evidence = await readCanvasColorEvidence(canvas)
    expect(evidence.opaquePixels, 'MMOOMM app canvas must contain painted pixels').toBeGreaterThan(20)
    expect(evidence.colorBuckets, 'MMOOMM app canvas must contain varied colors').toBeGreaterThan(1)
}

const expectMmoommCanvasPlayableHeight = async (page: Page, canvas: Locator, label: string) => {
    const [box, viewport] = await Promise.all([canvas.boundingBox(), page.viewportSize()])
    if (!box || !viewport) {
        throw new Error(`${label} canvas metrics are not available`)
    }

    const minimumHeightRatio = viewport.width < 600 ? 0.5 : 0.72
    expect(box.height, `${label} canvas must preserve a large playable area`).toBeGreaterThan(viewport.height * minimumHeightRatio)
}

const expectMmoommRuntimeNoTechnicalLeakage = async (widget: Locator, label: string) => {
    await expect(widget).not.toContainText(/clientBundle|sourceCode|serverBundle|moduleRole|attachedToId/)
    await expectNoTechnicalLeakage(widget, {
        label,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: MMOOMM_RUNTIME_FORBIDDEN_VISIBLE_TEXT
    })
}

const expectMmoommCanvasContained = async (widget: Locator, canvas: Locator, label: string) => {
    await expect
        .poll(
            async () => {
                const [box, viewport] = await Promise.all([
                    canvas.boundingBox(),
                    canvas.evaluate(() => ({
                        width: window.visualViewport?.width ?? window.innerWidth,
                        height: window.visualViewport?.height ?? window.innerHeight
                    }))
                ])
                return Boolean(
                    box &&
                        viewport &&
                        box.x >= -1 &&
                        box.y >= -1 &&
                        box.x + box.width <= viewport.width + 1 &&
                        box.y + box.height <= viewport.height + 1
                )
            },
            { timeout: 10_000 }
        )
        .toBe(true)
    await expectLocatorFullyFitsViewport(canvas, `${label} canvas`)
    const [widgetBox, canvasBox] = await Promise.all([widget.boundingBox(), canvas.boundingBox()])
    expect(widgetBox, `${label} widget must be rendered`).not.toBeNull()
    expect(canvasBox, `${label} canvas must be rendered`).not.toBeNull()
    if (!widgetBox || !canvasBox) return

    expect(canvasBox.x, `${label} canvas must start inside the widget`).toBeGreaterThanOrEqual(widgetBox.x - 1)
    expect(canvasBox.x + canvasBox.width, `${label} canvas must fit inside the widget`).toBeLessThanOrEqual(
        widgetBox.x + widgetBox.width + 1
    )
    expect(canvasBox.y, `${label} canvas must start inside the widget vertically`).toBeGreaterThanOrEqual(widgetBox.y - 1)
}

const expectMmoommCanvasKeyboardFocus = async (page: Page, canvas: Locator, label: string) => {
    await canvas.click({ position: { x: 16, y: 16 } })
    await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''), { timeout: 5_000 })
        .toBe('playcanvas-canvas')
    await page.keyboard.press('Tab')
    await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''), { timeout: 5_000 })
        .not.toBe('playcanvas-canvas')
    await expect(canvas, `${label} canvas must remain visible after keyboard focus leaves it`).toBeVisible()
}

const expectMmoommRuntimeControlAccessibleNames = async (widget: Locator, canvas: Locator, label: string) => {
    await expect(canvas, `${label} canvas must expose a localized accessible name`).toHaveAttribute('aria-label', MMOOMM_CANVAS_LABEL)
    await expect(widget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_STOP_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_RESET_CAMERA_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ZOOM_IN_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ZOOM_OUT_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ROTATE_LEFT_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ROTATE_RIGHT_BUTTON_NAME })).toBeVisible()
}

const expectMmoommCameraControlsResponsive = async (page: Page, widget: Locator, canvas: Locator, label: string) => {
    const cameraDistance = await readCanvasNumberDataset(canvas, 'cameraDistance')
    const cameraYaw = await readCanvasNumberDataset(canvas, 'cameraYaw')
    const cameraPitch = await readCanvasNumberDataset(canvas, 'cameraPitch')
    expect(cameraDistance, `${label} camera distance evidence must be present`).not.toBeNull()
    expect(cameraYaw, `${label} camera yaw evidence must be present`).not.toBeNull()
    expect(cameraPitch, `${label} camera pitch evidence must be present`).not.toBeNull()

    await widget.getByRole('button', { name: MMOOMM_ZOOM_IN_BUTTON_NAME }).click()
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'cameraDistance')) ?? Number.POSITIVE_INFINITY, { timeout: 10_000 })
        .toBeLessThan(cameraDistance ?? Number.POSITIVE_INFINITY)

    const yawBeforeRotate = await readCanvasNumberDataset(canvas, 'cameraYaw')
    await widget.getByRole('button', { name: MMOOMM_ROTATE_RIGHT_BUTTON_NAME }).click()
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'cameraYaw')) ?? Number.NEGATIVE_INFINITY, { timeout: 10_000 })
        .toBeGreaterThan(yawBeforeRotate ?? Number.NEGATIVE_INFINITY)
    const yawAfterRotateRight = await readCanvasNumberDataset(canvas, 'cameraYaw')
    await widget.getByRole('button', { name: MMOOMM_ROTATE_LEFT_BUTTON_NAME }).click()
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'cameraYaw')) ?? Number.POSITIVE_INFINITY, { timeout: 10_000 })
        .toBeLessThan(yawAfterRotateRight ?? Number.POSITIVE_INFINITY)

    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) {
        throw new Error(`${label} canvas box is not available for drag proof`)
    }
    const stationScreenYBeforeVerticalDrag = await readCanvasNumberDataset(canvas, 'stationScreenY')
    expect(stationScreenYBeforeVerticalDrag, `${label} station screen y evidence must be present before vertical drag`).not.toBeNull()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.82, { steps: 8 })
    await expect(canvas).toHaveAttribute('data-pointer-captured', 'true')
    await page.mouse.up()
    await expect(canvas).toHaveAttribute('data-pointer-captured', 'false')
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'stationScreenY')) ?? Number.NEGATIVE_INFINITY, {
            timeout: 10_000
        })
        .toBeGreaterThan((stationScreenYBeforeVerticalDrag ?? 0) + canvasBox.height * 0.02)
    await widget.getByRole('button', { name: MMOOMM_RESET_CAMERA_BUTTON_NAME }).click()
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'cameraPitch')) ?? Number.NEGATIVE_INFINITY, {
            timeout: 10_000
        })
        .toBeGreaterThan(-0.1)
    await expectMmoommCameraClipEvidence(canvas, `${label} after camera reset`)

    const stationScreenXBeforeHorizontalDrag = await readCanvasNumberDataset(canvas, 'stationScreenX')
    expect(stationScreenXBeforeHorizontalDrag, `${label} station screen x evidence must be present before horizontal drag`).not.toBeNull()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.5, { steps: 8 })
    await expect(canvas).toHaveAttribute('data-pointer-captured', 'true')
    await page.mouse.up()
    await expect(canvas).toHaveAttribute('data-pointer-captured', 'false')
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'stationScreenX')) ?? Number.POSITIVE_INFINITY, {
            timeout: 10_000
        })
        .toBeLessThan((stationScreenXBeforeHorizontalDrag ?? 0) - canvasBox.width * 0.02)
    await widget.getByRole('button', { name: MMOOMM_RESET_CAMERA_BUTTON_NAME }).click()
    await expectMmoommCameraClipEvidence(canvas, `${label} after horizontal camera drag reset`)

    const stationScreenXBeforeReverseHorizontalDrag = await readCanvasNumberDataset(canvas, 'stationScreenX')
    expect(
        stationScreenXBeforeReverseHorizontalDrag,
        `${label} station screen x evidence must be present before reverse horizontal drag`
    ).not.toBeNull()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.5, { steps: 8 })
    await expect(canvas).toHaveAttribute('data-pointer-captured', 'true')
    await page.mouse.up()
    await expect(canvas).toHaveAttribute('data-pointer-captured', 'false')
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'stationScreenX')) ?? Number.NEGATIVE_INFINITY, {
            timeout: 10_000
        })
        .toBeGreaterThan((stationScreenXBeforeReverseHorizontalDrag ?? 0) + canvasBox.width * 0.02)
    await widget.getByRole('button', { name: MMOOMM_RESET_CAMERA_BUTTON_NAME }).click()
    await expectMmoommCameraClipEvidence(canvas, `${label} after reverse horizontal camera drag reset`)
}

const expectMmoommCameraClipEvidence = async (canvas: Locator, label: string) => {
    const [shipX, shipY, noseX, noseY, stationX, stationY, cameraGuardClearance] = await Promise.all([
        readCanvasNumberDataset(canvas, 'shipScreenX'),
        readCanvasNumberDataset(canvas, 'shipScreenY'),
        readCanvasNumberDataset(canvas, 'shipNoseScreenX'),
        readCanvasNumberDataset(canvas, 'shipNoseScreenY'),
        readCanvasNumberDataset(canvas, 'stationScreenX'),
        readCanvasNumberDataset(canvas, 'stationScreenY'),
        readCanvasNumberDataset(canvas, 'cameraGuardClearance')
    ])
    const values = [shipX, shipY, noseX, noseY, stationX, stationY]
    expect(
        values.every((value) => value !== null),
        `${label} must expose finite camera projection evidence`
    ).toBe(true)
    if (values.some((value) => value === null)) {
        return
    }

    const box = await canvas.boundingBox()
    if (!box) {
        throw new Error(`${label} canvas box is not available for camera projection proof`)
    }
    for (const [name, x, y] of [
        ['ship', shipX, shipY],
        ['ship nose', noseX, noseY],
        ['station', stationX, stationY]
    ] as const) {
        expect(x, `${label} ${name} projection must stay inside the canvas horizontally`).toBeGreaterThanOrEqual(-box.width * 0.05)
        expect(x, `${label} ${name} projection must stay inside the canvas horizontally`).toBeLessThanOrEqual(box.width * 1.05)
        expect(y, `${label} ${name} projection must stay inside the canvas vertically`).toBeGreaterThanOrEqual(-box.height * 0.05)
        expect(y, `${label} ${name} projection must stay inside the canvas vertically`).toBeLessThanOrEqual(box.height * 1.05)
    }
    expect(cameraGuardClearance, `${label} camera must stay outside guarded station geometry`).not.toBeNull()
    expect(cameraGuardClearance ?? -1, `${label} camera must stay outside guarded station geometry`).toBeGreaterThanOrEqual(0)
}

export interface MmoommRuntimeProofOptions {
    checkViewportMatrix?: boolean
    label?: string
    locale?: 'en' | 'ru'
}

const expectMmoommRuntimeLocaleLabels = async (page: Page, widget: Locator, canvas: Locator, locale: 'en' | 'ru', label: string) => {
    if (locale === 'ru') {
        await expect(
            page.getByRole('button', { name: 'Добро пожаловать' }),
            `${label} must expose the Russian welcome menu item`
        ).toBeVisible()
        await expect(page.getByRole('button', { name: 'Космос' }), `${label} must expose the Russian space menu item`).toBeVisible()
        await expect(widget.getByTestId('playcanvas-realtime-status'), `${label} must expose Russian connected state`).toContainText(
            /Realtime (подключён|восстановлен)/
        )
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
        await expect(page.getByRole('button', { name: 'Welcome' }), `${label} must expose the English welcome menu item`).toBeVisible()
        await expect(page.getByRole('button', { name: 'Space' }), `${label} must expose the English space menu item`).toBeVisible()
    }
}

export const expectMmoommRuntimeReady = async (page: Page, applicationId: string, options: MmoommRuntimeProofOptions = {}) => {
    const label = options.label ?? 'MMOOMM app snapshot runtime'
    await page.goto(`/a/${applicationId}`)
    await expect(page.getByRole('button', { name: MMOOMM_WELCOME_BUTTON_NAME })).toBeVisible({
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(page.getByRole('heading', { name: MMOOMM_WELCOME_TEXT })).toBeVisible()
    await expect(page.getByTestId('playcanvas-canvas-widget')).toHaveCount(0)
    await openMmoommSpaceSection(page)

    const widget = page.getByTestId('playcanvas-canvas-widget')
    await expect(widget).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    const canvas = page.getByTestId('playcanvas-canvas')
    await expect(canvas).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(canvas).toHaveAttribute('data-runtime-module-executed', 'true', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(widget.getByTestId('playcanvas-realtime-status')).toContainText(MMOOMM_REALTIME_CONNECTED_TEXT, {
        timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT
    })
    await expect(canvas).toHaveAttribute('data-realtime-status', /connected|restored/, { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(canvas).not.toHaveAttribute('data-realtime-status', 'version_mismatch')
    await expectMmoommCanvasPainted(canvas)
    await expectMmoommCanvasPlayableHeight(page, canvas, label)
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
                await expectMmoommCanvasPainted(canvas)
                await expectMmoommCanvasPlayableHeight(page, canvas, `${label} viewport matrix`)
                await expectMmoommCameraClipEvidence(canvas, `${label} viewport matrix`)
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
    locale: 'en' | 'ru'
) => {
    const session = await createLoggedInBrowserContext(browser, credentials)
    try {
        await applyBrowserPreferences(session.page, { language: locale })
        await expectMmoommRuntimeReady(session.page, applicationId, {
            label: `MMOOMM connected runtime ${locale}`,
            locale
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
            await expect(widget.getByText(/Realtime-управление недоступно для вашей учётной записи/i)).toBeVisible()
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

const readCanvasNumberDataset = async (canvas: Locator, key: string): Promise<number | null> => {
    const value = await canvas.evaluate((element, datasetKey) => {
        const canvasElement = element as HTMLCanvasElement
        return canvasElement.dataset[datasetKey] ?? null
    }, key)
    if (value === null) {
        return null
    }
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
}

const readCanvasVectorDataset = async (
    canvas: Locator,
    prefix: 'remoteShip' | 'remoteRenderedShip'
): Promise<{ x: number; y: number; z: number } | null> => {
    const [x, y, z] = await Promise.all([
        readCanvasNumberDataset(canvas, `${prefix}X`),
        readCanvasNumberDataset(canvas, `${prefix}Y`),
        readCanvasNumberDataset(canvas, `${prefix}Z`)
    ])
    return x === null || y === null || z === null ? null : { x, y, z }
}

const vectorDistance = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)

export const expectMmoommSecondClientAndReconnect = async (
    browser: Browser,
    credentials: UserCredentials,
    primaryPage: Page,
    primaryCanvas: Locator,
    primaryWidget: Locator,
    applicationId: string
) => {
    const secondSession = await createLoggedInBrowserContext(browser, credentials)
    try {
        const secondPage = secondSession.page
        await secondPage.goto(`/a/${applicationId}`)
        await openMmoommSpaceSection(secondPage)
        const secondWidget = secondPage.getByTestId('playcanvas-canvas-widget')
        const secondCanvas = secondPage.getByTestId('playcanvas-canvas')
        await expect(secondCanvas).toHaveAttribute('data-realtime-status', 'connected', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(secondCanvas).toHaveAttribute('data-local-ship-id-assigned', 'true', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(secondCanvas).toHaveAttribute('data-ship-count', '2', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(secondCanvas).toHaveAttribute('data-remote-ship-count', '1', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(primaryCanvas).toHaveAttribute('data-ship-count', '2', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(primaryCanvas).toHaveAttribute('data-remote-ship-count', '1', { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        await expect(primaryWidget.getByTestId('playcanvas-participants-status')).toContainText(/ships:\s*2/i)
        await expect(secondWidget.getByTestId('playcanvas-participants-status')).toContainText(/ships:\s*2/i)
        await expectMmoommRuntimeNoTechnicalLeakage(secondWidget, 'MMOOMM second client widget')
        await expectNoPageHorizontalOverflow(secondPage, 'MMOOMM second client runtime')

        const remoteBefore = await readCanvasVectorDataset(secondCanvas, 'remoteShip')
        const renderedRemoteBefore = await readCanvasVectorDataset(secondCanvas, 'remoteRenderedShip')
        await primaryWidget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
        await expect(primaryCanvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
        await expect
            .poll(
                async () => {
                    const nextRemote = await readCanvasVectorDataset(secondCanvas, 'remoteShip')
                    if (!remoteBefore || !nextRemote) {
                        return false
                    }
                    return vectorDistance(remoteBefore, nextRemote) > 0.5
                },
                { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
            )
            .toBe(true)
        if (renderedRemoteBefore) {
            await expect
                .poll(
                    async () => {
                        const nextRenderedRemote = await readCanvasVectorDataset(secondCanvas, 'remoteRenderedShip')
                        return nextRenderedRemote ? vectorDistance(renderedRemoteBefore, nextRenderedRemote) > 0.5 : false
                    },
                    { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
                )
                .toBe(true)
        }

        await primaryPage.context().setOffline(true)
        await expect(primaryCanvas).toHaveAttribute('data-realtime-status', 'reconnecting', { timeout: 15_000 })
        await expect(primaryWidget.getByTestId('playcanvas-realtime-status')).toContainText(/reconnecting/i)
        await primaryPage.context().setOffline(false)
        await expect
            .poll(async () => (await primaryCanvas.getAttribute('data-realtime-status')) ?? '', { timeout: MMOOMM_RECONNECT_TIMEOUT })
            .toMatch(/^(restored|connected)$/)
        await expect(primaryCanvas).toHaveAttribute('data-reconnect-restored', 'true')
        await expect(primaryCanvas).toHaveAttribute('data-ship-count', '2', { timeout: 30_000 })
        await expect(primaryCanvas).toHaveAttribute('data-remote-ship-count', '1', { timeout: 30_000 })
        await expectNoPageHorizontalOverflow(primaryPage, 'MMOOMM runtime after reconnect')

        await primaryWidget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME }).click()
        await primaryPage.context().setOffline(true)
        await expect(primaryCanvas).toHaveAttribute('data-realtime-status', 'failed_reconnect', { timeout: MMOOMM_RECONNECT_TIMEOUT })
        await expect(primaryWidget.getByText(/realtime control could not reconnect/i)).toBeVisible()
        await expect(primaryWidget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME })).toBeDisabled()
        await expect(primaryWidget.getByRole('button', { name: MMOOMM_STOP_BUTTON_NAME })).toBeDisabled()
        await expectMmoommRuntimeNoTechnicalLeakage(primaryWidget, 'MMOOMM failed reconnect runtime widget')
        await expectMmoommCanvasContained(primaryWidget, primaryCanvas, 'MMOOMM failed reconnect runtime')
        await expectNoPageHorizontalOverflow(primaryPage, 'MMOOMM runtime after failed reconnect')
    } finally {
        await primaryPage
            .context()
            .setOffline(false)
            .catch(() => undefined)
        await secondSession.context.close()
    }
}

export const expectMmoommAuthenticatedNonMemberMatchmakeRejected = async (credentials: UserCredentials, applicationId: string) => {
    const api = await createLoggedInApiContext(credentials)
    try {
        const env = loadE2eEnvironment()
        const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ')
        const response = await fetch(new URL('/matchmake/joinOrCreate/fixed_tick_scene', env.baseURL), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {})
            },
            body: JSON.stringify({
                accessMode: 'member',
                applicationId,
                targetObjects: { station: { x: 999, y: 0, z: 999 } },
                cruiseSpeed: 999
            })
        })
        expect([401, 403, 419]).toContain(response.status)
    } finally {
        await disposeApiContext(api)
    }
}

export const expectMmoommUnauthenticatedMatchmakeRejected = async (applicationId: string) => {
    const env = loadE2eEnvironment()
    const response = await fetch(new URL('/matchmake/joinOrCreate/fixed_tick_scene', env.baseURL), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accessMode: 'member',
            applicationId,
            targetObjects: { station: { x: 999, y: 0, z: 999 } },
            cruiseSpeed: 999
        })
    })
    expect([400, 401, 403, 419]).toContain(response.status)
}
