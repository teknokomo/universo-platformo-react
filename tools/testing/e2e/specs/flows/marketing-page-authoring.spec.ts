import AxeBuilder from '@axe-core/playwright'
import type { Locator } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    getApplication,
    getLayout,
    listLayoutZoneWidgets,
    listMetahubMembers,
    listRecords,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectLocatorFullyFitsViewport,
    expectLocatorFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectLocalizedValidation,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls,
    expectTableHorizontalScrollConstrained,
    watchBrowserRuntimeIssues
} from '../../support/browser/runtimeUx'
import { entityDialogSelectors } from '../../support/selectors/contracts'
import { parseJsonResponse, readLocalizedText } from './entity-runtime-helpers'
import {
    buildExecutionRunId,
    ensureListView,
    expectStandardDialogActionFooter,
    fillLocalizedField,
    fillLocalizedFieldValues,
    openCreateDialog,
    readLayoutWidgetConfig,
    responseIsMutation,
    selectMarketingTemplate,
    type LayoutWidgetsResponse
} from '../../support/marketingPageAuthoringHelpers'
import { prepareMarketingMetahubLayoutAuthoring } from '../../support/marketingPageAuthoring/prepareMetahubLayoutAuthoring'
import { copyEntityBackedMarketingLayouts } from '../../support/marketingPageAuthoring/copyEntityBackedMarketingLayouts'
import { verifyMarketingLayoutAuthoringViews } from '../../support/marketingPageAuthoring/verifyMarketingLayoutAuthoringViews'
import { publishMarketingHeroApplication } from '../../support/marketingPageAuthoring/publishMarketingHeroApplication'
import { removeHeroPlacementAndDeleteEntityRecord } from '../../support/marketingPageAuthoring/removeHeroPlacementAndDeleteEntityRecord'
import { verifyMarketingApplicationAuthoring } from '../../support/marketingPageAuthoring/verifyMarketingApplicationAuthoring'
import { verifyPublishedMarketingHeroJourney } from '../../support/marketingPageAuthoring/verifyPublishedMarketingHeroJourney'

type EntityResponse = {
    id?: string
    data?: {
        id?: string
    }
}

type RecordResponse = {
    id?: string
    data?: Record<string, unknown>
}

const unwrapEntity = <T extends EntityResponse>(payload: T): { id?: string } => payload.data ?? payload

const expectMultilineEditorGeometry = async (field: Locator, label: string): Promise<void> => {
    const geometry = await field.evaluate((element) => {
        const style = window.getComputedStyle(element)
        const cssPixels = (value: string): number => Number.parseFloat(value) || 0
        const fontSize = cssPixels(style.fontSize) || 16
        const declaredLineHeight = Number.parseFloat(style.lineHeight)
        const lineHeight = style.lineHeight.endsWith('px')
            ? declaredLineHeight
            : Number.isFinite(declaredLineHeight)
            ? declaredLineHeight * fontSize
            : fontSize * 1.2
        const minimumTwoRowHeight =
            lineHeight * 2 +
            cssPixels(style.paddingTop) +
            cssPixels(style.paddingBottom) +
            cssPixels(style.borderTopWidth) +
            cssPixels(style.borderBottomWidth)

        return {
            rows: Number(element.getAttribute('rows')),
            height: element.getBoundingClientRect().height,
            minimumTwoRowHeight
        }
    })

    expect(geometry.rows, `${label} must expose at least two editable rows`).toBeGreaterThanOrEqual(2)
    expect(geometry.height, `${label} must render enough height for two text rows`).toBeGreaterThanOrEqual(geometry.minimumTwoRowHeight - 1)
}

test('@flow @combined @marketing-page browser authoring publishes edited content into the runtime', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(420_000)
    const browserIssues = watchBrowserRuntimeIssues(page)

    const executionRunId = buildExecutionRunId(runManifest.runId, testInfo)
    const metahubName = `E2E ${executionRunId} marketing authoring`
    const metahubCodename = `${executionRunId}-marketing-authoring`
    const publicationName = `E2E ${executionRunId} Marketing Publication`
    const updatedHeroTitle = 'Build a clear product story for every customer who visits your new website'
    const updatedHeroAccent = 'and help each team take the next confident step'
    const updatedHeroTitleRu = 'Создайте понятную историю продукта для каждого посетителя нового сайта'
    const updatedHeroAccentRu = 'и помогите каждой команде уверенно сделать следующий шаг'
    const brandLogoUrl = 'https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg'
    let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | null = null
    let noEditContentBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let noEditContentApi: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
    let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const marketingMetahub = await test.step('Create the marketing metahub and prepare its layout', async () => {
            await applyBrowserPreferences(page, { language: 'en' })

            // Create the metahub through the real template picker. The API is used only
            // to observe the settled response and to register deterministic cleanup.
            await page.goto('/metahubs')
            const metahubDialog = await openCreateDialog(page, 'Create Metahub')
            await expectNoTechnicalLeakage(metahubDialog, {
                label: 'Marketing metahub create dialog',
                checkUuidSubstrings: true
            })
            await fillLocalizedField(metahubDialog, 'Name', metahubName)
            await fillLocalizedField(metahubDialog, 'Codename', metahubCodename)
            await selectMarketingTemplate(page, metahubDialog)

            const metahubResponsePromise = waitForSettledMutationResponse(
                page,
                (response) => responseIsMutation(response, 'POST', /\/api\/v1\/metahubs$/),
                { label: 'Creating a marketing-page metahub through the browser picker', timeout: 90_000 }
            )
            await metahubDialog.getByTestId(entityDialogSelectors.submitButton).click()
            const metahubPayload = await parseJsonResponse<EntityResponse>(
                await metahubResponsePromise,
                'Creating a marketing-page metahub through the browser picker'
            )
            const metahub = unwrapEntity(metahubPayload)
            if (!metahub.id) {
                throw new Error('The browser-created marketing-page metahub did not return an id')
            }
            await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

            const { marketingLayoutId, entityResponse } = await prepareMarketingMetahubLayoutAuthoring({
                api,
                page,
                metahubId: metahub.id,
                executionRunId,
                testInfo
            })
            return { metahub, marketingLayoutId, entityResponse }
        })
        const { metahub, marketingLayoutId, entityResponse } = marketingMetahub

        const heroAuthoring = await test.step('Author Hero Entity records and verify binding lifecycle', async () => {
            await test.step('Edit the seeded Hero record in the generic Entity records UI', async () => {
                // Edit the dedicated Hero Entity record through the generic
                // object/record authoring surface. Hero copy no longer lives in
                // MarketingPageSiteSettings.
                await page.goto(`/metahub/${metahub.id}/entities/object/instances`)
                await expect(page.getByRole('heading', { name: 'Objects', exact: true })).toBeVisible()
                await ensureListView(page)
                const heroEntityLink = page.getByRole('link', { name: 'Marketing hero', exact: true })
                await expect(heroEntityLink).toBeVisible()
                await heroEntityLink.click()
                await expect(page).toHaveURL(/\/components$/)
                await page.getByRole('tab', { name: 'Records', exact: true }).click()
                await expect(page).toHaveURL(/\/records$/)
                await expect(page.getByRole('heading', { name: 'Records', exact: true })).toBeVisible()

                const heroRecordRow = page.getByRole('row').filter({ hasText: 'Our latest' }).first()
                await expect(heroRecordRow).toBeVisible()
                await heroRecordRow.getByRole('button', { name: 'Options', exact: true }).click()
                await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()

                const recordDialog = page.getByRole('dialog', { name: /Edit (Element|Record)/ })
                await expect(recordDialog).toBeVisible()
                await expect(recordDialog.getByRole('combobox', { name: 'Action type', exact: true })).toHaveCount(2)
                await expect(recordDialog.getByRole('combobox', { name: 'Application page', exact: true })).toHaveCount(2)
                await expectNoTechnicalLeakage(recordDialog, {
                    label: 'Marketing Hero record dialog',
                    checkUuidSubstrings: true,
                    forbiddenVisibleTextPatterns: [/^\s*(?:Published(?: at| by)?|Archived(?: at| by)?|Deleted(?: at| by)?)\s*$/imu]
                })
                await expectSemanticFieldControls(recordDialog, { longTextLabels: ['Description'] })
                await fillLocalizedFieldValues(page, recordDialog, 'Title', { en: updatedHeroTitle, ru: updatedHeroTitleRu })
                await fillLocalizedFieldValues(page, recordDialog, 'Accent', { en: updatedHeroAccent, ru: updatedHeroAccentRu })

                const recordUpdatePromise = waitForSettledMutationResponse(
                    page,
                    (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
                    { label: 'Updating the Marketing Hero Entity record through the generic record dialog', timeout: 90_000 }
                )
                await recordDialog.getByRole('button', { name: 'Save', exact: true }).click()
                const recordUpdateResponse = await recordUpdatePromise
                expect(recordUpdateResponse.ok()).toBe(true)
                await expect(recordDialog).toHaveCount(0)
                const updatedHeroRecordRow = page.getByRole('row').filter({ hasText: updatedHeroTitle }).first()
                await expect(updatedHeroRecordRow).toBeVisible()
                const heroRecordTable = page.getByRole('table').filter({ has: updatedHeroRecordRow }).first()
                await expect(heroRecordTable, 'The Hero Entity records list must expose its semantic table').toBeVisible()
                await expectNoTechnicalLeakage(heroRecordTable, {
                    label: 'Marketing Hero Entity records table',
                    checkUuidSubstrings: true
                })
                await expectRuntimeUxViewportMatrix(page, 'Marketing Hero Entity records table', {
                    beforeEachViewport: async (viewport) => {
                        await expect(updatedHeroRecordRow).toBeVisible()
                        await expectTableHorizontalScrollConstrained(
                            heroRecordTable.locator('xpath=..'),
                            `Marketing Hero Entity records table at ${viewport.name}`
                        )
                        await expectNoTechnicalLeakage(heroRecordTable, {
                            label: `Marketing Hero Entity records table at ${viewport.name}`,
                            checkUuidSubstrings: true
                        })
                        await page.screenshot({
                            path: testInfo.outputPath(`marketing-hero-records-${viewport.name}.png`),
                            fullPage: true,
                            animations: 'disabled'
                        })
                    }
                })
            })

            // Add a second Entity-owned Hero record through the same UI users use,
            // then bind a repeated widget placement to it. Both long records are
            // observed in one published runtime to prove independent resolution.
            const heroEntity = (entityResponse?.items ?? []).find(
                (entity: { id?: string; codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageHero'
            )
            if (typeof heroEntity?.id !== 'string') throw new Error('The marketing authoring fixture did not expose the Hero Entity')
            const independentHeroTitle = 'Give your growing team a faster way to work with the tools they already trust'
            const independentHeroAccent = 'without adding more complexity to every day'
            const independentHeroTitleRu = 'Помогите команде быстрее работать с привычными надёжными инструментами'
            const independentHeroAccentRu = 'без лишней сложности в повседневных задачах'

            const sourceWidgets = (await listLayoutZoneWidgets(api, metahub.id, marketingLayoutId)) as LayoutWidgetsResponse
            const sourceHeroWidget = sourceWidgets.items?.find((widget) => readLayoutWidgetConfig(widget).instanceKey === 'hero')
            if (!sourceHeroWidget?.id) throw new Error('The marketing layout did not expose its seeded Hero placement')

            await test.step('Set the seeded Hero action target before publication', async () => {
                // Give the seeded Hero a real section action before publication so
                // the application authoring flow can prove it refuses to hide the
                // last section that the published action targets.
                await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
                const seededHeroSurface = page.getByTestId(`layout-widget-${sourceHeroWidget.id}`)
                const seededHeroEditAction = seededHeroSurface.getByRole('button', { name: 'Edit', exact: true })
                await seededHeroEditAction.click()
                const seededHeroRecordForm = page.getByRole('dialog', { name: /Edit Hero content/ })
                await expect(seededHeroRecordForm).toBeVisible()
                await expect(page.getByRole('dialog', { name: 'Hero content', exact: true })).toHaveCount(0)
                const seededHeroDialogAccessibility = await new AxeBuilder({ page })
                    .include('[role="dialog"]')
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                    .analyze()
                expect(seededHeroDialogAccessibility.violations, JSON.stringify(seededHeroDialogAccessibility.violations)).toEqual([])
                const seededHeroActionKind = seededHeroRecordForm.getByRole('combobox', { name: 'Action type', exact: true }).first()
                await seededHeroActionKind.click()
                await page.getByRole('option', { name: 'Page section', exact: true }).click()
                const seededHeroActionTarget = seededHeroRecordForm.getByRole('combobox', { name: 'Page section', exact: true }).first()
                await seededHeroActionTarget.click()
                await page.getByRole('option', { name: 'Features', exact: true }).click()
                const seededHeroActionSavePromise = waitForSettledMutationResponse(
                    page,
                    (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
                    { label: 'Binding the seeded Hero action to the active Features section', timeout: 90_000 }
                )
                await seededHeroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
                expect((await seededHeroActionSavePromise).ok()).toBe(true)
                await expect(seededHeroRecordForm).toHaveCount(0)
                const seededHeroBindingDialog = page.getByRole('dialog', { name: 'Hero content', exact: true })
                await expect(seededHeroBindingDialog).toBeVisible()
                await expect.poll(() => seededHeroBindingDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
                await seededHeroBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
                await expect(seededHeroBindingDialog).toHaveCount(0)
                await expect(seededHeroEditAction).toBeFocused()
            })

            await test.step('Edit the existing Hero with the keyboard and verify validation, save, cancel, and focus', async () => {
                await applyBrowserPreferences(page, { language: 'en' })
                await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)

                const tabTo = async (target: Locator, label: string): Promise<void> => {
                    await expect(target, `${label} must be visible for keyboard navigation`).toBeVisible()
                    for (let pressCount = 0; pressCount < 200; pressCount += 1) {
                        if (await target.evaluate((element) => element === document.activeElement)) return
                        await page.keyboard.press('Tab')
                    }
                    throw new Error(`Keyboard navigation did not reach ${label}`)
                }

                const heroSurface = page.getByTestId(`layout-widget-${sourceHeroWidget.id}`)
                const openHeroEditor = heroSurface.getByRole('button', { name: 'Edit', exact: true })
                await tabTo(openHeroEditor, 'the existing Hero edit action')
                await page.keyboard.press('Enter')

                const recordForm = page.getByRole('dialog', { name: /Edit Hero content/ })
                await expect(recordForm).toBeVisible()
                await expect(page.getByRole('dialog', { name: 'Hero content', exact: true })).toHaveCount(0)
                await expect.poll(() => recordForm.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)

                const englishTitle = recordForm.getByTestId('localized-inline-row-en').getByRole('textbox', { name: 'Title', exact: true })
                const russianTitle = recordForm.getByTestId('localized-inline-row-ru').getByRole('textbox', { name: 'Title', exact: true })
                await tabTo(englishTitle, 'the English Hero title')
                await page.keyboard.press('Control+A')
                await page.keyboard.press('Backspace')
                await expect(englishTitle).toHaveValue('')

                await tabTo(recordForm.getByRole('button', { name: 'Save', exact: true }), 'the Hero form Save action')
                await page.keyboard.press('Enter')
                await expect(englishTitle).toHaveAttribute('aria-invalid', 'true')
                await expect(englishTitle).toBeFocused()
                await expect(recordForm.getByText('Add Title in English before saving.', { exact: true })).toBeVisible()
                await expectLocalizedValidation(recordForm, 'en', { label: 'Keyboard Hero title validation' })

                // Correct the invalid English value, then switch to the Russian
                // row in the same unsaved form and confirm both locale drafts survive.
                await page.keyboard.press('Control+A')
                await page.keyboard.type(updatedHeroTitle)
                await tabTo(russianTitle, 'the Russian Hero title')
                await page.keyboard.press('Control+A')
                await page.keyboard.type(updatedHeroTitleRu)
                await expect(englishTitle).toHaveValue(updatedHeroTitle)
                await expect(russianTitle).toHaveValue(updatedHeroTitleRu)

                const saveResponsePromise = waitForSettledMutationResponse(
                    page,
                    (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
                    { label: 'Saving the existing Hero record through keyboard navigation', timeout: 90_000 }
                )
                await tabTo(recordForm.getByRole('button', { name: 'Save', exact: true }), 'the Hero form Save action')
                await page.keyboard.press('Enter')
                expect((await saveResponsePromise).ok()).toBe(true)
                await expect(recordForm).toHaveCount(0)
                const bindingDialog = page.getByRole('dialog', { name: 'Hero content', exact: true })
                await expect(bindingDialog).toBeVisible()
                await expect.poll(() => bindingDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
                await expect(bindingDialog.getByRole('combobox', { name: 'Hero content record', exact: true })).toHaveValue(
                    updatedHeroTitle
                )
                await tabTo(bindingDialog.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero binding Cancel action')
                await page.keyboard.press('Enter')
                await expect(bindingDialog).toHaveCount(0)
                await expect(openHeroEditor).toBeFocused()

                await tabTo(openHeroEditor, 'the existing Hero edit action')
                await page.keyboard.press('Enter')
                await expect(recordForm).toBeVisible()
                await expect(englishTitle).toHaveValue(updatedHeroTitle)
                await expect(russianTitle).toHaveValue(updatedHeroTitleRu)

                await tabTo(englishTitle, 'the English Hero title before cancelling')
                await page.keyboard.press('Control+A')
                await page.keyboard.type('This unsaved Hero title must be discarded')
                await tabTo(recordForm.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero form Cancel action')
                await page.keyboard.press('Enter')
                await expect(recordForm).toHaveCount(0)
                await expect(bindingDialog).toHaveCount(0)
                await expect(openHeroEditor).toBeFocused()

                await page.keyboard.press('Enter')
                await expect(recordForm).toBeVisible()
                await expect(englishTitle).toHaveValue(updatedHeroTitle)
                await expect(russianTitle).toHaveValue(updatedHeroTitleRu)
                await tabTo(recordForm.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero form Cancel action')
                await page.keyboard.press('Enter')
                await expect(recordForm).toHaveCount(0)
                await expect(openHeroEditor).toBeFocused()
            })

            await test.step('Check required English Hero content in the Russian authoring form', async () => {
                // Validate the localized record form through the Russian authoring UI.
                // Required Russian values satisfy the generic form, while the Hero
                // contract correctly rejects the missing English copy with a localized
                // message before any request can be made.
                await applyBrowserPreferences(page, { language: 'ru' })
                await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
                const russianHeroSurface = page.getByTestId(`layout-widget-${sourceHeroWidget.id}`)
                const russianDuplicateHeroButton = russianHeroSurface.getByRole('button', { name: /^Дублировать виджет:/ })
                await russianDuplicateHeroButton.click()
                const russianHeroBindingDialog = page.getByRole('dialog', { name: 'Содержимое первого экрана', exact: true })
                await expect(russianHeroBindingDialog).toBeVisible()
                await expectStandardDialogActionFooter(russianHeroBindingDialog, 'Russian Hero content dialog')
                await expectNoTechnicalLeakage(russianHeroBindingDialog, {
                    label: 'Russian Hero content dialog',
                    checkUuidSubstrings: true
                })
                await expect.poll(() => russianHeroBindingDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
                await russianHeroBindingDialog.getByRole('button', { name: 'Создать запись содержимого', exact: true }).click()
                const russianHeroRecordForm = page.getByRole('dialog', { name: /^Создать содержимое первого экрана/ })
                await expect(russianHeroRecordForm).toBeVisible()
                await expectSemanticFieldControls(russianHeroRecordForm, { longTextLabels: ['Описание'] })
                await russianHeroRecordForm.getByRole('textbox', { name: 'Заголовок', exact: true }).fill('Новая запись')
                await russianHeroRecordForm.getByRole('textbox', { name: 'Описание', exact: true }).fill('Описание записи')
                await russianHeroRecordForm.getByRole('textbox', { name: 'Подпись email', exact: true }).fill('Электронная почта')
                await russianHeroRecordForm.getByRole('textbox', { name: 'Подсказка email', exact: true }).fill('Введите адрес')
                await russianHeroRecordForm.getByRole('textbox', { name: 'Подпись основной кнопки', exact: true }).fill('Начать')
                await russianHeroRecordForm.getByRole('button', { name: 'Сохранить', exact: true }).click()
                const missingEnglishTitleRow = russianHeroRecordForm.getByTestId('localized-inline-row-en')
                const missingEnglishTitle = missingEnglishTitleRow.getByRole('textbox', { name: 'Заголовок', exact: true })
                await expect(missingEnglishTitle).toHaveAttribute('aria-invalid', 'true')
                await expect(missingEnglishTitle).toBeFocused()
                const titleErrorDescriptionId = await missingEnglishTitle.getAttribute('aria-describedby')
                expect(titleErrorDescriptionId).toBeTruthy()
                const titleErrorMessage = russianHeroRecordForm.getByText(
                    'Заполните поле «Заголовок» на языке «английский» перед сохранением.',
                    {
                        exact: true
                    }
                )
                await expect(titleErrorMessage).toBeVisible()
                const helperTextId = await titleErrorMessage.getAttribute('id')
                expect(titleErrorDescriptionId?.split(/\s+/)).toContain(helperTextId)
                await expect(russianHeroRecordForm.getByRole('alert')).toHaveCount(0)
                await expectLocalizedValidation(russianHeroRecordForm, 'ru', { label: 'Russian Hero record validation' })
                await expectNoTechnicalLeakage(russianHeroRecordForm, {
                    label: 'Russian Hero record validation form',
                    checkUuidSubstrings: true
                })
                await russianHeroRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
                await expect(russianHeroRecordForm).toHaveCount(0)
                await page.keyboard.press('Escape')
                await expect(russianHeroBindingDialog).toBeVisible()
                await russianHeroBindingDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
                await expect(russianHeroBindingDialog).toHaveCount(0)
                await expect(russianDuplicateHeroButton).toBeFocused()
            })

            const independentHeroAuthoring = await test.step('Create and bind a second localized Hero record', async () => {
                await applyBrowserPreferences(page, { language: 'en' })
                await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
                const sourceHeroSurface = page.getByTestId(`layout-widget-${sourceHeroWidget.id}`)
                await sourceHeroSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
                const heroBindingDialog = page.getByRole('dialog', { name: 'Hero content', exact: true })
                await expect(heroBindingDialog).toBeVisible()
                await expectNoTechnicalLeakage(heroBindingDialog, {
                    label: 'English Hero content dialog',
                    checkUuidSubstrings: true
                })
                for (const viewport of [
                    { name: 'desktop-1920', width: 1920, height: 1080 },
                    { name: 'tablet-768', width: 768, height: 1024 },
                    { name: 'mobile-390', width: 390, height: 844 }
                ]) {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height })
                    await expectLocatorFullyFitsViewport(heroBindingDialog, `Marketing Hero binding dialog at ${viewport.name}`)
                    await expectStandardDialogActionFooter(heroBindingDialog, `Marketing Hero binding dialog at ${viewport.name}`)
                    await expectNoPageHorizontalOverflow(page, `Marketing Hero binding dialog at ${viewport.name}`)
                    await page.screenshot({
                        path: testInfo.outputPath(`marketing-hero-binding-dialog-${viewport.name}.png`),
                        fullPage: true,
                        animations: 'disabled'
                    })
                }
                await page.setViewportSize({ width: 390, height: 844 })
                await heroBindingDialog.getByRole('button', { name: 'Create content record', exact: true }).click()
                const heroRecordForm = page.getByRole('dialog', { name: /Create Hero content/ })
                await expect(heroRecordForm).toBeVisible()
                const heroRecordFormAccessibility = await new AxeBuilder({ page })
                    .include('[role="dialog"]')
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                    .analyze()
                expect(heroRecordFormAccessibility.violations, JSON.stringify(heroRecordFormAccessibility.violations)).toEqual([])
                await expectSemanticFieldControls(heroRecordForm, { longTextLabels: ['Description'] })
                for (const viewport of [
                    { name: 'wide-desktop', width: 1920, height: 1080 },
                    { name: 'desktop', width: 1440, height: 1000 },
                    { name: 'tablet', width: 768, height: 1024 },
                    { name: 'mobile', width: 390, height: 844 }
                ]) {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height })
                    await expectLocatorFitsViewport(heroRecordForm, `Marketing Hero record form at ${viewport.name}`)
                    await expectNoPageHorizontalOverflow(page, `Marketing Hero record form at ${viewport.name}`)
                    await page.screenshot({ path: testInfo.outputPath(`marketing-hero-record-form-${viewport.name}.png`), fullPage: true })
                }
                await expectSemanticFieldControls(heroRecordForm, { longTextLabels: ['Description'] })
                await expectNoTechnicalLeakage(heroRecordForm, {
                    label: 'Marketing Hero record creation form',
                    checkUuidSubstrings: true,
                    forbiddenVisibleTextPatterns: [/^\s*(?:Published(?: at| by)?|Archived(?: at| by)?|Deleted(?: at| by)?)\s*$/imu]
                })
                const englishTitleRow = heroRecordForm.getByTestId('localized-inline-row-en')
                const englishTitle = englishTitleRow.getByRole('textbox', { name: 'Title', exact: true })
                await englishTitle.fill(independentHeroTitle)
                await englishTitleRow.getByRole('button', { name: 'EN', exact: true }).click()
                await page.getByRole('menuitem', { name: 'Add language', exact: true }).click()
                await page.getByRole('menuitem', { name: 'Русский', exact: true }).click()
                const russianTitle = heroRecordForm
                    .getByTestId('localized-inline-row-ru')
                    .getByRole('textbox', { name: 'Title', exact: true })
                await expect(englishTitle).toHaveValue(independentHeroTitle)
                await russianTitle.fill(independentHeroTitleRu)
                await expect(englishTitle).toHaveValue(independentHeroTitle)
                await expect(russianTitle).toHaveValue(independentHeroTitleRu)
                await fillLocalizedFieldValues(page, heroRecordForm, 'Accent', {
                    en: independentHeroAccent,
                    ru: independentHeroAccentRu
                })
                await fillLocalizedFieldValues(page, heroRecordForm, 'Description', {
                    en: 'A second independently authored Hero story.',
                    ru: 'Вторая независимо созданная история главного экрана.'
                })
                await fillLocalizedFieldValues(page, heroRecordForm, 'Email label', {
                    en: 'Work email',
                    ru: 'Рабочая почта'
                })
                await fillLocalizedFieldValues(page, heroRecordForm, 'Email placeholder', {
                    en: 'name@example.com',
                    ru: 'name@example.com'
                })
                await fillLocalizedFieldValues(page, heroRecordForm, 'Primary action label', {
                    en: 'Explore the platform',
                    ru: 'Изучить платформу'
                })
                const mobileDescriptionInput = heroRecordForm
                    .getByTestId('localized-inline-row-en')
                    .getByRole('textbox', { name: 'Description', exact: true })
                await mobileDescriptionInput.scrollIntoViewIfNeeded()
                await expectLocatorFullyFitsViewport(mobileDescriptionInput, 'Marketing Hero long description field at mobile width')
                await expect(mobileDescriptionInput).toHaveAttribute('rows')
                await expectMultilineEditorGeometry(mobileDescriptionInput, 'English Hero Description editor at mobile width')
                const mobileDescriptionInputRu = heroRecordForm
                    .getByTestId('localized-inline-row-ru')
                    .getByRole('textbox', { name: 'Description', exact: true })
                await mobileDescriptionInputRu.scrollIntoViewIfNeeded()
                await expectLocatorFullyFitsViewport(
                    mobileDescriptionInputRu,
                    'Russian Marketing Hero long description field at mobile width'
                )
                await expect(mobileDescriptionInputRu).toHaveAttribute('rows')
                await expectMultilineEditorGeometry(mobileDescriptionInputRu, 'Russian Hero Description editor at mobile width')
                const primaryActionKind = heroRecordForm.getByRole('combobox', { name: 'Action type', exact: true }).first()
                await expect(primaryActionKind).toBeVisible()
                await primaryActionKind.focus()
                await page.keyboard.press('Enter')
                await page.getByRole('option', { name: 'Page section', exact: true }).click()
                const primaryActionTarget = heroRecordForm.getByRole('combobox', { name: 'Page section', exact: true }).first()
                await expect(primaryActionTarget).toBeVisible()
                await primaryActionTarget.focus()
                await page.keyboard.press('Enter')
                await expect(page.getByRole('option', { name: 'Features', exact: true })).toBeVisible()
                await page.getByRole('option', { name: 'Features', exact: true }).click()
                await expect(primaryActionTarget).toHaveText('Features')
                const mobileSaveButton = heroRecordForm.getByRole('button', { name: 'Save', exact: true })
                await mobileSaveButton.scrollIntoViewIfNeeded()
                await expectLocatorFullyFitsViewport(mobileSaveButton, 'Marketing Hero save action at mobile width')
                await expectStandardDialogActionFooter(heroRecordForm, 'Marketing Hero record form at mobile width')
                await expectNoPageHorizontalOverflow(page, 'Completed Marketing Hero record form at mobile width')
                await page.screenshot({
                    path: testInfo.outputPath('marketing-hero-record-form-mobile-ready-to-save.png'),
                    fullPage: true,
                    animations: 'disabled'
                })

                const heroCreateResponsePromise = waitForSettledMutationResponse(
                    page,
                    (response) => responseIsMutation(response, 'POST', /\/entities\/object\/instance\/[^/]+\/instance\/[^/]+\/records$/),
                    { label: 'Creating a second Hero Entity record through the Hero authoring form', timeout: 90_000 }
                )
                await heroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
                const heroCreateResponse = await heroCreateResponsePromise
                expect(
                    heroCreateResponse.ok(),
                    `Hero Entity creation failed with ${heroCreateResponse.status()}: ${await heroCreateResponse.text()}`
                ).toBe(true)
                const createdHeroRecord = await parseJsonResponse<RecordResponse>(
                    heroCreateResponse,
                    'Creating the second Hero Entity record'
                )
                if (typeof createdHeroRecord.id !== 'string') {
                    throw new Error('The Hero authoring form did not return the created Entity record id')
                }
                await expect(heroRecordForm).toHaveCount(0)
                await page.setViewportSize({ width: 1440, height: 1000 })

                const createdHeroRecords = (await listRecords(api, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
                    items?: Array<{ id?: string; data?: Record<string, unknown> }>
                }
                const createdIndependentHero = createdHeroRecords.items?.find((record) => record.id === createdHeroRecord.id)
                expect(createdIndependentHero?.data?.HeroKey).toEqual(expect.any(String))
                expect(createdIndependentHero?.data?.HeroKey).not.toBe('default')

                await heroBindingDialog.getByRole('button', { name: 'Edit selected content', exact: true }).click()
                const persistedHeroRecordForm = page.getByRole('dialog', { name: /Edit Hero content/ })
                await expect(persistedHeroRecordForm).toBeVisible()
                await expect(
                    persistedHeroRecordForm.getByTestId('localized-inline-row-en').getByRole('textbox', { name: 'Title', exact: true })
                ).toHaveValue(independentHeroTitle)
                await expect(
                    persistedHeroRecordForm.getByTestId('localized-inline-row-ru').getByRole('textbox', { name: 'Title', exact: true })
                ).toHaveValue(independentHeroTitleRu)
                await persistedHeroRecordForm.getByRole('button', { name: 'Cancel', exact: true }).click()
                await expect(persistedHeroRecordForm).toHaveCount(0)

                const heroRecordSelect = heroBindingDialog.getByRole('combobox', { name: 'Hero content record', exact: true })
                await expect(heroRecordSelect).toHaveValue(independentHeroTitle)
                await heroBindingDialog.getByRole('button', { name: 'Configure presentation and add Hero', exact: true }).click()

                const heroPresentationDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
                await expect(heroPresentationDialog).toBeVisible()
                await expectNoTechnicalLeakage(heroPresentationDialog, {
                    label: 'Hero presentation dialog',
                    checkUuidSubstrings: true
                })
                const duplicateHeroResponsePromise = waitForSettledMutationResponse(
                    page,
                    (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
                    { label: 'Adding an independent Hero Entity binding before publication', timeout: 90_000 }
                )
                await heroPresentationDialog.getByRole('button', { name: 'Save', exact: true }).click()
                const duplicateHeroResponse = await duplicateHeroResponsePromise
                expect(duplicateHeroResponse.ok()).toBe(true)
                await expect(heroPresentationDialog).toHaveCount(0)

                const addedHeroWidgets = (await listLayoutZoneWidgets(api, metahub.id, marketingLayoutId)) as LayoutWidgetsResponse
                const addedHeroWidget = addedHeroWidgets.items?.find(
                    (widget) => widget.widgetKey === 'marketing.hero' && widget.id !== sourceHeroWidget.id
                )
                if (!addedHeroWidget?.id) throw new Error('The second Hero placement was not persisted')

                const sourceLayoutDetails = await getLayout(api, metahub.id, marketingLayoutId)
                const sourceLayoutName = readLocalizedText(sourceLayoutDetails.name, 'en')
                const sourceHeroWidgetIds = (addedHeroWidgets.items ?? [])
                    .filter((widget) => widget.widgetKey === 'marketing.hero')
                    .map((widget) => String(widget.id))
                return {
                    createdHeroRecord,
                    addedHeroWidget,
                    sourceHeroWidgetIds,
                    sourceLayoutName,
                    sourceHeroWidgetId: String(sourceHeroWidget.id)
                }
            })
            const { createdHeroRecord, addedHeroWidget, sourceHeroWidgetIds, sourceLayoutName } = independentHeroAuthoring

            await test.step('Inspect layout list and card views across desktop, tablet, and mobile', () =>
                verifyMarketingLayoutAuthoringViews({
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    sourceLayoutName
                }))
            const copiedLayouts = await test.step('Copy the layout while reusing or omitting its Hero records', () =>
                copyEntityBackedMarketingLayouts({
                    api,
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    marketingLayoutId,
                    executionRunId,
                    sourceLayoutName,
                    sourceHeroWidgetIds
                }))
            const expectedConflictResourceUrls =
                await test.step('Open the chooser for Hero rebind, then verify bound-record deletion is blocked', async () => {
                    const openAddedHeroBindingChooser = async () => {
                        await page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
                        const heroSurface = page.getByTestId(`layout-widget-${addedHeroWidget.id}`)
                        await heroSurface.getByRole('button', { name: 'Edit', exact: true }).click()

                        const boundHeroForm = page.getByRole('dialog', { name: /Edit Hero content/ })
                        await expect(boundHeroForm).toBeVisible()
                        await boundHeroForm
                            .getByRole('button', { name: 'Choose another record and discard unsaved changes', exact: true })
                            .click()

                        const dialog = page.getByRole('dialog', { name: 'Hero content', exact: true })
                        const select = dialog.getByRole('combobox', { name: 'Hero content record', exact: true })
                        await expect(dialog).toBeVisible()
                        await expectNoTechnicalLeakage(dialog, { label: 'Hero content rebind chooser', checkUuidSubstrings: true })
                        return { dialog, select }
                    }

                    // Editing a bound record opens its form directly. Rebinding
                    // remains an explicit transition back to the chooser.
                    let reopenedBinding = await openAddedHeroBindingChooser()
                    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
                    await reopenedBinding.select.click()
                    await page.getByRole('option', { name: updatedHeroTitle, exact: true }).click()
                    const firstRebindResponsePromise = waitForSettledMutationResponse(
                        page,
                        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/binding$/),
                        { label: 'Rebinding the second Hero placement to the first Entity record', timeout: 90_000 }
                    )
                    await reopenedBinding.dialog.getByRole('button', { name: 'Save content selection', exact: true }).click()
                    const firstRebindResponse = await firstRebindResponsePromise
                    expect(firstRebindResponse.ok()).toBe(true)
                    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)

                    reopenedBinding = await openAddedHeroBindingChooser()
                    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)
                    await reopenedBinding.select.click()
                    await page.getByRole('option', { name: independentHeroTitle, exact: true }).click()
                    const restoreRebindResponsePromise = waitForSettledMutationResponse(
                        page,
                        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/binding$/),
                        { label: 'Restoring the second Hero placement to its independent Entity record', timeout: 90_000 }
                    )
                    await reopenedBinding.dialog.getByRole('button', { name: 'Save content selection', exact: true }).click()
                    const restoreRebindResponse = await restoreRebindResponsePromise
                    expect(restoreRebindResponse.ok()).toBe(true)
                    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)

                    reopenedBinding = await openAddedHeroBindingChooser()
                    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
                    await reopenedBinding.dialog.getByRole('button', { name: 'Edit selected content', exact: true }).click()
                    const editHeroRecordForm = page.getByRole('dialog', { name: /Edit Hero content/ })
                    await expect(editHeroRecordForm).toBeVisible()
                    await expectNoTechnicalLeakage(editHeroRecordForm, { label: 'Edit Hero content form', checkUuidSubstrings: true })
                    const editHeroActionTarget = editHeroRecordForm.getByRole('combobox', { name: 'Page section', exact: true }).first()
                    await editHeroActionTarget.focus()
                    await page.keyboard.press('Enter')
                    await expect(page.getByRole('option', { name: 'Hero — 2', exact: true })).toBeVisible()
                    await page.getByRole('option', { name: 'Hero — 2', exact: true }).click()
                    await expect(editHeroActionTarget).toHaveText('Hero — 2')
                    const heroActionUpdateResponsePromise = waitForSettledMutationResponse(
                        page,
                        (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
                        { label: 'Updating the Hero CTA to target the second active Hero section', timeout: 90_000 }
                    )
                    await editHeroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
                    const heroActionUpdateResponse = await heroActionUpdateResponsePromise
                    expect(heroActionUpdateResponse.ok()).toBe(true)
                    await expect(editHeroRecordForm).toHaveCount(0)
                    await expect(reopenedBinding.dialog).toBeVisible()
                    await reopenedBinding.dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
                    await expect(reopenedBinding.dialog).toHaveCount(0)
                    await page.setViewportSize({ width: 1440, height: 1000 })

                    await applyBrowserPreferences(page, { language: 'ru' })
                    await page.goto(`/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/records`)
                    await ensureListView(page)
                    const boundHeroRecordRow = page.getByRole('row').filter({ hasText: independentHeroTitleRu }).first()
                    await expect(boundHeroRecordRow).toBeVisible()
                    await boundHeroRecordRow.getByRole('button', { name: 'Опции', exact: true }).click()
                    await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click()
                    const boundHeroDeleteDialog = page.getByRole('dialog', { name: 'Удалить запись', exact: true })
                    await expect(boundHeroDeleteDialog).toBeVisible()
                    const deniedBoundHeroDeletePromise = waitForSettledMutationResponse(
                        page,
                        (response) =>
                            responseIsMutation(
                                response,
                                'DELETE',
                                new RegExp(
                                    `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${createdHeroRecord.id}$`
                                )
                            ),
                        { label: 'Refusing to delete a bound Hero record through the Entity records UI', timeout: 90_000 }
                    )
                    await boundHeroDeleteDialog.getByRole('button', { name: 'Удалить', exact: true }).click()
                    const deniedBoundHeroDelete = await deniedBoundHeroDeletePromise
                    expect(deniedBoundHeroDelete.status()).toBe(409)
                    const deniedBoundHeroDeleteAlert = page.getByRole('alert')
                    await expect(deniedBoundHeroDeleteAlert).toContainText(
                        'Эта запись используется в размещении Hero. Откройте макеты и укажите для этого размещения другую запись содержимого либо удалите размещение, затем повторите удаление.'
                    )
                    await expectNoTechnicalLeakage(deniedBoundHeroDeleteAlert, {
                        label: 'Russian bound Hero record deletion message',
                        checkUuidSubstrings: true
                    })
                    await expect(boundHeroDeleteDialog).toHaveCount(0)
                    await expect(boundHeroRecordRow).toBeVisible()

                    const deniedBoundHeroDeleteApi = await sendWithCsrf(
                        api,
                        'DELETE',
                        `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${createdHeroRecord.id}`
                    )
                    expect(deniedBoundHeroDeleteApi.status).toBe(409)
                    expect(await deniedBoundHeroDeleteApi.json()).toMatchObject({ code: 'RECORD_BOUND' })
                    const recordsAfterDeniedDelete = (await listRecords(api, metahub.id!, heroEntity.id!, {
                        limit: 100,
                        offset: 0
                    })) as { items?: Array<{ id?: string }> }
                    expect(recordsAfterDeniedDelete.items?.some((record) => record.id === createdHeroRecord.id)).toBe(true)

                    return [deniedBoundHeroDelete.url()]
                })
            const heroLayoutFlowResults = { ...copiedLayouts, expectedConflictResourceUrls }
            return {
                heroEntity,
                independentHeroTitle,
                independentHeroAccent,
                independentHeroTitleRu,
                independentHeroAccentRu,
                sourceHeroWidgetId: String(sourceHeroWidget.id),
                createdHeroRecord,
                addedHeroWidget,
                heroLayoutFlowResults
            }
        })
        const {
            heroEntity,
            independentHeroTitle,
            independentHeroAccent,
            independentHeroTitleRu,
            independentHeroAccentRu,
            sourceHeroWidgetId,
            createdHeroRecord,
            addedHeroWidget,
            heroLayoutFlowResults
        } = heroAuthoring

        const publishedApplication = await test.step('Publish the metahub and synchronize its application schema', () =>
            publishMarketingHeroApplication({ api, page, metahubId: metahub.id!, publicationName }))

        await test.step('Create the application schema through the ConnectorBoard diff flow', async () => {
            // Complete the application schema through the real ConnectorBoard diff
            // dialog, so the runtime assertion covers the full publish pipeline.
            await page.goto(`/a/${publishedApplication.applicationId}/admin/connectors`)
            await expect(page.getByRole('heading', { name: 'Connectors', exact: true })).toBeVisible()
            await ensureListView(page)
            const connectorLink = page.getByRole('link', { name: publishedApplication.connectorName, exact: true })
            await expect(connectorLink).toBeVisible()
            await connectorLink.click()
            await expect(page.getByTestId('application-connector-board-schema-card')).toBeVisible()

            const diffResponsePromise = page.waitForResponse(
                (response) =>
                    responseIsMutation(response, 'GET', new RegExp(`/api/v1/application/${publishedApplication.applicationId}/diff$`)),
                { timeout: 120_000 }
            )
            await page.getByTestId('application-connector-board-sync-button').click()
            const diffResponse = await diffResponsePromise
            expect(diffResponse.ok()).toBe(true)

            const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
            await expect(diffDialog).toBeVisible()
            const createSchemaButton = diffDialog.getByRole('button', { name: 'Create Schema', exact: true })
            await expect(createSchemaButton).toBeEnabled()

            const applicationSyncPromise = waitForSettledMutationResponse(
                page,
                (response) =>
                    responseIsMutation(response, 'POST', new RegExp(`/api/v1/application/${publishedApplication.applicationId}/sync$`)),
                { label: 'Creating the marketing application schema from ConnectorBoard', timeout: 180_000 }
            )
            await createSchemaButton.click()
            const applicationSyncResponse = await applicationSyncPromise
            expect(applicationSyncResponse.ok()).toBe(true)
            await expect(diffDialog).toHaveCount(0)
            await expect
                .poll(
                    async () => {
                        const current = await getApplication(api, publishedApplication.applicationId)
                        return current?.schemaStatus ?? current?.data?.schemaStatus ?? null
                    },
                    { timeout: 180_000, message: 'Waiting for the marketing application schema to become synced' }
                )
                .toBe('synced')
        })

        await test.step('Verify a metahub member without editContent cannot open Hero create or edit controls', async () => {
            bootstrapApi = await createBootstrapApiContext()
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const userRole = assignableRoles.find((role: { codename?: string }) => role.codename?.toLowerCase() === 'user')
            if (typeof userRole?.id !== 'string') {
                throw new Error('The assignable User role was not available for the Hero permission fixture')
            }

            const memberEmail = `e2e+${executionRunId}.marketing-content-member@example.test`
            const memberPassword = runManifest.testUser.password
            const createdMember = await createAdminUser(bootstrapApi, {
                email: memberEmail,
                password: memberPassword,
                roleIds: [userRole.id],
                comment: `Marketing Hero editContent browser coverage ${executionRunId}`
            })
            if (typeof createdMember?.userId !== 'string') throw new Error('The no-editContent Hero member account was not created')
            await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberEmail })
            await expect
                .poll(
                    async () => {
                        try {
                            const readinessApi = await createLoggedInApiContext({ email: memberEmail, password: memberPassword })
                            await disposeApiContext(readinessApi)
                            return true
                        } catch {
                            return false
                        }
                    },
                    { timeout: 30_000, message: 'Waiting for the no-editContent member account to become available' }
                )
                .toBe(true)
            await addMetahubMember(api, metahub.id!, { email: memberEmail, role: 'member' })

            noEditContentApi = await createLoggedInApiContext({ email: memberEmail, password: memberPassword })
            const memberAccess = await listMetahubMembers(noEditContentApi, metahub.id!)
            expect(memberAccess).toMatchObject({ role: 'member', permissions: { editContent: false } })

            noEditContentBrowser = await createLoggedInBrowserContext(browser, { email: memberEmail, password: memberPassword })
            await applyBrowserPreferences(noEditContentBrowser.page, { language: 'en' })
            await noEditContentBrowser.page.goto(`/metahub/${metahub.id}/resources/layouts/${marketingLayoutId}`)
            await expect(noEditContentBrowser.page.getByTestId('metahub-layout-details-content')).toBeVisible()
            const readOnlyHeroSurface = noEditContentBrowser.page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)
            await expect(readOnlyHeroSurface).toBeVisible()
            await expect(readOnlyHeroSurface.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
            await expect(noEditContentBrowser.page.getByRole('button', { name: 'Create content record', exact: true })).toHaveCount(0)
            await expect(noEditContentBrowser.page.getByRole('button', { name: 'Edit selected content', exact: true })).toHaveCount(0)
            await expect(noEditContentBrowser.page.getByRole('dialog', { name: 'Hero content', exact: true })).toHaveCount(0)
        })

        const actionIntegrityConflictUrl = await test.step('Verify the materialized application layout and its Hero action integrity', () =>
            verifyMarketingApplicationAuthoring({
                api,
                page,
                testInfo,
                applicationId: publishedApplication.applicationId,
                brandLogoUrl
            }))

        await test.step('Verify the published Entity-backed Hero runtime and section action', () =>
            verifyPublishedMarketingHeroJourney({
                api,
                page,
                testInfo,
                browserIssues,
                applicationId: publishedApplication.applicationId,
                brandLogoUrl,
                expectedConflictResourceUrls: [...heroLayoutFlowResults.expectedConflictResourceUrls, actionIntegrityConflictUrl],
                firstHero: {
                    title: updatedHeroTitle,
                    accent: updatedHeroAccent,
                    titleRu: updatedHeroTitleRu,
                    accentRu: updatedHeroAccentRu
                },
                secondHero: {
                    title: independentHeroTitle,
                    accent: independentHeroAccent,
                    titleRu: independentHeroTitleRu,
                    accentRu: independentHeroAccentRu
                }
            }))

        await test.step('Verify both published Hero records in a fresh anonymous browser context', async () => {
            anonymousContext = await browser.newContext({
                storageState: { cookies: [], origins: [] },
                locale: 'en-US',
                colorScheme: 'light'
            })
            const anonymousStorage = await anonymousContext.storageState()
            expect(anonymousStorage.cookies).toHaveLength(0)
            expect(anonymousStorage.origins).toHaveLength(0)

            const anonymousPage = await anonymousContext.newPage()
            const publishedUrl = new URL(`/a/${publishedApplication.applicationId}?locale=en`, page.url())
            await anonymousPage.goto(publishedUrl.toString())
            await expect(anonymousPage.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })

            for (const hero of [
                { title: updatedHeroTitle, accent: updatedHeroAccent },
                { title: independentHeroTitle, accent: independentHeroAccent }
            ]) {
                const heading = anonymousPage.getByRole('heading', { name: `${hero.title} ${hero.accent}`, exact: true })
                await expect(heading, `Anonymous runtime must render Hero “${hero.title}”`).toHaveCount(1)
                await expect(heading).toBeVisible()
            }
        })

        await test.step('Remove the placement and copied layout before deleting its Hero record', () =>
            removeHeroPlacementAndDeleteEntityRecord({
                api,
                page,
                metahubId: metahub.id!,
                marketingLayoutId,
                addedHeroWidgetId: addedHeroWidget.id!,
                reusedLayoutId: heroLayoutFlowResults.reusedLayoutId,
                reusedLayoutName: heroLayoutFlowResults.reusedLayoutName,
                heroEntityId: heroEntity.id!,
                heroRecordId: createdHeroRecord.id!,
                heroRecordTitleRu: independentHeroTitleRu
            }))
    } finally {
        await anonymousContext?.close().catch(() => undefined)
        await noEditContentBrowser?.context.close().catch(() => undefined)
        if (noEditContentApi) await disposeApiContext(noEditContentApi)
        if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
        await disposeApiContext(api)
    }
})
