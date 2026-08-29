import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import { expectMmoommRuntimeReady } from '../../support/mmoommRuntimeProof'
import {
    captureMmoommRuntimeBaselineTrace,
    captureMmoommRuntimeParityTrace,
    expectMmoommRuntimeParityTrace,
    expectMmoommTraceShowsCameraChange,
    expectMmoommTraceShowsMovement,
    expectMmoommRuntimeTraceWithinTolerance,
    loadMmoommRuntimeBaselineArtifact
} from '../../support/mmoommScriptAssetsProof'

const APPLICATION_SCHEMA_TIMEOUT = 180_000

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

test.describe('MMOOMM published script-assets runtime parity', () => {
    let api: LoggedInApiContext | null = null

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
            api = null
        }
    })

    test('@flow @slow imported MMOOMM script assets preserve a browser runtime baseline and movement trace', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(420_000)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

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

        const applicationName = `MMOOMM Runtime Parity ${runManifest.runId}`
        const linked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id ?? linked?.id
        const applicationSlug = linked?.application?.slug ?? linked?.slug
        if (typeof applicationId !== 'string') {
            throw new Error('MMOOMM runtime parity linked application did not return an application id')
        }
        await recordCreatedApplication({ id: applicationId, slug: applicationSlug })

        const replayLinked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: `${applicationName} replay` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const replayApplicationId = replayLinked?.application?.id ?? replayLinked?.id
        const replayApplicationSlug = replayLinked?.application?.slug ?? replayLinked?.slug
        if (typeof replayApplicationId !== 'string') {
            throw new Error('MMOOMM runtime parity replay application did not return an application id')
        }
        await recordCreatedApplication({ id: replayApplicationId, slug: replayApplicationSlug })

        await syncApplicationSchema(api, applicationId)
        await syncApplicationSchema(api, replayApplicationId)
        await expect
            .poll(
                async () => {
                    const application = await getApplication(api as LoggedInApiContext, applicationId)
                    return application?.schemaStatus ?? null
                },
                { timeout: APPLICATION_SCHEMA_TIMEOUT }
            )
            .toBe('synced')
        await expect
            .poll(
                async () => {
                    const application = await getApplication(api as LoggedInApiContext, replayApplicationId)
                    return application?.schemaStatus ?? null
                },
                { timeout: APPLICATION_SCHEMA_TIMEOUT }
            )
            .toBe('synced')

        const runtime = await expectMmoommRuntimeReady(page, applicationId, {
            label: 'MMOOMM published script-assets parity runtime',
            expectClientRuntimeModule: false
        })
        await expect(runtime.canvas).toHaveAttribute('data-scripts-loaded', 'true', { timeout: 60_000 })

        const preExtractionBaseline = await loadMmoommRuntimeBaselineArtifact()
        expectMmoommRuntimeParityTrace(preExtractionBaseline.trace, 'MMOOMM pre-extraction baseline', 'pre-extraction-widget')

        // The committed baseline was captured after this exact interaction
        // sequence. Keep the browser proof aligned with that historical run
        // instead of comparing an idle frame against a moving trace.
        await runtime.widget.getByRole('button', { name: /^Reset camera$/i }).click()
        await runtime.widget.getByRole('button', { name: /^Zoom in$/i }).click()
        await runtime.widget.getByRole('button', { name: /^Rotate right$/i }).click()
        await runtime.widget.getByRole('button', { name: /^Move to target$/i }).click()
        await expect(runtime.canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
        const baselineTrace = await captureMmoommRuntimeBaselineTrace(page, runtime.canvas)
        expectMmoommRuntimeParityTrace(baselineTrace, 'MMOOMM published script-assets baseline')
        await testInfo.attach('mmoomm-runtime-baseline-trace.json', {
            body: Buffer.from(JSON.stringify(baselineTrace, null, 2)),
            contentType: 'application/json'
        })
        await testInfo.attach('mmoomm-runtime-pre-extraction-baseline.json', {
            body: Buffer.from(JSON.stringify(preExtractionBaseline, null, 2)),
            contentType: 'application/json'
        })
        expectMmoommTraceShowsMovement(baselineTrace, 'MMOOMM published script-assets movement')
        expectMmoommRuntimeTraceWithinTolerance(
            preExtractionBaseline.trace,
            baselineTrace,
            // Guard clearance is derived from an oriented AABB. Small
            // differences in the sampled ship pose can move the nearest-point
            // result by a few units even while the actual collision invariant
            // is identical. Keep the non-penetration check strict (each sample
            // must be >= 0) and bound the derived-distance drift separately.
            { screenPixels: 1, worldUnits: 0.5, guardClearance: 2 },
            'MMOOMM published script-assets versus pre-extraction baseline'
        )

        // Use a second linked application so replay starts from the same
        // deterministic spawn state rather than the already moved first ship.
        await page.goto(`/a/${replayApplicationId}`)
        const replayRuntime = await expectMmoommRuntimeReady(page, replayApplicationId, {
            label: 'MMOOMM published script-assets replay runtime',
            expectClientRuntimeModule: false
        })
        await expect(replayRuntime.canvas).toHaveAttribute('data-scripts-loaded', 'true', { timeout: 60_000 })
        await replayRuntime.widget.getByRole('button', { name: /^Reset camera$/i }).click()
        await replayRuntime.widget.getByRole('button', { name: /^Zoom in$/i }).click()
        await replayRuntime.widget.getByRole('button', { name: /^Rotate right$/i }).click()
        await replayRuntime.widget.getByRole('button', { name: /^Move to target$/i }).click()
        await expect(replayRuntime.canvas).toHaveAttribute('data-last-intent-kind', 'move_to_object', { timeout: 15_000 })
        const replayTrace = await captureMmoommRuntimeBaselineTrace(page, replayRuntime.canvas)
        await testInfo.attach('mmoomm-runtime-replay-trace.json', {
            body: Buffer.from(JSON.stringify(replayTrace, null, 2)),
            contentType: 'application/json'
        })
        expectMmoommRuntimeParityTrace(replayTrace, 'MMOOMM published script-assets replay')
        expectMmoommRuntimeTraceWithinTolerance(
            baselineTrace,
            replayTrace,
            { screenPixels: 2, worldUnits: 1.5, guardClearance: 2 },
            'MMOOMM published script-assets replay parity'
        )

        // Exercise an additional camera-only interaction after the dynamic
        // parity trace. This proves the controls remain live after movement.
        const cameraBeforeTrace = await captureMmoommRuntimeParityTrace(page, replayRuntime.canvas, {
            samples: 4,
            intervalMs: 100
        })
        // The parity trace above already leaves the camera at the
        // reset+zoom+rotate pose. Apply a different user-facing delta here;
        // replaying the same three controls would return to the identical
        // pose and make the camera oracle compare two equal endpoints.
        await replayRuntime.widget.getByRole('button', { name: /^Zoom out$/i }).click()
        await replayRuntime.widget.getByRole('button', { name: /^Rotate left$/i }).click()
        const cameraTrace = await captureMmoommRuntimeParityTrace(page, replayRuntime.canvas, {
            samples: 4,
            intervalMs: 100
        })
        expectMmoommRuntimeParityTrace(cameraBeforeTrace, 'MMOOMM published script-assets camera baseline')
        expectMmoommRuntimeParityTrace(cameraTrace, 'MMOOMM published script-assets camera scenario')
        expectMmoommTraceShowsCameraChange(cameraBeforeTrace, cameraTrace)

        await replayRuntime.widget.getByRole('button', { name: /^Stop$/i }).click()
        await expect(replayRuntime.canvas).toHaveAttribute('data-last-intent-kind', 'stop', { timeout: 15_000 })
        await expectNoPageHorizontalOverflow(page, 'MMOOMM published script-assets parity runtime')

        await testInfo.attach('mmoomm-runtime-camera-scenario.json', {
            body: Buffer.from(JSON.stringify({ before: cameraBeforeTrace, after: cameraTrace }, null, 2)),
            contentType: 'application/json'
        })
    })
})
