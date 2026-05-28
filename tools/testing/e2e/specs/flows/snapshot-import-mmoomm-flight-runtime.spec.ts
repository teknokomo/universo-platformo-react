import type { Locator, Page } from '@playwright/test'
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
        }
        return {
            readable: true,
            coloredSamples,
            whitePixels,
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

const distance2d = (left: { x: number; z: number }, right: { x: number; z: number }) => Math.hypot(left.x - right.x, left.z - right.z)
const distance3d = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)

const normalizeVector = (value: { x: number; y: number; z: number }) => {
    const length = Math.hypot(value.x, value.y, value.z)
    return length > 0.000001 ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 1, y: 0, z: 0 }
}

const SHIP_BOUNDING_RADIUS = Math.hypot(6, 2, 2)
const STATION_GUARD_HALF = { x: 24 + SHIP_BOUNDING_RADIUS, y: 8 + SHIP_BOUNDING_RADIUS, z: 8 + SHIP_BOUNDING_RADIUS }

const dotVector = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }) =>
    left.x * right.x + left.y * right.y + left.z * right.z

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
    const spaceButton = page.getByRole('button', { name: /^Space$/ })
    await expect(spaceButton).toBeVisible({ timeout: 60_000 })
    await spaceButton.click()
}

const aabbOverlap = (
    left: { center: { x: number; y: number; z: number }; half: { x: number; y: number; z: number } },
    right: { center: { x: number; y: number; z: number }; half: { x: number; y: number; z: number } }
) =>
    Math.abs(left.center.x - right.center.x) <= left.half.x + right.half.x &&
    Math.abs(left.center.y - right.center.y) <= left.half.y + right.half.y &&
    Math.abs(left.center.z - right.center.z) <= left.half.z + right.half.z

const shipOverlapsStationAabb = (shipCenter: { x: number; y: number; z: number }) =>
    aabbOverlap(
        { center: shipCenter, half: { x: SHIP_BOUNDING_RADIUS, y: SHIP_BOUNDING_RADIUS, z: SHIP_BOUNDING_RADIUS } },
        { center: { x: 72, y: 0, z: -48 }, half: { x: 24, y: 8, z: 8 } }
    )

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
        half: STATION_GUARD_HALF
    }) || shipOverlapsStationAabb(to)

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

test('@flow imported MMOOMM flight snapshot renders PlayCanvas runtime and moves ship', async ({ browser, page, runManifest }) => {
    test.setTimeout(240_000)

    const bootstrapApi = await createBootstrapApiContext()
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    let readOnlySession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const readOnlyEmail = `e2e+${runManifest.runId}.mmoomm-observer@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
        const readOnlyPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        const readOnlyGlobalRoleCodename = `MmoommObserver${runManifest.runId.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 48)
        const readOnlyGlobalRole = await createRole(bootstrapApi, {
            codename: localizedText(readOnlyGlobalRoleCodename),
            name: localizedText('MMOOMM observer'),
            description: localizedText(`Read-only MMOOMM observer coverage ${runManifest.runId}`),
            color: '#607d8b',
            isSuperuser: false,
            permissions: []
        })
        await recordCreatedRole({ id: readOnlyGlobalRole.id, codename: readOnlyGlobalRoleCodename })
        const createdReadOnlyUser = await createAdminUser(bootstrapApi, {
            email: readOnlyEmail,
            password: readOnlyPassword,
            roleIds: [readOnlyGlobalRole.id],
            comment: `Created for MMOOMM observer coverage ${runManifest.runId}`
        })
        if (!createdReadOnlyUser?.userId) {
            throw new Error(`Created user ${readOnlyEmail} did not return a user id`)
        }
        await recordCreatedGlobalUser({ userId: createdReadOnlyUser.userId, email: readOnlyEmail })
        await waitForBrowserLoginReadiness({ email: readOnlyEmail, password: readOnlyPassword })

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

        const linkedApplication = await createApplicationThroughBrowser(
            page,
            api,
            metahubId,
            publicationId,
            `E2E ${runManifest.runId} MMOOMM Flight Runtime`
        )
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
        await syncApplicationThroughBrowser(page, api, applicationId, connectorId)

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

        await expect
            .poll(() => readCanvasColorEvidence(canvas), { timeout: 60_000 })
            .toMatchObject({ readable: true, coloredSamples: expect.any(Number) })
        const colorEvidence = await readCanvasColorEvidence(canvas)
        expect(colorEvidence.coloredSamples).toBeGreaterThan(0)
        expect(colorEvidence.whitePixels).toBeGreaterThan(500)
        expect(colorEvidence.whiteBoundsWidth).toBeGreaterThan(20)
        expect(colorEvidence.whiteBoundsHeight).toBeGreaterThan(8)

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
                    stationOverlapSamples.push(shipOverlapsStationAabb(shipPosition))
                    return distance2d(shipPosition, { x: 72, z: -48 })
                },
                { timeout: 30_000 }
            )
            .toBeLessThan(initialStationDistance - 25)
        expect(stationOverlapSamples).not.toContain(true)
        expect(shipOverlapsStationAabb(await readShipPosition(canvas))).toBe(false)
        await expect.poll(async () => distance3d(await readShipPosition(canvas), stationSafeTarget), { timeout: 60_000 }).toBeLessThan(6)
        await expect.poll(() => getNumberAttr(canvas, 'data-ship-guard-clearance'), { timeout: 30_000 }).toBeGreaterThanOrEqual(6)
        await expect
            .poll(async () => Number((await canvas.getAttribute('data-authoritative-updates')) ?? '0'), { timeout: 30_000 })
            .toBeGreaterThan(initialAuthoritativeUpdates + 2)
        const afterMoveVisual = await readCanvasColorEvidence(canvas)
        expect(
            Math.abs(afterMoveVisual.whiteCenterX - beforeMoveVisual.whiteCenterX) +
                Math.abs(afterMoveVisual.whiteCenterY - beforeMoveVisual.whiteCenterY)
        ).toBeGreaterThanOrEqual(1)

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
        const initialCameraPitch = await getNumberAttr(canvas, 'data-camera-pitch')
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5)
        await page.mouse.down()
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.82, { steps: 8 })
        await page.mouse.up()
        await expect
            .poll(async () => Math.abs((await getNumberAttr(canvas, 'data-camera-pitch')) - initialCameraPitch), { timeout: 10_000 })
            .toBeGreaterThan(0.5)
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
        let doubleClickTarget: { x: number; y: number; z: number } | null = null
        for (const point of candidateDoubleClickPoints) {
            await canvas.dblclick({ position: point })
            await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
            const candidateTarget = await readLastIntentTarget(canvas)
            const candidateForward = normalizeVector({
                x: candidateTarget.x - beforeDoubleClickPosition.x,
                y: candidateTarget.y - beforeDoubleClickPosition.y,
                z: candidateTarget.z - beforeDoubleClickPosition.z
            })
            const hasLong3dPick = distance3d(beforeDoubleClickPosition, candidateTarget) > 600
            const hasVerticalPick = Math.abs(candidateTarget.y - beforeDoubleClickPosition.y) > 80
            const requiresTurn = dotVector(beforeDoubleClickForward, candidateForward) < 0.95
            if (
                hasLong3dPick &&
                hasVerticalPick &&
                requiresTurn &&
                !movementCrossesStationGuard(beforeDoubleClickPosition, candidateTarget)
            ) {
                doubleClickTarget = candidateTarget
                break
            }
        }
        expect(doubleClickTarget, 'double-click must find a long free-space 3D target outside the station guard path').not.toBeNull()
        if (!doubleClickTarget) {
            throw new Error('Double-click free-space target was not resolved')
        }
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
        ).toBeLessThan(0.995)
        expect(distance3d(await readShipPosition(observerCanvas), observerInitial)).toBeGreaterThanOrEqual(0)
        await expect
            .poll(async () => dotVector(normalizeVector(await readShipForward(canvas)), expectedForward), { timeout: 30_000 })
            .toBeGreaterThan(0.9)
        await expect.poll(async () => distance3d(await readShipPosition(canvas), doubleClickTarget), { timeout: 60_000 }).toBeLessThan(5)
        expect(shipOverlapsStationAabb(await readShipPosition(canvas))).toBe(false)

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
        await page.waitForTimeout(1800)
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
        await expect(readOnlyWidget.getByRole('button', { name: /move to target/i })).toBeDisabled()
        await expect(readOnlyWidget.getByRole('button', { name: /stop/i })).toBeDisabled()
        await expectNoTechnicalLeakage(readOnlyWidget, {
            label: 'MMOOMM read-only observer widget',
            checkUuidSubstrings: true
        })
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
        await page.waitForTimeout(1200)
        expect(distance2d(beforeReadOnlyActions, await readShipPosition(canvas))).toBeLessThan(2)

        const beforeStop = await readShipPosition(canvas)
        await canvas.focus()
        await expect(canvas).toBeFocused()
        await page.keyboard.press('Escape')
        await widget.getByRole('button', { name: /stop/i }).click()
        await expect(canvas).toHaveAttribute('data-last-intent-kind', 'stop')
        await page.waitForTimeout(1600)
        const afterStop = await readShipPosition(canvas)
        await page.waitForTimeout(1200)
        const settledAfterStop = await readShipPosition(canvas)
        expect(distance2d(afterStop, settledAfterStop)).toBeLessThan(2)
        expect(distance2d(beforeStop, settledAfterStop)).toBeLessThan(80)

        const cameraDistance = await getNumberAttr(canvas, 'data-camera-distance')
        const beforeZoomVisual = await readCanvasColorEvidence(canvas)
        await widget.getByRole('button', { name: /zoom in/i }).click()
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-distance'), { timeout: 10_000 }).toBeLessThan(cameraDistance)
        const afterZoomVisual = await readCanvasColorEvidence(canvas)
        expect(afterZoomVisual.whiteBoundsWidth + afterZoomVisual.whiteBoundsHeight).toBeGreaterThan(
            beforeZoomVisual.whiteBoundsWidth + beforeZoomVisual.whiteBoundsHeight
        )
        const beforeWheelScrollY = await page.evaluate(() => window.scrollY)
        const beforeWheelZoomDistance = await getNumberAttr(canvas, 'data-camera-distance')
        await canvas.hover()
        await page.mouse.wheel(0, -400)
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-distance'), { timeout: 10_000 }).toBeLessThan(beforeWheelZoomDistance)
        expect(await page.evaluate(() => window.scrollY)).toBe(beforeWheelScrollY)
        const beforeWheelOutDistance = await getNumberAttr(canvas, 'data-camera-distance')
        await page.mouse.wheel(0, 400)
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-distance'), { timeout: 10_000 }).toBeGreaterThan(beforeWheelOutDistance)
        expect(await page.evaluate(() => window.scrollY)).toBe(beforeWheelScrollY)
        await expectNoPageVerticalOverflow(page, 'MMOOMM flight runtime after wheel zoom')
        const cameraYaw = await getNumberAttr(canvas, 'data-camera-yaw')
        await widget.getByRole('button', { name: /rotate right/i }).click()
        await expect.poll(() => getNumberAttr(canvas, 'data-camera-yaw'), { timeout: 10_000 }).toBeGreaterThan(cameraYaw)

        const box = await canvas.boundingBox()
        if (!box) {
            throw new Error('Canvas bounding box is unavailable')
        }
        const beforeFinalMove = await readShipPosition(canvas)
        let finalTarget: { x: number; y: number; z: number } | null = null
        for (const point of [
            { x: box.width * 0.18, y: box.height * 0.22 },
            { x: box.width * 0.82, y: box.height * 0.22 },
            { x: box.width * 0.18, y: box.height * 0.78 },
            { x: box.width * 0.82, y: box.height * 0.78 }
        ]) {
            await canvas.dblclick({
                position: { x: Math.max(12, Math.min(box.width - 12, point.x)), y: Math.max(12, Math.min(box.height - 12, point.y)) }
            })
            await expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
            const candidateTarget = await readLastIntentTarget(canvas)
            if (!movementCrossesStationGuard(beforeFinalMove, candidateTarget)) {
                finalTarget = candidateTarget
                break
            }
        }
        expect(finalTarget, 'final movement target must avoid the station guard').not.toBeNull()
        if (!finalTarget) {
            throw new Error('Final free-space target was not resolved')
        }
        await expect.poll(async () => distance3d(await readShipPosition(canvas), finalTarget), { timeout: 60_000 }).toBeLessThan(5)
        expect(shipOverlapsStationAabb(await readShipPosition(canvas))).toBe(false)

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
    } finally {
        await readOnlySession?.context.close().catch(() => undefined)
        await disposeApiContext(api)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
