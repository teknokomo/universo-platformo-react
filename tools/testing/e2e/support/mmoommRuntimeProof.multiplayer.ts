import type { Browser, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext } from './backend/api-session.mjs'
import { createLoggedInBrowserContext, type UserCredentials } from './browser/auth'
import { expectNoPageHorizontalOverflow } from './browser/runtimeUx'
import { loadE2eEnvironment } from './env/load-e2e-env.mjs'
import {
    captureMmoommRuntimeParityTrace,
    expectMmoommRuntimeParityTrace,
    expectMmoommTraceShowsMovement,
    type MmoommRuntimeParityTrace
} from './mmoommScriptAssetsProof'
import { expectMmoommCanvasContained, expectMmoommRuntimeNoTechnicalLeakage, readCanvasNumberDataset } from './mmoommRuntimeProof.canvas'
import {
    MMOOMM_MOVE_TO_TARGET_BUTTON_NAME,
    MMOOMM_RECONNECT_TIMEOUT,
    MMOOMM_RUNTIME_EXPECT_TIMEOUT,
    MMOOMM_STOP_BUTTON_NAME,
    openMmoommSpaceSection
} from './mmoommRuntimeProof.navigation'

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
): Promise<MmoommRuntimeParityTrace> => {
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
        await expect(primaryCanvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
        // Capture the movement while the second post-reconnect intent is still
        // connected. The next step deliberately takes the client offline to
        // verify the failed-reconnect state, where controls are disabled and
        // no new movement should be expected from the browser oracle.
        const movementTrace = await captureMmoommRuntimeParityTrace(primaryPage, primaryCanvas, {
            samples: 14,
            intervalMs: 100
        })
        expectMmoommRuntimeParityTrace(movementTrace, 'MMOOMM published script-assets movement')
        expectMmoommTraceShowsMovement(movementTrace)
        await primaryPage.context().setOffline(true)
        await expect(primaryCanvas).toHaveAttribute('data-realtime-status', 'failed_reconnect', { timeout: MMOOMM_RECONNECT_TIMEOUT })
        await expect(primaryWidget.getByText(/realtime control could not reconnect/i)).toBeVisible()
        await expect(primaryWidget.getByRole('button', { name: MMOOMM_MOVE_TO_TARGET_BUTTON_NAME })).toBeDisabled()
        await expect(primaryWidget.getByRole('button', { name: MMOOMM_STOP_BUTTON_NAME })).toBeDisabled()
        await expectMmoommRuntimeNoTechnicalLeakage(primaryWidget, 'MMOOMM failed reconnect runtime widget')
        await expectMmoommCanvasContained(primaryWidget, primaryCanvas, 'MMOOMM failed reconnect runtime')
        await expectNoPageHorizontalOverflow(primaryPage, 'MMOOMM runtime after failed reconnect')
        return movementTrace
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
