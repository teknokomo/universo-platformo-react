import { isUuidV7 } from '@universo-react/utils'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    getLayoutZoneWidgetBindings,
    listLayouts,
    listLayoutZoneWidgets,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import { expectMmoommRuntimeReady, openMmoommSpaceSection } from '../../support/mmoommRuntimeProof'
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

const expectMmoommOverviewHeaderLayout = async (page: import('@playwright/test').Page, locale: 'en' | 'ru', label: string) => {
    const appToolbar = page.getByTestId('runtime-app-toolbar')
    const headerActions = page.getByTestId('runtime-header-actions')
    const languageSwitcher = page.getByTestId('runtime-language-switcher')
    const themeSwitcher = page.getByRole('button', {
        name: locale === 'ru' ? 'Цветовая схема' : 'Color mode',
        exact: true
    })
    const overviewTitle = page.getByRole('heading', {
        name: locale === 'ru' ? 'Добро пожаловать во Вселенную MMOOMM' : 'Welcome to Universo MMOOMM',
        exact: true
    })

    await expect(appToolbar, `${label}: application toolbar`).toHaveCount(1)
    await expect(headerActions, `${label}: header actions`).toHaveCount(1)
    await expect(languageSwitcher, `${label}: one language switcher`).toHaveCount(1)
    await expect(themeSwitcher, `${label}: one theme switcher`).toHaveCount(1)
    await expect(appToolbar).toBeVisible()
    await expect(headerActions).toBeVisible()
    await expect(languageSwitcher).toBeVisible()
    await expect(themeSwitcher).toBeVisible()
    await expect(overviewTitle).toBeVisible()

    const [toolbarBounds, actionsBounds, titleBounds] = await Promise.all([
        appToolbar.boundingBox(),
        headerActions.boundingBox(),
        overviewTitle.boundingBox()
    ])
    expect(toolbarBounds, `${label}: toolbar bounds`).not.toBeNull()
    expect(actionsBounds, `${label}: header action bounds`).not.toBeNull()
    expect(titleBounds, `${label}: overview title bounds`).not.toBeNull()
    if (!toolbarBounds || !actionsBounds || !titleBounds) return

    const gapAfterToolbar = actionsBounds.y - (toolbarBounds.y + toolbarBounds.height)
    const gapBeforeOverview = titleBounds.y - (actionsBounds.y + actionsBounds.height)
    expect(gapAfterToolbar, `${label}: header should remain within the toolbar's vertical footprint`).toBeGreaterThanOrEqual(-8)
    expect(gapAfterToolbar, `${label}: header should sit close below the fixed application toolbar`).toBeLessThanOrEqual(16)
    expect(gapBeforeOverview, `${label}: overview should follow the header without a large blank band`).toBeGreaterThanOrEqual(0)
    expect(gapBeforeOverview, `${label}: overview should follow the header without a large blank band`).toBeLessThanOrEqual(40)
    await expectNoPageHorizontalOverflow(page, label)
}

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type DashboardPlacement = { id?: string; widgetKey?: string }

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

        const importedLayouts = await listLayouts(api, imported.metahubId, { limit: 20, offset: 0 })
        const importedLayoutId = importedLayouts?.items?.[0]?.id
        if (typeof importedLayoutId !== 'string') throw new Error('MMOOMM snapshot import did not return its Dashboard layout')
        const importedPlacements = (await listLayoutZoneWidgets(api, imported.metahubId, importedLayoutId)) as {
            items?: DashboardPlacement[]
        }
        const overviewTitlePlacement = importedPlacements.items?.find(({ widgetKey }) => widgetKey === 'overviewTitle')
        if (typeof overviewTitlePlacement?.id !== 'string') {
            throw new Error('MMOOMM snapshot import did not seed its Overview title widget')
        }
        const initialBindingResponse = (await getLayoutZoneWidgetBindings(
            api,
            imported.metahubId,
            importedLayoutId,
            overviewTitlePlacement.id,
            'en'
        )) as { bindings?: Array<{ slot?: string; sourceKey?: string; semanticKey?: string }> }
        const initialContentBinding = initialBindingResponse.bindings?.find(({ slot }) => slot === 'content')
        if (initialContentBinding?.sourceKey !== 'Main' || typeof initialContentBinding.semanticKey !== 'string') {
            throw new Error('MMOOMM Overview title must start with its Main Entity record binding')
        }
        const originalSemanticKey = initialContentBinding.semanticKey
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/metahub/${imported.metahubId}/resources/layouts/${importedLayoutId}`)
        const openOverviewBindingEditor = page.getByTestId(`layout-widget-edit-${overviewTitlePlacement.id}`)
        await expect(openOverviewBindingEditor).toBeVisible()
        await openOverviewBindingEditor.click()
        const overviewBindingDialog = page
            .getByRole('dialog')
            .filter({ has: page.getByRole('combobox', { name: 'Content source', exact: true }) })
            .last()
        await expect(overviewBindingDialog).toBeVisible()
        const contentSourceSelector = overviewBindingDialog.getByRole('combobox', { name: 'Content source', exact: true })
        const contentRecordSelector = overviewBindingDialog.getByRole('combobox', { name: 'Content record', exact: true })
        await expect(contentSourceSelector).toHaveValue('Main')
        await expect(contentRecordSelector).toHaveValue('Welcome to Universo MMOOMM')
        await expect(overviewBindingDialog.getByRole('button', { name: 'Create content', exact: true })).toBeEnabled()
        await expect(overviewBindingDialog.getByRole('button', { name: 'Edit content', exact: true })).toBeEnabled()
        await testInfo.attach('mmoomm-overview-content-authoring-actions', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })
        await overviewBindingDialog.getByRole('button', { name: 'Edit content', exact: true }).click()
        const editRecordDialog = page.getByRole('dialog', { name: 'Edit content record', exact: true })
        await expect(editRecordDialog).toBeVisible()
        await expect(editRecordDialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
        const editableEnglishTitle = editRecordDialog
            .getByTestId('localized-inline-row-en')
            .getByRole('textbox', { name: 'Title', exact: true })
        const editedTitle = `MMOOMM edit check ${runManifest.runId}`
        await expect(editableEnglishTitle).toHaveValue('Welcome to Universo MMOOMM')
        await editableEnglishTitle.fill(editedTitle)
        const updateRecordResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'PATCH' &&
                url.pathname.startsWith(`/api/v1/metahub/${imported.metahubId}/entities/object/instance/`) &&
                /\/record\/[^/]+$/u.test(url.pathname)
            )
        })
        await editRecordDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const updateRecordResponse = await updateRecordResponsePromise
        expect(updateRecordResponse.ok()).toBe(true)
        expect(new URL(updateRecordResponse.url()).pathname).toMatch(
            new RegExp(`^/api/v1/metahub/${imported.metahubId}/entities/object/instance/[^/]+/record/[^/]+$`, 'u')
        )
        await expect(editRecordDialog).toHaveCount(0)
        await expect(contentRecordSelector).toHaveValue(editedTitle)

        await overviewBindingDialog.getByRole('button', { name: 'Edit content', exact: true }).click()
        const reopenedEditRecordDialog = page.getByRole('dialog', { name: 'Edit content record', exact: true })
        const reopenedEnglishTitle = reopenedEditRecordDialog
            .getByTestId('localized-inline-row-en')
            .getByRole('textbox', { name: 'Title', exact: true })
        await expect(reopenedEnglishTitle).toHaveValue(editedTitle)
        await reopenedEnglishTitle.fill('Welcome to Universo MMOOMM')
        const restoreRecordResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'PATCH' &&
                url.pathname.startsWith(`/api/v1/metahub/${imported.metahubId}/entities/object/instance/`) &&
                /\/record\/[^/]+$/u.test(url.pathname)
            )
        })
        await reopenedEditRecordDialog.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await restoreRecordResponsePromise).ok()).toBe(true)
        await expect(reopenedEditRecordDialog).toHaveCount(0)
        await expect(contentRecordSelector).toHaveValue('Welcome to Universo MMOOMM')

        const reopenedOverviewBindingDialog = page
            .getByRole('dialog')
            .filter({ has: page.getByRole('combobox', { name: 'Content source', exact: true }) })
            .last()
        await expect(reopenedOverviewBindingDialog).toBeVisible()
        await reopenedOverviewBindingDialog.getByRole('button', { name: 'Create content', exact: true }).click()
        const createRecordDialog = page.getByRole('dialog', { name: 'Create content record', exact: true })
        await expect(createRecordDialog).toBeVisible()
        const createdTitle = `Authoring check ${runManifest.runId}`
        await createRecordDialog.getByRole('textbox', { name: 'Title', exact: true }).fill(createdTitle)
        const saveNewRecordButton = createRecordDialog.getByRole('button', { name: 'Save', exact: true })
        await expect(saveNewRecordButton).toBeEnabled()
        const createRecordResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                url.pathname.startsWith(`/api/v1/metahub/${imported.metahubId}/entities/object/instance/`) &&
                /\/records$/u.test(url.pathname)
            )
        })
        await saveNewRecordButton.click()
        const createRecordResponse = await createRecordResponsePromise
        expect(createRecordResponse.status()).toBe(201)
        const createdRecord = (await createRecordResponse.json()) as { id?: string; data?: Record<string, unknown> }
        expect(createdRecord.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        const generatedSemanticKey = createdRecord.data?.Key
        expect(generatedSemanticKey).toEqual(expect.stringMatching(/^content-[0-9a-f-]{36}$/iu))
        expect(isUuidV7(String(generatedSemanticKey).slice('content-'.length))).toBe(true)
        await expect(createRecordDialog).toHaveCount(0)
        await expect(contentRecordSelector).toHaveValue(createdTitle)

        const saveBindingResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'PATCH' && url.pathname.endsWith(`/zone-widget/${overviewTitlePlacement.id}/binding`)
        })
        const saveBindingButton = reopenedOverviewBindingDialog.getByRole('button', { name: 'Save', exact: true })
        await expect(saveBindingButton).toBeEnabled()
        await saveBindingButton.click()
        const saveBindingResponse = await saveBindingResponsePromise
        expect(saveBindingResponse.ok()).toBe(true)
        await expect(saveBindingButton).toBeDisabled()
        const persistedCreatedBinding = (await getLayoutZoneWidgetBindings(
            api,
            imported.metahubId,
            importedLayoutId,
            overviewTitlePlacement.id,
            'en'
        )) as { bindings?: Array<{ slot?: string; sourceKey?: string; semanticKey?: string }> }
        expect(persistedCreatedBinding.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ slot: 'content', sourceKey: 'Main', semanticKey: generatedSemanticKey })])
        )
        await reopenedOverviewBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(reopenedOverviewBindingDialog).toHaveCount(0)
        await page.reload()
        await page.getByTestId(`layout-widget-edit-${overviewTitlePlacement.id}`).click()
        const persistedBindingDialog = page
            .getByRole('dialog')
            .filter({ has: page.getByRole('combobox', { name: 'Content source', exact: true }) })
            .last()
        const persistedRecordSelector = persistedBindingDialog.getByRole('combobox', { name: 'Content record', exact: true })
        await expect(persistedBindingDialog).toBeVisible()
        await expect(persistedBindingDialog.getByRole('combobox', { name: 'Content source', exact: true })).toHaveValue('Main')
        await expect(persistedRecordSelector).toHaveValue(createdTitle)
        await testInfo.attach('mmoomm-no-hub-binding-reloaded', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })
        await persistedRecordSelector.click()
        await persistedRecordSelector.fill('Welcome to Universo MMOOMM')
        const originalRecordOption = page.getByRole('option', { name: 'Welcome to Universo MMOOMM', exact: true })
        await expect(originalRecordOption).toBeVisible()
        await originalRecordOption.click()
        await expect(persistedRecordSelector).toHaveValue('Welcome to Universo MMOOMM')
        const restoreBindingResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'PATCH' && url.pathname.endsWith(`/zone-widget/${overviewTitlePlacement.id}/binding`)
        })
        const restoreBindingButton = persistedBindingDialog.getByRole('button', { name: 'Save', exact: true })
        await restoreBindingButton.click()
        expect((await restoreBindingResponsePromise).ok()).toBe(true)
        await expect(restoreBindingButton).toBeDisabled()
        await persistedBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        const restoredBinding = (await getLayoutZoneWidgetBindings(
            api,
            imported.metahubId,
            importedLayoutId,
            overviewTitlePlacement.id,
            'en'
        )) as { bindings?: Array<{ slot?: string; sourceKey?: string; semanticKey?: string }> }
        expect(restoredBinding.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ slot: 'content', sourceKey: 'Main', semanticKey: originalSemanticKey })])
        )

        const applicationName = `MMOOMM Runtime Parity ${runManifest.runId}`
        const linked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id ?? linked?.id
        if (typeof applicationId !== 'string') {
            throw new Error('MMOOMM runtime parity linked application did not return an application id')
        }
        await recordCreatedApplication({ id: applicationId })

        const replayLinked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: `${applicationName} replay` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const replayApplicationId = replayLinked?.application?.id ?? replayLinked?.id
        if (typeof replayApplicationId !== 'string') {
            throw new Error('MMOOMM runtime parity replay application did not return an application id')
        }
        await recordCreatedApplication({ id: replayApplicationId })

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

        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/a/${applicationId}`)
        await expectMmoommOverviewHeaderLayout(page, 'en', 'MMOOMM overview EN desktop 1280')
        await testInfo.attach('mmoomm-overview-header-en-desktop-1280', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })

        const languageSwitcher = page.getByTestId('runtime-language-switcher')
        await languageSwitcher.focus()
        await page.keyboard.press('Enter')
        await page.getByRole('menu').getByRole('menuitem', { name: 'Russian', exact: true }).click()
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expectMmoommOverviewHeaderLayout(page, 'ru', 'MMOOMM overview RU desktop 1280')
        await expect(page.getByRole('link', { name: 'Добро пожаловать', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Космос', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Визуальная лаборатория', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Cosmos', exact: true })).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'Welcome to Universo MMOOMM', exact: true })).toHaveCount(0)
        await testInfo.attach('mmoomm-overview-header-ru-desktop-1280', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })
        await page.setViewportSize({ width: 768, height: 1024 })
        await expectMmoommOverviewHeaderLayout(page, 'ru', 'MMOOMM overview RU tablet 768')
        await testInfo.attach('mmoomm-overview-header-ru-tablet-768', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })
        await page.setViewportSize({ width: 390, height: 844 })
        await expectMmoommOverviewHeaderLayout(page, 'ru', 'MMOOMM overview RU mobile 390')
        await testInfo.attach('mmoomm-overview-header-ru-mobile-390', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })

        await page.setViewportSize({ width: 1280, height: 900 })
        await languageSwitcher.focus()
        await page.keyboard.press('Enter')
        await page.getByRole('menu').getByRole('menuitem', { name: 'Английский', exact: true }).click()
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await openMmoommSpaceSection(page)
        await expect(runtime.widget).toBeVisible()
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
            // Guard clearance depends on ship orientation, which this trace
            // does not record. Keep the per-sample non-penetration invariant
            // strict and compare only telemetry that is captured on both traces.
            {
                screenPixels: 1,
                alignScreenOrigin: true,
                worldUnits: 0.5,
                compareGuardClearance: false
            },
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
            { screenPixels: 2, worldUnits: 1.5, compareGuardClearance: false },
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
