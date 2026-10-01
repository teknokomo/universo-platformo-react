import type { TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getLayoutZoneWidgetBindings,
    listLayoutZoneWidgets,
    listEntityInstances,
    listRecords
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { readLocalizedText } from '../../support/entityRuntimeParsing'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectRuntimeUxViewportMatrix } from '../../support/browser/runtimeUx'
import {
    getWidgetByInstanceKey,
    layoutIdForMarketingPage,
    openWidgetBindingDialog,
    readConfig,
    readString,
    readWidgets,
    responseIsMutation,
    widgetSurface,
    type LayoutZoneWidgetsResponse
} from './marketing-page-widget-test-support'

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
        const expectedLabels: Record<string, { label: string; slots: Array<{ label: string; source: string }> }> = {
            navigation: {
                label: 'Навигация',
                slots: [{ label: 'Коллекция содержимого', source: 'Навигация маркетинговой страницы' }]
            },
            logos: {
                label: 'Коллекция: Логотипы',
                slots: [
                    { label: 'Содержимое раздела', source: 'Секции маркетинговой страницы' },
                    { label: 'Коллекция содержимого', source: 'Логотипы клиентов' }
                ]
            },
            features: {
                label: 'Коллекция: Возможности',
                slots: [
                    { label: 'Содержимое раздела', source: 'Секции маркетинговой страницы' },
                    { label: 'Коллекция содержимого', source: 'Возможности продукта' }
                ]
            },
            testimonials: {
                label: 'Коллекция: Отзывы',
                slots: [
                    { label: 'Содержимое раздела', source: 'Секции маркетинговой страницы' },
                    { label: 'Коллекция содержимого', source: 'Отзывы' }
                ]
            },
            highlights: {
                label: 'Коллекция: Преимущества',
                slots: [
                    { label: 'Содержимое раздела', source: 'Секции маркетинговой страницы' },
                    { label: 'Коллекция содержимого', source: 'Преимущества' }
                ]
            },
            pricing: {
                label: 'Тарифы',
                slots: [
                    { label: 'Содержимое раздела', source: 'Секции маркетинговой страницы' },
                    { label: 'Тарифные планы', source: 'Тарифы' },
                    { label: 'Преимущества тарифов', source: 'Преимущества тарифов' }
                ]
            },
            faq: {
                label: 'Коллекция: FAQ',
                slots: [
                    { label: 'Содержимое раздела', source: 'Секции маркетинговой страницы' },
                    { label: 'Коллекция содержимого', source: 'Часто задаваемые вопросы' }
                ]
            },
            footer: {
                label: 'Футер',
                slots: [
                    { label: 'Настройки сайта', source: 'Настройки маркетинговой страницы' },
                    { label: 'Ссылки в футере', source: 'Ссылки в подвале' }
                ]
            }
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

        let verifiedLocalizedSourceProvision = false
        for (const [instanceKey, expected] of Object.entries(expectedLabels)) {
            const widget = getWidgetByInstanceKey(widgets, instanceKey)
            if (!widget) throw new Error(`The marketing seed did not expose the ${instanceKey} widget in RU coverage`)
            const surface = widgetSurface(page, widget)
            await expect(surface.getByRole('button', { name: expected.label, exact: true })).toBeVisible()

            const dialog = await openWidgetBindingDialog(page, surface)
            await expect(dialog.getByRole('alert')).toHaveCount(0)
            await expectNoTechnicalLeakage(dialog, {
                label: `RU ${instanceKey} widget configuration dialog`,
                checkUuidSubstrings: true
            })
            for (const slot of expected.slots) {
                const slotButton = dialog.getByRole('button', { name: new RegExp(slot.label) })
                if ((await slotButton.getAttribute('aria-expanded')) !== 'true') await slotButton.click()
                const sourceSelect = dialog.getByRole('combobox', { name: 'Источник содержимого', exact: true })
                await expect(sourceSelect).toBeEnabled()
                await sourceSelect.click()
                const sourceOption = page.getByRole('option', { name: slot.source, exact: true })
                await expect(sourceOption).toBeVisible()
                await expect(sourceOption).not.toHaveText(/MarketingPage/)
                await sourceOption.click()
                await expect(sourceSelect).toHaveValue(slot.source)

                if (instanceKey === 'logos' && slot.label === 'Содержимое раздела') {
                    const sourceName = `${executionRunId} модель секций`
                    const sourceProvisionPath = new RegExp(
                        `/api/v1/metahub/${metahub.id}/layout/${layoutId}/widget-binding-sources/marketing\\.collection/section$`,
                        'u'
                    )
                    let sourceProvisionRequests = 0
                    const countSourceProvisionRequests = async (route: import('@playwright/test').Route) => {
                        if (route.request().method() === 'POST') sourceProvisionRequests += 1
                        await route.continue()
                    }
                    await page.route(sourceProvisionPath, countSourceProvisionRequests)
                    await dialog.getByRole('button', { name: 'Создать отдельный источник', exact: true }).click()
                    const provisionDialog = page.getByRole('dialog', { name: 'Создать отдельный источник содержимого', exact: true })
                    await expect(provisionDialog).toBeVisible()
                    await expect(provisionDialog).toContainText('Существующие записи скопированы не будут.')
                    await expectNoTechnicalLeakage(provisionDialog, {
                        label: 'RU Marketing source creation dialog',
                        checkUuidSubstrings: true
                    })
                    await page.screenshot({
                        path: testInfo.outputPath('marketing-page-widget-create-source-ru.png'),
                        fullPage: true,
                        animations: 'disabled'
                    })
                    const sourceNameField = provisionDialog.getByRole('textbox', { name: 'Название источника содержимого', exact: true })
                    await sourceNameField.fill(sourceName)
                    await provisionDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
                    const sourceDiscardDialog = page.getByRole('dialog', { name: 'Отменить несохранённые изменения?', exact: true })
                    await expect(sourceDiscardDialog).toBeVisible()
                    await expectNoTechnicalLeakage(sourceDiscardDialog, {
                        label: 'RU Marketing source discard confirmation',
                        checkUuidSubstrings: true
                    })
                    await sourceDiscardDialog.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
                    await expect(provisionDialog).toBeVisible()
                    await expect(sourceNameField).toHaveValue(sourceName)
                    await provisionDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
                    await expect(sourceDiscardDialog).toBeVisible()
                    await sourceDiscardDialog.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
                    await expect(provisionDialog).toHaveCount(0)
                    expect(sourceProvisionRequests).toBe(0)
                    await dialog.getByRole('button', { name: 'Создать отдельный источник', exact: true }).click()
                    await expect(provisionDialog).toBeVisible()
                    await expect(sourceNameField).toHaveValue('')
                    await sourceNameField.fill(sourceName)
                    const provisionResponsePromise = waitForSettledMutationResponse(
                        page,
                        (response) => responseIsMutation(response, 'POST', sourceProvisionPath),
                        { label: 'Создание отдельной модели секций Marketing' }
                    )
                    await provisionDialog.getByRole('button', { name: 'Создать', exact: true }).click()
                    const provisionResponse = await provisionResponsePromise
                    expect(provisionResponse.ok()).toBe(true)
                    expect(sourceProvisionRequests).toBe(1)
                    const provisionPayload = (await provisionResponse.json()) as {
                        source?: { sourceKey?: string; label?: string; recordsCount?: number }
                    }
                    expect(provisionPayload.source).toMatchObject({
                        sourceKey: expect.stringMatching(/^MarketingWidgetSource_[0-9a-f]{32}$/u),
                        label: sourceName,
                        recordsCount: 0
                    })
                    await expect(provisionDialog).toHaveCount(0)
                    await expect(sourceSelect).toHaveValue(sourceName)
                    await page.unroute(sourceProvisionPath, countSourceProvisionRequests)
                    verifiedLocalizedSourceProvision = true
                }
            }
            if (instanceKey === 'logos') {
                await page.screenshot({
                    path: testInfo.outputPath('marketing-page-widget-source-dialog-ru.png'),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
            await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
            if (instanceKey === 'logos' && verifiedLocalizedSourceProvision) {
                const bindingDiscardDialog = page.getByRole('dialog', { name: 'Отменить несохранённые изменения?', exact: true })
                await expect(bindingDiscardDialog).toBeVisible()
                await bindingDiscardDialog.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
                await expect(dialog).toBeVisible()
                await expect(dialog).toContainText(`${executionRunId} модель секций`)
                await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
                await expect(bindingDiscardDialog).toBeVisible()
                await bindingDiscardDialog.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
            }
            await expect(dialog).toHaveCount(0)
        }
        expect(verifiedLocalizedSourceProvision).toBe(true)

        const heroWidget = getWidgetByInstanceKey(widgets, 'hero')
        if (!heroWidget) throw new Error('The marketing seed did not expose the Hero widget in RU coverage')
        const originalHeroConfig = readConfig(heroWidget)
        const originalHeroBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, readString(heroWidget.id), 'ru')) as {
            bindings?: Array<{ slot?: string; semanticKey?: string }>
        }
        const heroSurface = widgetSurface(page, heroWidget)
        await expect(heroSurface.getByRole('button', { name: 'Главный экран', exact: true })).toBeVisible()
        await expect(heroSurface.getByRole('button', { name: 'Редактировать содержимое', exact: true })).toBeVisible()

        await heroSurface.getByRole('button', { name: 'Редактировать содержимое', exact: true }).click()
        const directHeroRecordForm = page.getByRole('dialog', { name: 'Редактировать запись содержимого', exact: true })
        await expect(directHeroRecordForm).toBeVisible()
        const directHeroTitleEn = directHeroRecordForm
            .getByTestId('localized-inline-row-en')
            .getByRole('textbox', { name: 'Заголовок', exact: true })
        const directHeroTitleRu = directHeroRecordForm
            .getByTestId('localized-inline-row-ru')
            .getByRole('textbox', { name: 'Заголовок', exact: true })
        const originalHeroTitleEn = 'Our latest'
        await expect(directHeroTitleEn).toHaveValue(originalHeroTitleEn)
        await expect(directHeroTitleRu).toHaveValue('Наши новые')
        const directHeroOriginalViewport = page.viewportSize()
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(directHeroRecordForm).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Russian direct Hero editor at ${viewport.name}`)
            const dialogBounds = await directHeroRecordForm.boundingBox()
            expect(dialogBounds, `${viewport.name} direct Hero editor must have visible bounds`).not.toBeNull()
            expect(dialogBounds!.x).toBeGreaterThanOrEqual(0)
            expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(viewport.width)
            await page.screenshot({
                path: testInfo.outputPath(`marketing-widget-hero-direct-edit-ru-${viewport.name}.png`),
                animations: 'disabled'
            })
        }
        if (directHeroOriginalViewport) await page.setViewportSize(directHeroOriginalViewport)

        await directHeroTitleRu.fill('')
        await expect(directHeroTitleRu).toHaveAttribute('aria-invalid', 'true')
        const directHeroValidation = directHeroRecordForm.getByText('Заполните поле «Заголовок» на языке «русский» перед сохранением.', {
            exact: true
        })
        await expect(directHeroValidation).toBeVisible()
        const directHeroValidationId = await directHeroValidation.getAttribute('id')
        expect((await directHeroTitleRu.getAttribute('aria-describedby'))?.split(/\s+/u)).toContain(directHeroValidationId)
        await expect(directHeroRecordForm.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
        const updatedHeroTitleRu = 'Наши новые — локализованное обновление'
        await directHeroTitleRu.fill(updatedHeroTitleRu)
        await expect(directHeroRecordForm.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled()
        const directHeroUpdateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/u),
            { label: 'Saving a Russian Hero content edit', timeout: 90_000 }
        )
        await directHeroRecordForm.getByRole('button', { name: 'Сохранить', exact: true }).click()
        const directHeroUpdateResponse = await directHeroUpdateResponsePromise
        expect(directHeroUpdateResponse.status()).toBe(200)
        await expect(directHeroRecordForm).toHaveCount(0)

        const heroBindingDialog = page
            .getByRole('dialog')
            .filter({ has: page.getByRole('combobox', { name: 'Запись содержимого', exact: true }) })
        await expect(heroBindingDialog).toBeVisible()
        await expectNoTechnicalLeakage(heroBindingDialog, {
            label: 'RU Hero content binding dialog',
            checkUuidSubstrings: true
        })
        const heroRecordSelect = heroBindingDialog.getByRole('combobox', { name: 'Запись содержимого', exact: true })
        await expect(heroRecordSelect).toBeEnabled()
        await expect(heroRecordSelect).toHaveAttribute('aria-describedby', /.+/u)
        await expect(heroBindingDialog.getByText('Выберите запись Сущности для этого виджета.', { exact: true })).toBeVisible()
        await expect(heroRecordSelect).toHaveValue(updatedHeroTitleRu)
        expect(
            await heroBindingDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
            'The open binding dialog should own keyboard focus'
        ).toBe(true)
        await page.keyboard.press('Tab')
        expect(
            await heroBindingDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
            'Tab navigation should remain within the open binding dialog'
        ).toBe(true)

        const heroEntities = await listEntityInstances(api, metahub.id, { kind: 'object', limit: 100, offset: 0 })
        const heroEntity = heroEntities.items?.find(
            (entity: { codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageHero'
        )
        if (!heroEntity?.id) throw new Error('The marketing-page fixture did not expose the Hero Entity for RU readback')
        const heroRecords = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const persistedRussianHeroRecord = heroRecords.items?.find(
            (record) => readLocalizedText(record.data?.Title, 'ru') === updatedHeroTitleRu
        )
        if (!persistedRussianHeroRecord?.id) throw new Error('The saved RU Hero record could not be identified for discard verification')
        expect(readLocalizedText(persistedRussianHeroRecord?.data?.Title, 'ru')).toBe(updatedHeroTitleRu)

        await heroBindingDialog.getByRole('button', { name: 'Редактировать содержимое', exact: true }).click()
        const discardedHeroRecordForm = page.getByRole('dialog', { name: 'Редактировать запись содержимого', exact: true })
        await expect(discardedHeroRecordForm).toBeVisible()
        const discardedHeroTitleRu = discardedHeroRecordForm
            .getByTestId('localized-inline-row-ru')
            .getByRole('textbox', { name: 'Заголовок', exact: true })
        await expect(discardedHeroTitleRu).toHaveValue(updatedHeroTitleRu)
        await discardedHeroTitleRu.fill('Черновик, который будет отменён')
        await discardedHeroRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
        const heroContentDiscardDialog = page.getByRole('dialog', { name: 'Отменить несохранённые изменения?', exact: true })
        await expect(heroContentDiscardDialog).toBeVisible()
        await heroContentDiscardDialog.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
        await expect(discardedHeroTitleRu).toHaveValue('Черновик, который будет отменён')
        await discardedHeroRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(heroContentDiscardDialog).toBeVisible()
        await heroContentDiscardDialog.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
        await expect(discardedHeroRecordForm).toHaveCount(0)
        await expect(heroRecordSelect).toHaveValue(updatedHeroTitleRu)
        const heroRecordsAfterDiscard = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const persistedHeroRecordAfterDiscard = heroRecordsAfterDiscard.items?.find((record) => record.id === persistedRussianHeroRecord.id)
        expect(readLocalizedText(persistedHeroRecordAfterDiscard?.data?.Title, 'en')).toBe(originalHeroTitleEn)
        expect(readLocalizedText(persistedHeroRecordAfterDiscard?.data?.Title, 'ru')).toBe(updatedHeroTitleRu)

        await heroRecordSelect.click()
        const localizedHeroRecord = page.getByRole('option', { name: new RegExp(`^${updatedHeroTitleRu}(?:\\s|$)`, 'u') })
        await expect(localizedHeroRecord).toBeVisible()
        await localizedHeroRecord.click()
        await heroBindingDialog.getByRole('button', { name: 'Оформление', exact: true }).click()
        await expect(heroBindingDialog).toBeHidden()

        const heroPresentationDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
        await expect(heroPresentationDialog).toBeVisible()
        await expect(heroPresentationDialog).toContainText(
            'Виджет отображает данные из связанных записей Сущностей. Управляйте ими в разделе «Объекты» метахаба.'
        )
        await expect(heroPresentationDialog).toContainText('Показывать форму подписки по электронной почте в виджете Hero.')
        await expect(heroPresentationDialog.getByRole('combobox', { name: 'Источник контента', exact: true })).toHaveCount(0)
        const heroPresentationSwitch = heroPresentationDialog.getByRole('switch')
        await expect(heroPresentationSwitch).toHaveCount(1)
        await expect(heroPresentationDialog.getByRole('button', { name: 'Отмена', exact: true })).toBeVisible()
        await expect(heroPresentationDialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(heroPresentationDialog, {
            label: 'RU Hero presentation dialog',
            checkUuidSubstrings: true
        })
        const initialPresentationState = await heroPresentationSwitch.isChecked()
        const changedPresentationState = !initialPresentationState
        await heroPresentationSwitch.click()
        await expect(heroPresentationSwitch).toBeChecked({ checked: changedPresentationState })
        await heroPresentationDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        const presentationDiscardDialog = page.getByRole('dialog', { name: 'Отменить несохранённые изменения?', exact: true })
        await expect(presentationDiscardDialog).toBeVisible()
        await expectNoTechnicalLeakage(presentationDiscardDialog, {
            label: 'RU presentation discard confirmation',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('marketing-widget-presentation-discard-ru.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await presentationDiscardDialog.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
        await expect(heroPresentationDialog).toBeVisible()
        await expect(heroPresentationSwitch).toBeChecked({ checked: changedPresentationState })
        await heroPresentationDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(presentationDiscardDialog).toBeVisible()
        await presentationDiscardDialog.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
        await expect(heroPresentationDialog).toHaveCount(0)

        const persistedWidgets = readWidgets((await listLayoutZoneWidgets(api, metahub.id, layoutId)) as LayoutZoneWidgetsResponse)
        const persistedHeroWidget = getWidgetByInstanceKey(persistedWidgets, 'hero')
        expect(persistedHeroWidget).toBeDefined()
        expect(readConfig(persistedHeroWidget!)).toEqual(originalHeroConfig)
        const persistedHeroBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, readString(heroWidget.id), 'ru')) as {
            bindings?: Array<{ slot?: string; semanticKey?: string; selectionLabel?: string }>
        }
        expect(persistedHeroBindings.bindings).toHaveLength(originalHeroBindings.bindings?.length ?? 0)
        expect(persistedHeroBindings.bindings?.map(({ slot, semanticKey }) => ({ slot, semanticKey }))).toEqual(
            originalHeroBindings.bindings?.map(({ slot, semanticKey }) => ({ slot, semanticKey }))
        )
        expect(persistedHeroBindings.bindings).toContainEqual(
            expect.objectContaining({ slot: 'content', selectionLabel: updatedHeroTitleRu })
        )

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
        const reloadedHeroSurface = widgetSurface(page, heroWidget)
        await reloadedHeroSurface.getByRole('button', { name: 'Редактировать содержимое', exact: true }).click()
        const reloadedHeroRecordForm = page.getByRole('dialog', { name: 'Редактировать запись содержимого', exact: true })
        await expect(reloadedHeroRecordForm).toBeVisible()
        await expect(
            reloadedHeroRecordForm.getByTestId('localized-inline-row-ru').getByRole('textbox', { name: 'Заголовок', exact: true })
        ).toHaveValue(updatedHeroTitleRu)
        await reloadedHeroRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(reloadedHeroRecordForm).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'RU marketing widget authoring after reload')
    } finally {
        await disposeApiContext(api)
    }
})
