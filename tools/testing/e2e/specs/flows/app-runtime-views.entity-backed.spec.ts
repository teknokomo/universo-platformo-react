import { createLocalizedContent } from '@universo-react/utils'
import { test, expect } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { switchRuntimeLocale } from '../../support/browser/preferences'
import {
    expectLocalizedValidation,
    expectLocatorFullyFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls,
    expectTableHorizontalScrollConstrained,
    expectRuntimeNavigationIconSemantics,
    waitForLayoutFrame
} from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createAdminUser,
    getAssignableRoles,
    createMetahub,
    createComponent,
    createObjectCollection,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createRecord,
    disposeApiContext,
    getLayoutZoneWidgetBindings,
    getRuntimeRow,
    addApplicationMember,
    listComponents,
    listLayoutZoneWidgets,
    listObjectCollections,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    updateLayoutZoneWidgetConfig,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { confirmDeleteSelectors, entityDialogSelectors } from '../../support/selectors/contracts'
import {
    expectNoDashboardRuntimeHandles,
    readCodename,
    waitForLayoutId,
    waitForObjectId,
    waitForUser
} from '../../support/appRuntimeViewsTestSupport'

const forbiddenDashboardRuntimeIdLabels = ['Project ID', 'Owner ID']

test.describe('Application Runtime View Settings', () => {
    test('@flow entity-backed dashboard applies detailsTable view settings, search, copy isolation, role access, and Entity row ordering', async ({
        page,
        browser,
        runManifest
    }, testInfo) => {
        test.setTimeout(300_000)

        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} entity-backed runtime views`
        const metahubCodename = `${runManifest.runId}-entity-backed-runtime-views`
        const publicationName = `E2E ${runManifest.runId} Entity-backed Runtime Publication`
        const applicationName = `E2E ${runManifest.runId} Entity-backed Runtime Application`
        const rowTitle = `Dashboard alpha ${runManifest.runId}`
        const editedRowTitle = `Dashboard alpha edited ${runManifest.runId}`
        const winningRowTitle = `Dashboard alpha latest ${runManifest.runId}`
        const staleRowTitle = `Dashboard alpha stale ${runManifest.runId}`
        const secondRowTitle = `Dashboard beta ${runManifest.runId}`
        const copiedRowTitle = `Dashboard beta copy ${runManifest.runId}`
        const editedCopyTitle = `Dashboard beta copy edited ${runManifest.runId}`
        const internalObjectName = `Internal runtime settings ${runManifest.runId}`
        const internalObjectCodename = `InternalRuntimeSettings${runManifest.runId.replace(/[^A-Za-z0-9]/gu, '')}`
        const alternateObjectName = `Dashboard alternate source ${runManifest.runId}`
        const alternateObjectCodename = `DashboardAlternate${runManifest.runId.replace(/[^A-Za-z0-9]/gu, '')}`
        const sourceOnlyTitle = `Original source only ${runManifest.runId}`
        const longDescription = `A multiline Dashboard description for ${
            runManifest.runId
        }.\n${'Readable content remains in the Entity record. '.repeat(12)}`
        const memberCredentials = {
            email: `e2e+${runManifest.runId}.dashboard-member@example.test`,
            password: process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        }
        let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
        let memberApi: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
        let memberBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
        let staleBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })
            if (!metahub?.id) throw new Error('Metahub creation did not return an id for the entity-backed runtime coverage')
            await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

            const objectCollectionId = await waitForObjectId(api, metahub.id)
            const objectCollections = await listObjectCollections(api, metahub.id, { limit: 100, offset: 0 })
            const objectCollection = (objectCollections?.items ?? []).find(
                (candidate: Record<string, unknown>) => candidate.id === objectCollectionId
            )
            const objectCodename = readCodename(objectCollection?.codename)
            if (!objectCodename) throw new Error('Entity-backed runtime coverage could not resolve the object codename')

            const alternateObject = await createObjectCollection(api, metahub.id, {
                name: { en: alternateObjectName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', alternateObjectCodename)
            })
            if (typeof alternateObject?.id !== 'string') {
                throw new Error('Dashboard source-rebind coverage could not create its alternate Object')
            }
            await createComponent(api, metahub.id, alternateObject.id, {
                name: 'Title',
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', 'Title'),
                dataType: 'STRING',
                isRequired: true,
                isDisplayComponent: true,
                validationRules: { maxLength: 255, minLength: 3, localized: true, versioned: true }
            })
            await createComponent(api, metahub.id, alternateObject.id, {
                name: 'Sort order',
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', 'SortOrder'),
                dataType: 'NUMBER',
                isRequired: true
            })
            await createComponent(api, metahub.id, alternateObject.id, {
                name: 'Description',
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', 'Description'),
                dataType: 'STRING',
                validationRules: { maxLength: 2048, localized: true, versioned: true }
            })
            for (const [name, codename, isDisplayComponent, isRequired] of [
                ['Cover', 'Cover', true, true],
                ['Instructions', 'Instructions', true, true],
                ['Project ID', 'ProjectId', false, false],
                ['Owner ID', 'OwnerId', false, false]
            ] as const) {
                await createComponent(api, metahub.id, alternateObject.id, {
                    name,
                    namePrimaryLocale: 'en',
                    codename: createLocalizedContent('en', codename),
                    dataType: 'STRING',
                    isRequired,
                    isDisplayComponent,
                    validationRules: { maxLength: 4096, localized: true, versioned: true }
                })
            }
            const sourceOnlyRecord = await createRecord(api, metahub.id, objectCollectionId, {
                data: { Title: createLocalizedContent('en', sourceOnlyTitle), SortOrder: 0 }
            })
            if (typeof sourceOnlyRecord?.id !== 'string') {
                throw new Error('Dashboard source-rebind coverage could not create its original-source-only record')
            }

            const internalObject = await createObjectCollection(api, metahub.id, {
                name: { en: internalObjectName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', internalObjectCodename)
            })
            if (!internalObject?.id) throw new Error('Dashboard navigation coverage could not create the internal Object fixture')

            const componentsPayload = await listComponents(api, metahub.id, objectCollectionId, { limit: 100, offset: 0 })
            const components = componentsPayload?.items ?? []
            if (!components.some((component: Record<string, unknown>) => readCodename(component.codename) === 'Title')) {
                throw new Error('Entity-backed runtime coverage could not find the Main object Title component')
            }
            if (!components.some((component: Record<string, unknown>) => readCodename(component.codename) === 'SortOrder')) {
                await createComponent(api, metahub.id, objectCollectionId, {
                    name: 'Sort order',
                    namePrimaryLocale: 'en',
                    codename: createLocalizedContent('en', 'SortOrder'),
                    dataType: 'NUMBER',
                    isRequired: true
                })
            }

            const layoutId = await waitForLayoutId(api, metahub.id)
            await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
            const centerZone = page.getByTestId('layout-zone-center')
            const sourceOptionsResponsePromise = page.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'GET' && url.pathname.endsWith('/widget-binding-sources/detailsTable/rows')
            })
            await centerZone.getByRole('button', { name: 'Add widget', exact: true }).click()
            const widgetMenu = page.getByRole('menu')
            await expect(widgetMenu).toBeVisible()
            await widgetMenu.getByRole('menuitem', { name: 'Details table', exact: true }).click()

            const bindingDialog = page.getByRole('dialog').filter({
                has: page.getByRole('combobox', { name: 'Content source', exact: true })
            })
            await expect(bindingDialog).toBeVisible()
            const sourceOptionsResponse = await sourceOptionsResponsePromise
            expect(sourceOptionsResponse.ok()).toBe(true)
            const sourceOptionsPayload = (await sourceOptionsResponse.json()) as {
                sources?: Array<{ sourceKey?: string; label?: string }>
            }
            const dashboardSource = sourceOptionsPayload.sources?.find((source) => source.sourceKey === objectCodename)
            if (!dashboardSource?.label) {
                throw new Error('Entity-backed runtime coverage could not resolve the expected source in the Dashboard picker')
            }

            const sourceSelect = bindingDialog.getByRole('combobox', { name: 'Content source', exact: true })
            const originalViewport = page.viewportSize()
            await page.setViewportSize({ width: 390, height: 844 })
            await sourceSelect.focus()
            await sourceSelect.fill(dashboardSource.label)
            const sourceListbox = page.getByRole('listbox', { name: 'Content source', exact: true })
            const dashboardSourceOption = sourceListbox.getByRole('option', { name: dashboardSource.label, exact: true })
            await expect(sourceListbox).toHaveCount(1)
            await expect(sourceListbox).toBeVisible()
            await expect(dashboardSourceOption).toBeVisible()
            await waitForLayoutFrame(page)
            await expect(dashboardSourceOption).toBeVisible()
            await expectLocatorFullyFitsViewport(dashboardSourceOption, 'Dashboard source option at 390x844')
            await expectNoPageHorizontalOverflow(page, 'Dashboard source picker at 390x844')
            await expectNoTechnicalLeakage(bindingDialog, {
                label: 'Dashboard source picker',
                checkUuidSubstrings: true
            })
            await page.screenshot({ path: testInfo.outputPath('dashboard-source-picker-mobile-390.png'), animations: 'disabled' })
            await sourceSelect.press('ArrowDown')
            await sourceSelect.press('Enter')
            await sourceSelect.press('Escape')
            await expect(page.getByRole('listbox')).toHaveCount(0)
            await expect(sourceSelect).toHaveValue(dashboardSource.label)
            if (originalViewport) await page.setViewportSize(originalViewport)
            await bindingDialog.getByRole('button', { name: 'Add', exact: true }).click()
            await expect(bindingDialog).not.toBeVisible()

            const widgetsPayload = await listLayoutZoneWidgets(api, metahub.id, layoutId)
            const detailsWidget = (widgetsPayload?.items ?? []).find(
                (widget: Record<string, unknown>) => widget.widgetKey === 'detailsTable'
            )
            if (!detailsWidget || typeof detailsWidget.id !== 'string' || typeof detailsWidget.version !== 'number') {
                throw new Error('Entity-backed runtime coverage did not find a versioned detailsTable placement')
            }

            const persistedBindings = await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, detailsWidget.id, 'en')
            expect(persistedBindings.bindings).toEqual(
                expect.arrayContaining([expect.objectContaining({ slot: 'rows', sourceKey: objectCodename, selectorKind: 'record-set' })])
            )

            const configuredWidgetsPayload = await listLayoutZoneWidgets(api, metahub.id, layoutId)
            const configuredDetailsWidget = (configuredWidgetsPayload?.items ?? []).find(
                (widget: Record<string, unknown>) => widget.id === detailsWidget.id
            )
            if (!configuredDetailsWidget || typeof configuredDetailsWidget.version !== 'number') {
                throw new Error('Entity-backed runtime coverage could not reload the detailsTable placement after binding it')
            }
            await updateLayoutZoneWidgetConfig(api, metahub.id, layoutId, detailsWidget.id, {
                config: {
                    variant: 'records',
                    showViewToggle: true,
                    showSearch: true,
                    defaultViewMode: 'table',
                    enableRowReordering: true,
                    createTargets: [
                        {
                            id: 'main-target',
                            label: 'Main',
                            objectCollectionCodename: alternateObjectCodename,
                            surface: 'dialog',
                            createDefaults: [{ fieldCodename: 'SortOrder', value: 1 }]
                        }
                    ]
                },
                expectedVersion: configuredDetailsWidget.version
            })

            // Rebind the existing placement through the same authoring UI a
            // metahub owner uses. The old source has a uniquely named record;
            // the published table must stop exposing it after the rebind.
            const currentRowsBinding = persistedBindings.bindings.find((binding: { slot?: string }) => binding.slot === 'rows') as
                | { sourceKey?: string }
                | undefined
            if (currentRowsBinding?.sourceKey !== objectCodename) {
                throw new Error('Dashboard source-rebind coverage must start from the original Entity source')
            }
            await page.reload()
            await expect(centerZone).toBeVisible()
            const detailsPlacementEdit = centerZone.getByTestId(`layout-widget-edit-${detailsWidget.id}`)
            await expect(detailsPlacementEdit).toHaveCount(1)
            await expect(detailsPlacementEdit).toBeVisible()
            await detailsPlacementEdit.click()

            const rebindDialog = page.getByRole('dialog').filter({
                has: page.getByRole('combobox', { name: 'Content source', exact: true })
            })
            await expect(rebindDialog).toBeVisible()
            const rebindSourceSelect = rebindDialog.getByRole('combobox', { name: 'Content source', exact: true })
            const alternateSourceSaveButton = rebindDialog.getByRole('button', { name: 'Save', exact: true })
            await expect(alternateSourceSaveButton).toBeDisabled()
            await rebindSourceSelect.fill(alternateObjectName)
            const alternateSourceOption = page.getByRole('option', { name: alternateObjectName, exact: true })
            await expect(alternateSourceOption).toBeVisible()
            await alternateSourceOption.click()
            await expect(rebindSourceSelect).toHaveValue(alternateObjectName)
            await expect(alternateSourceSaveButton, 'Choosing a different content Entity must make the binding dirty').toBeEnabled()

            const bindingSave = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'PATCH' && url.pathname.endsWith(`/zone-widget/${detailsWidget.id}/binding`)
                },
                { label: 'Rebinding the Dashboard detailsTable source' }
            )
            await alternateSourceSaveButton.click()
            const bindingSaveResponse = await bindingSave
            expect(bindingSaveResponse.ok(), 'Rebinding a Dashboard detailsTable source must succeed').toBe(true)
            await expect(rebindDialog).toBeVisible()
            await expect(alternateSourceSaveButton, 'A successful binding save must return the editor to its clean state').toBeDisabled()
            await rebindDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(rebindDialog).not.toBeVisible()

            const reboundBindings = await getLayoutZoneWidgetBindings(api, metahub.id, layoutId, detailsWidget.id, 'en')
            expect(reboundBindings.bindings).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ slot: 'rows', sourceKey: alternateObjectCodename, selectorKind: 'record-set' })
                ])
            )

            const publication = await createPublication(api, metahub.id, {
                name: { en: publicationName },
                namePrimaryLocale: 'en',
                autoCreateApplication: false
            })
            if (!publication?.id) throw new Error('Publication creation did not return an id for entity-backed runtime coverage')
            await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })

            await createPublicationVersion(api, metahub.id, publication.id, {
                name: { en: `E2E ${runManifest.runId} Entity-backed Runtime Version` },
                namePrimaryLocale: 'en'
            })
            await syncPublication(api, metahub.id, publication.id)
            await waitForPublicationReady(api, metahub.id, publication.id)

            const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
                name: { en: applicationName },
                namePrimaryLocale: 'en',
                createApplicationSchema: false
            })
            const applicationId = linkedApplication?.application?.id
            if (typeof applicationId !== 'string') throw new Error('Entity-backed runtime coverage did not create an application')
            await recordCreatedApplication({ id: applicationId })
            await syncApplicationSchema(api, applicationId)

            const effectiveLayoutResponsePromise = page.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/applications/${applicationId}/runtime/effective-layout`
                )
            })
            await page.goto(`/a/${applicationId}`)

            const effectiveLayoutResponse = await effectiveLayoutResponsePromise
            expect(effectiveLayoutResponse.ok(), 'Published Dashboard effective layout must load').toBe(true)
            const effectiveLayout = (await effectiveLayoutResponse.json()) as {
                status?: string
                widgets?: Array<{ widgetKey?: string; runtimeData?: unknown }>
            }
            expect(effectiveLayout.status).toBe('ok')
            const generatedMenuState = effectiveLayout.widgets?.find((widget) => widget.widgetKey === 'menuWidget')?.runtimeData as
                | {
                      status?: string
                      data?: { kind?: string; items?: Array<{ target?: { kind?: string; codename?: string }; icon?: string }> }
                  }
                | undefined
            expect(generatedMenuState, 'The generated menu must resolve from the published layout').toMatchObject({
                status: 'ready',
                data: { kind: 'menu' }
            })
            const generatedMenuItems = generatedMenuState?.data?.items ?? []
            expect(generatedMenuItems.some((item) => item.target?.kind === 'page' && item.target.codename === 'WelcomePage')).toBe(true)
            expect(generatedMenuItems.some((item) => item.target?.kind === 'object')).toBe(false)
            expect(JSON.stringify(generatedMenuState)).not.toContain(internalObjectCodename)

            const navigation = page.getByRole('navigation', { name: 'Application navigation', exact: true })
            await expect(navigation).toBeVisible()
            const welcomeLink = navigation.getByRole('link', { name: 'Welcome', exact: true })
            await expect(welcomeLink).toBeVisible()
            await expectRuntimeNavigationIconSemantics(navigation, [{ label: 'Welcome', family: 'home' }])
            await expect(navigation.getByText(internalObjectName, { exact: true })).toHaveCount(0)
            await expectNoTechnicalLeakage(navigation, { label: 'Published Dashboard navigation', checkUuidSubstrings: true })

            const runtimeHeader = page.getByTestId('runtime-header')
            const headerActions = page.getByTestId('runtime-header-actions')
            await expect(runtimeHeader).toBeVisible()
            const languageButton = page.getByTestId('runtime-language-switcher')
            const colorModeButton = runtimeHeader.getByRole('button', { name: 'Color mode', exact: true })
            const colorModeControl = colorModeButton
            await expect(languageButton).toBeVisible()
            await expect(colorModeButton).toBeVisible()
            await expect(page.locator('[data-testid="runtime-language-switcher"]')).toHaveCount(1)
            await expect(colorModeControl).toHaveCount(1)
            await languageButton.click()
            await expect(page.getByRole('menu')).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'English', exact: true })).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Russian', exact: true })).toBeVisible()
            await page.getByRole('menuitem', { name: 'Russian', exact: true }).click()
            const russianNavigation = page.getByRole('navigation', { name: 'Навигация приложения', exact: true })
            await expect(russianNavigation.getByRole('link', { name: 'Добро пожаловать', exact: true })).toBeVisible()
            await expect(page).toHaveURL(/(?:\?|&)locale=ru(?:&|$)/u)

            const localizedColorModeButton = headerActions.getByRole('button', { name: 'Цветовая схема', exact: true })
            await expect(localizedColorModeButton).toBeVisible()
            await localizedColorModeButton.click()
            await expect(page.getByRole('menuitem', { name: 'Системная', exact: true })).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Светлая', exact: true })).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Тёмная', exact: true })).toBeVisible()
            await testInfo.attach('dashboard-header-theme-menu-ru.png', {
                body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })
            await page.getByRole('menuitem', { name: 'Тёмная', exact: true }).click()
            await expect(page.locator('html')).toHaveAttribute('data-mui-color-scheme', 'dark')
            await testInfo.attach('dashboard-header-dark-theme-ru.png', {
                body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })

            await page.reload()
            await expect(page).toHaveURL(/(?:\?|&)locale=ru(?:&|$)/u)
            await expect(page.locator('html'), 'The selected Dashboard theme must persist across reload').toHaveAttribute(
                'data-mui-color-scheme',
                'dark'
            )
            await expect(page.getByTestId('runtime-language-switcher')).toHaveCount(1)
            await expect(page.locator('[data-screenshot="toggle-mode"]')).toHaveCount(1)
            await expect(page.getByRole('navigation', { name: 'Навигация приложения', exact: true })).toBeVisible()

            await languageButton.click()
            await expect(page.getByRole('menuitem', { name: 'Английский', exact: true })).toBeVisible()
            await page.getByRole('menuitem', { name: 'Английский', exact: true }).click()
            await expect(navigation.getByRole('link', { name: 'Welcome', exact: true })).toBeVisible()
            await expect(page).toHaveURL(/(?:\?|&)locale=en(?:&|$)/u)
            await expect(page.locator('html'), 'Switching language must preserve the selected dark theme').toHaveAttribute(
                'data-mui-color-scheme',
                'dark'
            )
            await testInfo.attach('dashboard-header-dark-theme-en.png', {
                body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })

            await headerActions.getByRole('button', { name: 'Color mode', exact: true }).click()
            await expect(page.getByRole('menuitem', { name: 'System', exact: true })).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Light', exact: true })).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Dark', exact: true })).toBeVisible()
            await page.getByRole('menuitem', { name: 'Light', exact: true }).click()
            await expect(page.locator('html')).toHaveAttribute('data-mui-color-scheme', 'light')

            // Exercise the same invalid localized field under the Russian
            // application locale; the error must be translated for the user.
            await switchRuntimeLocale(page, 'ru')
            const russianLanguageButton = page.getByTestId('runtime-language-switcher')
            const russianColorModeControl = headerActions.getByRole('button', { name: 'Цветовая схема', exact: true })
            await expect(page.locator('[data-testid="runtime-language-switcher"]')).toHaveCount(1)
            await expect(russianColorModeControl).toHaveCount(1)
            await expect(russianLanguageButton).toBeVisible()
            await expect(headerActions.getByRole('button', { name: 'Цветовая схема', exact: true })).toBeVisible()

            const russianInitialViewport = page.viewportSize() ?? { width: 1280, height: 720 }
            for (const viewport of [
                { name: 'desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await waitForLayoutFrame(page)
                const headerBounds = await runtimeHeader.boundingBox()
                const actionsBounds = await headerActions.boundingBox()
                const languageBounds = await russianLanguageButton.boundingBox()
                const colorModeBounds = await russianColorModeControl.boundingBox()
                expect(headerBounds, `Russian Dashboard header must be measurable at ${viewport.name}`).not.toBeNull()
                expect(actionsBounds, `Russian Dashboard header controls must be measurable at ${viewport.name}`).not.toBeNull()
                expect(languageBounds, `Russian Dashboard language control must be measurable at ${viewport.name}`).not.toBeNull()
                expect(colorModeBounds, `Russian Dashboard theme control must be measurable at ${viewport.name}`).not.toBeNull()
                expect(
                    Math.abs(headerBounds!.x + headerBounds!.width - (actionsBounds!.x + actionsBounds!.width)),
                    `Russian Dashboard header controls must remain right-aligned at ${viewport.name}`
                ).toBeLessThanOrEqual(16)
                expect(
                    languageBounds!.x + languageBounds!.width <= colorModeBounds!.x + 2 ||
                        colorModeBounds!.x + colorModeBounds!.width <= languageBounds!.x + 2,
                    `Russian Dashboard language and theme controls must not overlap at ${viewport.name}`
                ).toBe(true)
                await expect(page.locator('[data-testid="runtime-language-switcher"]')).toHaveCount(1)
                await expect(russianColorModeControl).toHaveCount(1)
                await expectLocatorFullyFitsViewport(russianLanguageButton, `Russian language control at ${viewport.name}`)
                await expectLocatorFullyFitsViewport(russianColorModeControl, `Russian theme control at ${viewport.name}`)
                await expectNoPageHorizontalOverflow(page, `Russian Dashboard header at ${viewport.name}`)
                if (viewport.name === 'mobile') {
                    await testInfo.attach('dashboard-header-russian-mobile-390.png', {
                        body: await page.screenshot({ animations: 'disabled' }),
                        contentType: 'image/png'
                    })
                }
            }
            await page.setViewportSize(russianInitialViewport)
            await waitForLayoutFrame(page)

            const russianEntityTable = page.getByTestId('dashboard-entity-table')
            await expect(russianEntityTable).toBeVisible({ timeout: 30_000 })
            await russianEntityTable.getByTestId('records-union-create-target-menu-button').click()
            await page.getByRole('menuitem', { name: 'Main', exact: true }).click()
            const russianCreateDialog = page.getByRole('dialog').first()
            await expect(russianCreateDialog).toBeVisible({ timeout: 15_000 })
            const russianTitleInput = russianCreateDialog.getByRole('textbox').first()
            await russianTitleInput.fill('x')
            await russianTitleInput.blur()
            await expect(
                russianCreateDialog.getByText('Введите от 3 до 255 символов в переводе на русский язык.', { exact: true })
            ).toBeVisible()
            await expect(russianCreateDialog.getByTestId(entityDialogSelectors.submitButton)).toBeDisabled()
            await expectLocalizedValidation(russianCreateDialog, 'ru', { label: 'Dashboard create dialog Russian validation' })
            await testInfo.attach('dashboard-create-validation-ru.png', {
                body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })
            await russianCreateDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
            await expect(russianCreateDialog).toBeHidden()

            await switchRuntimeLocale(page, 'en')
            await expect(page.getByTestId('dashboard-entity-table')).toBeVisible({ timeout: 30_000 })

            const entityTable = page.getByTestId('dashboard-entity-table')
            await expect(entityTable).toBeVisible({ timeout: 30_000 })
            await expect(entityTable.getByText(sourceOnlyTitle, { exact: true })).toHaveCount(0)
            await expectNoPageHorizontalOverflow(page, 'Empty entity-backed Dashboard table at desktop width')

            // Authored view settings reach the runtime: the toolbar exposes the
            // card/table toggle and the search field.
            const cardViewButton = entityTable.getByRole('button', { name: 'Card view' })
            const tableViewButton = entityTable.getByRole('button', { name: 'Table view' })
            await expect(cardViewButton).toBeVisible({ timeout: 30_000 })
            await expect(tableViewButton).toBeVisible()
            await expect(tableViewButton).toHaveAttribute('aria-pressed', 'true')

            const searchField = entityTable.getByRole('textbox', { name: 'Search records' })
            await expect(searchField).toBeVisible()

            const createMenuButton = entityTable.getByRole('button', { name: 'Create', exact: true })
            await expect(createMenuButton).toBeVisible()
            const createDialogInitialViewport = page.viewportSize()
            for (const viewport of [
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await waitForLayoutFrame(page)
                await createMenuButton.click()
                await page.getByRole('menuitem', { name: 'Main', exact: true }).click()
                const responsiveCreateDialog = page.getByRole('dialog').first()
                await expect(responsiveCreateDialog).toBeVisible({ timeout: 15_000 })
                await expectSemanticFieldControls(responsiveCreateDialog, {
                    longTextLabels: ['Description', 'Instructions'],
                    forbiddenEditableIdLabels: forbiddenDashboardRuntimeIdLabels
                })
                await expect(responsiveCreateDialog.getByTestId(entityDialogSelectors.submitButton)).toBeVisible()
                await expect(responsiveCreateDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
                await expectNoDashboardRuntimeHandles(responsiveCreateDialog, `Dashboard create dialog at ${viewport.name}`)
                await expectNoPageHorizontalOverflow(page, `Dashboard create dialog at ${viewport.name}`)
                await testInfo.attach(`dashboard-create-dialog-${viewport.name}-en.png`, {
                    body: await page.screenshot({ animations: 'disabled' }),
                    contentType: 'image/png'
                })
                await responsiveCreateDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
                await expect(responsiveCreateDialog).toBeHidden()
            }
            if (createDialogInitialViewport) {
                await page.setViewportSize(createDialogInitialViewport)
                await waitForLayoutFrame(page)
            }

            const firstCreateRequest = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'POST' && url.pathname === `/api/v1/applications/${applicationId}/runtime/rows`
                },
                { label: 'Creating the first row from the rebound Entity source' }
            )
            await createMenuButton.click()
            await page.getByRole('menuitem', { name: 'Main', exact: true }).click()
            const createDialog = page.getByRole('dialog').first()
            await expect(createDialog).toBeVisible({ timeout: 15_000 })
            await expectSemanticFieldControls(createDialog, {
                longTextLabels: ['Description', 'Instructions'],
                forbiddenEditableIdLabels: forbiddenDashboardRuntimeIdLabels
            })
            await expectNoDashboardRuntimeHandles(createDialog, 'Dashboard create dialog')
            const titleInput = createDialog.getByLabel('Title').first()
            await titleInput.fill('x')
            await titleInput.blur()
            await expect(createDialog.getByText('Enter between 3 and 255 characters in English.', { exact: true })).toBeVisible()
            await expect(createDialog.getByTestId(entityDialogSelectors.submitButton)).toBeDisabled()
            await expectLocalizedValidation(createDialog, 'en', { label: 'Dashboard create dialog validation' })
            await titleInput.fill(rowTitle)
            await createDialog.getByLabel('Description').first().fill(longDescription)
            await createDialog.getByLabel('Cover').first().fill('https://example.test/course-cover.png')
            await createDialog.getByLabel('Instructions').first().fill('Open the course resources in the lesson viewer.')
            await expect(createDialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
            await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
            const firstCreateResponse = await firstCreateRequest
            expect(firstCreateResponse.ok(), 'Creating a row from the rebound Entity source must succeed').toBe(true)
            const firstCreatedRow = (await firstCreateResponse.json()) as { id?: string }
            if (typeof firstCreatedRow.id !== 'string' || !firstCreatedRow.id) {
                throw new Error('The rebound Entity source did not return the created row handle')
            }
            expect(firstCreateResponse.request().postDataJSON()).toMatchObject({ objectCollectionId: alternateObject.id })
            const rawMediaValue = JSON.stringify({ type: 'image', storageKey: 'private/course-cover.png', mimeType: 'image/png' })
            const rawBlockContent = JSON.stringify({ blocks: [{ type: 'paragraph', data: { text: 'Private lesson instructions' } }] })
            const internalRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073990'
            const internalUserId = 'usr_internal_48392'
            const unsafeValueUpdate = await sendWithCsrf(
                api,
                'PATCH',
                `/api/v1/applications/${applicationId}/runtime/rows/${firstCreatedRow.id}`,
                {
                    objectCollectionId: alternateObject.id,
                    data: {
                        Cover: createLocalizedContent('en', rawMediaValue),
                        Instructions: createLocalizedContent('en', rawBlockContent),
                        ProjectId: createLocalizedContent('en', internalRecordId),
                        OwnerId: createLocalizedContent('en', internalUserId)
                    }
                }
            )
            expect(unsafeValueUpdate.ok, 'Saving the structured and technical field display fixture must succeed').toBe(true)
            const persistedFirstRow = await getRuntimeRow(api, applicationId, firstCreatedRow.id, {
                objectCollectionId: alternateObject.id
            })
            const collectPersistedStrings = (value: unknown): string[] => {
                if (typeof value === 'string') return [value]
                if (Array.isArray(value)) return value.flatMap(collectPersistedStrings)
                if (typeof value === 'object' && value !== null) {
                    return Object.values(value).flatMap(collectPersistedStrings)
                }
                return []
            }
            const persistedStrings = collectPersistedStrings((persistedFirstRow as { data?: unknown }).data)
            expect(persistedStrings).toContain(rowTitle)
            expect(persistedStrings.some((value) => value.includes(longDescription.trimEnd()))).toBe(true)
            for (const rawValue of [rawMediaValue, rawBlockContent, internalRecordId, internalUserId]) {
                expect(persistedStrings).toContain(rawValue)
            }

            await page.reload()
            await expect(entityTable).toBeVisible({ timeout: 30_000 })
            await expect(entityTable.getByText(rowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            for (const label of ['Cover', 'Instructions', 'Project ID', 'Owner ID']) {
                await expect(entityTable.getByRole('columnheader', { name: label, exact: true })).toHaveCount(0)
            }
            for (const value of [rawMediaValue, rawBlockContent, internalRecordId, internalUserId]) {
                await expect(entityTable.getByText(value, { exact: true })).toHaveCount(0)
            }
            await expectNoTechnicalLeakage(entityTable, {
                label: 'Entity-backed Dashboard structured-value table',
                checkUuidSubstrings: true
            })
            await cardViewButton.click()
            await expect(entityTable.getByText(rowTitle, { exact: true })).toBeVisible()
            for (const value of [rawMediaValue, rawBlockContent, internalRecordId, internalUserId]) {
                await expect(entityTable.getByText(value, { exact: true })).toHaveCount(0)
            }
            await expectNoTechnicalLeakage(entityTable, {
                label: 'Entity-backed Dashboard structured-value cards',
                checkUuidSubstrings: true
            })
            await tableViewButton.click()

            await expect(entityTable.getByText(rowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(entityTable.getByRole('columnheader', { name: 'Title' })).toBeVisible()

            const secondCreateRequest = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'POST' && url.pathname === `/api/v1/applications/${applicationId}/runtime/rows`
                },
                { label: 'Creating a second Entity-backed dashboard row' }
            )
            await createMenuButton.click()
            await page.getByRole('menuitem', { name: 'Main', exact: true }).click()
            const secondCreateDialog = page.getByRole('dialog').first()
            await expect(secondCreateDialog).toBeVisible({ timeout: 15_000 })
            await expectNoDashboardRuntimeHandles(secondCreateDialog, 'Dashboard second create dialog')
            await secondCreateDialog.getByLabel('Title').first().fill(secondRowTitle)
            await secondCreateDialog.getByLabel('Cover').first().fill('https://example.test/course-cover-beta.png')
            await secondCreateDialog.getByLabel('Instructions').first().fill('Review the course resources before continuing.')
            await expect(secondCreateDialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
            await secondCreateDialog.getByTestId(entityDialogSelectors.submitButton).click()
            const secondCreateResponse = await secondCreateRequest
            expect(secondCreateResponse.ok()).toBe(true)
            const secondCreatedRow = (await secondCreateResponse.json()) as { id?: string }
            if (typeof secondCreatedRow.id !== 'string' || !secondCreatedRow.id) {
                throw new Error('Second Entity-backed Dashboard row response has no row handle')
            }
            await expect(entityTable.getByText(secondRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })

            const sourceRow = entityTable.getByRole('row').filter({ hasText: secondRowTitle })
            await sourceRow.getByRole('button', { name: `Actions for ${secondRowTitle}`, exact: true }).click()
            await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
            const copyDialog = page.getByRole('dialog', { name: 'Copy element', exact: true })
            await expect(copyDialog).toBeVisible()
            await expectNoDashboardRuntimeHandles(copyDialog, 'Dashboard copy dialog')
            await copyDialog.getByLabel('Title').first().fill(copiedRowTitle)
            const copyRequest = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return (
                        response.request().method() === 'POST' &&
                        url.pathname.startsWith(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                        url.pathname.endsWith('/copy')
                    )
                },
                { label: 'Copying an Entity-backed Dashboard row' }
            )
            await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()
            const copyResponse = await copyRequest
            expect(copyResponse.ok(), 'Entity-backed Dashboard row copy must succeed').toBe(true)
            const copiedRowResponse = (await copyResponse.json()) as { id?: string }
            if (typeof copiedRowResponse.id !== 'string' || !copiedRowResponse.id) {
                throw new Error('Copied Dashboard row response has no row handle')
            }
            await expect(entityTable.getByText(copiedRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(entityTable.getByText(secondRowTitle, { exact: true })).toBeVisible()

            const copiedRowView = entityTable.getByRole('row').filter({ hasText: copiedRowTitle })
            const editDialogInitialViewport = page.viewportSize()
            await page.setViewportSize({ width: 390, height: 844 })
            await waitForLayoutFrame(page)
            await copiedRowView.getByRole('button', { name: `Actions for ${copiedRowTitle}`, exact: true }).click()
            await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
            const copyEditDialog = page.getByRole('dialog', { name: 'Edit element', exact: true })
            await expect(copyEditDialog).toBeVisible()
            await expectSemanticFieldControls(copyEditDialog, {
                longTextLabels: ['Description', 'Instructions'],
                forbiddenEditableIdLabels: forbiddenDashboardRuntimeIdLabels
            })
            await expectNoDashboardRuntimeHandles(copyEditDialog, 'Dashboard copied-record edit dialog')
            await expect(copyEditDialog.getByTestId(entityDialogSelectors.submitButton)).toBeVisible()
            await expect(copyEditDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
            await expectNoPageHorizontalOverflow(page, 'Dashboard edit dialog at mobile width')
            await testInfo.attach('dashboard-edit-dialog-mobile-390-en.png', {
                body: await page.screenshot({ animations: 'disabled' }),
                contentType: 'image/png'
            })
            await copyEditDialog.getByLabel('Title').first().fill(editedCopyTitle)
            const runtimeRowPathPrefix = `/api/v1/applications/${applicationId}/runtime/rows/`
            const isRuntimeRowMutationPath = (pathname: string) => {
                const rowReference = pathname.startsWith(runtimeRowPathPrefix) ? pathname.slice(runtimeRowPathPrefix.length) : ''
                return Boolean(rowReference) && !rowReference.includes('/')
            }
            const copyEditRequest = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'PATCH' && isRuntimeRowMutationPath(url.pathname)
                },
                { label: 'Editing the copied Entity-backed Dashboard row' }
            )
            await copyEditDialog.getByTestId(entityDialogSelectors.submitButton).click()
            expect((await copyEditRequest).ok(), 'Editing a copied Dashboard row must succeed').toBe(true)
            await expect(entityTable.getByText(editedCopyTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(entityTable.getByText(secondRowTitle, { exact: true })).toBeVisible()
            if (editDialogInitialViewport) {
                await page.setViewportSize(editDialogInitialViewport)
                await waitForLayoutFrame(page)
            }
            await page.reload()
            await expect(entityTable.getByText(editedCopyTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(entityTable.getByText(secondRowTitle, { exact: true })).toBeVisible()

            const copiedRowAfterReload = entityTable.getByRole('row').filter({ hasText: editedCopyTitle })
            await copiedRowAfterReload.getByRole('button', { name: `Actions for ${editedCopyTitle}`, exact: true }).click()
            await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
            const copyDeleteDialog = page.getByRole('dialog')
            await expect(copyDeleteDialog).toBeVisible()
            await expectNoDashboardRuntimeHandles(copyDeleteDialog, 'Dashboard copied-record delete dialog')
            const copyDeleteResponsePromise = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'DELETE' && isRuntimeRowMutationPath(url.pathname)
                },
                { label: 'Deleting the copied Entity-backed Dashboard row' }
            )
            await page.getByTestId(confirmDeleteSelectors.confirmButton).click()
            const copyDeleteResponse = await copyDeleteResponsePromise
            expect(copyDeleteResponse.ok(), 'Deleting the copied Dashboard row must succeed').toBe(true)
            await expect(entityTable.getByText(editedCopyTitle, { exact: true })).toHaveCount(0)
            await expect(entityTable.getByText(secondRowTitle, { exact: true })).toBeVisible()

            bootstrapApi = await createBootstrapApiContext()
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const requiredRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
                .split(',')
                .map((codename) => codename.trim().toLowerCase())
                .filter(Boolean)
            const roleIds = requiredRoleCodenames.map((codename) => {
                const roleId = assignableRoles.find((role: { codename?: unknown }) => String(role.codename).toLowerCase() === codename)?.id
                if (typeof roleId !== 'string') throw new Error(`Assignable global role ${codename} was not found`)
                return roleId
            })
            const createdMember = await createAdminUser(bootstrapApi, {
                ...memberCredentials,
                roleIds,
                comment: `Dashboard runtime permission coverage ${runManifest.runId}`
            })
            if (!createdMember?.userId) throw new Error('Dashboard runtime member account was not created')
            await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberCredentials.email })
            await waitForUser(memberCredentials)
            await addApplicationMember(api, applicationId, { email: memberCredentials.email, role: 'member' })
            memberApi = await createLoggedInApiContext(memberCredentials)
            memberBrowser = await createLoggedInBrowserContext(browser, memberCredentials)
            await memberBrowser.page.goto(`/a/${applicationId}`)
            const memberTable = memberBrowser.page.getByTestId('dashboard-entity-table')
            await expect(memberTable).toBeVisible({ timeout: 30_000 })
            await expect(memberTable.getByText(secondRowTitle, { exact: true })).toBeVisible()
            await expect(memberTable.getByRole('button', { name: /^Actions for /u })).toHaveCount(0)
            const persistedSourceBeforeDenial = await getRuntimeRow(api, applicationId, secondCreatedRow.id, {
                objectCollectionId: alternateObject.id
            })
            const sourceVersion = Number(persistedSourceBeforeDenial?.version ?? persistedSourceBeforeDenial?.data?._upl_version)
            if (!Number.isSafeInteger(sourceVersion) || sourceVersion < 1) {
                throw new Error('The protected Dashboard source row did not expose its current optimistic version')
            }
            const forbiddenEditResponse = await sendWithCsrf(
                memberApi,
                'PATCH',
                `/api/v1/applications/${applicationId}/runtime/rows/${secondCreatedRow.id}`,
                {
                    objectCollectionId: alternateObject.id,
                    expectedVersion: sourceVersion,
                    data: { Title: 'Unauthorized Dashboard edit' }
                }
            )
            expect(forbiddenEditResponse.status).toBe(403)
            const persistedSourceAfterDenial = await getRuntimeRow(api, applicationId, secondCreatedRow.id, {
                objectCollectionId: alternateObject.id
            })
            expect(persistedSourceAfterDenial?.data?.Title ?? persistedSourceAfterDenial?.Title).toEqual(
                persistedSourceBeforeDenial?.data?.Title ?? persistedSourceBeforeDenial?.Title
            )

            const createdRow = entityTable.getByRole('row').filter({ hasText: rowTitle })
            await createdRow.getByRole('button', { name: `Actions for ${rowTitle}`, exact: true }).click()
            await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
            const editDialog = page.getByRole('dialog').first()
            await expect(editDialog).toBeVisible({ timeout: 15_000 })
            await expectSemanticFieldControls(editDialog, {
                longTextLabels: ['Description', 'Instructions'],
                forbiddenEditableIdLabels: forbiddenDashboardRuntimeIdLabels
            })
            // The STRING fixture intentionally contains JSON-shaped text to test table/card projection; edit controls must still hide UUIDs and opaque runtime handles.
            await expectNoDashboardRuntimeHandles(editDialog, 'Dashboard record edit dialog', { checkJsonLikeText: false })
            await editDialog.getByLabel('Title').first().fill(editedRowTitle)
            const editRequest = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'PATCH' && isRuntimeRowMutationPath(url.pathname)
                },
                { label: 'Editing an Entity-backed dashboard row' }
            )
            await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
            expect((await editRequest).ok(), 'Entity-backed dashboard row edit must succeed').toBe(true)
            await expect(entityTable.getByText(editedRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await page.reload()
            await expect(entityTable.getByText(editedRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })

            // Keep a second authenticated owner session on the old row
            // version, then prove the UI reports the optimistic conflict and
            // preserves the winning update.
            staleBrowser = await createLoggedInBrowserContext(browser, {
                email: runManifest.testUser.email,
                password: runManifest.testUser.password
            })
            await staleBrowser.page.goto(`/a/${applicationId}`)
            const staleTable = staleBrowser.page.getByTestId('dashboard-entity-table')
            await expect(staleTable.getByText(editedRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            const staleRow = staleTable.getByRole('row').filter({ hasText: editedRowTitle })
            await staleRow.getByRole('button', { name: `Actions for ${editedRowTitle}`, exact: true }).click()
            await staleBrowser.page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
            const staleEditDialog = staleBrowser.page.getByRole('dialog', { name: 'Edit element', exact: true })
            await expect(staleEditDialog).toBeVisible()
            await expectSemanticFieldControls(staleEditDialog, {
                longTextLabels: ['Description', 'Instructions'],
                forbiddenEditableIdLabels: forbiddenDashboardRuntimeIdLabels
            })
            await expectNoDashboardRuntimeHandles(staleEditDialog, 'Dashboard stale-record edit dialog', { checkJsonLikeText: false })
            await expect(staleEditDialog.getByLabel('Title').first()).toHaveValue(editedRowTitle)

            const winningRow = entityTable.getByRole('row').filter({ hasText: editedRowTitle })
            await winningRow.getByRole('button', { name: `Actions for ${editedRowTitle}`, exact: true }).click()
            await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
            const winningEditDialog = page.getByRole('dialog', { name: 'Edit element', exact: true })
            await expect(winningEditDialog).toBeVisible()
            await expectSemanticFieldControls(winningEditDialog, {
                longTextLabels: ['Description', 'Instructions'],
                forbiddenEditableIdLabels: forbiddenDashboardRuntimeIdLabels
            })
            await expectNoDashboardRuntimeHandles(winningEditDialog, 'Dashboard current-record edit dialog', { checkJsonLikeText: false })
            await winningEditDialog.getByLabel('Title').first().fill(winningRowTitle)
            const winningEditRequest = waitForSettledMutationResponse(
                page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'PATCH' && isRuntimeRowMutationPath(url.pathname)
                },
                { label: 'Saving the current Dashboard row version' }
            )
            await winningEditDialog.getByTestId(entityDialogSelectors.submitButton).click()
            const winningEditResponse = await winningEditRequest
            expect(winningEditResponse.ok(), 'The current Dashboard row version must save').toBe(true)
            const winningEditPayload = winningEditResponse.request().postDataJSON() as { expectedVersion?: unknown }
            expect(Number.isSafeInteger(winningEditPayload.expectedVersion)).toBe(true)
            expect(Number(winningEditPayload.expectedVersion)).toBeGreaterThan(0)
            await expect(entityTable.getByText(winningRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })

            await staleEditDialog.getByLabel('Title').first().fill(staleRowTitle)
            const staleEditRequest = waitForSettledMutationResponse(
                staleBrowser.page,
                (response) => {
                    const url = new URL(response.url())
                    return response.request().method() === 'PATCH' && isRuntimeRowMutationPath(url.pathname)
                },
                { label: 'Rejecting a stale Dashboard row edit' }
            )
            await staleEditDialog.getByTestId(entityDialogSelectors.submitButton).click()
            const staleEditResponse = await staleEditRequest
            const staleEditPayload = staleEditResponse.request().postDataJSON() as { expectedVersion?: unknown }
            expect(staleEditPayload.expectedVersion).toBe(winningEditPayload.expectedVersion)
            expect(staleEditResponse.status()).toBe(409)
            expect(await staleEditResponse.json()).toMatchObject({ code: 'RUNTIME_RECORD_VERSION_CONFLICT' })
            await expect(staleEditDialog.getByRole('alert')).toContainText(
                'Update failed: This record changed after you opened it. Reload the record and try again.'
            )

            const persistedWinningRow = await getRuntimeRow(api, applicationId, firstCreatedRow.id, {
                objectCollectionId: alternateObject.id
            })
            expect(JSON.stringify(persistedWinningRow)).toContain(winningRowTitle)
            expect(JSON.stringify(persistedWinningRow)).not.toContain(staleRowTitle)
            await staleBrowser.page.reload()
            await expect(staleTable.getByText(winningRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(staleTable.getByText(staleRowTitle, { exact: true })).toHaveCount(0)

            await searchField.fill(`missing-${runManifest.runId}`)
            await expect(entityTable.getByText(winningRowTitle, { exact: true })).toHaveCount(0)
            await searchField.fill(winningRowTitle)
            await expect(entityTable.getByText(winningRowTitle, { exact: true })).toBeVisible()
            await expect(entityTable.getByText(secondRowTitle, { exact: true })).toHaveCount(0)
            await expect(entityTable.getByRole('row').filter({ hasText: winningRowTitle })).toHaveCount(1)
            await expect(entityTable.getByRole('button', { name: `Move ${rowTitle} up`, exact: true })).toHaveCount(0)
            await expect(entityTable.getByRole('button', { name: `Move ${rowTitle} down`, exact: true })).toHaveCount(0)
            await searchField.fill('')

            // The authored card view renders the created row as a card.
            await cardViewButton.click()
            await expect(cardViewButton).toHaveAttribute('aria-pressed', 'true')
            await expect(entityTable.getByText(winningRowTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expectNoTechnicalLeakage(entityTable, { label: 'Entity-backed Dashboard cards', checkUuidSubstrings: true })
            await tableViewButton.click()
            await expect(tableViewButton).toHaveAttribute('aria-pressed', 'true')

            const runtimeRows = entityTable.getByRole('rowgroup').nth(1).getByRole('row')
            await expect(runtimeRows).toHaveCount(2, { timeout: 30_000 })
            const beforeOrder = await Promise.all([0, 1].map(async (index) => runtimeRows.nth(index).getByRole('cell').nth(1).innerText()))
            const firstRow = runtimeRows.nth(0)
            const firstRowLabel = beforeOrder[0]
            if (!firstRowLabel) throw new Error('The first dashboard row did not expose a visible title')
            const moveFirstRowDown = firstRow.getByRole('button', { name: `Move ${firstRowLabel} down`, exact: true })
            await expect(moveFirstRowDown).toBeEnabled({ timeout: 30_000 })
            const reorderResponsePromise = page.waitForResponse(
                (response) => {
                    const url = new URL(response.url())
                    return (
                        response.request().method() === 'POST' &&
                        url.pathname === `/api/v1/applications/${applicationId}/runtime/rows/reorder`
                    )
                },
                { timeout: 30_000 }
            )
            await moveFirstRowDown.focus()
            await moveFirstRowDown.press('Enter')
            const reorderResponse = await reorderResponsePromise
            expect(reorderResponse.ok(), 'Entity-backed dashboard row reorder must succeed').toBe(true)
            const reorderBody = reorderResponse.request().postDataJSON() as {
                objectCollectionId?: string
                orderedRowIds?: string[]
                expectedVersionsByRowId?: Record<string, number>
            }
            expect(reorderBody.objectCollectionId).toBe(alternateObject.id)
            expect(reorderBody.orderedRowIds).toHaveLength(2)
            expect(new Set(reorderBody.orderedRowIds).size).toBe(2)
            expect(reorderBody.orderedRowIds?.every((id) => /^rh1\.[A-Za-z0-9_-]+$/u.test(id))).toBe(true)
            expect(Object.keys(reorderBody.expectedVersionsByRowId ?? {}).sort()).toEqual([...(reorderBody.orderedRowIds ?? [])].sort())
            expect(
                Object.values(reorderBody.expectedVersionsByRowId ?? {}).every((version) => Number.isSafeInteger(version) && version > 0)
            ).toBe(true)
            await expect
                .poll(async () => Promise.all([0, 1].map(async (index) => runtimeRows.nth(index).getByRole('cell').nth(1).innerText())))
                .toEqual([beforeOrder[1], beforeOrder[0]])
            await expectNoTechnicalLeakage(entityTable, { label: 'Entity-backed Dashboard table', checkUuidSubstrings: true })
            const runtimeTableContainer = entityTable.getByTestId('runtime-list-surface')
            await expect(runtimeTableContainer).toBeVisible()

            await page.reload()
            await expect(entityTable).toBeVisible({ timeout: 30_000 })
            await expect
                .poll(async () => Promise.all([0, 1].map(async (index) => runtimeRows.nth(index).getByRole('cell').nth(1).innerText())))
                .toEqual([beforeOrder[1], beforeOrder[0]])

            for (const viewport of [
                { name: 'desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await waitForLayoutFrame(page)
                const headerBounds = await runtimeHeader.boundingBox()
                const actionsBounds = await headerActions.boundingBox()
                const languageBounds = await languageButton.boundingBox()
                const colorModeBounds = await colorModeControl.boundingBox()
                expect(headerBounds, `Dashboard header must be measurable at ${viewport.name}`).not.toBeNull()
                expect(actionsBounds, `Dashboard header controls must be measurable at ${viewport.name}`).not.toBeNull()
                expect(languageBounds, `Dashboard language control must be measurable at ${viewport.name}`).not.toBeNull()
                expect(colorModeBounds, `Dashboard theme control must be measurable at ${viewport.name}`).not.toBeNull()
                expect(
                    Math.abs(headerBounds!.x + headerBounds!.width - (actionsBounds!.x + actionsBounds!.width)),
                    `Language and theme controls must remain right-aligned at ${viewport.name}`
                ).toBeLessThanOrEqual(16)
                const controlGroupRight = Math.max(languageBounds!.x + languageBounds!.width, colorModeBounds!.x + colorModeBounds!.width)
                expect(
                    Math.abs(headerBounds!.x + headerBounds!.width - controlGroupRight),
                    `Visible language and theme controls must reach the right edge at ${viewport.name}`
                ).toBeLessThanOrEqual(4)
                expect(languageBounds!.x).toBeGreaterThanOrEqual(0)
                expect(colorModeBounds!.x).toBeGreaterThanOrEqual(0)
                expect(languageBounds!.x + languageBounds!.width).toBeLessThanOrEqual(viewport.width + 2)
                expect(colorModeBounds!.x + colorModeBounds!.width).toBeLessThanOrEqual(viewport.width + 2)
                expect(
                    languageBounds!.x + languageBounds!.width <= colorModeBounds!.x + 2 ||
                        colorModeBounds!.x + colorModeBounds!.width <= languageBounds!.x + 2,
                    `Language and theme controls must not overlap at ${viewport.name}`
                ).toBe(true)
                await expect(languageButton).toBeVisible()
                await expect(colorModeButton).toBeVisible()
                await expect(page.locator('[data-testid="runtime-language-switcher"]')).toHaveCount(1)
                await expect(colorModeControl).toHaveCount(1)
                await expectNoPageHorizontalOverflow(page, `Entity-backed Dashboard reorder ${viewport.name}`)
                await expectTableHorizontalScrollConstrained(runtimeTableContainer, `Entity-backed Dashboard table ${viewport.name}`)
                await testInfo.attach(`dashboard-entity-table-reorder-${viewport.name}-${viewport.width}x${viewport.height}`, {
                    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                    contentType: 'image/png'
                })
            }
        } finally {
            await staleBrowser?.context.close()
            await memberBrowser?.context.close()
            if (memberApi) await disposeApiContext(memberApi)
            if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
            await disposeApiContext(api)
        }
    })
})
