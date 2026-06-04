import type { Locator, Page, TestInfo } from '@playwright/test'
import { PNG } from 'pngjs'
import { test, expect } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    addApplicationMember,
    createAdminUser,
    createRole,
    getApplication,
    createLoggedInApiContext,
    disposeApiContext,
    listPublicationApplications
} from '../../support/backend/api-session.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication,
    recordCreatedRole
} from '../../support/backend/run-manifest.mjs'
import { importMmoommFlightSnapshotThroughUi } from '../../support/mmoommFlightSnapshotImport'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import { loadE2eEnvironment } from '../../support/env/load-e2e-env.mjs'
import { applicationSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import { waitForSettledMutationResponse } from '../../support/browser/network'

const FLIGHT_CANVAS_MODULE_CODENAME = 'flight-canvas-widget'
const FIXED_TICK_SERVER_MODULE_CODENAME = 'fixed-tick-flight-runtime'
const MMOOMM_FLOW_TIMEOUT = 600_000
const RUNTIME_EXPECT_TIMEOUT = 60_000
const MOVEMENT_TIMEOUT = 120_000
const RECONNECT_TIMEOUT = 45_000

const localizedText = (content: string, locale = 'en') => {
    const now = new Date().toISOString()

    return {
        _schema: '1',
        _primary: locale,
        locales: {
            [locale]: {
                content,
                version: 1,
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        }
    }
}

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

function buildExecutionRunId(runId: string, testInfo: TestInfo) {
    const normalizedProject =
        testInfo.project.name
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
            .slice(-6) || 'proj'
    return `${runId}-${normalizedProject}-r${testInfo.retry}-p${testInfo.repeatEachIndex}-w${testInfo.workerIndex}`
}

async function fillLocalizedField(dialog: Locator, label: string, value: string) {
    await dialog.getByLabel(label).first().fill(value)
}

async function createApplicationThroughBrowser(
    page: Page,
    api: LoggedInApiContext,
    metahubId: string,
    publicationId: string,
    applicationName: string
) {
    await page.goto(`/metahub/${metahubId}/publication/${publicationId}/applications`)
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()

    const createApplicationResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/publication/${publicationId}/applications`)
    )

    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create Application' })
    await expect(dialog).toBeVisible()
    await fillLocalizedField(dialog, 'Name', applicationName)
    const createButton = dialog.getByRole('button', { name: 'Create' })
    await expect(createButton).toBeEnabled()
    await createButton.click()

    const response = await createApplicationResponse
    expect(response.ok()).toBe(true)
    await expect(dialog).toHaveCount(0, { timeout: 30_000 })

    type PublicationApplication = { id?: string; slug?: string; name?: { locales?: Record<string, { content?: string }> } }
    let application: PublicationApplication | null = null
    await expect
        .poll(async () => {
            const payload = await listPublicationApplications(api, metahubId, publicationId)
            application = ((payload.items ?? []) as PublicationApplication[]).find((item) =>
                Object.values(item.name?.locales ?? {}).some((localeValue) => localeValue?.content === applicationName)
            )
            return typeof application?.id === 'string'
        })
        .toBe(true)

    if (!application?.id) {
        throw new Error(`Creating application ${applicationName} did not expose a persisted id`)
    }

    type CreatedApplicationPayload = { application?: { id?: string; slug?: string }; connector?: { id?: string } }
    const createdPayload = (await response.json()) as CreatedApplicationPayload
    const connectorId = createdPayload.connector?.id
    if (typeof connectorId !== 'string') {
        throw new Error(`Creating application ${applicationName} did not expose a connector id`)
    }

    return { ...application, connectorId }
}

async function syncApplicationThroughBrowser(page: Page, api: LoggedInApiContext, applicationId: string, connectorId: string) {
    await page.goto(`/a/${applicationId}/admin/connector/${connectorId}`)
    await expect(page.getByTestId(applicationSelectors.connectorBoardSchemaCard)).toBeVisible({ timeout: 30_000 })

    const diffResponsePromise = page.waitForResponse(
        (response) => response.request().method() === 'GET' && response.url().endsWith(`/api/v1/application/${applicationId}/diff`),
        { timeout: 60_000 }
    )
    await page.getByTestId(applicationSelectors.connectorBoardSyncButton).click()
    const diffResponse = await diffResponsePromise
    expect(diffResponse.status()).toBe(200)

    const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
    await expect(diffDialog).toBeVisible({ timeout: 30_000 })
    await expect(diffDialog.getByText(/blocks|fields|elements|entities|values/i).first()).toBeVisible()

    const syncResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/application/${applicationId}/sync`),
        { label: 'Creating imported MMOOMM application schema', timeout: 420_000 }
    )
    await diffDialog.getByRole('button', { name: 'Create Schema' }).click()
    const syncResponse = await syncResponsePromise
    expect(syncResponse.status()).toBe(200)
    await expect(diffDialog).toHaveCount(0)
    await expect
        .poll(async () => {
            const persisted = await getApplication(api, applicationId)
            return persisted?.schemaStatus ?? null
        })
        .toBe('synced')
}

const readCanvasColorEvidence = async (canvas: import('@playwright/test').Locator) =>
    canvas.screenshot().then((buffer) => {
        const image = PNG.sync.read(buffer)
        let coloredSamples = 0
        let whitePixels = 0
        let remoteTintPixels = 0
        let minWhiteX = image.width
        let minWhiteY = image.height
        let maxWhiteX = 0
        let maxWhiteY = 0
        for (let index = 0; index < image.data.length; index += 4) {
            if (image.data[index] > 8 || image.data[index + 1] > 8 || image.data[index + 2] > 8) {
                coloredSamples += 1
            }
            if (image.data[index] > 180 && image.data[index + 1] > 180 && image.data[index + 2] > 180) {
                const pixel = index / 4
                const x = pixel % image.width
                const y = Math.floor(pixel / image.width)
                whitePixels += 1
                minWhiteX = Math.min(minWhiteX, x)
                minWhiteY = Math.min(minWhiteY, y)
                maxWhiteX = Math.max(maxWhiteX, x)
                maxWhiteY = Math.max(maxWhiteY, y)
            }
            if (image.data[index + 2] > 120 && image.data[index + 1] > 90 && image.data[index + 2] > image.data[index] + 20) {
                remoteTintPixels += 1
            }
        }
        return {
            readable: true,
            coloredSamples,
            whitePixels,
            remoteTintPixels,
            whiteBoundsWidth: maxWhiteX - minWhiteX,
            whiteBoundsHeight: maxWhiteY - minWhiteY,
            whiteCenterX: whitePixels > 0 ? (minWhiteX + maxWhiteX) / 2 : 0,
            whiteCenterY: whitePixels > 0 ? (minWhiteY + maxWhiteY) / 2 : 0
        }
    })

const getNumberAttr = async (locator: import('@playwright/test').Locator, name: string): Promise<number> =>
    Number((await locator.getAttribute(name)) ?? '0')

const getCanvasClickPoint = async (canvas: import('@playwright/test').Locator, xAttr: string, yAttr: string) => {
    const [box, dimensions] = await Promise.all([
        canvas.boundingBox(),
        canvas.evaluate((element) => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))
    ])
    if (!box || dimensions.width <= 0 || dimensions.height <= 0) {
        throw new Error('Canvas dimensions are not available')
    }

    return {
        x: (await getNumberAttr(canvas, xAttr)) * (box.width / dimensions.width),
        y: (await getNumberAttr(canvas, yAttr)) * (box.height / dimensions.height)
    }
}

const readShipPosition = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-ship-x'),
    y: await getNumberAttr(canvas, 'data-ship-y'),
    z: await getNumberAttr(canvas, 'data-ship-z')
})

const readRemoteShipPosition = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-remote-ship-x'),
    y: await getNumberAttr(canvas, 'data-remote-ship-y'),
    z: await getNumberAttr(canvas, 'data-remote-ship-z')
})

const readRemoteRenderedShipPosition = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-remote-rendered-ship-x'),
    y: await getNumberAttr(canvas, 'data-remote-rendered-ship-y'),
    z: await getNumberAttr(canvas, 'data-remote-rendered-ship-z')
})

const readLastIntentTarget = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-last-intent-target-x'),
    y: await getNumberAttr(canvas, 'data-last-intent-target-y'),
    z: await getNumberAttr(canvas, 'data-last-intent-target-z')
})

const readShipForward = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-ship-forward-x'),
    y: await getNumberAttr(canvas, 'data-ship-forward-y'),
    z: await getNumberAttr(canvas, 'data-ship-forward-z')
})

const readShipVisualForward = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-ship-visual-forward-x'),
    y: await getNumberAttr(canvas, 'data-ship-visual-forward-y'),
    z: await getNumberAttr(canvas, 'data-ship-visual-forward-z')
})

const readShipNoseScreenOffset = async (canvas: import('@playwright/test').Locator) => ({
    x: (await getNumberAttr(canvas, 'data-ship-nose-screen-x')) - (await getNumberAttr(canvas, 'data-ship-screen-x')),
    y: (await getNumberAttr(canvas, 'data-ship-nose-screen-y')) - (await getNumberAttr(canvas, 'data-ship-screen-y'))
})

const readRemoteRenderedShipForward = async (canvas: import('@playwright/test').Locator) => ({
    x: await getNumberAttr(canvas, 'data-remote-rendered-ship-forward-x'),
    y: await getNumberAttr(canvas, 'data-remote-rendered-ship-forward-y'),
    z: await getNumberAttr(canvas, 'data-remote-rendered-ship-forward-z')
})

const sendCanvasMoveToTarget = async (canvas: Locator, target: { x: number; y: number; z: number }) => {
    await canvas.evaluate((element, nextTarget) => {
        const controlCanvas = element as HTMLCanvasElement & {
            __playcanvasMoveToTarget?: (target: { x: number; y: number; z: number }) => void
        }
        controlCanvas.__playcanvasMoveToTarget?.(nextTarget)
    }, target)
    await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
}

const distance2d = (left: { x: number; z: number }, right: { x: number; z: number }) => Math.hypot(left.x - right.x, left.z - right.z)
const distance3d = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)

const SHIP_HALF_EXTENTS = { x: 6, y: 2, z: 2 }
const STATION_VISUAL_HALF = { x: 24, y: 8, z: 8 }
const CONTACT_TOLERANCE = 0.75

const dotVector = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) =>
    left.x * right.x + left.y * right.y + left.z * right.z

const normalizeVector = (value: { x: number; y: number; z: number }) => {
    const length = Math.hypot(value.x, value.y, value.z)
    return length > 0.000001 ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 1, y: 0, z: 0 }
}

const expectNoPageVerticalOverflow = async (page: Page, label: string) => {
    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight))
    expect(overflowPx, `${label} must not create vertical page scroll`).toBeLessThanOrEqual(1)
}

const expectCanvasFillsRuntimeViewport = async (page: Page, canvas: Locator, label: string) => {
    const [box, viewport] = await Promise.all([canvas.boundingBox(), page.viewportSize()])
    if (!box || !viewport) {
        throw new Error(`${label} canvas metrics are not available`)
    }
    const minimumHeightRatio = viewport.width < 600 ? 0.5 : 0.72
    expect(box.height, `${label} canvas must preserve a large playable area`).toBeGreaterThan(viewport.height * minimumHeightRatio)
    const allowedBottomGap = viewport.width < 600 ? 24 : 24
    expect(viewport.height - box.y - box.height, `${label} canvas must not leave a large blank area below it`).toBeLessThanOrEqual(
        allowedBottomGap
    )
}

const openSpaceSection = async (page: Page) => {
    const existingWidget = page.getByTestId('playcanvas-canvas-widget')
    if (await existingWidget.isVisible().catch(() => false)) {
        return
    }
    const spaceButton = page.getByRole('button', { name: /^(Space|Космос)$/ })
    await expect(spaceButton).toBeVisible({ timeout: 60_000 })
    await spaceButton.click()
}

const crossVector = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) => ({
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
})

const normalize3d = (value: { x: number; y: number; z: number }, fallback = { x: 1, y: 0, z: 0 }) => {
    const length = Math.hypot(value.x, value.y, value.z)
    if (length > 0.000001) {
        return { x: value.x / length, y: value.y / length, z: value.z / length }
    }
    const fallbackLength = Math.hypot(fallback.x, fallback.y, fallback.z)
    return fallbackLength > 0.000001
        ? { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength, z: fallback.z / fallbackLength }
        : { x: 1, y: 0, z: 0 }
}

const resolveShipAxes = (forwardValue: { x: number; y: number; z: number }) => {
    const forward = normalize3d(forwardValue)
    const referenceUp = Math.abs(forward.y) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 }
    const right = normalize3d(crossVector(referenceUp, forward), { x: 0, y: 0, z: 1 })
    const up = normalize3d(crossVector(forward, right), { x: 0, y: 1, z: 0 })
    return [forward, up, right] as const
}

const createOrientedBox = (
    center: { x: number; y: number; z: number },
    half: { x: number; y: number; z: number },
    axes: readonly [{ x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number }]
) => ({ center, half, axes })

const createShipBox = (center: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }) =>
    createOrientedBox(center, SHIP_HALF_EXTENTS, resolveShipAxes(forward))

const createStationBox = () =>
    createOrientedBox({ x: 72, y: 0, z: -48 }, STATION_VISUAL_HALF, [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }
    ])

const boxRadiusOnAxis = (box: ReturnType<typeof createOrientedBox>, axis: { x: number; y: number; z: number }) =>
    box.half.x * Math.abs(dotVector(box.axes[0], axis)) +
    box.half.y * Math.abs(dotVector(box.axes[1], axis)) +
    box.half.z * Math.abs(dotVector(box.axes[2], axis))

const orientedBoxesOverlap = (left: ReturnType<typeof createOrientedBox>, right: ReturnType<typeof createOrientedBox>) => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector(leftAxis, rightAxis)
            if (Math.hypot(cross.x, cross.y, cross.z) > 0.000001) {
                axes.push(normalize3d(cross))
            }
        }
    }
    const centerDelta = {
        x: right.center.x - left.center.x,
        y: right.center.y - left.center.y,
        z: right.center.z - left.center.z
    }
    return axes.every((axis) => Math.abs(dotVector(centerDelta, axis)) <= boxRadiusOnAxis(left, axis) + boxRadiusOnAxis(right, axis))
}

const orientedBoxVertices = (box: ReturnType<typeof createOrientedBox>) => {
    const vertices: Array<{ x: number; y: number; z: number }> = []
    for (const xSign of [-1, 1]) {
        for (const ySign of [-1, 1]) {
            for (const zSign of [-1, 1]) {
                vertices.push({
                    x:
                        box.center.x +
                        box.axes[0].x * box.half.x * xSign +
                        box.axes[1].x * box.half.y * ySign +
                        box.axes[2].x * box.half.z * zSign,
                    y:
                        box.center.y +
                        box.axes[0].y * box.half.x * xSign +
                        box.axes[1].y * box.half.y * ySign +
                        box.axes[2].y * box.half.z * zSign,
                    z:
                        box.center.z +
                        box.axes[0].z * box.half.x * xSign +
                        box.axes[1].z * box.half.y * ySign +
                        box.axes[2].z * box.half.z * zSign
                })
            }
        }
    }
    return vertices
}

const distanceToStationAabbSurface = (point: { x: number; y: number; z: number }) =>
    Math.hypot(
        Math.max(Math.abs(point.x - 72) - STATION_VISUAL_HALF.x, 0),
        Math.max(Math.abs(point.y) - STATION_VISUAL_HALF.y, 0),
        Math.max(Math.abs(point.z + 48) - STATION_VISUAL_HALF.z, 0)
    )

const shipOverlapsStationAabb = (shipCenter: { x: number; y: number; z: number }, shipForward = { x: 1, y: 0, z: 0 }) =>
    orientedBoxesOverlap(createShipBox(shipCenter, shipForward), createStationBox())

const shipsOverlapAabb = (
    leftCenter: { x: number; y: number; z: number },
    leftForward: { x: number; y: number; z: number },
    rightCenter: { x: number; y: number; z: number },
    rightForward: { x: number; y: number; z: number }
) => orientedBoxesOverlap(createShipBox(leftCenter, leftForward), createShipBox(rightCenter, rightForward))

const orientedBoxesPenetrate = (
    left: ReturnType<typeof createOrientedBox>,
    right: ReturnType<typeof createOrientedBox>,
    tolerance = CONTACT_TOLERANCE
) => {
    const axes = [...left.axes, ...right.axes]
    for (const leftAxis of left.axes) {
        for (const rightAxis of right.axes) {
            const cross = crossVector(leftAxis, rightAxis)
            if (Math.hypot(cross.x, cross.y, cross.z) > 0.000001) {
                axes.push(normalize3d(cross))
            }
        }
    }
    const centerDelta = {
        x: right.center.x - left.center.x,
        y: right.center.y - left.center.y,
        z: right.center.z - left.center.z
    }
    return axes.every(
        (axis) => Math.abs(dotVector(centerDelta, axis)) < boxRadiusOnAxis(left, axis) + boxRadiusOnAxis(right, axis) - tolerance
    )
}

const shipsPenetrateAabb = (
    leftCenter: { x: number; y: number; z: number },
    leftForward: { x: number; y: number; z: number },
    rightCenter: { x: number; y: number; z: number },
    rightForward: { x: number; y: number; z: number }
) => orientedBoxesPenetrate(createShipBox(leftCenter, leftForward), createShipBox(rightCenter, rightForward))

const stationVisualClearance = (shipCenter: { x: number; y: number; z: number }, shipForward = { x: 1, y: 0, z: 0 }) => {
    const shipBox = createShipBox(shipCenter, shipForward)
    if (orientedBoxesOverlap(shipBox, createStationBox())) {
        return 0
    }
    return Math.min(...orientedBoxVertices(shipBox).map(distanceToStationAabbSurface))
}

const segmentIntersectsAabb = (
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    box: { center: { x: number; y: number; z: number }; half: { x: number; y: number; z: number } }
) => {
    let tMin = 0
    let tMax = 1

    for (const axis of ['x', 'y', 'z'] as const) {
        const start = from[axis]
        const delta = to[axis] - start
        const min = box.center[axis] - box.half[axis]
        const max = box.center[axis] + box.half[axis]

        if (Math.abs(delta) < 0.000001) {
            if (start < min || start > max) {
                return false
            }
            continue
        }

        const inverse = 1 / delta
        const near = (min - start) * inverse
        const far = (max - start) * inverse
        tMin = Math.max(tMin, Math.min(near, far))
        tMax = Math.min(tMax, Math.max(near, far))
        if (tMin > tMax) {
            return false
        }
    }

    return true
}

const movementCrossesStationGuard = (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) =>
    segmentIntersectsAabb(from, to, {
        center: { x: 72, y: 0, z: -48 },
        half: {
            x: STATION_VISUAL_HALF.x + SHIP_HALF_EXTENTS.x,
            y: STATION_VISUAL_HALF.y + SHIP_HALF_EXTENTS.y,
            z: STATION_VISUAL_HALF.z + SHIP_HALF_EXTENTS.z
        }
    }) || shipOverlapsStationAabb(to)

const resolveFreeSpaceDoubleClickTarget = async (
    canvas: Locator,
    from: { x: number; y: number; z: number },
    options: {
        label: string
        minDistance?: number
        requireVerticalDelta?: number
        requireTurnFrom?: { x: number; y: number; z: number }
        points?: Array<{ x: number; y: number }>
    }
) => {
    const box = await canvas.boundingBox()
    if (!box) {
        throw new Error(`${options.label} canvas bounding box is unavailable`)
    }

    const candidatePoints = options.points ?? [
        { x: box.width * 0.18, y: box.height * 0.22 },
        { x: box.width * 0.5, y: box.height * 0.18 },
        { x: box.width * 0.82, y: box.height * 0.22 },
        { x: box.width * 0.18, y: box.height * 0.5 },
        { x: box.width * 0.82, y: box.height * 0.5 },
        { x: box.width * 0.18, y: box.height * 0.78 },
        { x: box.width * 0.5, y: box.height * 0.82 },
        { x: box.width * 0.82, y: box.height * 0.78 }
    ]

    for (const point of candidatePoints) {
        await canvas.dblclick({
            position: {
                x: Math.max(20, Math.min(box.width - 20, point.x)),
                y: Math.max(20, Math.min(box.height - 20, point.y))
            }
        })
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
        const candidateTarget = await readLastIntentTarget(canvas)
        const distance = distance3d(from, candidateTarget)
        const verticalDelta = Math.abs(candidateTarget.y - from.y)
        const candidateForward = normalizeVector({
            x: candidateTarget.x - from.x,
            y: candidateTarget.y - from.y,
            z: candidateTarget.z - from.z
        })
        const turnAccepted = options.requireTurnFrom ? dotVector(options.requireTurnFrom, candidateForward) < 0.95 : true
        if (
            distance > (options.minDistance ?? 120) &&
            verticalDelta >= (options.requireVerticalDelta ?? 0) &&
            turnAccepted &&
            !movementCrossesStationGuard(from, candidateTarget)
        ) {
            return candidateTarget
        }
    }

    throw new Error(`${options.label} free-space target was not resolved`)
}

async function waitForBrowserLoginReadiness(credentials: { email: string; password: string }) {
    await expect
        .poll(async () => {
            try {
                const api = await createLoggedInApiContext(credentials)
                await disposeApiContext(api)
                return true
            } catch {
                return false
            }
        })
        .toBe(true)
}

test('@flow imported MMOOMM flight snapshot renders PlayCanvas runtime and moves ship', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(MMOOMM_FLOW_TIMEOUT)

    const bootstrapApi = await createBootstrapApiContext()
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    let unauthorizedSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let readOnlySession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let secondPilotSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let russianSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const executionRunId = buildExecutionRunId(runManifest.runId, testInfo)
        const applicationName = `E2E ${executionRunId} MMOOMM Flight Runtime`
        const readOnlyEmail = `e2e+${executionRunId}.mmoomm-observer@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
        const readOnlyPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        const secondPilotEmail = `e2e+${executionRunId}.mmoomm-pilot-b@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
        const secondPilotPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        const readOnlyGlobalRoleCodename = `MmoommObserver${executionRunId.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 48)
        const readOnlyGlobalRole = await createRole(bootstrapApi, {
            codename: localizedText(readOnlyGlobalRoleCodename),
            name: localizedText('MMOOMM observer'),
            description: localizedText(`Read-only MMOOMM observer coverage ${executionRunId}`),
            color: '#607d8b',
            isSuperuser: false,
            permissions: []
        })
        await recordCreatedRole({ id: readOnlyGlobalRole.id, codename: readOnlyGlobalRoleCodename })
        const createdReadOnlyUser = await createAdminUser(bootstrapApi, {
            email: readOnlyEmail,
            password: readOnlyPassword,
            roleIds: [readOnlyGlobalRole.id],
            comment: `Created for MMOOMM observer coverage ${executionRunId}`
        })
        if (!createdReadOnlyUser?.userId) {
            throw new Error(`Created user ${readOnlyEmail} did not return a user id`)
        }
        await recordCreatedGlobalUser({ userId: createdReadOnlyUser.userId, email: readOnlyEmail })
        const createdSecondPilotUser = await createAdminUser(bootstrapApi, {
            email: secondPilotEmail,
            password: secondPilotPassword,
            roleIds: [readOnlyGlobalRole.id],
            comment: `Created for MMOOMM second pilot coverage ${executionRunId}`
        })
        if (!createdSecondPilotUser?.userId) {
            throw new Error(`Created user ${secondPilotEmail} did not return a user id`)
        }
        await recordCreatedGlobalUser({ userId: createdSecondPilotUser.userId, email: secondPilotEmail })
        await waitForBrowserLoginReadiness({ email: readOnlyEmail, password: readOnlyPassword })
        await waitForBrowserLoginReadiness({ email: secondPilotEmail, password: secondPilotPassword })

        const imported = await importMmoommFlightSnapshotThroughUi(page)
        const metahubId = imported.metahubId
        const publicationId = imported.publicationId

        await recordCreatedMetahub({
            id: metahubId,
            name: imported.metahubName,
            codename: 'MmoommFlightSimulator'
        })
        await recordCreatedPublication({
            id: publicationId,
            metahubId,
            schemaName: null
        })

        const linkedApplication = await createApplicationThroughBrowser(page, api, metahubId, publicationId, applicationName)
        const applicationId = linkedApplication?.id
        if (typeof applicationId !== 'string') {
            throw new Error('MMOOMM linked application creation did not return an application id')
        }
        const connectorId = linkedApplication.connectorId
        if (typeof connectorId !== 'string') {
            throw new Error('MMOOMM linked application creation did not return a connector id')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.slug
        })
        await addApplicationMember(api, applicationId, { email: readOnlyEmail, role: 'member' })
        await addApplicationMember(api, applicationId, { email: secondPilotEmail, role: 'editor' })
        await syncApplicationThroughBrowser(page, api, applicationId, connectorId)

        await page.goto(`/metahub/${metahubId}/publication/${publicationId}/applications`)
        const [runtimePopup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: applicationName }).click()])
        await expect(runtimePopup).toHaveURL(new RegExp(`/a/${applicationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
        await expect(runtimePopup.getByRole('button', { name: /^Welcome$/ })).toBeVisible({ timeout: 60_000 })
        await runtimePopup.close()

        const env = loadE2eEnvironment()
        const unauthMatchmake = await fetch(new URL('/matchmake/joinOrCreate/fixed_tick_scene', env.baseURL), {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessMode: 'member',
                applicationId,
                targetObjects: { station: { x: 999, y: 0, z: 999 } },
                cruiseSpeed: 999
            })
        })
        expect([400, 401, 403, 419]).toContain(unauthMatchmake.status)

        unauthorizedSession = await createLoggedInBrowserContext(browser, {
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const unauthorizedPage = unauthorizedSession.page
        await unauthorizedPage.route('**/matchmake/joinOrCreate/fixed_tick_scene', async (route) => {
            await route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'forbidden' })
            })
        })
        await unauthorizedPage.goto(`/a/${applicationId}`)
        await openSpaceSection(unauthorizedPage)
        const unauthorizedWidget = unauthorizedPage.getByTestId('playcanvas-canvas-widget')
        const unauthorizedCanvas = unauthorizedPage.getByTestId('playcanvas-canvas')
        await expect(unauthorizedCanvas).toHaveAttribute('data-realtime-status', 'unauthorized', { timeout: RUNTIME_EXPECT_TIMEOUT })
        await expect(unauthorizedWidget.getByText(/realtime control is not available for your account/i)).toBeVisible()
        await expect(unauthorizedWidget.getByRole('button', { name: /move to target/i })).toBeDisabled()
        await expect(unauthorizedWidget.getByRole('button', { name: /stop/i })).toBeDisabled()
        await expectNoTechnicalLeakage(unauthorizedWidget, {
            label: 'MMOOMM unauthorized runtime widget',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(unauthorizedPage, 'MMOOMM unauthorized runtime')
        const unauthorizedInitialPosition =
            (await unauthorizedCanvas.getAttribute('data-ship-x')) !== null &&
            (await unauthorizedCanvas.getAttribute('data-ship-y')) !== null &&
            (await unauthorizedCanvas.getAttribute('data-ship-z')) !== null
                ? await readShipPosition(unauthorizedCanvas)
                : null
        const unauthorizedCanvasBox = await unauthorizedCanvas.boundingBox()
        if (!unauthorizedCanvasBox) {
            throw new Error('Unauthorized canvas box is not available')
        }
        const unauthorizedActionPoint = {
            x: unauthorizedCanvasBox.width * 0.5,
            y: unauthorizedCanvasBox.height * 0.5
        }
        await unauthorizedCanvas.click({ position: unauthorizedActionPoint })
        await unauthorizedCanvas.dblclick({ position: unauthorizedActionPoint })
        await unauthorizedCanvas.focus()
        await unauthorizedPage.keyboard.press('Enter')
        await unauthorizedPage.keyboard.press('Escape')
        await expect(unauthorizedCanvas).not.toHaveAttribute('data-last-intent-kind', /.+/)
        if (unauthorizedInitialPosition) {
            await expect
                .poll(async () => distance3d(await readShipPosition(unauthorizedCanvas), unauthorizedInitialPosition), { timeout: 5_000 })
                .toBeLessThan(1)
        }
        await unauthorizedSession.context.close()
        unauthorizedSession = null

        const runtimeModulesResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname === `/api/v1/applications/${applicationId}/runtime/modules` &&
                url.searchParams.get('attachedToKind') === 'metahub'
            )
        })
        const clientBundleResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname.startsWith(`/api/v1/applications/${applicationId}/runtime/modules/`) &&
                url.pathname.endsWith('/client')
            )
        })

        await page.goto(`/a/${applicationId}`)

        await expect(page.getByRole('button', { name: /^Welcome$/ })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByRole('button', { name: /^Space$/ })).toBeVisible()
        await expect(page.getByRole('button', { name: /^Main$/ })).toHaveCount(0)
        await expect(page.getByRole('button', { name: /^Ship$/ })).toHaveCount(0)
        await expect(page.getByRole('button', { name: /^Station$/ })).toHaveCount(0)
        await expect(page.getByText(/Welcome to Universo MMOOMM/i)).toBeVisible()
        await expect(page.getByTestId('playcanvas-canvas-widget')).toHaveCount(0)
        await openSpaceSection(page)

        const widget = page.getByTestId('playcanvas-canvas-widget')
        await expect(widget).toBeVisible({ timeout: 60_000 })
        const runtimeModulesResponse = await runtimeModulesResponsePromise
        expect(runtimeModulesResponse.ok()).toBeTruthy()
        const runtimeModulesPayload = (await runtimeModulesResponse.json()) as { items?: Array<Record<string, any>> }
        const selectedFlightModule = runtimeModulesPayload.items?.find((item) => item?.codename === FLIGHT_CANVAS_MODULE_CODENAME)
        const serverFlightModule = runtimeModulesPayload.items?.find((item) => item?.codename === FIXED_TICK_SERVER_MODULE_CODENAME)
        expect(selectedFlightModule).toBeTruthy()
        expect(selectedFlightModule?.moduleRole).toBe('widget')
        expect(selectedFlightModule?.manifest?.methods).toEqual(
            expect.arrayContaining([expect.objectContaining({ target: expect.stringMatching(/^client/) })])
        )
        expect(serverFlightModule).toBeUndefined()

        const clientBundleResponse = await clientBundleResponsePromise
        expect(clientBundleResponse.ok()).toBeTruthy()
        expect(new URL(clientBundleResponse.url()).pathname).toContain(`/runtime/modules/${selectedFlightModule?.id}/client`)
        expect((await clientBundleResponse.text()).trim().length).toBeGreaterThan(0)
        await expectNoTechnicalLeakage(widget, {
            label: 'MMOOMM flight runtime widget',
            checkUuidSubstrings: true
        })
        await expect(widget).not.toContainText(/clientBundle|sourceCode|serverBundle|moduleRole|attachedToId/)
        await expectNoPageHorizontalOverflow(page, 'MMOOMM flight runtime')

        const moveButton = widget.getByRole('button', { name: /move to target/i })
        await expect(moveButton).toBeVisible()
        const canvas = page.getByTestId('playcanvas-canvas')
        await expect(canvas).toBeVisible()
        await expect(canvas).toHaveAttribute('data-runtime-module-executed', 'true', { timeout: 60_000 })
        await expect(canvas).toHaveAttribute('data-runtime-module-codename', FLIGHT_CANVAS_MODULE_CODENAME)
        await expect(canvas).toHaveAttribute('data-realtime-status', 'connected', { timeout: 60_000 })
        await expect(widget.getByTestId('playcanvas-realtime-status')).toContainText(/connected/i)
        await expect(canvas).toHaveAttribute('aria-label', /3D flight scene/i)
        await expect(page.getByTestId('dashboard-metadata-details-tables')).toHaveCount(0)
        await expect(page.getByTestId('center-zone-widget-detailsTable')).toHaveCount(0)
        await expect(page.getByTestId('center-zone-widget-detailsTitle')).toHaveCount(0)
        await expectNoPageVerticalOverflow(page, 'MMOOMM flight runtime')
        await expectCanvasFillsRuntimeViewport(page, canvas, 'MMOOMM flight runtime')

        russianSession = await createLoggedInBrowserContext(browser, {
            email: readOnlyEmail,
            password: readOnlyPassword
        })
        const russianPage = russianSession.page
        await russianPage.goto('/')
        await russianPage.evaluate(() => window.localStorage.setItem('i18nextLng', 'ru'))
        await russianPage.goto(`/a/${applicationId}`)
        await openSpaceSection(russianPage)
        const russianWidget = russianPage.getByTestId('playcanvas-canvas-widget')
        const russianCanvas = russianPage.getByTestId('playcanvas-canvas')
        await expect(russianCanvas).toHaveAttribute('data-realtime-status', 'connected', { timeout: 60_000 })
        await expect(russianWidget.getByTestId('playcanvas-realtime-status')).toContainText(/Realtime подключён/i)
        await expect(russianWidget.getByTestId('playcanvas-control-mode')).toContainText(/Только просмотр/i)
        await expect(russianWidget.getByRole('button', { name: /Лететь к цели/i })).toBeDisabled()
        await expect(russianWidget.getByRole('button', { name: /Остановить/i })).toBeDisabled()
        await expectNoPageHorizontalOverflow(russianPage, 'MMOOMM Russian read-only runtime')
        await russianSession.context.close()
        russianSession = null

        secondPilotSession = await createLoggedInBrowserContext(browser, {
            email: secondPilotEmail,
            password: secondPilotPassword
        })
        const secondPilotPage = secondPilotSession.page
        await secondPilotPage.goto(`/a/${applicationId}`)
        await openSpaceSection(secondPilotPage)
        const secondPilotWidget = secondPilotPage.getByTestId('playcanvas-canvas-widget')
        const secondPilotCanvas = secondPilotPage.getByTestId('playcanvas-canvas')
        await expect(secondPilotCanvas).toHaveAttribute('data-realtime-status', 'connected', { timeout: 60_000 })
        await expect(secondPilotCanvas).toHaveAttribute('data-local-ship-id-assigned', 'true', { timeout: 60_000 })
        await expect(secondPilotCanvas).toHaveAttribute('data-ship-count', '2', { timeout: 60_000 })
        await expect(secondPilotCanvas).toHaveAttribute('data-remote-ship-count', '1', { timeout: 60_000 })
        await expect(canvas).toHaveAttribute('data-ship-count', '2', { timeout: 60_000 })
        await expect(canvas).toHaveAttribute('data-remote-ship-count', '1', { timeout: 60_000 })
        await expect(widget.getByTestId('playcanvas-participants-status')).toContainText(/ships:\s*2/i)
        await expect(widget.getByTestId('playcanvas-participants-status')).toContainText(/remote/i)
        await expect(secondPilotWidget.getByTestId('playcanvas-participants-status')).toContainText(/ships:\s*2/i)
        await expect
            .poll(async () => distance3d(await readShipPosition(canvas), await readShipPosition(secondPilotCanvas)), { timeout: 15_000 })
            .toBeGreaterThan(10)
        const initialPrimaryShip = await readShipPosition(canvas)
        const initialSecondShip = await readShipPosition(secondPilotCanvas)
        await expectNoTechnicalLeakage(secondPilotWidget, {
            label: 'MMOOMM second pilot widget',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(secondPilotPage, 'MMOOMM second pilot runtime')

        await Promise.all([
            sendCanvasMoveToTarget(canvas, initialSecondShip),
            sendCanvasMoveToTarget(secondPilotCanvas, initialPrimaryShip)
        ])
        const collisionCourseSeparationSamples: number[] = []
        const primaryRenderedPenetrationSamples: boolean[] = []
        const secondRenderedPenetrationSamples: boolean[] = []
        const sampleCollisionCourse = async () => {
            const primary = await readShipPosition(canvas)
            const second = await readShipPosition(secondPilotCanvas)
            const primaryForward = await readShipForward(canvas)
            const secondForward = await readShipForward(secondPilotCanvas)
            collisionCourseSeparationSamples.push(distance3d(primary, second))
            primaryRenderedPenetrationSamples.push(
                shipsPenetrateAabb(
                    primary,
                    primaryForward,
                    await readRemoteRenderedShipPosition(canvas),
                    await readRemoteRenderedShipForward(canvas)
                )
            )
            secondRenderedPenetrationSamples.push(
                shipsPenetrateAabb(
                    second,
                    secondForward,
                    await readRemoteRenderedShipPosition(secondPilotCanvas),
                    await readRemoteRenderedShipForward(secondPilotCanvas)
                )
            )
            return distance3d(primary, second)
        }
        await expect.poll(sampleCollisionCourse, { timeout: 30_000 }).toBeLessThanOrEqual(13)
        for (let sampleIndex = 0; sampleIndex < 20; sampleIndex += 1) {
            await page.waitForTimeout(100)
            await sampleCollisionCourse()
        }
        expect(
            Math.min(...collisionCourseSeparationSamples),
            'server-authoritative collision course should bring ships close enough to prove contact handling'
        ).toBeLessThanOrEqual(13)
        expect(primaryRenderedPenetrationSamples, 'primary client must not render the remote ship inside the local ship').not.toContain(
            true
        )
        expect(secondRenderedPenetrationSamples, 'second client must not render the remote ship inside the local ship').not.toContain(true)

        await expect
            .poll(() => readCanvasColorEvidence(canvas), { timeout: 60_000 })
            .toMatchObject({ readable: true, coloredSamples: expect.any(Number) })
        const colorEvidence = await readCanvasColorEvidence(canvas)
        expect(colorEvidence.coloredSamples).toBeGreaterThan(0)
        expect(colorEvidence.whitePixels).toBeGreaterThan(500)
        expect(colorEvidence.whiteBoundsWidth).toBeGreaterThan(20)
        expect(colorEvidence.whiteBoundsHeight).toBeGreaterThan(8)
        expect(colorEvidence.remoteTintPixels).toBeGreaterThan(80)

        const initialX = Number((await canvas.getAttribute('data-ship-x')) ?? '0')
        const initialStationDistance = distance2d(await readShipPosition(canvas), { x: 72, z: -48 })
        const initialAuthoritativeUpdates = Number((await canvas.getAttribute('data-authoritative-updates')) ?? '0')
        const beforeMoveVisual = await readCanvasColorEvidence(canvas)
        const stationPoint = await getCanvasClickPoint(canvas, 'data-station-screen-x', 'data-station-screen-y')
        await canvas.click({ position: stationPoint })
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object')
        await expect(canvas).toHaveAttribute('data-last-intent-object-id', 'station')
        await expect.poll(async () => Math.abs((await readLastIntentTarget(canvas)).x - 72)).toBeGreaterThan(1)
        await expect.poll(async () => Math.abs((await readLastIntentTarget(canvas)).z + 48)).toBeGreaterThan(1)
        const stationSafeTarget = await readLastIntentTarget(canvas)
        await expect
            .poll(async () => Number((await canvas.getAttribute('data-ship-x')) ?? '0'), { timeout: 30_000 })
            .toBeGreaterThan(initialX + 5)
        const stationOverlapSamples: boolean[] = []
        await expect
            .poll(
                async () => {
                    const shipPosition = await readShipPosition(canvas)
                    stationOverlapSamples.push(shipOverlapsStationAabb(shipPosition, await readShipForward(canvas)))
                    return distance2d(shipPosition, { x: 72, z: -48 })
                },
                { timeout: 30_000 }
            )
            .toBeLessThan(initialStationDistance - 25)
        expect(stationOverlapSamples).not.toContain(true)
        expect(shipOverlapsStationAabb(await readShipPosition(canvas), await readShipForward(canvas))).toBe(false)
        await expect
            .poll(async () => distance3d(await readShipPosition(canvas), stationSafeTarget), { timeout: MOVEMENT_TIMEOUT })
            .toBeLessThan(1)
        await expect.poll(() => getNumberAttr(canvas, 'data-ship-guard-clearance'), { timeout: 30_000 }).toBeGreaterThanOrEqual(0)
        await expect
            .poll(() => getNumberAttr(canvas, 'data-ship-guard-clearance'), { timeout: 30_000 })
            .toBeLessThanOrEqual(CONTACT_TOLERANCE)
        expect(stationVisualClearance(await readShipPosition(canvas), await readShipForward(canvas))).toBeLessThanOrEqual(CONTACT_TOLERANCE)
        await expect
            .poll(async () => Number((await canvas.getAttribute('data-authoritative-updates')) ?? '0'), { timeout: 30_000 })
            .toBeGreaterThan(initialAuthoritativeUpdates + 2)
        const afterMoveVisual = await readCanvasColorEvidence(canvas)
        expect(
            Math.abs(afterMoveVisual.whiteCenterX - beforeMoveVisual.whiteCenterX) +
                Math.abs(afterMoveVisual.whiteCenterY - beforeMoveVisual.whiteCenterY)
        ).toBeGreaterThanOrEqual(1)
        await expect
            .poll(async () => distance3d(await readRemoteShipPosition(secondPilotCanvas), await readShipPosition(canvas)), {
                timeout: 30_000
            })
            .toBeLessThan(5)

        const primaryRemoteBeforeSecondMove = await readRemoteShipPosition(canvas)
        const secondMoveTarget = await resolveFreeSpaceDoubleClickTarget(secondPilotCanvas, initialSecondShip, {
            label: 'second pilot movement',
            minDistance: 120
        })
        await expect
            .poll(async () => distance3d(await readShipPosition(secondPilotCanvas), secondMoveTarget), { timeout: MOVEMENT_TIMEOUT })
            .toBeLessThan(8)
        await expect
            .poll(async () => distance3d(await readRemoteShipPosition(canvas), await readShipPosition(secondPilotCanvas)), {
                timeout: 30_000
            })
            .toBeLessThan(5)
        expect(distance3d(primaryRemoteBeforeSecondMove, await readRemoteShipPosition(canvas))).toBeGreaterThan(5)
        const shipSeparationSamples: number[] = []
        const shipOverlapSamples: boolean[] = []
        const postMovementTargetRemainingSamples: number[] = []
        for (let sample = 0; sample < 10; sample += 1) {
            const primary = await readShipPosition(canvas)
            const second = await readShipPosition(secondPilotCanvas)
            shipSeparationSamples.push(distance3d(primary, second))
            postMovementTargetRemainingSamples.push(
                Math.min(distance3d(primary, initialSecondShip), distance3d(second, initialPrimaryShip))
            )
            shipOverlapSamples.push(
                shipsOverlapAabb(
                    primary,
                    await readShipForward(canvas),
                    await readRemoteRenderedShipPosition(canvas),
                    await readRemoteRenderedShipForward(canvas)
                )
            )
            await page.waitForTimeout(100)
        }
        expect(
            Math.max(...shipSeparationSamples),
            'server-authoritative ships should remain separately trackable while both clients are active'
        ).toBeGreaterThan(5)
        expect(
            Math.min(...postMovementTargetRemainingSamples),
            'server-authoritative ships must not continue through each other to the opposite ship origin'
        ).toBeGreaterThan(2)
        expect(shipOverlapSamples, 'rendered local and remote ship hulls must not overlap').not.toContain(true)

        const observerPage = await page.context().newPage()
        await observerPage.goto(`/a/${applicationId}`)
        await openSpaceSection(observerPage)
        const observerCanvas = observerPage.getByTestId('playcanvas-canvas')
        await expect(observerCanvas).toHaveAttribute('data-realtime-status', 'connected', { timeout: 60_000 })
        const observerInitial = await readShipPosition(observerCanvas)
        const shipPoint = await getCanvasClickPoint(canvas, 'data-ship-screen-x', 'data-ship-screen-y')
        const canvasBox = await canvas.boundingBox()
        if (!canvasBox) {
            throw new Error('Canvas box is not available for empty-space movement')
        }
        const beforeDoubleClickPosition = await readShipPosition(canvas)
        const beforeDoubleClickForward = normalizeVector(await readShipForward(canvas))
        const beforeDoubleClickNoseOffset = await readShipNoseScreenOffset(canvas)
        const initialCameraPitch = await getNumberAttr(canvas, 'data-camera-pitch')
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5)
        await page.mouse.down()
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.82, { steps: 8 })
        await expect(canvas).toHaveAttribute('data-pointer-captured', 'true')
        await page.mouse.up()
        await expect(canvas).toHaveAttribute('data-pointer-captured', 'false')
        await expect
            .poll(async () => Math.abs((await getNumberAttr(canvas, 'data-camera-pitch')) - initialCameraPitch), { timeout: 10_000 })
            .toBeGreaterThan(0.5)
        await canvas.focus()
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5)
        await page.mouse.down()
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.62, canvasBox.y + canvasBox.height * 0.62, { steps: 4 })
        await expect(canvas).toHaveAttribute('data-pointer-captured', 'true')
        await page.keyboard.press('Escape')
        await expect(canvas).toHaveAttribute('data-pointer-captured', 'false')
        await page.mouse.up()
        const candidateDoubleClickPoints = [
            { x: shipPoint.x - canvasBox.width * 0.34, y: shipPoint.y - canvasBox.height * 0.34 },
            { x: shipPoint.x + canvasBox.width * 0.34, y: shipPoint.y - canvasBox.height * 0.34 },
            { x: shipPoint.x - canvasBox.width * 0.34, y: shipPoint.y + canvasBox.height * 0.28 },
            { x: shipPoint.x + canvasBox.width * 0.34, y: shipPoint.y + canvasBox.height * 0.28 },
            { x: canvasBox.width * 0.18, y: canvasBox.height * 0.22 },
            { x: canvasBox.width * 0.82, y: canvasBox.height * 0.22 },
            { x: canvasBox.width * 0.18, y: canvasBox.height * 0.78 },
            { x: canvasBox.width * 0.82, y: canvasBox.height * 0.78 }
        ].map((point) => ({
            x: Math.max(20, Math.min(canvasBox.width - 20, point.x)),
            y: Math.max(20, Math.min(canvasBox.height - 20, point.y))
        }))
        const doubleClickTarget = await resolveFreeSpaceDoubleClickTarget(canvas, beforeDoubleClickPosition, {
            label: 'vertical double-click movement',
            minDistance: 600,
            requireVerticalDelta: 80,
            requireTurnFrom: beforeDoubleClickForward,
            points: candidateDoubleClickPoints
        })
        expect(distance3d(beforeDoubleClickPosition, doubleClickTarget)).toBeGreaterThan(600)
        expect(Math.abs(doubleClickTarget.y - beforeDoubleClickPosition.y)).toBeGreaterThan(80)
        const expectedForward = normalizeVector({
            x: doubleClickTarget.x - beforeDoubleClickPosition.x,
            y: doubleClickTarget.y - beforeDoubleClickPosition.y,
            z: doubleClickTarget.z - beforeDoubleClickPosition.z
        })
        expect(dotVector(beforeDoubleClickForward, expectedForward), 'double-click target must require a visible turn').toBeLessThan(0.95)
        await expect(canvas).toHaveAttribute('data-ship-turning', 'true', { timeout: 5_000 })
        expect(
            dotVector(normalizeVector(await readShipForward(canvas)), expectedForward),
            'ship must not snap to the new heading immediately'
        ).toBeLessThan(0.999)
        const turnSamples: Array<{ forward: { x: number; y: number; z: number }; sampledAt: number }> = []
        const expectedAlignmentSamples: number[] = []
        for (let sample = 0; sample < 15; sample += 1) {
            const forward = await readShipForward(canvas)
            turnSamples.push({ forward, sampledAt: Date.now() })
            expectedAlignmentSamples.push(dotVector(normalizeVector(forward), expectedForward))
            await page.waitForTimeout(80)
        }
        for (let sample = 1; sample < turnSamples.length; sample += 1) {
            const currentForward = normalizeVector(turnSamples[sample].forward)
            const previousForward = normalizeVector(turnSamples[sample - 1].forward)
            const elapsedSeconds = Math.max(0.08, (turnSamples[sample].sampledAt - turnSamples[sample - 1].sampledAt) / 1000)
            const turnDeltaRadians = Math.acos(Math.max(-1, Math.min(1, dotVector(previousForward, currentForward))))
            const maxExpectedTurnRadians = Math.min(0.85, Math.max(0.01, elapsedSeconds * 1.8) + 0.15)
            expect(
                Math.hypot(currentForward.x, currentForward.y, currentForward.z),
                'ship forward vector must stay normalized'
            ).toBeGreaterThan(0.99)
            expect(
                Math.hypot(currentForward.x, currentForward.y, currentForward.z),
                'ship forward vector must stay normalized'
            ).toBeLessThan(1.01)
            expect(turnDeltaRadians, 'ship turn must not snap or spin between sampled frames').toBeLessThanOrEqual(maxExpectedTurnRadians)
            expect(
                expectedAlignmentSamples[sample],
                'ship turn should converge toward the clicked heading without oscillating away'
            ).toBeGreaterThanOrEqual(expectedAlignmentSamples[sample - 1] - 0.02)
        }
        expect(
            Math.max(...turnSamples.map((sample) => Math.abs(sample.forward.y))),
            'ship must pitch toward vertical free-space targets'
        ).toBeGreaterThan(0.05)
        const movementSamples: Array<{ position: { x: number; y: number; z: number }; remaining: number; sampledAt: number }> = []
        for (let sample = 0; sample < 12; sample += 1) {
            const position = await readShipPosition(canvas)
            movementSamples.push({ position, remaining: distance3d(position, doubleClickTarget), sampledAt: Date.now() })
            await page.waitForTimeout(80)
        }
        for (let sample = 1; sample < movementSamples.length; sample += 1) {
            const elapsedSeconds = Math.max(0.08, (movementSamples[sample].sampledAt - movementSamples[sample - 1].sampledAt) / 1000)
            const maxExpectedSampleStep = Math.max(20, elapsedSeconds * 240)
            expect(
                movementSamples[sample].remaining,
                'local predicted movement should converge toward the vertical target without reversing'
            ).toBeLessThanOrEqual(movementSamples[sample - 1].remaining + 1)
            expect(
                distance3d(movementSamples[sample - 1].position, movementSamples[sample].position),
                'local predicted movement should not snap between sampled browser frames'
            ).toBeLessThanOrEqual(maxExpectedSampleStep)
        }
        expect(
            Math.abs((await readShipVisualForward(canvas)).y),
            'rendered PlayCanvas hull must pitch, not only the logical heading vector'
        ).toBeGreaterThan(0.05)
        expect(
            dotVector(normalizeVector(await readShipVisualForward(canvas)), normalizeVector(await readShipForward(canvas))),
            'rendered hull forward and logical heading must stay aligned'
        ).toBeGreaterThan(0.995)
        const afterPitchNoseOffset = await readShipNoseScreenOffset(canvas)
        expect(
            Math.hypot(afterPitchNoseOffset.x - beforeDoubleClickNoseOffset.x, afterPitchNoseOffset.y - beforeDoubleClickNoseOffset.y),
            'computed hull nose point must move on screen when the rendered hull pitches'
        ).toBeGreaterThan(1)
        expect(distance3d(await readShipPosition(observerCanvas), observerInitial)).toBeGreaterThanOrEqual(0)
        await expect
            .poll(async () => dotVector(normalizeVector(await readShipForward(canvas)), expectedForward), { timeout: 30_000 })
            .toBeGreaterThan(0.9)
        await expect
            .poll(async () => distance3d(await readShipPosition(canvas), doubleClickTarget), { timeout: MOVEMENT_TIMEOUT })
            .toBeLessThan(5)
        expect(shipOverlapsStationAabb(await readShipPosition(canvas), await readShipForward(canvas))).toBe(false)

        await expect
            .poll(
                async () => {
                    const primary = await readShipPosition(canvas)
                    const observer = await readShipPosition(observerCanvas)
                    return Math.abs(primary.x - observer.x) + Math.abs(primary.y - observer.y) + Math.abs(primary.z - observer.z)
                },
                { timeout: 30_000 }
            )
            .toBeLessThan(4)
        await observerPage.close()

        await widget.getByRole('button', { name: /stop/i }).click()
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'stop')
        const stoppedBeforeObserver = await readShipPosition(canvas)
        await expect.poll(async () => distance2d(stoppedBeforeObserver, await readShipPosition(canvas)), { timeout: 5_000 }).toBeLessThan(2)
        readOnlySession = await createLoggedInBrowserContext(browser, {
            email: readOnlyEmail,
            password: readOnlyPassword
        })
        const readOnlyPage = readOnlySession.page
        await readOnlyPage.goto(`/a/${applicationId}`)
        await openSpaceSection(readOnlyPage)
        const readOnlyWidget = readOnlyPage.getByTestId('playcanvas-canvas-widget')
        const readOnlyCanvas = readOnlyPage.getByTestId('playcanvas-canvas')
        await expect(readOnlyCanvas).toHaveAttribute('data-realtime-status', 'connected', { timeout: 60_000 })
        await expect(readOnlyWidget.getByTestId('playcanvas-control-mode')).toContainText(/view only/i)
        await expect(readOnlyWidget.getByTestId('playcanvas-participants-status')).toContainText(/ships:\s*2/i)
        await expect(readOnlyWidget.getByRole('button', { name: /move to target/i })).toBeDisabled()
        await expect(readOnlyWidget.getByRole('button', { name: /stop/i })).toBeDisabled()
        await expectNoTechnicalLeakage(readOnlyWidget, {
            label: 'MMOOMM read-only observer widget',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(readOnlyPage, 'MMOOMM read-only observer runtime')
        const beforeReadOnlyActions = await readShipPosition(canvas)
        const readOnlyCanvasBox = await readOnlyCanvas.boundingBox()
        if (!readOnlyCanvasBox) {
            throw new Error('Read-only canvas box is not available')
        }
        const readOnlyActionPoint = { x: readOnlyCanvasBox.width * 0.5, y: readOnlyCanvasBox.height * 0.5 }
        await readOnlyCanvas.click({ position: readOnlyActionPoint })
        await readOnlyCanvas.dblclick({ position: readOnlyActionPoint })
        await readOnlyCanvas.focus()
        await readOnlyPage.keyboard.press('Enter')
        await readOnlyPage.keyboard.press('Escape')
        await expect(readOnlyCanvas).not.toHaveAttribute('data-last-intent-kind', /.+/)
        const readOnlyCameraDistance = await getNumberAttr(readOnlyCanvas, 'data-camera-distance')
        await readOnlyWidget.getByRole('button', { name: /zoom in/i }).click()
        await expect
            .poll(() => getNumberAttr(readOnlyCanvas, 'data-camera-distance'), { timeout: 10_000 })
            .toBeLessThan(readOnlyCameraDistance)
        await readOnlySession.context.close()
        readOnlySession = null
        await expect.poll(async () => distance2d(beforeReadOnlyActions, await readShipPosition(canvas)), { timeout: 5_000 }).toBeLessThan(2)

        const beforeStop = await readShipPosition(canvas)
        await widget.getByRole('button', { name: /move to target/i }).focus()
        await expect(widget.getByRole('button', { name: /move to target/i })).toBeFocused()
        let tabbedIntoCanvas = false
        for (let attempt = 0; attempt < 12; attempt += 1) {
            await page.keyboard.press('Tab')
            if (await canvas.evaluate((node) => document.activeElement === node)) {
                tabbedIntoCanvas = true
                break
            }
        }
        expect(tabbedIntoCanvas, 'keyboard Tab navigation must enter the 3D flight canvas').toBe(true)
        await page.keyboard.press('Tab')
        await expect.poll(() => canvas.evaluate((node) => document.activeElement === node), { timeout: 5_000 }).toBe(false)
        await canvas.focus()
        await expect(canvas).toBeFocused()
        await page.keyboard.press('Escape')
        await widget.getByRole('button', { name: /stop/i }).click()
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'stop')
        const afterStop = await readShipPosition(canvas)
        await expect.poll(async () => distance2d(afterStop, await readShipPosition(canvas)), { timeout: 5_000 }).toBeLessThan(2)
        const settledAfterStop = await readShipPosition(canvas)
        expect(distance2d(afterStop, settledAfterStop)).toBeLessThan(2)
        expect(distance2d(beforeStop, settledAfterStop)).toBeLessThan(80)
        await page.context().setOffline(true)
        await expect(canvas).toHaveAttribute('data-realtime-status', 'reconnecting', { timeout: 15_000 })
        await expect(widget.getByTestId('playcanvas-realtime-status')).toContainText(/reconnecting/i)
        await expect(widget.getByText(/realtime control is reconnecting/i)).toBeVisible()
        const reconnectingIntent = (await canvas.getAttribute('data-last-intent-kind')) ?? ''
        await widget.getByRole('button', { name: /stop/i }).click({ force: true })
        await canvas.focus()
        await page.keyboard.press('Enter')
        const reconnectingCanvasBox = await canvas.boundingBox()
        if (reconnectingCanvasBox) {
            await canvas.dblclick({
                position: {
                    x: Math.max(12, Math.min(reconnectingCanvasBox.width - 12, reconnectingCanvasBox.width * 0.25)),
                    y: Math.max(12, Math.min(reconnectingCanvasBox.height - 12, reconnectingCanvasBox.height * 0.25))
                },
                force: true
            })
        }
        await expect(canvas).toHaveAttribute('data-last-intent-kind', reconnectingIntent)
        await page.context().setOffline(false)
        await expect
            .poll(async () => (await canvas.getAttribute('data-realtime-status')) ?? '', { timeout: RECONNECT_TIMEOUT })
            .toMatch(/^(restored|connected)$/)
        await expect(canvas).toHaveAttribute('data-reconnect-restored', 'true')
        await expect(canvas).toHaveAttribute('data-ship-count', '2', { timeout: 30_000 })
        await expect(canvas).toHaveAttribute('data-remote-ship-count', '1', { timeout: 30_000 })
        await expectNoPageHorizontalOverflow(page, 'MMOOMM flight runtime after reconnect')
        const restoredRemoteBefore = await readRemoteShipPosition(canvas)
        const secondPilotAfterReconnect = await readShipPosition(secondPilotCanvas)
        const secondPilotReconnectTarget = await resolveFreeSpaceDoubleClickTarget(secondPilotCanvas, secondPilotAfterReconnect, {
            label: 'post-reconnect second pilot movement',
            minDistance: 120
        })
        await expect
            .poll(async () => distance3d(await readShipPosition(secondPilotCanvas), secondPilotReconnectTarget), {
                timeout: MOVEMENT_TIMEOUT
            })
            .toBeLessThan(8)
        await expect
            .poll(async () => distance3d(await readRemoteShipPosition(canvas), await readShipPosition(secondPilotCanvas)), {
                timeout: 30_000
            })
            .toBeLessThan(5)
        expect(
            distance3d(restoredRemoteBefore, await readRemoteShipPosition(canvas)),
            'restored client must continue receiving remote authoritative ship movement after reconnect'
        ).toBeGreaterThan(5)

        const cameraDistance = await getNumberAttr(canvas, 'data-camera-distance')
        const beforeZoomVisual = await readCanvasColorEvidence(canvas)
        await widget.getByRole('button', { name: /zoom in/i }).click()
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-distance'), { timeout: 10_000 }).toBeLessThan(cameraDistance)
        const afterZoomVisual = await readCanvasColorEvidence(canvas)
        expect(afterZoomVisual.coloredSamples).toBeGreaterThan(0)
        expect(afterZoomVisual.whitePixels).toBeGreaterThan(80)
        expect(Number.isFinite(afterZoomVisual.whiteCenterX + afterZoomVisual.whiteCenterY)).toBe(true)
        await page.evaluate(() => window.scrollTo(0, 0))
        const beforeWheelZoomDistance = await getNumberAttr(canvas, 'data-camera-distance')
        await canvas.hover()
        await page.mouse.wheel(0, -400)
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-distance'), { timeout: 10_000 }).toBeLessThan(beforeWheelZoomDistance)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        const beforeWheelOutDistance = await getNumberAttr(canvas, 'data-camera-distance')
        await page.mouse.wheel(0, 400)
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-distance'), { timeout: 10_000 }).toBeGreaterThan(beforeWheelOutDistance)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        await expectNoPageVerticalOverflow(page, 'MMOOMM flight runtime after wheel zoom')
        const cameraYaw = await getNumberAttr(canvas, 'data-camera-yaw')
        await widget.getByRole('button', { name: /rotate right/i }).click()
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-yaw'), { timeout: 10_000 }).toBeGreaterThan(cameraYaw)

        const beforeFinalMove = await readShipPosition(canvas)
        const finalTarget = await resolveFreeSpaceDoubleClickTarget(canvas, beforeFinalMove, {
            label: 'final movement',
            minDistance: 120
        })
        const initialFinalTargetDistance = distance3d(beforeFinalMove, finalTarget)
        await expect
            .poll(async () => distance3d(await readShipPosition(canvas), finalTarget), { timeout: MOVEMENT_TIMEOUT })
            .toBeLessThan(initialFinalTargetDistance - 25)
        expect(shipOverlapsStationAabb(await readShipPosition(canvas), await readShipForward(canvas))).toBe(false)

        await expectRuntimeUxViewportMatrix(page, 'MMOOMM flight runtime', {
            beforeEachViewport: async () => {
                await expect(canvas).toBeVisible()
                await expectNoPageVerticalOverflow(page, 'MMOOMM flight runtime viewport matrix')
                await expectCanvasFillsRuntimeViewport(page, canvas, 'MMOOMM flight runtime viewport matrix')
                const evidence = await readCanvasColorEvidence(canvas)
                expect(evidence.whitePixels).toBeGreaterThan(300)
            }
        })

        await moveButton.click()
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object')
        await page.context().setOffline(true)
        await expect(canvas).toHaveAttribute('data-realtime-status', 'failed_reconnect', { timeout: RECONNECT_TIMEOUT })
        await expect(widget.getByText(/realtime control could not reconnect/i)).toBeVisible()
        await expect(widget.getByRole('button', { name: /move to target/i })).toBeDisabled()
        await expect(widget.getByRole('button', { name: /stop/i })).toBeDisabled()
        await expectNoTechnicalLeakage(widget, {
            label: 'MMOOMM failed reconnect runtime widget',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'MMOOMM flight runtime after failed reconnect')
    } finally {
        await unauthorizedSession?.context.close().catch(() => undefined)
        await readOnlySession?.context.close().catch(() => undefined)
        await secondPilotSession?.context.close().catch(() => undefined)
        await russianSession?.context.close().catch(() => undefined)
        await page
            .context()
            .setOffline(false)
            .catch(() => undefined)
        await disposeApiContext(api)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
