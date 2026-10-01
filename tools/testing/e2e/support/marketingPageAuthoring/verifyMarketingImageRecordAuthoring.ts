import { expect, type Page, type TestInfo } from '@playwright/test'
import { getLayoutZoneWidgetBindings, listLayoutZoneWidgets, listRecords, sendWithCsrf } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import type { ApiContext } from '../lmsRuntime'
import {
    expectLocatorFullyFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectTableHorizontalScrollConstrained
} from '../browser/runtimeUx'
import {
    ensureListView,
    expectStandardDialogActionFooter,
    fillLocalizedFieldValues,
    readLayoutWidgetConfig,
    responseIsMutation,
    type LayoutWidgetsResponse
} from '../marketingPageAuthoringHelpers'
import { readLocalizedText } from '../entityRuntimeParsing'

type MarketingEntityInstancesResponse = {
    items?: Array<{ id?: string; codename?: unknown }>
}

export async function verifyMarketingImageRecordAuthoring(options: {
    api: ApiContext
    page: Page
    testInfo: TestInfo
    runStep: (title: string, action: () => Promise<void>) => Promise<void>
    metahubId: string
    marketingLayoutId: string
    entityResponse: MarketingEntityInstancesResponse
    brandLogoUrl: string
}): Promise<{ expectedValidationResourceUrls: string[]; imageAltText: { en: string; ru: string } }> {
    const { api, page, testInfo, runStep, metahubId, marketingLayoutId, entityResponse, brandLogoUrl } = options
    let imageEntityId = ''
    let siteSettingsEntityId = ''
    let imageWidgetId = ''
    const expectedValidationResourceUrls: string[] = []
    const imageBindingDialog = page.getByRole('dialog').filter({
        has: page.getByRole('combobox', { name: 'Content record', exact: true })
    })
    const imageAltText = {
        en: 'Material UI dashboard preview',
        ru: 'Предпросмотр панели управления Material UI'
    }
    const updatedImageAltText = {
        en: 'Edited Material UI dashboard preview',
        ru: 'Обновлённый предпросмотр панели Material UI'
    }

    await runStep('Resolve Marketing Image entities and placement', async () => {
        const imageEntity = (entityResponse?.items ?? []).find(
            (entity: { id?: string; codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageImage'
        )
        const siteSettingsEntity = (entityResponse?.items ?? []).find(
            (entity: { id?: string; codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageSiteSettings'
        )
        if (typeof imageEntity?.id !== 'string' || typeof siteSettingsEntity?.id !== 'string') {
            throw new Error('The marketing template did not expose its image and site-settings Entities')
        }
        imageEntityId = imageEntity.id
        siteSettingsEntityId = siteSettingsEntity.id

        const sourceWidgets = (await listLayoutZoneWidgets(api, metahubId, marketingLayoutId)) as LayoutWidgetsResponse
        const imageWidget = sourceWidgets.items?.find((widget) => readLayoutWidgetConfig(widget).instanceKey === 'hero-image')
        if (!imageWidget?.id) throw new Error('The marketing template did not expose its Image placement')
        imageWidgetId = imageWidget.id as string
    })

    await runStep('Create Marketing Image record and validate localized AltText', async () => {
        await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
        const imageSurface = page.getByTestId(`layout-widget-${imageWidgetId}`)
        await expect(imageSurface).toBeVisible()
        await imageSurface.getByRole('button', { name: 'Edit', exact: true }).click()
        await expect(imageBindingDialog).toBeVisible()
        await expectNoTechnicalLeakage(imageBindingDialog, { label: 'Marketing Image binding dialog', checkUuidSubstrings: true })
        await imageBindingDialog.getByRole('button', { name: 'Create content', exact: true }).click()

        const imageRecordForm = page.getByRole('dialog', { name: 'Create content record', exact: true }).last()
        await expect(imageRecordForm).toBeVisible()
        await expectNoTechnicalLeakage(imageRecordForm, { label: 'Marketing Image record form', checkUuidSubstrings: true })
        const resourceType = imageRecordForm.getByRole('combobox', { name: 'Resource type', exact: true })
        const resourceUrl = imageRecordForm.getByRole('textbox', { name: 'Source URL', exact: true })
        await expect(resourceType).toBeVisible()
        await expect(resourceUrl).toBeVisible()
        await expect(resourceUrl).toHaveValue('')
        await expect(resourceUrl).not.toHaveAttribute('aria-invalid', 'true')
        await fillLocalizedFieldValues(page, imageRecordForm, 'Alternative text', imageAltText)
        await imageRecordForm.getByRole('textbox', { name: 'Display width', exact: true }).fill('1600')
        await imageRecordForm.getByRole('textbox', { name: 'Display height', exact: true }).fill('900')
        const decorativeImage = imageRecordForm.getByRole('checkbox', { name: 'Decorative image', exact: true })
        const imageRecordSave = imageRecordForm.getByRole('button', { name: 'Save', exact: true })
        await expect(decorativeImage).toBeVisible()
        await expect(decorativeImage).not.toBeChecked()
        await expect(imageRecordSave).toBeEnabled()
        await fillLocalizedFieldValues(page, imageRecordForm, 'Alternative text', { en: '', ru: '' })
        await expect(imageRecordSave).toBeDisabled()
        await decorativeImage.check()
        await expect(imageRecordSave).toBeEnabled()
        await decorativeImage.uncheck()
        await expect(imageRecordSave).toBeDisabled()
        await fillLocalizedFieldValues(page, imageRecordForm, 'Alternative text', imageAltText)
        await expect(imageRecordSave).toBeEnabled()

        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectLocatorFullyFitsViewport(imageRecordForm, `Marketing Image form at ${viewport.name}`)
            await expectStandardDialogActionFooter(imageRecordForm, `Marketing Image form at ${viewport.name}`)
            await expectNoPageHorizontalOverflow(page, `Marketing Image form at ${viewport.name}`)
            await expectNoTechnicalLeakage(imageRecordForm, {
                label: `Marketing Image form at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            await page.screenshot({
                path: testInfo.outputPath(`marketing-image-record-form-${viewport.name}.png`),
                animations: 'disabled'
            })
        }
        await page.setViewportSize({ width: 1920, height: 1080 })

        const imageRecordCreatePath = new RegExp(
            `/api/v1/metahub/${metahubId}/entities/object/instance/(?:[^/]+/instance/)?${imageEntityId}/records$`,
            'u'
        )
        const imageCreateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', imageRecordCreatePath),
            { label: 'Creating a Marketing Image record through ResourceSource controls' }
        )
        const omitRussianAltTextForServerValidation = async (route: import('@playwright/test').Route) => {
            if (route.request().method() !== 'POST') {
                await route.continue()
                return
            }
            const requestBody = route.request().postDataJSON() as { data?: Record<string, unknown> }
            const altText = requestBody.data?.AltText
            const locales =
                altText && typeof altText === 'object' && !Array.isArray(altText) ? (altText as Record<string, unknown>).locales : null
            if (!locales || typeof locales !== 'object' || Array.isArray(locales) || !('ru' in locales)) {
                throw new Error('The browser did not submit the expected localized Image AltText shape')
            }
            delete (locales as Record<string, unknown>).ru
            await route.continue({ postData: JSON.stringify(requestBody) })
        }
        await page.route(imageRecordCreatePath, omitRussianAltTextForServerValidation)
        await imageRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
        const validationResponse = await imageCreateResponsePromise
        expect(validationResponse.status()).toBe(400)
        expect(await validationResponse.json()).toMatchObject({ code: 'VALIDATION_ERROR', fields: ['AltText.ru.required'] })
        expectedValidationResourceUrls.push(validationResponse.url())
        const russianAltRow = imageRecordForm.getByTestId('localized-inline-row-ru')
        const russianAltInput = russianAltRow.getByRole('textbox', { name: 'Alternative text', exact: true })
        await expect(russianAltInput).toHaveAttribute('aria-invalid', 'true')
        await expect(imageRecordForm.getByText('Add Alternative text in Russian before saving.', { exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(imageRecordForm, {
            label: 'Marketing Image localized server validation error',
            checkUuidSubstrings: true,
            checkInternalValidationText: true
        })
        await page.screenshot({
            path: testInfo.outputPath('marketing-image-alttext-inline-server-error.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await page.unroute(imageRecordCreatePath, omitRussianAltTextForServerValidation)
        await russianAltInput.fill('')
        await expect(russianAltInput).toHaveAttribute('aria-invalid', 'true')
        await expect(imageRecordForm.getByText('Add Alternative text in Russian before saving.', { exact: true })).toBeVisible()
        await russianAltInput.fill(imageAltText.ru)
        await expect(imageRecordForm.getByText('Add Alternative text in Russian before saving.', { exact: true })).toHaveCount(0)
        const successfulImageCreateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', imageRecordCreatePath),
            { label: 'Creating a Marketing Image record after correcting localized AltText' }
        )
        await imageRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
        const successfulImageCreateResponse = await successfulImageCreateResponsePromise
        expect(successfulImageCreateResponse.status()).toBe(201)
        expect(successfulImageCreateResponse.ok()).toBe(true)
        await expect(imageRecordForm).toHaveCount(0)
        await expect(imageBindingDialog).toBeVisible()
    })

    await runStep('Verify edit cancellation and update the Marketing Image record', async () => {
        const imageRecordsBeforeEdit = (await listRecords(api, metahubId, imageEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const imageRecordToEdit = imageRecordsBeforeEdit.items?.find(
            (record) => readLocalizedText(record.data?.AltText, 'en') === imageAltText.en
        )
        if (typeof imageRecordToEdit?.id !== 'string') throw new Error('The browser-created Marketing Image record could not be reopened')
        expect(imageRecordToEdit.data?.Resource ?? null).toBeNull()
        const imageRecordUpdatePath = new RegExp(
            `/api/v1/metahub/${metahubId}/entities/object/instance/(?:[^/]+/instance/)?${imageEntityId}/record/${imageRecordToEdit.id}$`,
            'u'
        )
        await imageBindingDialog.getByRole('button', { name: 'Edit content', exact: true }).click()
        let imageRecordEditForm = page.getByRole('dialog', { name: 'Edit content record', exact: true })
        await expect(imageRecordEditForm).toBeVisible()
        await expectNoTechnicalLeakage(imageRecordEditForm, {
            label: 'Marketing Image edit form',
            checkUuidSubstrings: true
        })
        const editableImageResource = imageRecordEditForm.getByRole('textbox', { name: 'Source URL', exact: true })
        await expect(editableImageResource).toHaveValue('')
        await expect(editableImageResource).not.toHaveAttribute('aria-invalid', 'true')
        await editableImageResource.fill(brandLogoUrl)
        await fillLocalizedFieldValues(page, imageRecordEditForm, 'Alternative text', updatedImageAltText)
        await imageRecordEditForm.getByRole('textbox', { name: 'Display width', exact: true }).fill('1440')
        await imageRecordEditForm.getByRole('textbox', { name: 'Display height', exact: true }).fill('810')
        await imageRecordEditForm.getByRole('button', { name: 'Cancel', exact: true }).click()
        const contentDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
        await expect(contentDiscardDialog).toBeVisible()
        await contentDiscardDialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
        await expect(imageRecordEditForm).toBeVisible()
        await expect(imageRecordEditForm.getByRole('textbox', { name: 'Display width', exact: true })).toHaveValue(/1440/u)
        await imageRecordEditForm.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(contentDiscardDialog).toBeVisible()
        await contentDiscardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
        await expect(imageRecordEditForm).toHaveCount(0)
        const imageRecordsAfterDiscard = (await listRecords(api, metahubId, imageEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const unchangedImageRecord = imageRecordsAfterDiscard.items?.find((record) => record.id === imageRecordToEdit.id)
        expect(unchangedImageRecord?.data?.Resource ?? null).toBeNull()
        expect(readLocalizedText(unchangedImageRecord?.data?.AltText, 'en')).toBe(imageAltText.en)
        expect(readLocalizedText(unchangedImageRecord?.data?.AltText, 'ru')).toBe(imageAltText.ru)
        expect(unchangedImageRecord?.data?.Width).toBe(1600)
        expect(unchangedImageRecord?.data?.Height).toBe(900)

        await imageBindingDialog.getByRole('button', { name: 'Edit content', exact: true }).click()
        imageRecordEditForm = page.getByRole('dialog', { name: 'Edit content record', exact: true })
        await expect(imageRecordEditForm).toBeVisible()
        await imageRecordEditForm.getByRole('textbox', { name: 'Source URL', exact: true }).fill(brandLogoUrl)
        await fillLocalizedFieldValues(page, imageRecordEditForm, 'Alternative text', updatedImageAltText)
        await imageRecordEditForm.getByRole('textbox', { name: 'Display width', exact: true }).fill('1440')
        await imageRecordEditForm.getByRole('textbox', { name: 'Display height', exact: true }).fill('810')
        const imageRecordUpdateResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', imageRecordUpdatePath),
            { label: 'Editing the Marketing Image Entity record through its binding dialog' }
        )
        await imageRecordEditForm.getByRole('button', { name: 'Save', exact: true }).click()
        const imageRecordUpdateResponse = await imageRecordUpdateResponsePromise
        expect(imageRecordUpdateResponse.status()).toBe(200)
        expect(imageRecordUpdateResponse.ok()).toBe(true)
        await expect(imageRecordEditForm).toHaveCount(0)
        await expect(imageBindingDialog).toBeVisible()
    })

    await runStep('Bind the image record and verify saved data and server validation', async () => {
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectLocatorFullyFitsViewport(imageBindingDialog, `Marketing Image binding dialog at ${viewport.name}`)
            await expectStandardDialogActionFooter(imageBindingDialog, `Marketing Image binding dialog at ${viewport.name}`)
            await expectNoPageHorizontalOverflow(page, `Marketing Image binding dialog at ${viewport.name}`)
            await expectNoTechnicalLeakage(imageBindingDialog, {
                label: `Marketing Image binding dialog at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            await page.screenshot({
                path: testInfo.outputPath(`marketing-image-binding-dialog-${viewport.name}.png`),
                animations: 'disabled'
            })
        }
        await page.setViewportSize({ width: 1920, height: 1080 })

        const imageBindingSavePath = new RegExp(
            `/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/zone-widget/${imageWidgetId}/binding$`,
            'u'
        )
        const imageBindingSaveResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', imageBindingSavePath),
            { label: 'Binding the new Marketing Image record to its placement' }
        )
        await imageBindingDialog.getByRole('button', { name: 'Save', exact: true }).click()
        const imageBindingSaveResponse = await imageBindingSaveResponsePromise
        expect(imageBindingSaveResponse.status()).toBe(200)
        expect(imageBindingSaveResponse.ok()).toBe(true)
        await expect(imageBindingDialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
        await imageBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(imageBindingDialog).toHaveCount(0)

        const imageBindings = (await getLayoutZoneWidgetBindings(api, metahubId, marketingLayoutId, imageWidgetId, 'en')) as {
            bindings?: Array<{ slot?: string; semanticKey?: string }>
        }
        const createdImageKey = imageBindings.bindings?.find(({ slot }) => slot === 'content')?.semanticKey
        expect(createdImageKey).toBeTruthy()
        const imageRecords = (await listRecords(api, metahubId, imageEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ id?: string; data?: Record<string, unknown> }>
        }
        const createdImageRecord = imageRecords.items?.find((record) => record.data?.ImageKey === createdImageKey)
        if (typeof createdImageRecord?.id !== 'string' || typeof createdImageKey !== 'string') {
            throw new Error('The bound Marketing Image record could not be resolved after saving its binding')
        }
        expect(createdImageRecord?.data?.Resource).toMatchObject({ type: 'url', url: brandLogoUrl })
        expect(readLocalizedText(createdImageRecord?.data?.AltText, 'en')).toBe(updatedImageAltText.en)
        expect(readLocalizedText(createdImageRecord?.data?.AltText, 'ru')).toBe(updatedImageAltText.ru)
        expect(createdImageRecord?.data?.Width).toBe(1440)
        expect(createdImageRecord?.data?.Height).toBe(810)

        const rejectedImageWithoutAltText = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/metahub/${metahubId}/entities/object/instance/${imageEntityId}/records`,
            {
                data: {
                    Resource: { type: 'url', url: brandLogoUrl },
                    Decorative: false,
                    Width: 1600,
                    Height: 900
                },
                sortOrder: 2
            }
        )
        expect(rejectedImageWithoutAltText.status).toBe(400)
        expect(await rejectedImageWithoutAltText.json()).toMatchObject({
            code: 'VALIDATION_ERROR',
            fields: ['AltText.required']
        })
    })

    await runStep('Verify the saved image in the records table at each viewport', async () => {
        await page.goto(`/metahub/${metahubId}/entities/object/instances`)
        await ensureListView(page, true)
        const imageEntityLink = page.getByRole('link', { name: 'Marketing images', exact: true })
        await expect(imageEntityLink).toBeVisible()
        await imageEntityLink.click()
        await page.getByRole('tab', { name: 'Records', exact: true }).click()
        const imageRecordRow = page.getByRole('row').filter({ hasText: updatedImageAltText.en }).first()
        await expect(imageRecordRow).toBeVisible()
        await expect(imageRecordRow).toContainText('1440')
        await expect(imageRecordRow).toContainText('810')
        await expectNoTechnicalLeakage(imageRecordRow, {
            label: 'Saved Marketing Image record row',
            checkUuidSubstrings: true
        })
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(imageRecordRow).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Saved Marketing Image record table at ${viewport.name}`)
            await expectTableHorizontalScrollConstrained(
                page.getByRole('table').locator('..'),
                `Saved Marketing Image record table at ${viewport.name}`
            )
            await expectNoTechnicalLeakage(imageRecordRow, {
                label: `Saved Marketing Image record row at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            await page.screenshot({
                path: testInfo.outputPath(`marketing-image-record-row-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }
        await page.setViewportSize({ width: 1920, height: 1080 })
    })

    await runStep('Verify Russian localized image validation and discard behavior', async () => {
        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
        const russianImageSurface = page.getByTestId(`layout-widget-${imageWidgetId}`)
        await russianImageSurface.getByRole('button', { name: /Редактировать|Edit/u }).click()
        const russianImageBindingDialog = page.getByRole('dialog').filter({
            has: page.getByRole('combobox', { name: 'Запись содержимого', exact: true })
        })
        await expect(russianImageBindingDialog).toBeVisible()
        await russianImageBindingDialog.getByRole('button', { name: /Создать запись|Create content/u }).click()
        const russianImageRecordForm = page.getByRole('dialog', { name: /Создать запись|Create content record/u }).last()
        await expect(russianImageRecordForm).toBeVisible()
        await russianImageRecordForm.getByRole('textbox', { name: 'URL источника', exact: true }).fill(brandLogoUrl)
        await fillLocalizedFieldValues(page, russianImageRecordForm, 'Альтернативный текст', {
            en: 'Russian UI validation image',
            ru: 'Изображение проверки русской локали'
        })
        await russianImageRecordForm.getByRole('textbox', { name: 'Ширина отображения', exact: true }).fill('1200')
        await russianImageRecordForm.getByRole('textbox', { name: 'Высота отображения', exact: true }).fill('675')
        const russianImageCreatePath = new RegExp(
            `/api/v1/metahub/${metahubId}/entities/object/instance/(?:[^/]+/instance/)?${imageEntityId}/records$`,
            'u'
        )
        const omitEnglishAltTextForServerValidation = async (route: import('@playwright/test').Route) => {
            if (route.request().method() !== 'POST') {
                await route.continue()
                return
            }
            const requestBody = route.request().postDataJSON() as { data?: Record<string, unknown> }
            const altText = requestBody.data?.AltText
            const locales =
                altText && typeof altText === 'object' && !Array.isArray(altText) ? (altText as Record<string, unknown>).locales : null
            if (!locales || typeof locales !== 'object' || Array.isArray(locales) || !('en' in locales)) {
                throw new Error('The Russian browser flow did not submit the expected localized Image AltText shape')
            }
            delete (locales as Record<string, unknown>).en
            await route.continue({ postData: JSON.stringify(requestBody) })
        }
        await page.route(russianImageCreatePath, omitEnglishAltTextForServerValidation)
        const russianValidationResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'POST', russianImageCreatePath),
            { label: 'Validating required English Image AltText in the Russian authoring UI' }
        )
        await russianImageRecordForm.getByRole('button', { name: 'Сохранить', exact: true }).click()
        const russianValidationResponse = await russianValidationResponsePromise
        expect(russianValidationResponse.status()).toBe(400)
        expect(await russianValidationResponse.json()).toMatchObject({ code: 'VALIDATION_ERROR', fields: ['AltText.en.required'] })
        expectedValidationResourceUrls.push(russianValidationResponse.url())
        const englishAltRow = russianImageRecordForm.getByTestId('localized-inline-row-en')
        const englishAltInput = englishAltRow.getByRole('textbox', { name: 'Альтернативный текст', exact: true })
        const russianUiAltRow = russianImageRecordForm.getByTestId('localized-inline-row-ru')
        const russianUiAltInput = russianUiAltRow.getByRole('textbox', { name: 'Альтернативный текст', exact: true })
        await expect(englishAltInput).toHaveAttribute('aria-invalid', 'true')
        await expect(
            russianImageRecordForm.getByText('Заполните поле «Альтернативный текст» на языке «английский» перед сохранением.', {
                exact: true
            })
        ).toBeVisible()
        await expectNoTechnicalLeakage(russianImageRecordForm, {
            label: 'Russian Marketing Image localized server validation error',
            checkUuidSubstrings: true,
            checkInternalValidationText: true
        })
        await page.screenshot({
            path: testInfo.outputPath('marketing-image-alttext-ru-inline-server-error.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await page.unroute(russianImageCreatePath, omitEnglishAltTextForServerValidation)
        await russianImageRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
        const russianContentDiscardDialog = page.getByRole('dialog', { name: 'Отменить несохранённые изменения?', exact: true })
        await expect(russianContentDiscardDialog).toBeVisible()
        await expectNoTechnicalLeakage(russianContentDiscardDialog, {
            label: 'Russian Marketing Image discard confirmation',
            checkUuidSubstrings: true
        })
        await russianContentDiscardDialog.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
        await expect(russianImageRecordForm).toBeVisible()
        await expect(englishAltInput).toHaveValue('Russian UI validation image')
        await expect(russianUiAltInput).toHaveValue('Изображение проверки русской локали')
        await russianImageRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(russianContentDiscardDialog).toBeVisible()
        await expectNoTechnicalLeakage(russianContentDiscardDialog, {
            label: 'Russian Marketing Image discard confirmation',
            checkUuidSubstrings: true
        })
        await russianContentDiscardDialog.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
        await expect(russianImageRecordForm).toHaveCount(0)
        await russianImageBindingDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await applyBrowserPreferences(page, { language: 'en' })
    })

    await runStep('Verify optional Brand logo clearing and restoration', async () => {
        await page.goto(`/metahub/${metahubId}/entities/object/instances`)
        await ensureListView(page, true)
        const siteSettingsLink = page.getByRole('link', { name: 'Marketing site settings', exact: true })
        await expect(siteSettingsLink).toBeVisible()
        await siteSettingsLink.click()
        await page.getByRole('tab', { name: 'Records', exact: true }).click()
        const siteSettingsRecordsBeforeEdit = (await listRecords(api, metahubId, siteSettingsEntityId, {
            limit: 100,
            offset: 0
        })) as { items?: Array<{ id?: string; data?: Record<string, unknown> }> }
        const siteSettingsRecordToEdit = siteSettingsRecordsBeforeEdit.items?.find(
            (record) => readLocalizedText(record.data?.BrandName, 'en') === 'Material UI'
        )
        if (!siteSettingsRecordToEdit?.id)
            throw new Error('The Marketing site settings record could not be identified for ResourceSource editing')
        const siteSettingsUpdatePath = new RegExp(
            `/api/v1/metahub/${metahubId}/entities/object/instance/(?:[^/]+/instance/)?${siteSettingsEntityId}/record/${siteSettingsRecordToEdit.id}$`,
            'u'
        )
        const siteSettingsRecord = page.getByRole('row').filter({ hasText: 'Material UI' }).first()
        await expect(siteSettingsRecord).toBeVisible()
        await siteSettingsRecord.getByRole('button', { name: 'Options', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        const siteSettingsForm = page.getByRole('dialog', { name: /Edit (Element|Record)/u })
        await expect(siteSettingsForm).toBeVisible()
        await expectNoTechnicalLeakage(siteSettingsForm, { label: 'Marketing site settings form', checkUuidSubstrings: true })
        const optionalBrandLogo = siteSettingsForm.getByRole('textbox', { name: 'Source URL', exact: true })
        await expect(siteSettingsForm.getByRole('combobox', { name: 'Resource type', exact: true })).toBeVisible()
        await expect(optionalBrandLogo).toHaveValue(brandLogoUrl)
        await optionalBrandLogo.fill('')
        await expect(optionalBrandLogo).toHaveValue('')
        await expect(optionalBrandLogo).not.toHaveAttribute('aria-invalid', 'true')
        await expect(siteSettingsForm.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
        await expectNoTechnicalLeakage(siteSettingsForm, { label: 'Optional empty Brand logo field', checkUuidSubstrings: true })
        await page.screenshot({
            path: testInfo.outputPath('marketing-optional-brand-logo-empty.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const clearBrandLogoResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', siteSettingsUpdatePath),
            { label: 'Clearing the optional Brand logo ResourceSource' }
        )
        await siteSettingsForm.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await clearBrandLogoResponsePromise).ok()).toBe(true)
        await expect(siteSettingsForm).toHaveCount(0)

        const savedSiteSettings = (await listRecords(api, metahubId, siteSettingsEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ data?: Record<string, unknown> }>
        }
        const materialUiSettings = savedSiteSettings.items?.find(
            (record) => readLocalizedText(record.data?.BrandName, 'en') === 'Material UI'
        )
        expect(materialUiSettings?.data?.BrandLogo).toBeNull()

        await siteSettingsRecord.getByRole('button', { name: 'Options', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        const reopenedSiteSettingsForm = page.getByRole('dialog', { name: /Edit (Element|Record)/u })
        await expect(reopenedSiteSettingsForm).toBeVisible()
        await expect(reopenedSiteSettingsForm.getByRole('textbox', { name: 'Source URL', exact: true })).toHaveValue('')
        await expectNoTechnicalLeakage(reopenedSiteSettingsForm, {
            label: 'Reopened empty optional Brand logo field',
            checkUuidSubstrings: true
        })
        await reopenedSiteSettingsForm.getByRole('textbox', { name: 'Source URL', exact: true }).fill(brandLogoUrl)
        const restoreBrandLogoResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => responseIsMutation(response, 'PATCH', siteSettingsUpdatePath),
            { label: 'Restoring the optional Brand logo ResourceSource before runtime publication' }
        )
        await reopenedSiteSettingsForm.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await restoreBrandLogoResponsePromise).ok()).toBe(true)
        await expect(reopenedSiteSettingsForm).toHaveCount(0)

        const restoredSiteSettings = (await listRecords(api, metahubId, siteSettingsEntityId, { limit: 100, offset: 0 })) as {
            items?: Array<{ data?: Record<string, unknown> }>
        }
        const restoredMaterialUiSettings = restoredSiteSettings.items?.find(
            (record) => readLocalizedText(record.data?.BrandName, 'en') === 'Material UI'
        )
        expect(restoredMaterialUiSettings?.data?.BrandLogo).toMatchObject({ type: 'url', url: brandLogoUrl })
    })

    return {
        expectedValidationResourceUrls: [...new Set(expectedValidationResourceUrls)],
        imageAltText: updatedImageAltText
    }
}
