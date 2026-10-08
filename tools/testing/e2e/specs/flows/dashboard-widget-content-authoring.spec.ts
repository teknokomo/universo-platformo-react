import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getLayoutZoneWidgetBindings,
    listLayouts,
    listLayoutZoneWidgets,
    listObjectCollections,
    listRecords
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { readCodename } from '../../support/appRuntimeViewsTestSupport'
import { fillLocalizedFieldValues } from '../../support/marketingPageAuthoringHelpers'

type DashboardPlacement = {
    id?: string
    widgetKey?: string
    instanceKey?: string
}

type EntityRecord = {
    id?: string
    data?: Record<string, unknown>
}

test('@flow Dashboard Overview title creates and edits entity-backed content records', async ({ page, runManifest }, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const metahubName = `E2E ${runManifest.runId} Dashboard content authoring`
    const metahubCodename = `${runManifest.runId}-dashboard-content-authoring`
    const createdTitle = `Created overview ${runManifest.runId}`
    const createdRussianTitle = `Созданный обзор ${runManifest.runId}`
    const editedTitle = `Edited overview ${runManifest.runId}`
    const bodyText = 'Created from the Dashboard widget binding editor.'
    const russianBodyText = 'Создано в редакторе привязок виджета панели.'

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'basic-demo'
        })
        if (typeof metahub?.id !== 'string') throw new Error('Basic Demo creation did not return a metahub id')
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

        const placements = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: DashboardPlacement[] }
        const overviewTitle = placements.items?.find(
            (placement) => placement.widgetKey === 'overviewTitle' && placement.instanceKey === 'demo-overview-heading'
        )
        if (typeof overviewTitle?.id !== 'string') throw new Error('Basic Demo did not seed its entity-backed Overview title')

        const entitiesResponse = await listObjectCollections(api, metahub.id, { limit: 100, offset: 0 })
        const contentEntity = (entitiesResponse?.items ?? []).find(
            (entity: Record<string, unknown>) => readCodename(entity.codename) === 'DashboardDemoContent'
        ) as Record<string, unknown> | undefined
        if (typeof contentEntity?.id !== 'string') throw new Error('Basic Demo content Entity was not seeded')

        const initialBinding = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, overviewTitle.id, 'en')) as {
            bindings?: Array<{ slot?: string; sourceKey?: string; selectorKind?: string; semanticKey?: string }>
        }
        expect(initialBinding.bindings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    slot: 'content',
                    sourceKey: 'DashboardDemoContent',
                    selectorKind: 'semantic-key',
                    semanticKey: 'overview-heading'
                })
            ])
        )

        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
        const openBindingEditor = page.getByTestId(`layout-widget-edit-${overviewTitle.id}`)
        await expect(openBindingEditor).toBeVisible()
        await openBindingEditor.click()

        const bindingDialog = page
            .getByRole('dialog')
            .filter({ has: page.getByRole('combobox', { name: 'Content source', exact: true }) })
            .last()
        await expect(bindingDialog).toBeVisible()
        const createRecordButton = bindingDialog.getByRole('button', { name: 'Create content', exact: true })
        const editRecordButton = bindingDialog.getByRole('button', { name: 'Edit content', exact: true })
        await expect(createRecordButton).toBeEnabled()
        await expect(editRecordButton).toBeEnabled()
        await expectNoTechnicalLeakage(bindingDialog, {
            label: 'Dashboard Overview title content binding editor',
            checkUuidSubstrings: true,
            checkJsonLikeText: true
        })
        await expectNoPageHorizontalOverflow(page, 'Dashboard Overview title binding editor at 1280x900')
        await testInfo.attach('dashboard-overview-title-binding-editor-desktop', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })

        await createRecordButton.click()
        const createRecordDialog = page.getByRole('dialog', { name: 'Create content record', exact: true })
        await expect(createRecordDialog).toBeVisible()
        const englishFields = createRecordDialog.getByTestId('localized-inline-row-en')
        await expect(englishFields.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible()
        const bodyField = englishFields.getByRole('textbox', { name: 'Body', exact: true })
        await expect(bodyField).toBeVisible()
        await expect(bodyField).toHaveAttribute('rows', '4')
        await fillLocalizedFieldValues(page, createRecordDialog, 'Title', { en: createdTitle, ru: createdRussianTitle })
        await fillLocalizedFieldValues(page, createRecordDialog, 'Body', { en: bodyText, ru: russianBodyText })
        await expectNoTechnicalLeakage(createRecordDialog, {
            label: 'Dashboard content record creation form',
            checkUuidSubstrings: true,
            checkJsonLikeText: true
        })
        await expectNoPageHorizontalOverflow(page, 'Dashboard content record form at 1280x900')
        await testInfo.attach('dashboard-overview-title-record-create-desktop', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })

        // The entity's persisted policy generates the semantic key on the server.
        const createResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'POST' &&
                url.pathname.includes('/entities/object/instance/') &&
                url.pathname.endsWith(`/instance/${contentEntity.id}/records`)
            )
        })
        await createRecordDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const createResponse = await createResponsePromise
        expect(createResponse.status()).toBe(201)
        const createdRecord = (await createResponse.json()) as EntityRecord
        if (typeof createdRecord.id !== 'string') throw new Error('Dashboard content creation response did not return a record id')
        expect(isUuidV7(createdRecord.id)).toBe(true)
        const createdKey = createdRecord.data?.Key
        expect(typeof createdKey).toBe('string')
        const generatedKey = String(createdKey)
        expect(generatedKey.startsWith('dashboard-content-')).toBe(true)
        expect(isUuidV7(generatedKey.slice('dashboard-content-'.length))).toBe(true)
        await expect(createRecordDialog).toHaveCount(0)

        const savedBindingResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'PATCH' && url.pathname.endsWith(`/zone-widget/${overviewTitle.id}/binding`)
        })
        const saveBindingButton = bindingDialog.getByRole('button', { name: 'Save', exact: true })
        await expect(saveBindingButton).toBeEnabled()
        await saveBindingButton.click()
        const savedBindingResponse = await savedBindingResponsePromise
        expect(savedBindingResponse.ok()).toBe(true)
        await expect(saveBindingButton).toBeDisabled()

        const persistedBinding = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, overviewTitle.id, 'en')) as {
            bindings?: Array<{ slot?: string; sourceKey?: string; selectorKind?: string; semanticKey?: string }>
        }
        expect(persistedBinding.bindings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    slot: 'content',
                    sourceKey: 'DashboardDemoContent',
                    selectorKind: 'semantic-key',
                    semanticKey: generatedKey
                })
            ])
        )

        const records = (await listRecords(api, metahub.id, contentEntity.id, { limit: 100, offset: 0 })) as {
            items?: EntityRecord[]
        }
        const generatedKeys = (records.items ?? []).map((record) => record.data?.Key).filter((value) => typeof value === 'string')
        expect(generatedKeys).toContain(generatedKey)
        expect(new Set(generatedKeys).size).toBe(generatedKeys.length)

        await bindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(bindingDialog).toHaveCount(0)
        await page.reload()
        const openContentEditor = page.getByTestId(`layout-widget-edit-content-${overviewTitle.id}`)
        await expect(openContentEditor).toBeVisible()
        await openContentEditor.click()

        const editRecordDialog = page.getByRole('dialog', { name: 'Edit content record', exact: true })
        await expect(editRecordDialog).toBeVisible()
        const editedTitleField = editRecordDialog
            .getByTestId('localized-inline-row-en')
            .getByRole('textbox', { name: 'Title', exact: true })
        await expect(editedTitleField).toHaveValue(createdTitle)
        await expect(
            editRecordDialog.getByTestId('localized-inline-row-ru').getByRole('textbox', { name: 'Title', exact: true })
        ).toHaveValue(createdRussianTitle)
        await editedTitleField.fill(editedTitle)
        await expectNoTechnicalLeakage(editRecordDialog, {
            label: 'Dashboard content record edit form',
            checkUuidSubstrings: true,
            checkJsonLikeText: true
        })
        await page.setViewportSize({ width: 390, height: 844 })
        await expectNoPageHorizontalOverflow(page, 'Dashboard content record form at 390x844')
        await testInfo.attach('dashboard-overview-title-record-edit-mobile-390', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })

        const updateResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'PATCH' &&
                url.pathname.includes('/entities/object/instance/') &&
                url.pathname.endsWith(`/instance/${contentEntity.id}/record/${createdRecord.id}`)
            )
        })
        await editRecordDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const updateResponse = await updateResponsePromise
        expect(updateResponse.ok()).toBe(true)
        await expect(editRecordDialog).toHaveCount(0)

        const updatedRecords = (await listRecords(api, metahub.id, contentEntity.id, { limit: 100, offset: 0 })) as {
            items?: EntityRecord[]
        }
        const updatedRecord = updatedRecords.items?.find((record) => record.id === createdRecord.id)
        expect(updatedRecord?.data?.Key).toBe(generatedKey)
        expect(updatedRecord?.data?.Title).toMatchObject({
            locales: expect.objectContaining({
                en: expect.objectContaining({ content: editedTitle }),
                ru: expect.objectContaining({ content: createdRussianTitle })
            })
        })
        expect(updatedRecord?.data?.Body).toMatchObject({
            locales: expect.objectContaining({
                en: expect.objectContaining({ content: bodyText }),
                ru: expect.objectContaining({ content: russianBodyText })
            })
        })
    } finally {
        await disposeApiContext(api)
    }
})
