import type { Request, TestInfo } from '@playwright/test'
import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getLayoutZoneWidgetBindings,
    listEntityInstances,
    listComponents,
    listLayoutZoneWidgets,
    listRecords
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectLocatorFullyFitsViewport, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { expectStandardDialogActionFooter, fillLocalizedFieldValues } from '../../support/marketingPageAuthoringHelpers'
import { verifyMarketingPricingRecordRelationSetFlow } from '../../support/marketingPagePricingBindings'
import { readLocalizedText } from './entity-runtime-helpers'
import {
    getWidgetByInstanceKey,
    layoutIdForMarketingPage,
    openWidgetBindingDialog,
    readConfig,
    readRecord,
    readString,
    readWidgets,
    responseIsMutation,
    waitForWidgetState,
    widgetSurface,
    type LayoutZoneWidgetsResponse
} from './marketing-page-widget-test-support'

test('@flow @combined @marketing-page browser widget lifecycle persists semantic composition changes', async ({
    page,
    runManifest
}, testInfo: TestInfo) => {
    test.setTimeout(240_000)

    const executionRunId = `${runManifest.runId}-widget-lifecycle-${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${testInfo.retry}`
    const metahubName = `E2E ${executionRunId} marketing widgets`
    const metahubCodename = `${executionRunId}-marketing-widgets`
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        await applyBrowserPreferences(page, { language: 'en' })

        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (!metahub?.id) throw new Error('Marketing-page metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        const layoutId = await layoutIdForMarketingPage(api, metahub.id)
        const initialResponse = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
        const initialWidgets = readWidgets(initialResponse)
        const faqWidget = getWidgetByInstanceKey(initialWidgets, 'faq')
        if (!faqWidget) throw new Error('The marketing seed did not expose the FAQ collection widget')
        const pricingWidget = getWidgetByInstanceKey(initialWidgets, 'pricing')
        if (!pricingWidget) throw new Error('The marketing seed did not expose the pricing widget')
        const heroWidget = getWidgetByInstanceKey(initialWidgets, 'hero')
        if (!heroWidget) throw new Error('The marketing seed did not expose the hero widget')
        const imageWidget = getWidgetByInstanceKey(initialWidgets, 'hero-image')
        if (!imageWidget) throw new Error('The marketing seed did not expose the Image widget')

        await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
        const details = page.getByTestId('metahub-layout-details-content')
        await expect(details).toBeVisible()
        await expect(page.getByTestId('layout-zone-marketing-header')).toBeVisible()
        await expect(page.getByTestId('layout-zone-marketing-main')).toBeVisible()
        await expect(page.getByTestId('layout-zone-marketing-footer')).toBeVisible()
        await expectNoTechnicalLeakage(details, {
            label: 'Marketing widget authoring surface before lifecycle mutations',
            checkUuidSubstrings: true
        })

        const faqSurface = widgetSurface(page, faqWidget)
        await expect(faqSurface).toBeVisible()

        // Deactivate a real seeded widget and verify the durable state through the API.
        const deactivateButton = faqSurface.getByRole('button', { name: 'Deactivate', exact: true })
        await expect(deactivateButton).toBeVisible()
        const toggleResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/toggle-active$/),
            { label: 'Deactivating the FAQ marketing widget' }
        )
        await deactivateButton.click()
        const toggleResponse = await toggleResponsePromise
        expect(toggleResponse.ok()).toBe(true)
        await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => getWidgetByInstanceKey([widget], 'faq') !== undefined && widget.isActive === false,
            'The FAQ marketing widget did not become inactive'
        )
        await expect(faqSurface.getByRole('button', { name: 'Activate', exact: true })).toBeVisible()

        // Edit the shared config through the real MUI dialog, keeping the source selected.
        const bindingDialog = await openWidgetBindingDialog(page, faqSurface)
        await expect(bindingDialog.getByRole('alert')).toHaveCount(0)
        await expect(bindingDialog.getByRole('combobox', { name: 'Content source', exact: true })).toBeEnabled()
        await bindingDialog.getByRole('button', { name: 'Appearance', exact: true }).click()
        await expect(bindingDialog).toHaveCount(0)
        let presentationDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(presentationDialog).toBeVisible()
        await expect(presentationDialog.getByRole('combobox', { name: 'Content source', exact: true })).toHaveCount(0)
        let maxItemsField = presentationDialog.getByRole('spinbutton', { name: 'Maximum items', exact: true })
        await expect(maxItemsField).toBeVisible()
        const originalMaxItems = await maxItemsField.inputValue()
        await maxItemsField.fill('12')
        await presentationDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        const presentationDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
        await expect(presentationDiscardDialog).toBeVisible()
        await expectNoTechnicalLeakage(presentationDiscardDialog, {
            label: 'Marketing presentation discard confirmation',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('marketing-widget-presentation-unsaved-confirmation.png'),
            animations: 'disabled'
        })
        await presentationDiscardDialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
        await expect(presentationDialog).toBeVisible()
        await expect(maxItemsField).toHaveValue('12')
        await presentationDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(presentationDiscardDialog).toBeVisible()
        await presentationDiscardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
        await expect(presentationDialog).toHaveCount(0)

        const reopenedBindingDialog = await openWidgetBindingDialog(page, faqSurface)
        await reopenedBindingDialog.getByRole('button', { name: 'Appearance', exact: true }).click()
        presentationDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(presentationDialog).toBeVisible()
        maxItemsField = presentationDialog.getByRole('spinbutton', { name: 'Maximum items', exact: true })
        await expect(maxItemsField).toHaveValue(originalMaxItems)
        await maxItemsField.fill('12')
        const originalViewport = page.viewportSize()
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(presentationDialog).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Marketing widget presentation dialog at ${viewport.name}`)
            const dialogBounds = await presentationDialog.boundingBox()
            expect(dialogBounds, `${viewport.name} presentation dialog must have visible bounds`).not.toBeNull()
            expect(dialogBounds!.x).toBeGreaterThanOrEqual(0)
            expect(dialogBounds!.y).toBeGreaterThanOrEqual(0)
            expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(viewport.width)
            expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(viewport.height)

            const dialogActions = presentationDialog.locator('.MuiDialogActions-root')
            await expect(dialogActions).toBeVisible()
            const footerBounds = await dialogActions.boundingBox()
            expect(footerBounds, `${viewport.name} presentation dialog footer must have visible bounds`).not.toBeNull()
            expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(viewport.height)
            await expect(presentationDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport()
            await expect(presentationDialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
            await page.screenshot({
                path: testInfo.outputPath(`marketing-widget-presentation-${viewport.name}.png`),
                animations: 'disabled'
            })
        }
        if (originalViewport) await page.setViewportSize(originalViewport)
        const configResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/config$/),
            { label: 'Saving FAQ marketing widget settings' }
        )
        await presentationDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const configResponse = await configResponsePromise
        expect(configResponse.ok()).toBe(true)
        await expect(presentationDialog).toHaveCount(0)
        const persistedFaqSource = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => getWidgetByInstanceKey([widget], 'faq') !== undefined && readConfig(widget).maxItems === 12,
            'The FAQ marketing widget settings were not persisted'
        )
        const faqBindingsBeforeDuplicate = (await getLayoutZoneWidgetBindings(
            api,
            metahub.id,
            layoutId,
            readString(persistedFaqSource.id),
            'en'
        )) as { bindings?: Array<{ slot?: string; sourceKey?: string; selectorKind?: string; semanticKey?: string }> }
        const faqBindingSignaturesBeforeDuplicate = (faqBindingsBeforeDuplicate.bindings ?? [])
            .map((binding) =>
                [binding.slot ?? '', binding.sourceKey ?? '', binding.selectorKind ?? '', binding.semanticKey ?? ''].join('|')
            )
            .sort()
        const faqPlacementIdsBeforeDuplicate = new Set(
            readWidgets((await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse)
                .filter((widget) => widget.widgetKey === 'marketing.collection' && readConfig(widget).variant === 'faq')
                .map((widget) => readString(widget.id))
        )

        // Duplicate a repeatable collection through the existing authoring surface. The server
        // owns the new row and instance identity; the browser must never manufacture either.
        const duplicateButton = faqSurface.getByRole('button', { name: /^Duplicate widget:/ })
        await expect(duplicateButton).toBeVisible()
        await duplicateButton.click()
        const duplicateDialog = page.getByRole('dialog').filter({
            has: page.getByRole('combobox', { name: 'Content source', exact: true })
        })
        await expect(duplicateDialog).toBeVisible()
        const addDuplicateButton = duplicateDialog.getByRole('button', { name: 'Add', exact: true })
        await expect(addDuplicateButton).toBeEnabled()
        const faqDuplicatePath = `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget`
        let faqDuplicateRequestCount = 0
        const observeFaqDuplicateRequest = (request: Request) => {
            if (request.method() === 'PUT' && new URL(request.url()).pathname === faqDuplicatePath) faqDuplicateRequestCount += 1
        }
        page.on('request', observeFaqDuplicateRequest)
        const duplicateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
            { label: 'Duplicating the FAQ marketing widget' }
        )
        const duplicateResponse = await (async () => {
            try {
                await addDuplicateButton.click()
                return await duplicateResponsePromise
            } finally {
                page.off('request', observeFaqDuplicateRequest)
            }
        })()
        expect(faqDuplicateRequestCount).toBe(1)
        expect(duplicateResponse.ok()).toBe(true)
        const duplicatedFaq = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => {
                const config = readConfig(widget)
                const instanceKey = readString(config.instanceKey)
                return (
                    widget.widgetKey === 'marketing.collection' &&
                    config.variant === 'faq' &&
                    instanceKey !== '' &&
                    instanceKey !== 'faq' &&
                    readString(widget.id) !== readString(faqWidget.id)
                )
            },
            'The duplicated FAQ marketing widget was not persisted with a new instance identity'
        )
        const faqWidgetsAfterDuplicate = readWidgets((await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse)
        const newlyCreatedFaqPlacements = faqWidgetsAfterDuplicate.filter(
            (widget) =>
                widget.widgetKey === 'marketing.collection' &&
                readConfig(widget).variant === 'faq' &&
                !faqPlacementIdsBeforeDuplicate.has(readString(widget.id))
        )
        expect(newlyCreatedFaqPlacements, 'One Duplicate action must persist exactly one new FAQ placement').toHaveLength(1)
        expect(readString(duplicatedFaq.id)).toBe(readString(newlyCreatedFaqPlacements[0].id))
        expect(readConfig(duplicatedFaq)).toMatchObject({ variant: 'faq', maxItems: 12 })
        expect(readString(readConfig(duplicatedFaq).instanceKey)).not.toBe(readString(readConfig(faqWidget).instanceKey))
        expect(readString(readConfig(duplicatedFaq).instanceKey)).not.toBe('')
        const duplicatedFaqBindings = (await getLayoutZoneWidgetBindings(
            api,
            metahub.id,
            layoutId,
            readString(duplicatedFaq.id),
            'en'
        )) as { bindings?: Array<{ slot?: string; sourceKey?: string; selectorKind?: string; semanticKey?: string }> }
        const duplicatedFaqBindingSignatures = (duplicatedFaqBindings.bindings ?? [])
            .map((binding) =>
                [binding.slot ?? '', binding.sourceKey ?? '', binding.selectorKind ?? '', binding.semanticKey ?? ''].join('|')
            )
            .sort()
        expect(duplicatedFaqBindingSignatures).toEqual(faqBindingSignaturesBeforeDuplicate)
        const duplicatedSurface = widgetSurface(page, duplicatedFaq)
        await expect(duplicatedSurface).toBeVisible()
        await page.reload()
        await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
        await expect(widgetSurface(page, duplicatedFaq)).toBeVisible()

        // A single Duplicate action creates both a new placement and its own
        // Hero Entity record. It should not send the author through a chooser.
        const heroSurface = widgetSurface(page, heroWidget)
        await expect(heroSurface).toBeVisible()
        const heroEntities = await listEntityInstances(api, metahub.id, { kind: 'object', limit: 100, offset: 0 })
        const heroEntity = heroEntities.items?.find(
            (entity: { codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageHero'
        )
        if (!heroEntity?.id) throw new Error('The marketing-page fixture did not expose the Hero Entity')
        const recordsBeforeDuplicate = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const sourceHeroRecord = recordsBeforeDuplicate.items?.find((record) => readString(readRecord(record.data).HeroKey) === 'default')
        if (!sourceHeroRecord?.id) throw new Error('The seeded marketing Hero Entity record was not available before duplication')
        const sourceHeroKey = readString(readRecord(sourceHeroRecord.data).HeroKey)

        const duplicateHeroResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', /\/zone-widget\/duplicate$/),
            { label: 'Duplicating the Hero placement and its bound Entity record', timeout: 90_000 }
        )
        await heroSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
        await expect(page.getByRole('dialog', { name: 'Hero', exact: true })).toHaveCount(0)
        await expect(page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })).toHaveCount(0)
        const duplicateHeroResponse = await duplicateHeroResponsePromise
        expect(duplicateHeroResponse.ok()).toBe(true)
        const duplicatedHero = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => {
                const instanceKey = readString(readConfig(widget).instanceKey)
                return (
                    widget.widgetKey === 'marketing.hero' &&
                    instanceKey !== '' &&
                    instanceKey !== 'hero' &&
                    readString(widget.id) !== readString(heroWidget.id)
                )
            },
            'The duplicated marketing hero widget was not persisted with a new instance identity'
        )
        expect(readString(readConfig(duplicatedHero).instanceKey)).not.toBe(readString(readConfig(heroWidget).instanceKey))
        const duplicatedHeroInstanceKey = readString(readConfig(duplicatedHero).instanceKey)
        expect(duplicatedHeroInstanceKey).not.toBe('')
        expect(isUuidV7(readString(duplicatedHero.id))).toBe(true)
        expect(readString(duplicatedHero.id)).not.toBe(readString(heroWidget.id))
        await expect
            .poll(
                async () => {
                    const response = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
                        items?: Array<{ id?: string; data?: Record<string, unknown> }>
                    }
                    return response.items?.length ?? 0
                },
                { timeout: 60_000, message: 'The Duplicate action should create a separate Hero Entity record' }
            )
            .toBe((recordsBeforeDuplicate.items?.length ?? 0) + 1)
        const recordsAfterDuplicate = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const newHeroRecords = (recordsAfterDuplicate.items ?? []).filter(
            (record) => !recordsBeforeDuplicate.items?.some((previous) => previous.id === record.id)
        )
        expect(newHeroRecords).toHaveLength(1)
        const duplicatedHeroRecord = newHeroRecords[0]
        expect(duplicatedHeroRecord.id).toBeTruthy()
        expect(isUuidV7(duplicatedHeroRecord.id ?? '')).toBe(true)
        const duplicatedHeroRecordKey = readString(readRecord(duplicatedHeroRecord.data).HeroKey)
        expect(duplicatedHeroRecordKey).not.toBe('')
        expect(duplicatedHeroRecordKey).not.toBe(sourceHeroKey)
        expect(duplicatedHeroRecord.id).not.toBe(sourceHeroRecord.id)

        const duplicatedHeroSurface = widgetSurface(page, duplicatedHero)
        await expect(duplicatedHeroSurface).toBeVisible()
        await duplicatedHeroSurface.getByRole('button', { name: 'Edit content', exact: true }).click()
        const duplicatedHeroRecordForm = page.getByRole('dialog', { name: /^Edit content record(?:\s|$)/u })
        await expect(duplicatedHeroRecordForm).toBeVisible()
        const copiedEnglishTitle = duplicatedHeroRecordForm
            .getByTestId('localized-inline-row-en')
            .getByRole('textbox', { name: 'Title', exact: true })
        await expect(copiedEnglishTitle).toHaveValue('Our latest')
        await copiedEnglishTitle.fill('Lifecycle copy edited independently')
        const copiedRecordSavePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
            { label: 'Editing the duplicated Hero Entity record independently', timeout: 90_000 }
        )
        await duplicatedHeroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
        const copiedRecordSave = await copiedRecordSavePromise
        expect(copiedRecordSave.ok()).toBe(true)
        await expect(duplicatedHeroRecordForm).toHaveCount(0)
        const recordsAfterCopiedEdit = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const savedCopy = recordsAfterCopiedEdit.items?.find((record) => record.id === duplicatedHeroRecord.id)
        const savedSource = recordsAfterCopiedEdit.items?.find((record) => record.id === sourceHeroRecord.id)
        expect(readString(readRecord(savedCopy?.data).HeroKey)).toBe(duplicatedHeroRecordKey)
        expect(readString(readRecord(savedSource?.data).HeroKey)).toBe(sourceHeroKey)
        expect(readLocalizedText(readRecord(savedCopy?.data).Title, 'en')).toBe('Lifecycle copy edited independently')
        expect(readLocalizedText(readRecord(savedSource?.data).Title, 'en')).toBe('Our latest')

        const duplicatedHeroBindingDialog = page.getByRole('dialog', { name: 'Hero', exact: true })
        await expect(duplicatedHeroBindingDialog).toBeVisible()
        await expect(duplicatedHeroBindingDialog.getByRole('combobox', { name: 'Content record', exact: true })).toHaveValue(
            'Lifecycle copy edited independently'
        )
        await duplicatedHeroBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(duplicatedHeroBindingDialog).toHaveCount(0)

        // Reopening Duplicate for the same source starts a new copy operation.
        // It must not reuse the record cloned by the previous dialog session.
        const recordsBeforeSecondDuplicate = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const secondDuplicateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', /\/zone-widget\/duplicate$/),
            { label: 'Duplicating the same Hero placement a second time', timeout: 90_000 }
        )
        await heroSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
        const secondDuplicateResponse = await secondDuplicateResponsePromise
        expect(secondDuplicateResponse.ok()).toBe(true)
        const secondDuplicatedHero = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => {
                const instanceKey = readString(readConfig(widget).instanceKey)
                return (
                    widget.widgetKey === 'marketing.hero' &&
                    instanceKey !== '' &&
                    instanceKey !== 'hero' &&
                    readString(widget.id) !== readString(heroWidget.id) &&
                    readString(widget.id) !== readString(duplicatedHero.id)
                )
            },
            'A second Hero Duplicate action did not create its own placement'
        )
        expect(isUuidV7(readString(secondDuplicatedHero.id))).toBe(true)
        const recordsAfterSecondDuplicate = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const secondCopiedRecords = (recordsAfterSecondDuplicate.items ?? []).filter(
            (record) => !recordsBeforeSecondDuplicate.items?.some((previous) => previous.id === record.id)
        )
        expect(secondCopiedRecords).toHaveLength(1)
        const secondCopiedRecord = secondCopiedRecords[0]
        expect(isUuidV7(secondCopiedRecord.id ?? '')).toBe(true)
        const secondCopiedRecordKey = readString(readRecord(secondCopiedRecord.data).HeroKey)
        expect(secondCopiedRecordKey).not.toBe('')
        expect(secondCopiedRecordKey).not.toBe(sourceHeroKey)
        expect(secondCopiedRecordKey).not.toBe(duplicatedHeroRecordKey)
        const secondHeroBindings = (await getLayoutZoneWidgetBindings(
            api,
            metahub.id,
            layoutId,
            readString(secondDuplicatedHero.id),
            'en'
        )) as { bindings?: Array<{ slot?: string; semanticKey?: string }> }
        expect(secondHeroBindings.bindings?.find(({ slot }) => slot === 'content')?.semanticKey).toBe(secondCopiedRecordKey)

        // Image Duplicate clones its bound Entity record and points the new
        // placement at that independent copy.
        const imageEntities = await listEntityInstances(api, metahub.id, { kind: 'object', limit: 100, offset: 0 })
        const imageEntity = imageEntities.items?.find(
            (entity: { codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageImage'
        )
        if (!imageEntity?.id) throw new Error('The marketing-page fixture did not expose the Image Entity')
        const sourceImageBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, readString(imageWidget.id), 'en')) as {
            bindings?: Array<{ slot?: string; semanticKey?: string }>
        }
        const sourceImageKey = sourceImageBindings.bindings?.find(({ slot }) => slot === 'content')?.semanticKey
        if (!sourceImageKey) throw new Error('The seeded Image placement had no semantic Entity binding')
        const imageRecordsBeforeDuplicate = (await listRecords(api, metahub.id, imageEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const sourceImageRecord = imageRecordsBeforeDuplicate.items?.find(
            (record) => readString(readRecord(record.data).ImageKey) === sourceImageKey
        )
        if (!sourceImageRecord?.id) throw new Error('The bound Marketing Image record was unavailable before duplication')
        const imageWidgetsBeforeDuplicate = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
        const imageWidgetIdsBeforeDuplicate = new Set(readWidgets(imageWidgetsBeforeDuplicate).map((widget) => readString(widget.id)))
        const imageSurface = widgetSurface(page, imageWidget)
        const imageRecordCopyPath = new RegExp(
            `/api/v1/metahub/${metahub.id}/entities/object/instance/(?:[^/]+/instance/)?${imageEntity.id}/record/${sourceImageRecord.id}/copy$`,
            'u'
        )
        const imagePlacementCreatePath = new RegExp(`/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget$`, 'u')
        const duplicateImagePlacementPath = new RegExp(`/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget/duplicate$`, 'u')
        let separateRecordCopyRequests = 0
        let separatePlacementRequests = 0
        const countSeparateRecordCopies = async (route: import('@playwright/test').Route) => {
            separateRecordCopyRequests += 1
            await route.continue()
        }
        const countSeparatePlacementRequests = async (route: import('@playwright/test').Route) => {
            separatePlacementRequests += 1
            await route.continue()
        }
        await page.route(imageRecordCopyPath, countSeparateRecordCopies)
        await page.route(imagePlacementCreatePath, countSeparatePlacementRequests)
        const failedDuplicateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', duplicateImagePlacementPath),
            { label: 'Receiving a server-side Image duplicate optimistic-lock failure', timeout: 90_000 }
        )
        const failPlacementAfterRecordCopy = async (route: import('@playwright/test').Route) => {
            if (route.request().method() === 'POST') {
                const payload = route.request().postDataJSON() as { expectedVersion?: unknown }
                if (
                    typeof payload.expectedVersion !== 'number' ||
                    !Number.isInteger(payload.expectedVersion) ||
                    payload.expectedVersion < 1
                ) {
                    throw new Error('The duplicate request did not include a positive layout version')
                }
                await route.continue({ postData: JSON.stringify({ ...payload, expectedVersion: payload.expectedVersion + 1 }) })
                return
            }
            await route.continue()
        }
        await page.route(duplicateImagePlacementPath, failPlacementAfterRecordCopy)
        await imageSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
        const failedDuplicateResponse = await failedDuplicateResponsePromise
        expect(failedDuplicateResponse.status()).toBe(409)
        expect(await failedDuplicateResponse.json()).toMatchObject({ code: 'CONFLICT' })
        const failedDuplicateDialog = page.getByRole('dialog').filter({ hasText: 'Content bindings could not be saved. Try again.' })
        await expect(failedDuplicateDialog).toBeVisible()
        await expectNoTechnicalLeakage(failedDuplicateDialog, {
            label: 'Marketing Image transaction rollback after stale placement version',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('marketing-image-duplicate-failure-en.png'),
            fullPage: true,
            animations: 'disabled'
        })
        const recordsAfterFailedDuplicate = (await listRecords(api, metahub.id, imageEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        expect(recordsAfterFailedDuplicate.items?.map((record) => record.id)).toEqual(
            imageRecordsBeforeDuplicate.items?.map((record) => record.id)
        )
        const widgetsAfterFailedDuplicate = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
        expect(readWidgets(widgetsAfterFailedDuplicate).map((widget) => readString(widget.id))).toEqual([...imageWidgetIdsBeforeDuplicate])
        expect(separateRecordCopyRequests).toBe(0)
        expect(separatePlacementRequests).toBe(0)
        await page.unroute(duplicateImagePlacementPath, failPlacementAfterRecordCopy)
        await page.unroute(imageRecordCopyPath, countSeparateRecordCopies)
        await page.unroute(imagePlacementCreatePath, countSeparatePlacementRequests)

        await failedDuplicateDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        const duplicateDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
        await expect(duplicateDiscardDialog).toHaveCount(0)
        await expect(failedDuplicateDialog).toHaveCount(0)

        const imagePlacementCopyResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', duplicateImagePlacementPath),
            { label: 'Creating a Marketing Image copy and placement atomically', timeout: 90_000 }
        )
        let atomicDuplicateRequests = 0
        const countAtomicDuplicateRequests = async (route: import('@playwright/test').Route) => {
            atomicDuplicateRequests += 1
            await route.continue()
        }
        await page.route(duplicateImagePlacementPath, countAtomicDuplicateRequests)
        await page.route(imageRecordCopyPath, countSeparateRecordCopies)
        await page.route(imagePlacementCreatePath, countSeparatePlacementRequests)
        await imageSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
        const imagePlacementCopyResponse = await imagePlacementCopyResponsePromise
        expect(imagePlacementCopyResponse.status()).toBe(201)
        expect(imagePlacementCopyResponse.ok()).toBe(true)
        expect(atomicDuplicateRequests).toBe(1)
        expect(separateRecordCopyRequests).toBe(0)
        expect(separatePlacementRequests).toBe(0)
        await page.unroute(duplicateImagePlacementPath, countAtomicDuplicateRequests)
        await page.unroute(imageRecordCopyPath, countSeparateRecordCopies)
        await page.unroute(imagePlacementCreatePath, countSeparatePlacementRequests)
        const duplicatedImageWidget = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => widget.widgetKey === 'marketing.image' && !imageWidgetIdsBeforeDuplicate.has(readString(widget.id)),
            'Duplicating the Image placement did not persist a new widget identity'
        )
        expect(readString(duplicatedImageWidget.id)).not.toBe(readString(imageWidget.id))
        const imageRecordsAfterDuplicate = (await listRecords(api, metahub.id, imageEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const copiedImageRecords = (imageRecordsAfterDuplicate.items ?? []).filter(
            (record) => !imageRecordsBeforeDuplicate.items?.some((previous) => previous.id === record.id)
        )
        expect(copiedImageRecords).toHaveLength(1)
        const copiedImageRecord = copiedImageRecords[0]
        if (typeof copiedImageRecord?.id !== 'string') throw new Error('The copied Image record did not expose its UUID identity')
        const copiedImageData = readRecord(copiedImageRecord.data)
        const copiedImageKey = readString(copiedImageData.ImageKey)
        const sourceImageData = readRecord(sourceImageRecord.data)
        expect(isUuidV7(copiedImageRecord.id)).toBe(true)
        expect(copiedImageRecord.id).not.toBe(sourceImageRecord.id)
        expect(copiedImageKey).not.toBe('')
        expect(copiedImageKey).not.toBe(sourceImageKey)
        expect(isUuidV7(copiedImageKey.slice('image-'.length))).toBe(true)
        expect(copiedImageData.Resource).toEqual(sourceImageData.Resource)
        expect(copiedImageData.Decorative).toBe(sourceImageData.Decorative)
        expect(copiedImageData.Width).toBe(sourceImageData.Width)
        expect(copiedImageData.Height).toBe(sourceImageData.Height)
        expect(readLocalizedText(copiedImageData.AltText, 'en')).toBe(readLocalizedText(sourceImageData.AltText, 'en'))
        expect(readLocalizedText(copiedImageData.AltText, 'ru')).toBe(readLocalizedText(sourceImageData.AltText, 'ru'))
        const duplicatedImageBindings = (await getLayoutZoneWidgetBindings(
            api,
            metahub.id,
            layoutId,
            readString(duplicatedImageWidget.id),
            'en'
        )) as { bindings?: Array<{ slot?: string; semanticKey?: string }> }
        expect(duplicatedImageBindings.bindings?.find(({ slot }) => slot === 'content')?.semanticKey).toBe(copiedImageKey)
        await expect(widgetSurface(page, duplicatedImageWidget)).toBeVisible()
        await page.reload()
        await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
        await expect(widgetSurface(page, duplicatedImageWidget)).toBeVisible()

        // Add a collection and create its empty Entity source model through the authoring UI.
        const mainZone = page.getByTestId('layout-zone-marketing-main')
        await mainZone.getByRole('button', { name: 'Add widget', exact: true }).click()
        const widgetMenu = page.getByRole('menu')
        await expect(widgetMenu).toBeVisible()
        await widgetMenu.getByRole('menuitem', { name: 'Collection', exact: true }).click()
        const collectionConfigDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(collectionConfigDialog).toBeVisible()
        await collectionConfigDialog.getByRole('button', { name: 'Save', exact: true }).click()
        await expect(collectionConfigDialog).toHaveCount(0)
        const collectionBindingDialog = page.getByRole('dialog').filter({
            has: page.getByRole('combobox', { name: 'Content source', exact: true })
        })
        await expect(collectionBindingDialog).toBeVisible()

        const sourceSelect = collectionBindingDialog.getByRole('combobox', { name: 'Content source', exact: true })
        await expect(sourceSelect).toBeEnabled()
        await sourceSelect.click()
        const sourceOptions = page.getByRole('option')
        await expect(sourceOptions).not.toHaveCount(0)
        await sourceOptions.first().click()

        const sourceName = `${executionRunId} collection source`
        await collectionBindingDialog.getByRole('button', { name: 'Create separate source', exact: true }).click()
        const sourceProvisionDialog = page.getByRole('dialog', { name: 'Create a separate content source', exact: true })
        await expect(sourceProvisionDialog).toBeVisible()
        await expect(sourceProvisionDialog).toContainText('Existing records will not be copied.')
        await expectNoTechnicalLeakage(sourceProvisionDialog, {
            label: 'Marketing collection source creation dialog',
            checkUuidSubstrings: true
        })
        const sourceProvisioningOriginalViewport = page.viewportSize()
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectLocatorFullyFitsViewport(sourceProvisionDialog, `Create content source dialog at ${viewport.name}`)
            await expectStandardDialogActionFooter(sourceProvisionDialog, `Create content source dialog at ${viewport.name}`)
            await expectNoPageHorizontalOverflow(page, `Create content source dialog at ${viewport.name}`)
            await page.screenshot({
                path: testInfo.outputPath(`marketing-widget-create-source-${viewport.name}.png`),
                animations: 'disabled'
            })
        }
        if (sourceProvisioningOriginalViewport) await page.setViewportSize(sourceProvisioningOriginalViewport)
        const sourceNameField = sourceProvisionDialog.getByRole('textbox', { name: 'Content source name', exact: true })
        await sourceNameField.fill(sourceName)
        await sourceProvisionDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        const sourceDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
        await expect(sourceDiscardDialog).toBeVisible()
        await expectNoTechnicalLeakage(sourceDiscardDialog, {
            label: 'Marketing source discard confirmation',
            checkUuidSubstrings: true
        })
        await sourceDiscardDialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
        await expect(sourceProvisionDialog).toBeVisible()
        await expect(sourceNameField).toHaveValue(sourceName)
        await sourceProvisionDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(sourceDiscardDialog).toBeVisible()
        await sourceDiscardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
        await expect(sourceProvisionDialog).toHaveCount(0)
        await collectionBindingDialog.getByRole('button', { name: 'Create separate source', exact: true }).click()
        await expect(sourceProvisionDialog).toBeVisible()
        await expect(sourceNameField).toHaveValue('')
        await sourceNameField.fill(sourceName)
        const provisionedEntityLookupResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname === `/api/v1/metahub/${metahub.id}/entities` &&
                url.searchParams.get('kind') === 'object' &&
                /^MarketingWidgetSource_[0-9a-f]{32}$/u.test(url.searchParams.get('search') ?? '')
            )
        })
        const sourceComponentResponses: Response[] = []
        const collectSourceComponentResponse = (response: Response) => {
            if (response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/components')) {
                sourceComponentResponses.push(response)
            }
        }
        page.on('response', collectSourceComponentResponse)
        const provisionResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', /\/widget-binding-sources\/marketing\.collection\/section$/),
            { label: 'Creating a separate Entity model for the new Marketing collection' }
        )
        await sourceProvisionDialog.getByRole('button', { name: 'Create', exact: true }).click()
        const [provisionResponse, provisionedEntityLookupResponse] = await Promise.all([
            provisionResponsePromise,
            provisionedEntityLookupResponsePromise
        ])
        expect(provisionResponse.ok()).toBe(true)
        expect(provisionedEntityLookupResponse.ok()).toBe(true)
        const provisionPayload = (await provisionResponse.json()) as {
            source?: { sourceKey?: string; label?: string; recordsCount?: number }
        }
        const provisionedSourceKey = readString(provisionPayload.source?.sourceKey)
        expect(provisionedSourceKey).toMatch(/^MarketingWidgetSource_[0-9a-f]{32}$/u)
        expect(provisionPayload.source).toMatchObject({ label: sourceName, recordsCount: 0 })
        expect(new URL(provisionedEntityLookupResponse.url()).searchParams.get('search')).toBe(provisionedSourceKey)
        const provisionedEntityLookupPayload = readRecord(await provisionedEntityLookupResponse.json())
        const provisionedEntityItems = Array.isArray(provisionedEntityLookupPayload.items)
            ? provisionedEntityLookupPayload.items.map(readRecord)
            : []
        const resolvedSourceEntity = provisionedEntityItems.find(
            (entity) => readLocalizedText(entity.codename, 'en') === provisionedSourceKey
        )
        expect(resolvedSourceEntity).toBeDefined()
        const provisionedEntityId = readString(resolvedSourceEntity?.id)
        await expect
            .poll(
                () =>
                    sourceComponentResponses.some((response) =>
                        new URL(response.url()).pathname.endsWith(`/instance/${provisionedEntityId}/components`)
                    ),
                { message: 'The newly provisioned Entity Components were not loaded by the authoring dialog' }
            )
            .toBe(true)
        const provisionedEntityComponentsResponse = sourceComponentResponses.find((response) =>
            new URL(response.url()).pathname.endsWith(`/instance/${provisionedEntityId}/components`)
        )
        expect(provisionedEntityComponentsResponse?.ok()).toBe(true)
        const provisionedEntityComponentsPayload = readRecord(await provisionedEntityComponentsResponse!.json())
        expect(Array.isArray(provisionedEntityComponentsPayload.items) ? provisionedEntityComponentsPayload.items : []).not.toHaveLength(0)
        page.off('response', collectSourceComponentResponse)
        await expect(sourceProvisionDialog).toHaveCount(0)
        await expect(sourceSelect).toHaveValue(sourceName)

        const createContentRecordButton = collectionBindingDialog.getByRole('button', { name: 'Create content', exact: true })
        await expect(createContentRecordButton).toBeEnabled()
        await createContentRecordButton.click()
        const createContentRecordDialog = page.getByRole('dialog', { name: 'Create content record', exact: true }).last()
        await expect(createContentRecordDialog).toBeVisible()
        await fillLocalizedFieldValues(page, createContentRecordDialog, 'Title', {
            en: `${executionRunId} Collection section`,
            ru: `${executionRunId} Раздел коллекции`
        })
        const createRecordResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', /\/entities\/object\/instance\/[^/]+\/instance\/[^/]+\/records$/u),
            { label: 'Creating a semantic Marketing collection section record' }
        )
        await createContentRecordDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const createRecordResponse = await createRecordResponsePromise
        expect(createRecordResponse.ok()).toBe(true)
        await expect(createContentRecordDialog).toHaveCount(0)
        await expect(collectionBindingDialog.getByRole('combobox', { name: 'Content record', exact: true })).toHaveValue(
            `${executionRunId} Collection section`
        )

        const addResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
            { label: 'Adding a marketing collection widget' }
        )
        await collectionBindingDialog.getByRole('button', { name: 'Add', exact: true }).click()
        const addResponse = await addResponsePromise
        expect(addResponse.ok()).toBe(true)
        const addedWidgetId = readString(readRecord(await addResponse.json()).id)
        expect(addedWidgetId).not.toBe('')
        await expect(collectionBindingDialog).toHaveCount(0)

        const addedWidget = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => readString(widget.id) === addedWidgetId && widget.widgetKey === 'marketing.collection',
            'The newly added marketing collection widget was not persisted'
        )
        expect(addedWidget.zone).toBe('marketing-main')
        expect(addedWidget.isActive).toBe(true)
        const addedInstanceKey = readString(readConfig(addedWidget).instanceKey)
        expect(addedInstanceKey).not.toBe('')
        expect(readConfig(addedWidget)).not.toHaveProperty('source')
        expect(readConfig(addedWidget)).not.toHaveProperty('copySource')
        const addedBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, readString(addedWidget.id), 'en')) as {
            bindings?: Array<{ slot?: string; sourceKey?: string; selectorKind?: string; semanticKey?: string }>
        }
        expect(addedBindings.bindings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    slot: 'section',
                    selectorKind: 'semantic-key',
                    sourceKey: provisionedSourceKey
                })
            ])
        )
        const itemsBinding = addedBindings.bindings?.find(({ slot }) => slot === 'items')
        expect(itemsBinding).toMatchObject({ slot: 'items', selectorKind: 'record-set' })
        expect(itemsBinding?.sourceKey).toBeTruthy()
        expect(itemsBinding?.sourceKey).not.toBe(provisionedSourceKey)
        const provisionedEntities = (await listEntityInstances(api, metahub.id, { kind: 'object', limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; codename?: unknown }>
        }
        const provisionedEntity = provisionedEntities.items?.find(
            (entity) => readLocalizedText(entity.codename, 'en') === provisionedSourceKey
        )
        if (!provisionedEntity?.id) throw new Error('The separately provisioned Marketing source was not persisted as an Object')
        const provisionedComponents = (await listComponents(api, metahub.id, provisionedEntity.id)) as {
            items?: Array<{ codename?: unknown }>
        }
        expect(provisionedComponents.items?.length ?? 0).toBeGreaterThan(0)
        const provisionedRecords = (await listRecords(api, metahub.id, provisionedEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        expect(provisionedRecords.items).toHaveLength(1)
        const provisionedSectionKey = readString(readRecord(provisionedRecords.items?.[0]?.data).SectionKey)
        expect(provisionedSectionKey).not.toBe('')
        expect(addedBindings.bindings?.find(({ slot }) => slot === 'section')?.semanticKey).toBe(provisionedSectionKey)
        expect(readLocalizedText(readRecord(provisionedRecords.items?.[0]?.data).Title, 'en')).toBe(`${executionRunId} Collection section`)
        expect(readLocalizedText(readRecord(provisionedRecords.items?.[0]?.data).Title, 'ru')).toBe(`${executionRunId} Раздел коллекции`)

        // Remove the newly appended widget through the shared confirmation dialog.
        const addedSurface = widgetSurface(page, addedWidget)
        await expect(addedSurface).toBeVisible()
        const removeButton = addedSurface.getByRole('button', { name: 'Delete', exact: true })
        await expect(removeButton).toBeVisible()
        await removeButton.click()
        const confirmation = page.getByRole('dialog', { name: 'Remove widget?' })
        await expect(confirmation).toBeVisible()
        await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
        await expect(confirmation.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(confirmation, {
            label: 'Marketing widget removal confirmation',
            checkUuidSubstrings: true
        })

        const removeResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'DELETE', /\/zone-widget\/[^/]+$/),
            { label: 'Removing the added marketing collection widget' }
        )
        await confirmation.getByRole('button', { name: 'Remove', exact: true }).click()
        const removeResponse = await removeResponsePromise
        expect(removeResponse.ok()).toBe(true)
        await expect(addedSurface).toHaveCount(0)
        await expect
            .poll(async () => {
                const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
                return getWidgetByInstanceKey(readWidgets(response), addedInstanceKey) !== undefined
            })
            .toBe(false)

        // Exercise the record-set + relation-set authoring flow through the same
        // dialog a metahub editor uses for a new Pricing placement.
        await verifyMarketingPricingRecordRelationSetFlow({ page, api, metahubId: metahub.id, layoutId, mainZone })

        // Use the accessible dnd-kit handle to exercise keyboard reorder, then verify order from durable data.
        const pricingSurface = widgetSurface(page, pricingWidget)
        await expect(pricingSurface).toBeVisible()
        const beforeReorderResponse = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
        const beforeReorder = readWidgets(beforeReorderResponse)
            .filter((widget) => widget.zone === 'marketing-main')
            .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
        const pricingIndex = beforeReorder.findIndex((widget) => readString(widget.id) === readString(pricingWidget.id))
        expect(pricingIndex).toBeGreaterThan(0)
        const dragHandle = pricingSurface.getByRole('button', { name: /^Reorder widget:/ })
        const moveResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/zone-widgets\/move$/),
            { label: 'Keyboard-reordering the marketing pricing widget' }
        )
        await dragHandle.focus()
        await page.keyboard.press('Space')
        await expect(dragHandle).toHaveAttribute('aria-pressed', 'true')
        await page.keyboard.press('ArrowUp')
        await expect(page.getByRole('status')).toContainText('Collection: Highlights')
        await page.keyboard.press('Space')
        const moveResponse = await moveResponsePromise
        expect(moveResponse.ok(), `Keyboard widget reorder returned HTTP ${moveResponse.status()}`).toBe(true)
        await expect
            .poll(async () => {
                const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
                const sorted = readWidgets(response)
                    .filter((widget) => widget.zone === 'marketing-main')
                    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
                return sorted.findIndex((widget) => readString(widget.id) === readString(pricingWidget.id))
            })
            .toBe(pricingIndex - 1)

        await expectNoTechnicalLeakage(details, {
            label: 'Marketing widget authoring surface after lifecycle mutations',
            checkUuidSubstrings: true
        })
        const lifecycleViewport = page.viewportSize()
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(details).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Marketing widget authoring lifecycle at ${viewport.name}`)
            await expectNoTechnicalLeakage(details, {
                label: `Marketing widget lifecycle at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            await page.screenshot({
                path: testInfo.outputPath(`marketing-page-widget-lifecycle-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }
        if (lifecycleViewport) await page.setViewportSize(lifecycleViewport)
    } finally {
        await disposeApiContext(api)
    }
})
