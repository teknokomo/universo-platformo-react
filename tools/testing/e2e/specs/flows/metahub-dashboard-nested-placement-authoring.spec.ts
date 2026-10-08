import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getLayoutZoneWidgetBindings,
    listLayouts,
    listLayoutZoneWidgets
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'

type LayoutPlacement = {
    id: string
    instanceKey: string
    widgetKey: string
    zone?: string
    parentInstanceKey?: string | null
    slotKey?: string | null
    sortOrder?: number
    version?: number
}

test('@flow metahub Dashboard nested placement authoring adds a child to its compatible slot and persists its hierarchy', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const metahubName = `E2E ${runManifest.runId} nested Dashboard placements`
    const metahubCodename = `${runManifest.runId}-nested-dashboard-placements`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'basic-demo'
        })
        if (typeof metahub?.id !== 'string') {
            throw new Error('Basic Demo metahub creation did not return an id for nested Dashboard placement coverage')
        }

        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        let layoutId: string | undefined
        await expect
            .poll(async () => {
                const response = await listLayouts(api, metahub.id, { limit: 20, offset: 0 })
                layoutId = response?.items?.[0]?.id
                return typeof layoutId === 'string'
            })
            .toBe(true)
        if (!layoutId) throw new Error('Basic Demo did not return its Dashboard layout')

        let container: LayoutPlacement | undefined
        let seededChild: LayoutPlacement | undefined
        await expect
            .poll(async () => {
                const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
                const placements = response.items ?? []
                container = placements.find((item) => item.widgetKey === 'columnsContainer' && !item.parentInstanceKey)
                seededChild = placements.find(
                    (item) => item.widgetKey === 'detailsTable' && item.parentInstanceKey === container?.instanceKey
                )
                return Boolean(container?.instanceKey && seededChild?.id && seededChild.slotKey)
            })
            .toBe(true)

        if (!container?.instanceKey || !seededChild?.id || !seededChild.slotKey) {
            throw new Error('Basic Demo did not return its seeded columnsContainer-to-detailsTable placement')
        }

        const seededBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, seededChild.id, 'en')) as {
            bindings?: Array<Record<string, unknown>>
        }
        expect(seededBindings.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ sourceKey: 'DashboardDemoRecords', slot: 'rows' })])
        )

        await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
        const nestedRegion = page.getByRole('region', { name: 'Nested content' })
        await expect(nestedRegion).toBeVisible()
        await expect(nestedRegion.getByRole('heading', { name: 'Nested content' })).toBeVisible()
        await expect(nestedRegion.getByText('Column 1', { exact: true })).toBeVisible()

        const addChildButton = nestedRegion.getByRole('button', { name: /^Add content: .+ · Column 1$/ })
        await expect(addChildButton).toBeVisible()

        // The child is rendered within the visible slot card, preserving the seed hierarchy.
        const slotCard = nestedRegion.getByRole('group', { name: 'Columns container · Column 1', exact: true })
        await expect(slotCard.getByText('Details table', { exact: true })).toBeVisible()
        await expect(slotCard.getByText('Details table', { exact: true })).toHaveCount(1)

        await addChildButton.click()
        const addMenu = page.getByRole('menu')
        await expect(addMenu).toBeVisible()
        const sourceOptionsResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && url.pathname.endsWith('/widget-binding-sources/detailsTable/rows')
        })
        await addMenu.getByRole('menuitem', { name: 'Details table', exact: true }).click()

        const bindingDialog = page.getByRole('dialog').filter({
            has: page.getByRole('combobox', { name: 'Content source', exact: true })
        })
        await expect(bindingDialog).toBeVisible()
        const sourceOptionsResponse = await sourceOptionsResponsePromise
        expect(sourceOptionsResponse.ok()).toBe(true)
        const sourceOptionsPayload = (await sourceOptionsResponse.json()) as {
            sources?: Array<{ sourceKey?: string; label?: string }>
        }
        const dashboardDemoSource = sourceOptionsPayload.sources?.find((source) => source.sourceKey === 'DashboardDemoRecords')
        if (!dashboardDemoSource?.label) {
            throw new Error('Nested Dashboard authoring could not resolve the seeded DashboardDemoRecords source')
        }

        const sourceSelect = bindingDialog.getByRole('combobox', { name: 'Content source', exact: true })
        await sourceSelect.fill(dashboardDemoSource.label)
        const sourceOption = page.getByRole('option', { name: dashboardDemoSource.label, exact: true })
        await expect(sourceOption).toBeVisible()
        await sourceOption.click()

        const addPlacementResponse = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'PUT' && url.pathname.endsWith('/zone-widget')
        })
        await bindingDialog.getByRole('button', { name: 'Add', exact: true }).click()

        const placementResponse = await addPlacementResponse
        expect(placementResponse.ok()).toBe(true)
        const submittedPlacement = placementResponse.request().postDataJSON() as Record<string, unknown>
        expect(submittedPlacement).toMatchObject({
            zone: 'center',
            widgetKey: 'detailsTable',
            parentInstanceKey: container.instanceKey,
            slotKey: seededChild.slotKey
        })

        let addedChild: LayoutPlacement | undefined
        await expect
            .poll(async () => {
                const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
                addedChild = response.items?.find(
                    (item) =>
                        item.widgetKey === 'detailsTable' &&
                        item.id !== seededChild?.id &&
                        item.parentInstanceKey === container?.instanceKey &&
                        item.slotKey === seededChild?.slotKey
                )
                return Boolean(addedChild?.id)
            })
            .toBe(true)
        expect(addedChild).toMatchObject({
            widgetKey: 'detailsTable',
            parentInstanceKey: container.instanceKey,
            slotKey: seededChild.slotKey
        })
        if (!addedChild?.id) throw new Error('Nested Dashboard authoring did not return the added child placement id')
        const addedBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, addedChild.id, 'en')) as {
            bindings?: Array<Record<string, unknown>>
        }
        expect(addedBindings.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ sourceKey: 'DashboardDemoRecords', slot: 'rows' })])
        )

        await expect(slotCard.getByText('Details table', { exact: true })).toHaveCount(2)
        await expect(nestedRegion.getByRole('button', { name: 'Move up', exact: true })).toBeVisible()
        await expect(nestedRegion.getByRole('button', { name: 'Move down', exact: true })).toBeVisible()

        const placementsBeforeMove = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
        const siblingIdsBeforeMove = (placementsBeforeMove.items ?? [])
            .filter((item) => item.parentInstanceKey === container?.instanceKey && item.slotKey === seededChild?.slotKey)
            .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
            .map((item) => item.id)
        expect(siblingIdsBeforeMove).toEqual([seededChild.id, addedChild?.id])
        const currentSeededChild = (placementsBeforeMove.items ?? []).find((item) => item.id === seededChild?.id)
        if (typeof currentSeededChild?.version !== 'number') {
            throw new Error('Nested Dashboard authoring did not return the current seeded child version before moving it')
        }

        const moveResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'PATCH' && url.pathname.endsWith('/zone-widgets/move')
        })
        const moveDown = nestedRegion.getByRole('button', { name: 'Move down', exact: true }).first()
        await moveDown.focus()
        await page.keyboard.press('Enter')
        const moveResponse = await moveResponsePromise
        expect(moveResponse.ok()).toBe(true)
        expect(moveResponse.request().postDataJSON()).toMatchObject({
            widgetId: seededChild.id,
            targetIndex: 1,
            expectedVersion: currentSeededChild.version
        })

        await expect
            .poll(async () => {
                const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
                return (response.items ?? [])
                    .filter((item) => item.parentInstanceKey === container?.instanceKey && item.slotKey === seededChild?.slotKey)
                    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
                    .map((item) => item.id)
            })
            .toEqual([addedChild?.id, seededChild.id])

        const placementsBeforeDelete = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
        const currentAddedChild = placementsBeforeDelete.items?.find((item) => item.id === addedChild.id)
        if (typeof currentAddedChild?.version !== 'number') {
            throw new Error('Nested Dashboard authoring did not return the current added child version before deleting it')
        }

        const removeButton = slotCard.getByRole('button', { name: 'Delete', exact: true }).first()
        await expect(slotCard.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(2)
        await expect(removeButton).toBeVisible()
        await removeButton.click()

        const removeConfirmation = page.getByRole('dialog', { name: 'Remove widget?' })
        await expect(removeConfirmation).toBeVisible()
        await expect(removeConfirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
        const confirmRemoveButton = removeConfirmation.getByRole('button', { name: 'Remove', exact: true })
        await expect(confirmRemoveButton).toBeVisible()

        const removeResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'DELETE' && url.pathname.includes(`/layout/${layoutId}/zone-widget/`)
        })
        await confirmRemoveButton.click()
        const removeResponse = await removeResponsePromise
        expect(removeResponse.ok()).toBe(true)
        const removeUrl = new URL(removeResponse.url())
        expect(removeUrl.pathname).toBe(`/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget/${addedChild.id}`)
        expect(removeUrl.searchParams.get('expectedVersion')).toBe(String(currentAddedChild.version))

        let placementsAfterDelete: LayoutPlacement[] = []
        await expect
            .poll(async () => {
                const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
                placementsAfterDelete = response.items ?? []
                return placementsAfterDelete.some((item) => item.id === addedChild.id)
            })
            .toBe(false)
        expect(placementsAfterDelete).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: seededChild.id,
                    widgetKey: 'detailsTable',
                    parentInstanceKey: container.instanceKey,
                    slotKey: seededChild.slotKey
                })
            ])
        )
        const remainingSeededBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, seededChild.id, 'en')) as {
            bindings?: Array<Record<string, unknown>>
        }
        expect(remainingSeededBindings.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ sourceKey: 'DashboardDemoRecords', slot: 'rows' })])
        )

        await page.reload()
        await expect(nestedRegion).toBeVisible()
        await expect(slotCard.getByText('Details table', { exact: true })).toHaveCount(1)
        await expect(slotCard.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(1)

        const placementsAfterReload = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutPlacement[] }
        expect(placementsAfterReload.items?.some((item) => item.id === addedChild.id)).toBe(false)
        expect(placementsAfterReload.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: seededChild.id,
                    widgetKey: 'detailsTable',
                    parentInstanceKey: container.instanceKey,
                    slotKey: seededChild.slotKey
                })
            ])
        )
        const reloadedSeededBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, seededChild.id, 'en')) as {
            bindings?: Array<Record<string, unknown>>
        }
        expect(reloadedSeededBindings.bindings).toEqual(
            expect.arrayContaining([expect.objectContaining({ sourceKey: 'DashboardDemoRecords', slot: 'rows' })])
        )

        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Dashboard nested placement authoring',
            checkUuidSubstrings: true,
            checkJsonLikeText: true,
            checkInternalValidationText: true,
            forbiddenVisibleTextPatterns: [/column:records/i, /\[object Object\]/i]
        })
        await expectNoPageHorizontalOverflow(page, 'Dashboard nested placement authoring at 1440x900')

        const screenshotPath = testInfo.outputPath('dashboard-nested-placement-authoring.png')
        await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' })
        await testInfo.attach('dashboard-nested-placement-authoring', {
            path: screenshotPath,
            contentType: 'image/png'
        })

        await page.setViewportSize({ width: 390, height: 844 })
        await expect(nestedRegion).toBeVisible()
        await expect(nestedRegion.getByText('Column 1', { exact: true })).toBeVisible()
        await expect(addChildButton).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Dashboard nested placement authoring at 390x844')
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Dashboard nested placement authoring at 390x844',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/column:records/i, /\[object Object\]/i]
        })
        const mobileScreenshotPath = testInfo.outputPath('dashboard-nested-placement-authoring-mobile-390.png')
        await page.screenshot({ path: mobileScreenshotPath, fullPage: true, animations: 'disabled' })
        await testInfo.attach('dashboard-nested-placement-authoring-mobile-390', {
            path: mobileScreenshotPath,
            contentType: 'image/png'
        })
    } finally {
        await disposeApiContext(api)
    }
})
