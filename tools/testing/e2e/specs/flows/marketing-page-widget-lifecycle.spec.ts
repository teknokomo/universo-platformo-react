import type { Locator, Page, Response, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    listMetahubEntityTypes,
    listLayoutZoneWidgets,
    listRecords,
    listLayouts
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import { readLocalizedText } from './entity-runtime-helpers'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

type LayoutZoneWidget = {
    id?: unknown
    zone?: unknown
    widgetKey?: unknown
    sortOrder?: unknown
    version?: unknown
    isActive?: unknown
    config?: unknown
}

type LayoutZoneWidgetsResponse = {
    items?: LayoutZoneWidget[]
}

const readWidgets = (payload: LayoutZoneWidgetsResponse | LayoutZoneWidget[] | null | undefined): LayoutZoneWidget[] => {
    if (Array.isArray(payload)) return payload
    return Array.isArray(payload?.items) ? payload.items : []
}

const readConfig = (widget: LayoutZoneWidget): Record<string, unknown> => {
    if (!widget.config || typeof widget.config !== 'object' || Array.isArray(widget.config)) return {}
    return widget.config as Record<string, unknown>
}

const readRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

const responseIsMutation = (response: Response, method: string, path: RegExp): boolean =>
    response.request().method() === method && path.test(new URL(response.url()).pathname)

const getWidgetByInstanceKey = (widgets: LayoutZoneWidget[], instanceKey: string): LayoutZoneWidget | undefined =>
    widgets.find((widget) => readString(readConfig(widget).instanceKey) === instanceKey)

const waitForWidgetState = async (
    api: ApiSession,
    metahubId: string,
    layoutId: string,
    predicate: (widget: LayoutZoneWidget) => boolean,
    message: string
): Promise<LayoutZoneWidget> => {
    let match: LayoutZoneWidget | undefined

    await expect
        .poll(
            async () => {
                const response = (await listLayoutZoneWidgets(api, metahubId, layoutId)) as LayoutZoneWidgetsResponse
                match = readWidgets(response).find(predicate)
                return Boolean(match)
            },
            { timeout: 60_000, message }
        )
        .toBe(true)

    if (!match) throw new Error(message)
    return match
}

const widgetSurface = (page: Page, widget: LayoutZoneWidget): Locator => {
    const id = readString(widget.id)
    if (!id) throw new Error('Marketing widget response did not expose a stable UI identity')
    return page.getByTestId(`layout-widget-${id}`)
}

const openWidgetConfigDialog = async (page: Page, surface: Locator): Promise<Locator> => {
    await surface.getByRole('button', { name: /Редактировать|Edit/ }).click()
    const dialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
    await expect(dialog).toBeVisible()
    return dialog
}

const layoutIdForMarketingPage = async (api: ApiSession, metahubId: string): Promise<string> => {
    const response = await listLayouts(api, metahubId, { limit: 100, offset: 0 })
    const layout = response.items?.find((item: { id?: unknown; templateKey?: unknown }) => item.templateKey === 'marketing-page')
    const layoutId = readString(layout?.id)
    if (!layoutId) throw new Error('The marketing-page metahub did not expose a marketing layout')
    return layoutId
}

test('@flow @combined @marketing-page browser widget lifecycle persists semantic composition changes', async ({
    page,
    runManifest
}, testInfo: TestInfo) => {
    test.setTimeout(240_000)

    const executionRunId = `${runManifest.runId}-widget-lifecycle-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`
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
        const configDialog = await openWidgetConfigDialog(page, faqSurface)
        const maxItemsField = configDialog.getByRole('spinbutton', { name: 'Maximum items', exact: true })
        await expect(maxItemsField).toBeVisible()
        await maxItemsField.fill('12')
        const configResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/config$/),
            { label: 'Saving FAQ marketing widget settings' }
        )
        await configDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const configResponse = await configResponsePromise
        expect(configResponse.ok()).toBe(true)
        await expect(configDialog).toHaveCount(0)
        await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => getWidgetByInstanceKey([widget], 'faq') !== undefined && readConfig(widget).maxItems === 12,
            'The FAQ marketing widget settings were not persisted'
        )

        // Duplicate a repeatable collection through the existing authoring surface. The server
        // owns the new row and instance identity; the browser must never manufacture either.
        const duplicateButton = faqSurface.getByRole('button', { name: /^Duplicate widget:/ })
        await expect(duplicateButton).toBeVisible()
        const duplicateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
            { label: 'Duplicating the FAQ marketing widget' }
        )
        await duplicateButton.click()
        const duplicateResponse = await duplicateResponsePromise
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
        expect(readString(readConfig(duplicatedFaq).instanceKey)).not.toBe(readString(readConfig(faqWidget).instanceKey))
        const duplicatedSurface = widgetSurface(page, duplicatedFaq)
        await expect(duplicatedSurface).toBeVisible()
        await page.reload()
        await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
        await expect(widgetSurface(page, duplicatedFaq)).toBeVisible()

        // A single Duplicate action creates both a new placement and its own
        // Hero Entity record. It should not send the author through a chooser.
        const heroSurface = widgetSurface(page, heroWidget)
        await expect(heroSurface).toBeVisible()
        const heroEntities = await listMetahubEntityTypes(api, metahub.id, { limit: 100, offset: 0 })
        const heroEntity = heroEntities.items?.find((entity: { codename?: unknown }) => readString(entity.codename) === 'MarketingPageHero')
        if (!heroEntity?.id) throw new Error('The marketing-page fixture did not expose the Hero Entity')
        const recordsBeforeDuplicate = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const sourceHeroRecord = recordsBeforeDuplicate.items?.find((record) => readString(readRecord(record.data).HeroKey) === 'default')
        if (!sourceHeroRecord?.id) throw new Error('The seeded marketing Hero Entity record was not available before duplication')
        const sourceHeroKey = readString(readRecord(sourceHeroRecord.data).HeroKey)

        const duplicateHeroResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
            { label: 'Duplicating the Hero placement and its bound Entity record', timeout: 90_000 }
        )
        await heroSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
        await expect(page.getByRole('dialog', { name: 'Hero content', exact: true })).toHaveCount(0)
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
        const duplicatedHeroKey = readString(readConfig(duplicatedHero).instanceKey)
        expect(duplicatedHeroKey).not.toBe('')
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
        const duplicatedHeroKey = readString(readRecord(duplicatedHeroRecord.data).HeroKey)
        expect(duplicatedHeroKey).not.toBe('')
        expect(duplicatedHeroKey).not.toBe(sourceHeroKey)
        expect(duplicatedHeroRecord.id).not.toBe(sourceHeroRecord.id)

        const duplicatedHeroSurface = widgetSurface(page, duplicatedHero)
        await expect(duplicatedHeroSurface).toBeVisible()
        await duplicatedHeroSurface.getByRole('button', { name: /Редактировать|Edit/ }).click()
        const duplicatedHeroRecordForm = page.getByRole('dialog', { name: /Edit Hero content/ })
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
        expect(readString(readRecord(savedCopy?.data).HeroKey)).toBe(duplicatedHeroKey)
        expect(readString(readRecord(savedSource?.data).HeroKey)).toBe(sourceHeroKey)
        expect(readLocalizedText(readRecord(savedCopy?.data).Title, 'en')).toBe('Lifecycle copy edited independently')
        expect(readLocalizedText(readRecord(savedSource?.data).Title, 'en')).toBe('Our latest')

        // Add a collection via the real widget menu and choose an available entity source.
        const mainZone = page.getByTestId('layout-zone-marketing-main')
        await mainZone.getByRole('button', { name: 'Add widget', exact: true }).click()
        const widgetMenu = page.getByRole('menu')
        await expect(widgetMenu).toBeVisible()
        await widgetMenu.getByRole('menuitem', { name: 'Collection', exact: true }).click()
        const addDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(addDialog).toBeVisible()

        const sourceSelect = addDialog.getByRole('combobox', { name: 'Content source', exact: true })
        if (await sourceSelect.isDisabled()) {
            await expect(addDialog.getByRole('alert')).toContainText('No compatible Object entity source is available')
            throw new Error(
                'The marketing-page fixture has no compatible Object entity source for the Collection widget; the browser flow cannot continue without bypassing the UI.'
            )
        }
        await sourceSelect.click()
        const sourceOptions = page.getByRole('option')
        await expect(sourceOptions).not.toHaveCount(0)
        await sourceOptions.first().click()

        const addResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
            { label: 'Adding a marketing collection widget' }
        )
        await addDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const addResponse = await addResponsePromise
        expect(addResponse.ok()).toBe(true)
        await expect(addDialog).toHaveCount(0)

        const addedWidget = await waitForWidgetState(
            api,
            metahub.id,
            layoutId,
            (widget) => {
                const config = readConfig(widget)
                return (
                    widget.widgetKey === 'marketing.collection' &&
                    readString(config.instanceKey) !== '' &&
                    readString(config.instanceKey) !== 'logos' &&
                    readString(config.instanceKey) !== 'features' &&
                    readString(config.instanceKey) !== 'testimonials' &&
                    readString(config.instanceKey) !== 'highlights' &&
                    readString(config.instanceKey) !== 'faq'
                )
            },
            'The newly added marketing collection widget was not persisted'
        )
        expect(addedWidget.zone).toBe('marketing-main')
        expect(addedWidget.isActive).toBe(true)
        const addedInstanceKey = readString(readConfig(addedWidget).instanceKey)
        expect(addedInstanceKey).not.toBe('')
        expect(readString(readRecord(readConfig(addedWidget).source).entityCodename)).toMatch(/^MarketingPage/)

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
        await expectNoPageHorizontalOverflow(page, 'Marketing widget authoring lifecycle')
        await page.screenshot({
            path: testInfo.outputPath('marketing-page-widget-lifecycle.png'),
            fullPage: true,
            animations: 'disabled'
        })
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @combined @marketing-page @i18n RU authoring localizes content sources and Hero binding/presentation dialogs', async ({
    page,
    runManifest
}, testInfo: TestInfo) => {
    test.setTimeout(240_000)

    const executionRunId = `${runManifest.runId}-widget-ru-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`
    const metahubName = `E2E ${executionRunId} marketing RU`
    const metahubCodename = `${executionRunId}-marketing-ru`
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        await applyBrowserPreferences(page, { language: 'ru' })

        const metahub = await createMetahub(api, {
            name: { en: metahubName, ru: metahubName },
            namePrimaryLocale: 'ru',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (!metahub?.id) throw new Error('RU marketing-page metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        const layoutId = await layoutIdForMarketingPage(api, metahub.id)
        const response = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse
        const widgets = readWidgets(response)
        const expectedLabels: Record<string, { label: string; source: string }> = {
            navigation: { label: 'Навигация', source: 'Навигация маркетинговой страницы' },
            logos: { label: 'Коллекция: Логотипы', source: 'Логотипы клиентов' },
            features: { label: 'Коллекция: Возможности', source: 'Возможности продукта' },
            testimonials: { label: 'Коллекция: Отзывы', source: 'Отзывы' },
            highlights: { label: 'Коллекция: Преимущества', source: 'Преимущества' },
            pricing: { label: 'Тарифы', source: 'Тарифы' },
            faq: { label: 'Коллекция: FAQ', source: 'Часто задаваемые вопросы' },
            footer: { label: 'Футер', source: 'Ссылки в подвале' }
        }

        await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
        const details = page.getByTestId('metahub-layout-details-content')
        await expect(details).toBeVisible()
        for (const [zone, label] of [
            ['marketing-header', 'Шапка маркетинговой страницы'],
            ['marketing-main', 'Содержимое маркетинговой страницы'],
            ['marketing-footer', 'Подвал маркетинговой страницы']
        ] as const) {
            await expect(page.getByTestId(`layout-zone-${zone}`)).toContainText(label)
        }

        for (const [instanceKey, expected] of Object.entries(expectedLabels)) {
            const widget = getWidgetByInstanceKey(widgets, instanceKey)
            if (!widget) throw new Error(`The marketing seed did not expose the ${instanceKey} widget in RU coverage`)
            const surface = widgetSurface(page, widget)
            await expect(surface.getByRole('button', { name: expected.label, exact: true })).toBeVisible()

            const dialog = await openWidgetConfigDialog(page, surface)
            await expect(dialog.getByRole('alert')).toHaveCount(0)
            await expectNoTechnicalLeakage(dialog, {
                label: `RU ${instanceKey} widget configuration dialog`,
                checkUuidSubstrings: true
            })
            const sourceSelect = dialog.getByRole('combobox', { name: 'Источник контента', exact: true })
            await expect(sourceSelect).toBeEnabled()
            await sourceSelect.click()
            const sourceOption = page.getByRole('option', { name: expected.source, exact: true })
            await expect(sourceOption).toBeVisible()
            await expect(sourceOption).not.toHaveText(/MarketingPage/)
            await sourceOption.click()
            await expect(sourceSelect).toContainText(expected.source)
            if (instanceKey === 'logos') {
                await page.screenshot({
                    path: testInfo.outputPath('marketing-page-widget-source-dialog-ru.png'),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
            await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
            await expect(dialog).toHaveCount(0)
        }

        const heroWidget = getWidgetByInstanceKey(widgets, 'hero')
        if (!heroWidget) throw new Error('The marketing seed did not expose the Hero widget in RU coverage')
        const heroSurface = widgetSurface(page, heroWidget)
        await expect(heroSurface.getByRole('button', { name: 'Главный экран', exact: true })).toBeVisible()
        await heroSurface.getByRole('button', { name: /Редактировать|Edit/ }).click()

        const heroBindingDialog = page.getByRole('dialog', { name: 'Содержимое первого экрана', exact: true })
        await expect(heroBindingDialog).toBeVisible()
        await expect(heroBindingDialog).toContainText(
            'Выберите запись Сущности для этого блока. Содержимое и настройки отображения сохраняются отдельно.'
        )
        await expectNoTechnicalLeakage(heroBindingDialog, {
            label: 'RU Hero content binding dialog',
            checkUuidSubstrings: true
        })
        const heroRecordSelect = heroBindingDialog.getByRole('combobox', { name: 'Запись для первого экрана', exact: true })
        await expect(heroRecordSelect).toBeEnabled()
        await expect(heroRecordSelect).toHaveValue('Наши новые')
        await heroRecordSelect.click()
        const localizedHeroRecord = page.getByRole('option', { name: 'Наши новые', exact: true })
        await expect(localizedHeroRecord).toBeVisible()
        await localizedHeroRecord.click()
        await heroBindingDialog.getByRole('button', { name: 'Настроить отображение', exact: true }).click()
        await expect(heroBindingDialog).toHaveCount(0)

        const heroPresentationDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(heroPresentationDialog).toBeVisible()
        await expect(heroPresentationDialog).toContainText(
            'Редактируйте связанные записи в метахабе: Сущности -> Объекты -> выбранный объект -> Записи.'
        )
        await expect(heroPresentationDialog.getByRole('combobox', { name: 'Источник контента', exact: true })).toHaveCount(0)
        await expect(heroPresentationDialog.getByRole('switch')).toHaveCount(1)
        await expect(heroPresentationDialog.getByRole('button', { name: 'Отмена', exact: true })).toBeVisible()
        await expect(heroPresentationDialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(heroPresentationDialog, {
            label: 'RU Hero presentation dialog',
            checkUuidSubstrings: true
        })
        await heroPresentationDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(heroPresentationDialog).toHaveCount(0)

        await expectNoTechnicalLeakage(details, {
            label: 'RU marketing widget authoring surface',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'RU marketing widget authoring')
        await expectRuntimeUxViewportMatrix(page, 'RU marketing widget authoring viewport matrix')
        await page.screenshot({
            path: testInfo.outputPath('marketing-page-widget-lifecycle-ru.png'),
            fullPage: true,
            animations: 'disabled'
        })

        await page.reload()
        await expect(page.getByTestId('layout-zone-marketing-header')).toContainText('Шапка маркетинговой страницы')
        await expect(page.getByTestId('layout-zone-marketing-main')).toContainText('Содержимое маркетинговой страницы')
        await expect(page.getByTestId('layout-zone-marketing-footer')).toContainText('Подвал маркетинговой страницы')
        await expectNoPageHorizontalOverflow(page, 'RU marketing widget authoring after reload')
    } finally {
        await disposeApiContext(api)
    }
})
