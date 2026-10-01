import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext, getApplication, listLayoutZoneWidgets } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectNoTechnicalLeakage, watchBrowserRuntimeIssues } from '../../support/browser/runtimeUx'
import { entityDialogSelectors } from '../../support/selectors/contracts'
import { parseJsonResponse, readLocalizedText } from './entity-runtime-helpers'
import {
    buildExecutionRunId,
    ensureListView,
    fillLocalizedField,
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
import { enablePublicApplicationAndVerifySettings } from '../../support/marketingPageAuthoring/enablePublicApplicationAndVerifySettings'
import { verifyMarketingHeroMemberPermissions } from '../../support/marketingPageAuthoring/verifyMarketingHeroMemberPermissions'
import { verifyAnonymousMarketingHeroRuntime } from '../../support/marketingPageAuthoring/verifyAnonymousMarketingHeroRuntime'
import { verifyMarketingImageRecordAuthoring } from '../../support/marketingPageAuthoring/verifyMarketingImageRecordAuthoring'
import {
    editSeededMarketingHeroEntityRecord,
    setSeededMarketingHeroSectionAction,
    verifyMarketingHeroKeyboardEditing,
    verifyRussianMarketingHeroRequiredEnglish
} from '../../support/marketingPageAuthoring/marketingHeroEntityAuthoring'
import { createIndependentMarketingHeroRecord } from '../../support/marketingPageAuthoring/createIndependentMarketingHeroRecord'
import { verifyMarketingHeroBindingDeletionLifecycle } from '../../support/marketingPageAuthoring/verifyMarketingHeroBindingDeletionLifecycle'

type EntityResponse = {
    id?: string
    data?: {
        id?: string
    }
}

const unwrapEntity = <T extends EntityResponse>(payload: T): { id?: string } => payload.data ?? payload

test('@flow @combined @marketing-page browser authoring publishes edited content into the runtime', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(420_000)
    await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' })
    )
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

        const marketingImageAuthoring = await test.step('Create and edit Marketing Image content through the ResourceSource editor', () =>
            verifyMarketingImageRecordAuthoring({
                api,
                page,
                testInfo,
                runStep: (title, action) => test.step(title, action),
                metahubId: metahub.id!,
                marketingLayoutId,
                entityResponse,
                brandLogoUrl
            }))

        const heroAuthoring = await test.step('Author Hero Entity records and verify binding lifecycle', async () => {
            await test.step('Edit the seeded Hero record in the generic Entity records UI', () =>
                editSeededMarketingHeroEntityRecord({
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    updatedHeroTitle,
                    updatedHeroTitleRu,
                    updatedHeroAccent,
                    updatedHeroAccentRu
                }))

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

            await test.step('Set the seeded Hero action target before publication', () =>
                setSeededMarketingHeroSectionAction({
                    page,
                    metahubId: metahub.id!,
                    marketingLayoutId,
                    sourceHeroWidgetId: String(sourceHeroWidget.id)
                }))

            await test.step('Edit the existing Hero with the keyboard and verify validation, save, cancel, and focus', () =>
                verifyMarketingHeroKeyboardEditing({
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    marketingLayoutId,
                    sourceHeroWidgetId: String(sourceHeroWidget.id),
                    updatedHeroTitle,
                    updatedHeroTitleRu
                }))

            await test.step('Check required English Hero content in the Russian authoring form', () =>
                verifyRussianMarketingHeroRequiredEnglish({
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    marketingLayoutId,
                    sourceHeroWidgetId: String(sourceHeroWidget.id)
                }))

            const independentHeroAuthoring = await test.step('Duplicate Hero and edit its independent Entity record', () =>
                createIndependentMarketingHeroRecord({
                    api,
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    marketingLayoutId,
                    heroEntityId: String(heroEntity.id),
                    sourceHeroWidgetId: String(sourceHeroWidget.id),
                    independentHeroTitle,
                    independentHeroAccent,
                    independentHeroTitleRu,
                    independentHeroAccentRu
                }))
            const { createdHeroRecord, addedHeroWidget, sourceLayoutName } = independentHeroAuthoring

            await test.step('Inspect layout list and card views across desktop, tablet, and mobile', () =>
                verifyMarketingLayoutAuthoringViews({
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    sourceLayoutName
                }))
            const copiedLayouts = await test.step('Copy the layout while preserving all Entity binding slots', () =>
                copyEntityBackedMarketingLayouts({
                    api,
                    page,
                    testInfo,
                    metahubId: metahub.id!,
                    marketingLayoutId,
                    executionRunId,
                    sourceLayoutName
                }))
            const expectedConflictResourceUrls =
                await test.step('Open the chooser for Hero rebind, then verify bound-record deletion is blocked', () =>
                    verifyMarketingHeroBindingDeletionLifecycle({
                        api,
                        page,
                        testInfo,
                        metahubId: metahub.id!,
                        marketingLayoutId,
                        addedHeroWidgetId: String(addedHeroWidget.id),
                        heroEntityId: String(heroEntity.id),
                        createdHeroRecordId: createdHeroRecord.id,
                        updatedHeroTitle,
                        independentHeroTitle,
                        independentHeroTitleRu
                    }))
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

        await test.step('Enable anonymous published runtime through Application Settings', () =>
            enablePublicApplicationAndVerifySettings({
                page,
                testInfo,
                applicationId: publishedApplication.applicationId
            }))

        await test.step('Verify a metahub member without editContent cannot open Hero create or edit controls', () =>
            verifyMarketingHeroMemberPermissions({
                browser,
                api,
                executionRunId,
                memberPassword: runManifest.testUser.password,
                metahubId: metahub.id!,
                marketingLayoutId,
                heroEntityId: String(heroEntity.id),
                sourceHeroWidgetId
            }))

        const actionIntegrityConflictUrl = await test.step('Verify the materialized application layout and its Hero action integrity', () =>
            verifyMarketingApplicationAuthoring({
                api,
                page,
                testInfo,
                metahubId: metahub.id!,
                sourceLayoutId: marketingLayoutId,
                publicationId: publishedApplication.publicationId,
                applicationId: publishedApplication.applicationId
            }))

        await test.step('Verify the published Entity-backed Hero runtime and section action', () =>
            verifyPublishedMarketingHeroJourney({
                api,
                page,
                testInfo,
                browserIssues,
                applicationId: publishedApplication.applicationId,
                brandLogoUrl,
                imageAltText: marketingImageAuthoring.imageAltText,
                expectedValidationResourceUrls: marketingImageAuthoring.expectedValidationResourceUrls,
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

        await test.step('Verify both published Hero records in a fresh anonymous browser context', () =>
            verifyAnonymousMarketingHeroRuntime({
                browser,
                page,
                testInfo,
                applicationId: publishedApplication.applicationId,
                brandLogoUrl,
                imageAltText: marketingImageAuthoring.imageAltText,
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

        await test.step('Remove the placement and copied layout before deleting its Hero record', () =>
            removeHeroPlacementAndDeleteEntityRecord({
                api,
                page,
                metahubId: metahub.id!,
                marketingLayoutId,
                addedHeroWidgetId: addedHeroWidget.id!,
                copiedLayoutId: heroLayoutFlowResults.copiedLayoutId,
                copiedLayoutName: heroLayoutFlowResults.copiedLayoutName,
                heroEntityId: heroEntity.id!,
                heroRecordId: createdHeroRecord.id!,
                heroRecordTitleRu: independentHeroTitleRu
            }))
    } finally {
        await disposeApiContext(api)
    }
})
