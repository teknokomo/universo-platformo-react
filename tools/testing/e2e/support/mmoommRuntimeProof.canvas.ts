import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { PNG } from 'pngjs'
import { expectLocatorFullyFitsViewport, expectNoTechnicalLeakage } from './browser/runtimeUx'
import {
    MMOOMM_CANVAS_LABEL,
    MMOOMM_MOVE_TO_TARGET_BUTTON_NAME,
    MMOOMM_RESET_CAMERA_BUTTON_NAME,
    MMOOMM_ROTATE_LEFT_BUTTON_NAME,
    MMOOMM_ROTATE_RIGHT_BUTTON_NAME,
    MMOOMM_RUNTIME_EXPECT_TIMEOUT,
    MMOOMM_RUNTIME_FORBIDDEN_VISIBLE_TEXT,
    MMOOMM_STOP_BUTTON_NAME,
    MMOOMM_ZOOM_IN_BUTTON_NAME,
    MMOOMM_ZOOM_OUT_BUTTON_NAME
} from './mmoommRuntimeProof.navigation'

type VisualLinkupFamily = 'softWhiteLinkup' | 'typeGlow' | 'lowPolyRetrowave' | 'channelDegradation'
type VisualLinkupVariantProof = {
    slug: string
    family: VisualLinkupFamily
    capturePixelEvidence?: boolean
}

const VISUAL_LINKUP_VARIANT_PROOFS: readonly VisualLinkupVariantProof[] = [
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

type VisualLinkupLocale = 'en' | 'ru'

const VISUAL_LINKUP_FAMILY_LABELS: Record<VisualLinkupLocale, Record<VisualLinkupFamily, string>> = {
    en: {
        softWhiteLinkup: 'Soft white linkup',
        typeGlow: 'Type glow',
        lowPolyRetrowave: 'Low-poly retrowave',
        channelDegradation: 'Channel degradation'
    },
    ru: {
        softWhiteLinkup: 'Мягкая белая связка',
        typeGlow: 'Типографическое свечение',
        lowPolyRetrowave: 'Ретро-геометрия',
        channelDegradation: 'Деградация канала'
    }
}

const resolveVisualLinkupFamilyLabel = (locale: VisualLinkupLocale, family: VisualLinkupFamily): string =>
    VISUAL_LINKUP_FAMILY_LABELS[locale][family]

export const readCanvasNumberDataset = async (canvas: Locator, key: string): Promise<number | null> => {
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

export const expectMmoommVisualLinkupCanvasPainted = async (page: Page, canvas: Locator) => {
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

export const expectMmoommVisualLinkupCanvasFramed = async (page: Page, canvas: Locator, label: string) => {
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

export const expectMmoommVisualLinkupDistinctMaterialEvidence = async (
    canvas: Locator,
    label: string,
    variantEvidence: CanvasColorEvidence[]
) => {
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

export const expectMmoommVisualLinkupVariantLegendUsable = async (
    page: Page,
    widget: Locator,
    canvas: Locator,
    label: string,
    locale: VisualLinkupLocale
) => {
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
    await expect(firstVariant, `${label} must expose the soft white family`).toContainText(
        resolveVisualLinkupFamilyLabel(locale, 'softWhiteLinkup')
    )
    await expect(typeGlowVariant, `${label} must expose the type glow family`).toContainText(
        resolveVisualLinkupFamilyLabel(locale, 'typeGlow')
    )
    await expect(lowPolyVariant, `${label} must expose the low-poly family`).toContainText(
        resolveVisualLinkupFamilyLabel(locale, 'lowPolyRetrowave')
    )
    await expect(degradedVariant, `${label} must expose the degradation family`).toContainText(
        resolveVisualLinkupFamilyLabel(locale, 'channelDegradation')
    )
    await expect(firstVariant, `${label} first visual variant must be selected by default`).toHaveAttribute('aria-pressed', 'true')

    const variantEvidence: CanvasColorEvidence[] = []
    const capturedFamilies = new Set<string>()
    for (const variant of VISUAL_LINKUP_VARIANT_PROOFS) {
        const button = legend.getByTestId(`playcanvas-visual-lab-variant-${variant.slug}`)
        const familyLabel = resolveVisualLinkupFamilyLabel(locale, variant.family)
        await expect(button, `${label} must expose variant ${variant.slug}`).toBeVisible()
        await expect(button, `${label} variant ${variant.slug} must show its localized family`).toContainText(familyLabel)
        await expect(button, `${label} variant ${variant.slug} must keep its family slug out of visible text`).not.toContainText(
            variant.family
        )
        await expect(button, `${label} variant ${variant.slug} must expose its family slug as test data`).toHaveAttribute(
            'data-visual-lab-family',
            variant.family
        )
        await button.click()
        await expect(button, `${label} variant ${variant.slug} must become selected`).toHaveAttribute('aria-pressed', 'true')
        await expect(
            legend.getByTestId('playcanvas-visual-lab-selected'),
            `${label} selected ${variant.slug} label must update`
        ).toContainText(familyLabel)
        await expect(
            legend.getByTestId('playcanvas-visual-lab-selected'),
            `${label} selected ${variant.slug} label must keep its family slug out of visible text`
        ).not.toContainText(variant.family)
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

export const expectMmoommCanvasToFillAvailableViewport = async (page: Page, canvas: Locator, label: string) => {
    const [box, viewport] = await Promise.all([canvas.boundingBox(), page.viewportSize()])
    if (!box || !viewport) {
        throw new Error(`${label} canvas metrics are not available`)
    }

    const isMobile = viewport.width < 600
    const bottomInset = isMobile ? 19 : 23
    const minimumHeight = isMobile ? 320 : 560
    const availableHeight = Math.max(1, viewport.height - box.y - bottomInset)
    const requiredHeight = Math.min(minimumHeight, availableHeight)
    const canvasBottom = box.y + box.height

    expect(box.height, `${label} canvas must preserve its configured minimum height when space allows`).toBeGreaterThanOrEqual(
        requiredHeight - 2
    )
    expect(canvasBottom, `${label} canvas must reach the available viewport boundary`).toBeGreaterThanOrEqual(
        viewport.height - bottomInset - 2
    )
    expect(canvasBottom, `${label} canvas must preserve the viewport bottom inset`).toBeLessThanOrEqual(viewport.height - bottomInset + 2)
}

export const expectMmoommRuntimeNoTechnicalLeakage = async (widget: Locator, label: string) => {
    await expect(widget).not.toContainText(/clientBundle|sourceCode|serverBundle|moduleRole|attachedToId/)
    await expectNoTechnicalLeakage(widget, {
        label,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: MMOOMM_RUNTIME_FORBIDDEN_VISIBLE_TEXT
    })
}

export const expectMmoommCanvasContained = async (widget: Locator, canvas: Locator, label: string) => {
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

export const expectMmoommCanvasKeyboardFocus = async (page: Page, canvas: Locator, label: string) => {
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

export const expectMmoommRuntimeControlAccessibleNames = async (widget: Locator, canvas: Locator, label: string) => {
    await expect(canvas, `${label} canvas must expose a localized accessible name`).toHaveAttribute('aria-label', MMOOMM_CANVAS_LABEL)
    await expect(widget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_STOP_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_RESET_CAMERA_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ZOOM_IN_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ZOOM_OUT_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ROTATE_LEFT_BUTTON_NAME })).toBeVisible()
    await expect(widget.getByRole('button', { name: MMOOMM_ROTATE_RIGHT_BUTTON_NAME })).toBeVisible()
}

export const expectMmoommVisualLabCameraControlsResponsive = async (page: Page, widget: Locator, canvas: Locator, label: string) => {
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

export const expectMmoommCameraControlsResponsive = async (page: Page, widget: Locator, canvas: Locator, label: string) => {
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

export const expectMmoommCameraClipEvidence = async (canvas: Locator, label: string) => {
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
