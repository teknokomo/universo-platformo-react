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
const MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME = /^(Visual Linkup Lab|Визуальная лаборатория)$/i
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
const VISUAL_LINKUP_VARIANT_PROOFS = [
    { slug: 'white-link-halo', family: 'softWhiteLinkup', capturePixelEvidence: true },
    { slug: 'mist-core', family: 'softWhiteLinkup' },
    { slug: 'soft-station-read', family: 'softWhiteLinkup' },
    { slug: 'near-white-core', family: 'softWhiteLinkup' },
    { slug: 'cyan-magenta', family: 'typeGlow', capturePixelEvidence: true },
    { slug: 'amber-ice', family: 'typeGlow' },
    { slug: 'classification-minimal', family: 'typeGlow' },
    { slug: 'classification-strong', family: 'typeGlow' },
    { slug: 'lowpoly-clean', family: 'lowPolyRetrowave' },
    { slug: 'lowpoly-radar', family: 'lowPolyRetrowave', capturePixelEvidence: true },
    { slug: 'retrowave-soft', family: 'lowPolyRetrowave' },
    { slug: 'retrowave-aggressive', family: 'lowPolyRetrowave' },
    { slug: 'linkup-boot', family: 'channelDegradation' },
    { slug: 'sensor-dropout', family: 'channelDegradation', capturePixelEvidence: true },
    { slug: 'dense-fog-relay', family: 'channelDegradation' },
    { slug: 'near-whiteout', family: 'channelDegradation' }
] as const

export const openMmoommSpaceSection = async (page: Page) => {
    const existingSpaceRuntimeStatus = page.getByTestId('playcanvas-realtime-status')
    if (await existingSpaceRuntimeStatus.isVisible().catch(() => false)) {
        return
    }
    const spaceButton = page.getByRole('button', { name: /^(Space|Космос)$/ })
    await expect(spaceButton).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await spaceButton.click()
}

export const openMmoommVisualLinkupLabSection = async (page: Page) => {
    const labButton = page.getByRole('button', { name: MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME })
    await expect(labButton).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await labButton.click()
}

type CanvasColorEvidence = {
    width: number
    height: number
    opaquePixels: number
    darkPixels: number
    brightPixels: number
    cyanPixels: number
    magentaPixels: number
    amberPixels: number
    foregroundPixels: number
    foregroundRatio: number
    foregroundBounds: { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null
    meanRgb: { r: number; g: number; b: number }
    colorBuckets: number
    foregroundBuckets: number
}

const readCanvasColorEvidence = async (page: Page, canvas: Locator): Promise<CanvasColorEvidence> => {
    const box = await canvas.boundingBox()
    if (!box) {
        throw new Error('MMOOMM canvas screenshot evidence requires a visible canvas bounding box')
    }
    const buffer = await page.screenshot({
        clip: {
            x: box.x,
            y: box.y,
            width: Math.max(1, box.width),
            height: Math.max(1, box.height)
        }
    })
    return Promise.resolve(buffer).then((buffer) => {
        const image = PNG.sync.read(buffer)
        const buckets = new Set<string>()
        const foregroundBuckets = new Set<string>()
        let opaquePixels = 0
        let darkPixels = 0
        let brightPixels = 0
        let cyanPixels = 0
        let magentaPixels = 0
        let amberPixels = 0
        let foregroundPixels = 0
        let foregroundRed = 0
        let foregroundGreen = 0
        let foregroundBlue = 0
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        const stepX = Math.max(1, Math.floor(image.width / 96))
        const stepY = Math.max(1, Math.floor(image.height / 96))

        for (let y = 0; y < image.height; y += stepY) {
            for (let x = 0; x < image.width; x += stepX) {
                const offset = (image.width * y + x) * 4
                const alpha = image.data[offset + 3] ?? 0
                if (alpha < 20) continue
                const red = image.data[offset] ?? 0
                const green = image.data[offset + 1] ?? 0
                const blue = image.data[offset + 2] ?? 0
                const max = Math.max(red, green, blue)
                const min = Math.min(red, green, blue)
                const brightness = (red + green + blue) / 3
                const saturation = max === 0 ? 0 : (max - min) / max
                opaquePixels += 1
                buckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`)
                if (red < 38 && green < 44 && blue < 58) darkPixels += 1
                if (red > 145 && green > 145 && blue > 145) brightPixels += 1
                if (green > 95 && blue > 120 && blue > red * 1.35) cyanPixels += 1
                if (red > 120 && blue > 120 && red > green * 1.35) magentaPixels += 1
                if (red > 130 && green > 70 && blue < 75) amberPixels += 1
                if (brightness > 55 || saturation > 0.22 || red > 110 || green > 110 || blue > 110) {
                    foregroundPixels += 1
                    foregroundRed += red
                    foregroundGreen += green
                    foregroundBlue += blue
                    foregroundBuckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`)
                    minX = Math.min(minX, x)
                    minY = Math.min(minY, y)
                    maxX = Math.max(maxX, x)
                    maxY = Math.max(maxY, y)
                }
            }
        }

        const foregroundBounds =
            foregroundPixels > 0
                ? {
                      minX,
                      minY,
                      maxX,
                      maxY,
                      centerX: (minX + maxX) / 2,
                      centerY: (minY + maxY) / 2
                  }
                : null
        return {
            width: image.width,
            height: image.height,
            opaquePixels,
            darkPixels,
            brightPixels,
            cyanPixels,
            magentaPixels,
            amberPixels,
            foregroundPixels,
            foregroundRatio: opaquePixels > 0 ? foregroundPixels / opaquePixels : 0,
            foregroundBounds,
            meanRgb:
                foregroundPixels > 0
                    ? {
                          r: foregroundRed / foregroundPixels,
                          g: foregroundGreen / foregroundPixels,
                          b: foregroundBlue / foregroundPixels
                      }
                    : { r: 0, g: 0, b: 0 },
            colorBuckets: buckets.size,
            foregroundBuckets: foregroundBuckets.size
        }
    })
}

export const expectMmoommCanvasPainted = async (page: Page, canvas: Locator) => {
    const box = await canvas.boundingBox()
    expect(box?.width ?? 0, 'MMOOMM app canvas must have visible width').toBeGreaterThan(320)
    expect(box?.height ?? 0, 'MMOOMM app canvas must have visible height').toBeGreaterThan(240)
    await expect
        .poll(
            async () => {
                const evidence = await readCanvasColorEvidence(page, canvas)
                return evidence.opaquePixels > 20 && evidence.colorBuckets > 1
            },
            { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
        )
        .toBe(true)
    const evidence = await readCanvasColorEvidence(page, canvas)
    expect(evidence.opaquePixels, 'MMOOMM app canvas must contain painted pixels').toBeGreaterThan(20)
    expect(evidence.colorBuckets, 'MMOOMM app canvas must contain varied colors').toBeGreaterThan(1)
}

const expectMmoommVisualLinkupCanvasPainted = async (page: Page, canvas: Locator) => {
    await expectMmoommCanvasPainted(page, canvas)
    await expect
        .poll(
            async () => {
                const evidence = await readCanvasColorEvidence(page, canvas)
                return (
                    evidence.darkPixels > evidence.opaquePixels * 0.35 &&
                    evidence.brightPixels > 8 &&
                    evidence.colorBuckets > 4 &&
                    evidence.foregroundBuckets > 3
                )
            },
            { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
        )
        .toBe(true)
    const evidence = await readCanvasColorEvidence(page, canvas)
    expect(evidence.darkPixels, 'MMOOMM visual lab canvas must preserve a dark space background').toBeGreaterThan(
        evidence.opaquePixels * 0.35
    )
    expect(evidence.brightPixels, 'MMOOMM visual lab canvas must include white translucent objects').toBeGreaterThan(8)
    expect(evidence.foregroundBuckets, 'MMOOMM visual lab canvas must include visible material variation').toBeGreaterThan(3)
}

const formatCanvasFramingEvidence = (evidence: CanvasColorEvidence, selectedVariant: string | null): string => {
    const bounds = evidence.foregroundBounds
    return JSON.stringify({
        selectedVariant,
        width: evidence.width,
        height: evidence.height,
        foregroundRatio: Number(evidence.foregroundRatio.toFixed(4)),
        foregroundBuckets: evidence.foregroundBuckets,
        foregroundWidth: bounds ? bounds.maxX - bounds.minX : null,
        foregroundHeight: bounds ? bounds.maxY - bounds.minY : null,
        foregroundCenterX: bounds ? Number(bounds.centerX.toFixed(1)) : null,
        foregroundCenterY: bounds ? Number(bounds.centerY.toFixed(1)) : null,
        foregroundMinX: bounds ? bounds.minX : null,
        foregroundMaxX: bounds ? bounds.maxX : null,
        darkPixels: evidence.darkPixels,
        brightPixels: evidence.brightPixels,
        colorBuckets: evidence.colorBuckets
    })
}

const isMmoommVisualLinkupCanvasFramed = (evidence: CanvasColorEvidence): boolean => {
    const bounds = evidence.foregroundBounds
    if (!bounds) return false
    return (
        evidence.foregroundRatio > 0.01 &&
        evidence.foregroundBuckets > 3 &&
        bounds.maxX - bounds.minX > evidence.width * 0.06 &&
        bounds.maxY - bounds.minY > evidence.height * 0.06 &&
        bounds.centerX > evidence.width * 0.14 &&
        bounds.centerX < evidence.width * 0.86 &&
        bounds.centerY > evidence.height * 0.14 &&
        bounds.centerY < evidence.height * 0.86 &&
        bounds.minX > evidence.width * 0.01 &&
        bounds.maxX < evidence.width * 0.99
    )
}

const expectMmoommVisualLinkupCanvasFramed = async (page: Page, canvas: Locator, label: string) => {
    await expect
        .poll(
            async () => {
                const evidence = await readCanvasColorEvidence(page, canvas)
                return isMmoommVisualLinkupCanvasFramed(evidence)
            },
            { timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT }
        )
        .toBe(true)
    const evidence = await readCanvasColorEvidence(page, canvas)
    const selectedVariant = await canvas.getAttribute('data-visual-lab-selected-variant')
    const diagnostics = formatCanvasFramingEvidence(evidence, selectedVariant)
    const bounds = evidence.foregroundBounds
    expect(bounds, `${label} must expose a foreground object cluster: ${diagnostics}`).not.toBeNull()
    if (!bounds) return
    expect(
        evidence.foregroundRatio,
        `${label} foreground object cluster must be readable, not a tiny dark speck: ${diagnostics}`
    ).toBeGreaterThan(0.01)
    expect(
        evidence.foregroundBuckets,
        `${label} foreground object cluster must contain visible material variation: ${diagnostics}`
    ).toBeGreaterThan(3)
    expect(bounds.centerX, `${label} foreground object cluster must be horizontally framed: ${diagnostics}`).toBeGreaterThan(
        evidence.width * 0.14
    )
    expect(bounds.centerX, `${label} foreground object cluster must be horizontally framed: ${diagnostics}`).toBeLessThan(
        evidence.width * 0.86
    )
    expect(bounds.centerY, `${label} foreground object cluster must be vertically framed: ${diagnostics}`).toBeGreaterThan(
        evidence.height * 0.14
    )
    expect(bounds.centerY, `${label} foreground object cluster must be vertically framed: ${diagnostics}`).toBeLessThan(
        evidence.height * 0.86
    )
    expect(bounds.maxX - bounds.minX, `${label} foreground object cluster must occupy visible width: ${diagnostics}`).toBeGreaterThan(
        evidence.width * 0.06
    )
    expect(bounds.maxY - bounds.minY, `${label} foreground object cluster must occupy visible height: ${diagnostics}`).toBeGreaterThan(
        evidence.height * 0.06
    )
}

const colorDistance = (left: CanvasColorEvidence, right: CanvasColorEvidence): number =>
    Math.hypot(left.meanRgb.r - right.meanRgb.r, left.meanRgb.g - right.meanRgb.g, left.meanRgb.b - right.meanRgb.b)

const waitForCanvasFrame = async (canvas: Locator) => {
    await canvas.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            })
    )
}

const parseOpacityRange = (value: string | null, label: string): { min: number; max: number } => {
    const [minText, maxText] = (value ?? '').split(':')
    const min = Number(minText)
    const max = Number(maxText)
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error(`${label} must expose a numeric opacity range, received ${String(value)}`)
    }
    return { min, max }
}

const expectMmoommVisualLinkupDistinctMaterialEvidence = async (canvas: Locator, label: string, variantEvidence: CanvasColorEvidence[]) => {
    const coreRange = parseOpacityRange(await canvas.getAttribute('data-visual-lab-core-opacity-range'), `${label} core opacity`)
    const glowRange = parseOpacityRange(await canvas.getAttribute('data-visual-lab-glow-opacity-range'), `${label} glow opacity`)
    expect(coreRange.max - coreRange.min, `${label} must preserve distinct core opacity variants`).toBeGreaterThanOrEqual(0.25)
    expect(glowRange.max - glowRange.min, `${label} must preserve distinct glow opacity variants`).toBeGreaterThanOrEqual(0.1)
    expect(variantEvidence.length, `${label} must capture visible evidence for representative variants`).toBeGreaterThanOrEqual(3)
    for (let index = 0; index < variantEvidence.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < variantEvidence.length; otherIndex += 1) {
            const left = variantEvidence[index]
            const right = variantEvidence[otherIndex]
            const distance = colorDistance(left, right)
            const foregroundRatioDelta = Math.abs(left.foregroundRatio - right.foregroundRatio)
            const bucketDelta = Math.abs(left.foregroundBuckets - right.foregroundBuckets)
            expect(
                distance >= 18 || foregroundRatioDelta >= 0.01 || bucketDelta >= 3,
                `${label} representative variants ${index + 1} and ${otherIndex + 1} must be visibly distinct in canvas pixels`
            ).toBe(true)
        }
    }
}

const expectMmoommVisualLinkupVariantLegendUsable = async (page: Page, widget: Locator, canvas: Locator, label: string) => {
    const legend = widget.getByTestId('playcanvas-visual-lab-legend')
    await expect(legend, `${label} must expose a visible variant legend`).toBeVisible()
    await expect(legend, `${label} legend must name visual variants`).toContainText(/Visual variants|Визуальные варианты/)

    const firstVariant = legend.getByTestId(`playcanvas-visual-lab-variant-${VISUAL_LINKUP_VARIANT_PROOFS[0].slug}`)
    const lowPolyVariant = legend.getByTestId('playcanvas-visual-lab-variant-lowpoly-radar')
    const typeGlowVariant = legend.getByTestId('playcanvas-visual-lab-variant-cyan-magenta')
    const degradedVariant = legend.getByTestId('playcanvas-visual-lab-variant-sensor-dropout')
    await expect(firstVariant, `${label} must expose the white halo variant`).toBeVisible()
    await expect(typeGlowVariant, `${label} must expose the type glow variant`).toBeVisible()
    await expect(lowPolyVariant, `${label} must expose the low-poly radar variant`).toBeVisible()
    await expect(degradedVariant, `${label} must expose the channel degradation variant`).toBeVisible()
    await expect(firstVariant, `${label} must expose the soft white family`).toContainText('softWhiteLinkup')
    await expect(typeGlowVariant, `${label} must expose the type glow family`).toContainText('typeGlow')
    await expect(lowPolyVariant, `${label} must expose the low-poly family`).toContainText('lowPolyRetrowave')
    await expect(degradedVariant, `${label} must expose the degradation family`).toContainText('channelDegradation')
    await expect(firstVariant, `${label} first visual variant must be selected by default`).toHaveAttribute('aria-pressed', 'true')

    const variantEvidence: CanvasColorEvidence[] = []
    const capturedFamilies = new Set<string>()
    for (const variant of VISUAL_LINKUP_VARIANT_PROOFS) {
        const button = legend.getByTestId(`playcanvas-visual-lab-variant-${variant.slug}`)
        await expect(button, `${label} must expose variant ${variant.slug}`).toBeVisible()
        await expect(button, `${label} variant ${variant.slug} must show family ${variant.family}`).toContainText(variant.family)
        await button.click()
        await expect(button, `${label} variant ${variant.slug} must become selected`).toHaveAttribute('aria-pressed', 'true')
        await expect(
            legend.getByTestId('playcanvas-visual-lab-selected'),
            `${label} selected ${variant.slug} label must update`
        ).toContainText(variant.family)
        await expect(canvas, `${label} canvas must focus selected variant ${variant.slug}`).toHaveAttribute(
            'data-visual-lab-selected-variant',
            variant.slug
        )
        await waitForCanvasFrame(canvas)
        await expectMmoommVisualLinkupCanvasFramed(page, canvas, `${label} ${variant.slug} variant`)
        if (variant.capturePixelEvidence) {
            capturedFamilies.add(variant.family)
            variantEvidence.push(await readCanvasColorEvidence(page, canvas))
        }
    }
    expect(Array.from(capturedFamilies).sort(), `${label} must capture pixel evidence for every visual variant family`).toEqual([
        'channelDegradation',
        'lowPolyRetrowave',
        'softWhiteLinkup',
        'typeGlow'
    ])
    return variantEvidence
}

const expectMmoommCanvasPlayableHeight = async (
    page: Page,
    canvas: Locator,
    label: string,
    options: { desktopMinimumHeightRatio?: number } = {}
) => {
    const [box, viewport] = await Promise.all([canvas.boundingBox(), page.viewportSize()])
    if (!box || !viewport) {
        throw new Error(`${label} canvas metrics are not available`)
    }

    const minimumHeightRatio = viewport.width < 600 ? 0.5 : options.desktopMinimumHeightRatio ?? 0.7
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

const expectMmoommVisualLabCameraControlsResponsive = async (page: Page, widget: Locator, canvas: Locator, label: string) => {
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

    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) {
        throw new Error(`${label} canvas box is not available for drag proof`)
    }
    const yawBeforeDrag = await readCanvasNumberDataset(canvas, 'cameraYaw')
    const scrollBefore = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.7, canvasBox.y + canvasBox.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.4, canvasBox.y + canvasBox.height * 0.5, { steps: 8 })
    await page.mouse.up()
    await expect
        .poll(async () => (await readCanvasNumberDataset(canvas, 'cameraYaw')) ?? Number.POSITIVE_INFINITY, { timeout: 10_000 })
        .toBeLessThan(yawBeforeDrag ?? Number.POSITIVE_INFINITY)
    const scrollAfter = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
    expect(scrollAfter, `${label} canvas drag must not scroll the page`).toEqual(scrollBefore)
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
    await expectMmoommCanvasPainted(page, canvas)
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
                await expectMmoommCanvasPainted(page, canvas)
                await expectMmoommCanvasPlayableHeight(page, canvas, `${label} viewport matrix`)
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
    await expect(page.getByRole('button', { name: MMOOMM_WELCOME_BUTTON_NAME })).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await expect(page.getByRole('button', { name: MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME })).toBeVisible({
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
    await expect(widget.getByTestId('playcanvas-runtime-mode-status')).toContainText(/Static visual lab|Статическая визуальная лаборатория/)
    await expectMmoommVisualLinkupCanvasPainted(page, canvas)
    await expectMmoommVisualLinkupCanvasFramed(page, canvas, `${label} initial overview`)
    const variantEvidence = await expectMmoommVisualLinkupVariantLegendUsable(page, widget, canvas, label)
    await expectMmoommVisualLinkupDistinctMaterialEvidence(canvas, label, variantEvidence)
    await expectMmoommCanvasPlayableHeight(page, canvas, label, { desktopMinimumHeightRatio: 0.56 })
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
                await expectMmoommCanvasPlayableHeight(page, canvas, `${label} viewport matrix`, { desktopMinimumHeightRatio: 0.56 })
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
