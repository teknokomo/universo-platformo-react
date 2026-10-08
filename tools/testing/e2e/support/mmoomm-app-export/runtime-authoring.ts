import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect } from '../../fixtures/test'
import {
    getApplication,
    createComponent,
    createRecord,
    listConnectors,
    listComponents,
    listLayoutZoneWidgets,
    createLayout,
    listObjectCollections,
    listPublicationApplications
} from '../backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedPublication } from '../backend/run-manifest.mjs'
import { applyBrowserPreferences } from '../browser/preferences'
import { waitForSettledMutationResponse } from '../browser/network'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectSemanticFieldControls } from '../browser/runtimeUx'
import { entityDialogSelectors, toolbarSelectors } from '../selectors/contracts'
import { createCodenameVLC, createLocalizedContent, updateLocalizedContentLocale } from '@universo-react/utils'
import { expectPlayCanvasEditorFullscreenHost, expectPlayCanvasEditorIframeLoaded } from '../playcanvasEditorAuthoring'
import { expectMmoommRuntimeReady, expectMmoommVisualLinkupLabRuntimeReady } from '../mmoommRuntimeProof'
import { MMOOMM_OVERVIEW_TITLE_BY_LOCALE } from '../mmoommRuntimeProof.navigation'
import { APP_RUNTIME_TIMEOUT, localizedInput } from '../mmoommAppGeneratorData'
import {
    apiGet,
    parseJsonResponse,
    fillLocalizedInlineField,
    readCodenameText,
    publishedManifestSelectValuePrefix,
    requireProjectInstanceByName
} from './shared'
import type {
    ApiContext,
    CreatedEntityResponse,
    TargetedPublishedRuntimeManifestSummary,
    PlayCanvasWidgetRuntimeOptions,
    BrowserCreatedApplicationResponse
} from './shared'
import { openProjectEditDialogPlayCanvasTab } from './metahub-authoring'

const createPublicationThroughBrowser = async (page: Page, metahubId: string, values: { name: { en: string; ru: string } }) => {
    await page.goto(`/metahub/${metahubId}/publications`)
    await expect(page.getByRole('heading', { name: 'Publications' })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create Publication' })
    await expect(dialog).toBeVisible()
    await fillLocalizedInlineField(page, dialog, 'Name', values.name)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/publications`),
        { label: 'Creating MMOOMM runtime publication through UI', timeout: 90_000 }
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    const created = await parseJsonResponse<CreatedEntityResponse>(await createResponse, 'Creating MMOOMM runtime publication through UI')
    await expect(dialog).toHaveCount(0)
    const publicationId = created.id ?? created.data?.id
    if (typeof publicationId !== 'string') {
        throw new Error('MMOOMM app generator UI publication creation did not receive a publication id')
    }
    await expect(page.getByText(values.name.en, { exact: true })).toBeVisible()
    await recordCreatedPublication({ id: publicationId, metahubId, schemaName: null })
    return publicationId
}

const createPublicationLinkedApplicationThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    publicationId: string,
    values: { name: { en: string; ru: string } }
) => {
    await page.goto(`/metahub/${metahubId}/publication/${publicationId}/applications`)
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Applications', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const dialog = page.getByRole('dialog', { name: 'Create Application' })
    await expect(dialog).toBeVisible()
    await fillLocalizedInlineField(page, dialog, 'Name', values.name)
    await expect(dialog.getByText('After the application and connector are created')).toBeVisible()

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/publication/${publicationId}/applications`),
        { label: 'Creating MMOOMM runtime linked application through UI', timeout: 90_000 }
    )
    await dialog.getByRole('button', { name: 'Create' }).click()
    const created = await parseJsonResponse<BrowserCreatedApplicationResponse>(
        await createResponse,
        'Creating MMOOMM runtime linked application through UI'
    )
    await expect(dialog).toHaveCount(0, { timeout: 30_000 })

    let applicationId = created.application?.id ?? created.data?.application?.id ?? created.data?.id ?? created.id
    let connectorId = created.connector?.id ?? created.data?.connector?.id

    await expect
        .poll(
            async () => {
                const payload = await listPublicationApplications(api, metahubId, publicationId)
                const application = (payload.items ?? []).find(
                    (item: { id?: string; name?: { locales?: Record<string, { content?: string }> } }) =>
                        Object.values(item.name?.locales ?? {}).some((localeValue) => localeValue?.content === values.name.en)
                )
                applicationId = applicationId ?? application?.id
                return typeof applicationId === 'string'
            },
            { timeout: 60_000 }
        )
        .toBe(true)

    if (typeof applicationId !== 'string') {
        throw new Error('MMOOMM app generator UI application creation did not receive an application id')
    }

    if (typeof connectorId !== 'string') {
        await expect
            .poll(
                async () => {
                    const payload = await listConnectors(api, applicationId)
                    const connector = payload.items?.[0]
                    connectorId = connector?.id
                    return typeof connectorId === 'string'
                },
                { timeout: 60_000 }
            )
            .toBe(true)
    }

    if (typeof connectorId !== 'string') {
        throw new Error('MMOOMM app generator UI application creation did not expose a connector id')
    }

    await expect(page.getByText(values.name.en, { exact: true })).toBeVisible()
    await recordCreatedApplication({ id: applicationId })
    return { applicationId, connectorId }
}

const createApplicationSchemaThroughConnectorDialog = async (
    page: Page,
    api: ApiContext,
    input: { applicationId: string; connectorId: string }
) => {
    await page.goto(`/a/${input.applicationId}/admin/connector/${input.connectorId}`)
    await expect(page.getByTestId('application-connector-board-schema-card')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('application-connector-board-details-card')).toBeVisible()
    await expectNoTechnicalLeakage(page.getByTestId('application-connector-board-schema-card'), {
        label: 'MMOOMM application connector schema card',
        allowTextPatterns: [/app_[0-9a-f]+/i],
        checkUuidSubstrings: true
    })

    const diffResponsePromise = page.waitForResponse(
        (response) => response.request().method() === 'GET' && response.url().endsWith(`/api/v1/application/${input.applicationId}/diff`),
        { timeout: 60_000 }
    )
    await page.getByTestId('application-connector-board-sync-button').click()
    const diffResponse = await diffResponsePromise
    expect(diffResponse.status()).toBe(200)

    const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
    await expect(diffDialog).toBeVisible({ timeout: 30_000 })
    await expect(diffDialog.getByRole('heading', { name: /schema will be created|following schema will be created/i })).toBeVisible()
    await expectNoTechnicalLeakage(diffDialog, {
        label: 'MMOOMM application connector diff dialog',
        allowTextPatterns: [/app_[0-9a-f]+/i],
        checkUuidSubstrings: true
    })

    const syncResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/application/${input.applicationId}/sync`),
        { label: 'Creating MMOOMM application schema through ConnectorDiffDialog', timeout: APP_RUNTIME_TIMEOUT }
    )
    await diffDialog.getByRole('button', { name: 'Create Schema' }).click()
    const syncResponse = await syncResponsePromise
    expect(syncResponse.status()).toBe(200)
    const syncBody = (await syncResponse.json()) as { status?: string }
    expect(syncBody.status).toBe('created')
    await expect(diffDialog).toHaveCount(0, { timeout: 30_000 })

    await expect
        .poll(
            async () => {
                const persisted = await getApplication(api, input.applicationId)
                return persisted?.schemaStatus ?? null
            },
            { timeout: APP_RUNTIME_TIMEOUT }
        )
        .toBe('synced')
}

export const setEditorDefaultProjectThroughBrowser = async (page: Page, metahubId: string, projectName: string) => {
    await page.goto(`/metahub/${metahubId}/resources`)
    const editorRow = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
    await editorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    const settingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
    const defaultProjectSelect = settingsDialog.getByLabel('Default project')
    await expect(defaultProjectSelect).toBeVisible()
    await defaultProjectSelect.click()
    await expect(page.getByRole('option', { name: projectName })).toBeVisible()
    await page.getByRole('option', { name: projectName }).click()
    const saveButton = settingsDialog.getByRole('button', { name: 'Save' })
    const settingsSave = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'PATCH' && /\/api\/v1\/metahub\/.+\/package\/.+\/config/.test(response.url()),
        { label: `Setting default PlayCanvas project to ${projectName}` }
    )
    await saveButton.click()
    await settingsSave
    await expect(settingsDialog).toHaveCount(0)
}

export const openFullscreenEditorThroughBrowser = async (page: Page, metahubId: string, projectId?: string) => {
    await page.goto(`/metahub/${metahubId}/resources`)
    const editorRow = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
    await editorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    const settingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
    await settingsDialog.getByLabel('Display mode').click()
    await page.getByRole('option', { name: 'Open separately' }).click()
    await settingsDialog.getByRole('button', { name: 'Save' }).click()
    await expect(settingsDialog).toHaveCount(0)

    await page.goto(`/metahub/${metahubId}/resources`)
    const editorRowForOpen = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
    await editorRowForOpen.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
    const editorPopupPromise = page.waitForEvent('popup')
    await page.getByRole('menuitem', { name: 'Open editor' }).click()
    const editorPage = await editorPopupPromise
    await editorPage.waitForLoadState('domcontentloaded')
    await applyBrowserPreferences(editorPage, { language: 'en' })
    if (projectId) {
        await editorPage.goto(
            `/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${encodeURIComponent(projectId)}`
        )
    }
    await expect(editorPage).toHaveURL(
        new RegExp(`/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen(?:\\?projectId=.+)?$`)
    )
    await expectPlayCanvasEditorIframeLoaded(editorPage)
    await expectPlayCanvasEditorFullscreenHost(editorPage)
    return editorPage
}

export const publishPlayCanvasProjectThroughBrowser = async (page: Page, api: ApiContext, metahubId: string, projectName: string) => {
    await requireProjectInstanceByName(api, metahubId, projectName)

    await page.goto(`/metahub/${metahubId}/entities/project/instances`)
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    const editDialog = await openProjectEditDialogPlayCanvasTab(page, metahubId, projectName)
    const publishButton = editDialog.getByRole('button', { name: 'Publish runtime' })
    await expect(publishButton).toBeVisible()
    await expect(publishButton).toBeEnabled()
    const publishResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/metahub/${metahubId}/playcanvas/projects/`) &&
            response.url().endsWith('/publish'),
        { label: `Publishing PlayCanvas project ${projectName}` }
    )
    await publishButton.click()
    await parseJsonResponse(await publishResponse, `Publishing PlayCanvas project ${projectName}`)
    await editDialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(editDialog).toHaveCount(0)
}

const getDialogComboboxByVisibleLabel = (dialog: Locator, label: string) => {
    const accessibleControl = dialog.getByRole('combobox', { name: label })
    const formControl = dialog.locator('label', { hasText: label }).locator('xpath=ancestor::*[contains(@class, "MuiFormControl-root")][1]')
    return accessibleControl.or(formControl.getByRole('combobox')).first()
}

const removeDefaultLayoutWidgetsThroughBrowser = async (page: Page, api: ApiContext, metahubId: string, layoutId: string) => {
    const zoneWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    for (const widget of zoneWidgets?.items?.filter((item) =>
        ['detailsTitle', 'detailsTable', 'menuWidget'].includes(String(item?.widgetKey ?? ''))
    ) ?? []) {
        const widgetId = String(widget.id)
        await page.getByTestId(`layout-widget-remove-${widgetId}`).click()
        const confirmationDialog = page.getByRole('dialog', { name: 'Remove widget?' })
        await expect(confirmationDialog).toBeVisible()
        await confirmationDialog.getByRole('button', { name: 'Remove', exact: true }).click()
        await expect(page.getByTestId(`layout-widget-${widgetId}`)).toHaveCount(0)
    }
}

const seedMmoommWelcomeContent = async (api: ApiContext, metahubId: string): Promise<void> => {
    const objectCollections = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
    const mainObject = objectCollections.items?.find((item: { codename?: unknown }) => readCodenameText(item.codename) === 'Main') as
        | { id?: string }
        | undefined
    if (typeof mainObject?.id !== 'string') {
        throw new Error('MMOOMM dashboard welcome content requires the default Main Object')
    }

    const componentPayload = await listComponents(api, metahubId, mainObject.id, { limit: 100, offset: 0 })
    const components = componentPayload.items ?? []
    const componentCodenames = new Set(components.map((component: { codename?: unknown }) => readCodenameText(component.codename)))
    if (!componentCodenames.has('Title')) {
        throw new Error('MMOOMM dashboard welcome content requires the Main Object Title component')
    }
    if (!componentCodenames.has('Key')) {
        await createComponent(api, metahubId, mainObject.id, {
            name: { en: 'Content key' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', 'Key'),
            dataType: 'STRING',
            isRequired: true,
            validationRules: {
                maxLength: 128,
                pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$',
                unique: true
            }
        })
    }
    if (!componentCodenames.has('Body')) {
        await createComponent(api, metahubId, mainObject.id, {
            name: { en: 'Content body' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', 'Body'),
            dataType: 'STRING',
            isRequired: false,
            validationRules: { localized: true, maxLength: 4096 }
        })
    }

    const created = await createRecord(api, metahubId, mainObject.id, {
        data: {
            Key: 'mmoomm-welcome',
            Title: updateLocalizedContentLocale(
                createLocalizedContent('en', MMOOMM_OVERVIEW_TITLE_BY_LOCALE.en),
                'ru',
                MMOOMM_OVERVIEW_TITLE_BY_LOCALE.ru
            )
        }
    })
    if (typeof (created?.id ?? created?.data?.id) !== 'string') {
        throw new Error('Creating the MMOOMM dashboard welcome record did not return an identity')
    }
}

const configureOverviewTitleThroughBrowser = async (page: Page, api: ApiContext, metahubId: string, layoutId: string) => {
    const centerZone = page.getByTestId('layout-zone-center')
    const sourceOptionsResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === 'GET' && url.pathname.endsWith('/widget-binding-sources/overviewTitle/content')
    })
    await centerZone.getByRole('button', { name: 'Add widget' }).click()
    await page.getByRole('menuitem', { name: 'Overview title', exact: true }).click()
    const dialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('combobox', { name: 'Content source', exact: true }) })
        .last()
    await expect(dialog).toBeVisible()

    const sourceOptionsResponse = await sourceOptionsResponsePromise
    expect(sourceOptionsResponse.ok()).toBe(true)
    const sourceOptionsPayload = (await sourceOptionsResponse.json()) as {
        sources?: Array<{ sourceKey?: string; label?: string }>
    }
    const mainSource = sourceOptionsPayload.sources?.find((source) => source.sourceKey === 'Main')
    if (!mainSource?.label) {
        throw new Error('MMOOMM dashboard source picker did not expose the Main Object')
    }

    const sourceSelect = getDialogComboboxByVisibleLabel(dialog, 'Content source')
    await sourceSelect.focus()
    await sourceSelect.fill(mainSource.label)
    await page.getByRole('option', { name: mainSource.label, exact: true }).click()

    const recordSelect = getDialogComboboxByVisibleLabel(dialog, 'Content record')
    await recordSelect.focus()
    await recordSelect.fill('Welcome to Universo MMOOMM')
    await page.getByRole('option', { name: 'Welcome to Universo MMOOMM', exact: true }).click()

    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PUT' && response.url().endsWith(`/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`),
        { label: 'Adding entity-backed MMOOMM dashboard title', timeout: APP_RUNTIME_TIMEOUT }
    )
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    const settledSaveResponse = await saveResponse
    if (!settledSaveResponse.ok()) {
        throw new Error(`Adding the MMOOMM dashboard title failed with ${settledSaveResponse.status()} ${settledSaveResponse.statusText()}`)
    }
    await expect(dialog).toHaveCount(0)

    const savedWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    expect(savedWidgets.items?.some((widget) => widget?.widgetKey === 'overviewTitle' && widget.zone === 'center')).toBe(true)
}

const configureMenuWidgetThroughBrowser = async (page: Page, api: ApiContext, metahubId: string, layoutId: string) => {
    const leftZone = page.getByTestId('layout-zone-left')
    await leftZone.getByRole('button', { name: 'Add widget' }).click()
    const menuWidgetOption = page.getByRole('menuitem', { name: 'Menu' })
    await expect(menuWidgetOption).toBeVisible()
    await menuWidgetOption.click({ force: true })
    const dialog = page.getByRole('dialog', { name: 'Navigation menu' })
    await expect(dialog).toBeVisible()
    const navigationSource = getDialogComboboxByVisibleLabel(dialog, 'Navigation source')
    await navigationSource.click()
    await page.getByRole('option', { name: 'Generated navigation', exact: true }).click()
    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PUT' && response.url().endsWith(`/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`),
        { label: 'Saving MMOOMM navigation menu widget', timeout: APP_RUNTIME_TIMEOUT }
    )
    await dialog.getByRole('button', { name: 'Save' }).click()
    const settledSaveResponse = await saveResponse
    if (!settledSaveResponse.ok()) {
        throw new Error(
            `Saving MMOOMM navigation menu widget failed with ${settledSaveResponse.status()} ${settledSaveResponse.statusText()}`
        )
    }
    await expect(dialog).toHaveCount(0)
    const savedWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    const savedMenu = (savedWidgets.items ?? []).find((widget: { widgetKey?: unknown }) => widget?.widgetKey === 'menuWidget')
    expect(savedMenu).toMatchObject({ zone: 'left', isActive: true, config: { variant: 'generated' } })
    expect(savedMenu?.config).toEqual({ variant: 'generated' })
}

const configurePlayCanvasCanvasWidgetThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    options: PlayCanvasWidgetRuntimeOptions
) => {
    await page.goto(`/metahub/${metahubId}/resources/layouts/${options.layoutId}`)
    await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
    const centerZone = page.getByTestId('layout-zone-center')
    const widgetCountBefore = await centerZone.getByText(/^PlayCanvas canvas$/).count()
    await centerZone.getByRole('button', { name: 'Add widget' }).click()
    const canvasWidgetOption = page.getByRole('menuitem', { name: 'PlayCanvas canvas' })
    await expect(canvasWidgetOption).toBeVisible()
    // Layout drag/drop transitions can keep the MUI menu item moving for a
    // prolonged period on a resource-constrained CI runner. Visibility is the
    // meaningful user-facing precondition; force only skips the redundant
    // stability probe while retaining the real target and overlay checks.
    await canvasWidgetOption.click({ force: true })
    const dialog = page.getByRole('dialog', { name: 'PlayCanvas canvas widget' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Visible in sections' })).toHaveCount(0)
    await expectSemanticFieldControls(dialog, {
        referenceFieldLabels: ['Client module', 'Realtime server module', 'Published scene'],
        forbiddenEditableIdLabels: ['Runtime manifest id', 'Project id', 'Scene id']
    })
    await fillLocalizedInlineField(page, dialog, 'Widget title', options.title)
    if (options.clientModuleName) {
        await getDialogComboboxByVisibleLabel(dialog, 'Client module').click()
        await page.getByRole('option', { name: options.clientModuleName }).click()
    }
    if (options.realtimeServerModuleName) {
        await getDialogComboboxByVisibleLabel(dialog, 'Realtime server module').click()
        await page.getByRole('option', { name: options.realtimeServerModuleName }).click()
    }
    await getDialogComboboxByVisibleLabel(dialog, 'Published scene').click()
    const runtimeManifestSelectValuePrefix = publishedManifestSelectValuePrefix(options.runtimeManifest)
    const publishedSceneOptions = page.locator(`li[role="option"][data-value^="${runtimeManifestSelectValuePrefix}"]`)
    await expect(publishedSceneOptions, `Published scene option must be unique for ${options.runtimeManifest.projectName}`).toHaveCount(1)
    const publishedSceneOption = publishedSceneOptions.first()
    await expect(
        publishedSceneOption,
        `Published scene option must include the manifest for ${options.runtimeManifest.projectName}`
    ).toBeVisible()
    await publishedSceneOption.click()
    await dialog.getByLabel('Minimum height').fill('560')
    const fitViewport = dialog.getByRole('switch', { name: 'Fit available viewport height' })
    if (!(await fitViewport.isChecked())) {
        await fitViewport.check()
    }
    await page.keyboard.press('Escape')
    const saveButton = dialog
        .getByRole('button', { name: 'Save' })
        .or(page.getByRole('dialog').last().getByRole('button', { name: 'Save' }))
        .last()
    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PUT' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/layout/${options.layoutId}/zone-widget`),
        { label: `Saving PlayCanvas canvas widget in layout ${options.layoutId}`, timeout: APP_RUNTIME_TIMEOUT }
    )
    await saveButton.click()
    const settledSaveResponse = await saveResponse
    if (!settledSaveResponse.ok()) {
        throw new Error(`Saving PlayCanvas canvas widget failed with ${settledSaveResponse.status()} ${settledSaveResponse.statusText()}`)
    }
    await expect(dialog).toHaveCount(0)
    await expect(centerZone.getByText(/^PlayCanvas canvas$/)).toHaveCount(widgetCountBefore + 1)

    const savedWidgets = await listLayoutZoneWidgets(api, metahubId, options.layoutId)
    expect(savedWidgets.items?.filter((widget) => widget?.widgetKey === 'playcanvasCanvas' && widget.zone === 'center')).toHaveLength(1)
}

export const createScopedDashboardLayout = async (
    api: ApiContext,
    metahubId: string,
    baseLayoutId: string,
    scopeEntityId: string,
    label: { en: string; ru: string }
): Promise<string> => {
    const response = await createLayout(api, metahubId, {
        scopeEntityId,
        baseLayoutId,
        templateKey: 'dashboard',
        name: localizedInput(label.en, label.ru),
        namePrimaryLocale: 'en',
        isActive: true,
        isDefault: true
    })
    const layoutId = response?.id ?? response?.data?.id
    if (typeof layoutId !== 'string') {
        throw new Error(`Creating scoped Dashboard layout for ${label.en} did not return its ID`)
    }
    expect(response?.scopeEntityId ?? response?.data?.scopeEntityId).toBe(scopeEntityId)
    expect(response?.baseLayoutId ?? response?.data?.baseLayoutId).toBe(baseLayoutId)
    return layoutId
}

export const configureRuntimeLayoutThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    layoutId: string,
    spaceLayoutId: string,
    visualLabLayoutId: string,
    authoringRuntimeManifest: TargetedPublishedRuntimeManifestSummary,
    visualLabRuntimeManifest: TargetedPublishedRuntimeManifestSummary
) => {
    await page.goto(`/metahub/${metahubId}/resources/layouts/${layoutId}`)
    await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
    await expectNoTechnicalLeakage(page.getByTestId('metahub-layout-details-content'), {
        label: 'MMOOMM layout authoring surface before widget configuration',
        checkUuidSubstrings: true
    })
    await removeDefaultLayoutWidgetsThroughBrowser(page, api, metahubId, layoutId)
    await seedMmoommWelcomeContent(api, metahubId)
    await configureOverviewTitleThroughBrowser(page, api, metahubId, layoutId)
    await configureMenuWidgetThroughBrowser(page, api, metahubId, layoutId)
    await configurePlayCanvasCanvasWidgetThroughBrowser(page, api, metahubId, {
        layoutId: spaceLayoutId,
        runtimeManifest: authoringRuntimeManifest,
        title: { en: 'Universo MMOOMM', ru: 'Universo MMOOMM' },
        realtimeServerModuleName: 'Fixed Tick Flight Runtime'
    })
    await configurePlayCanvasCanvasWidgetThroughBrowser(page, api, metahubId, {
        layoutId: visualLabLayoutId,
        runtimeManifest: visualLabRuntimeManifest,
        title: { en: 'Visual Linkup Lab', ru: 'Визуальная лаборатория' }
    })
    await expectNoTechnicalLeakage(page.getByTestId('metahub-layout-details-content'), {
        label: 'MMOOMM layout authoring surface',
        allowTextPatterns: [/fixed-tick-flight-runtime/i],
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, 'MMOOMM layout authoring surface')
}

const captureScopedApplicationLayoutLineage = async (
    api: ApiContext,
    applicationId: string,
    sourceLayoutIds: readonly string[],
    testInfo: TestInfo
): Promise<void> => {
    const layoutsResponse = await apiGet(api, `/api/v1/applications/${applicationId}/layouts?limit=100&offset=0`)
    if (!layoutsResponse.ok) {
        throw new Error(`Reading synchronized application layouts failed with ${layoutsResponse.status} ${layoutsResponse.statusText}`)
    }
    const layoutsPayload = (await layoutsResponse.json()) as {
        items?: Array<{
            id?: unknown
            sourceLayoutId?: unknown
            scopeEntityId?: unknown
            templateKey?: unknown
            compositionMode?: unknown
            baseLayoutId?: unknown
        }>
    }
    const expectedSourceLayoutIds = new Set(sourceLayoutIds)
    const scopedLayouts = (layoutsPayload.items ?? []).filter(
        (layout): layout is typeof layout & { id: string; sourceLayoutId: string } =>
            typeof layout.id === 'string' && typeof layout.sourceLayoutId === 'string' && expectedSourceLayoutIds.has(layout.sourceLayoutId)
    )
    if (scopedLayouts.length !== expectedSourceLayoutIds.size) {
        throw new Error(`Expected ${expectedSourceLayoutIds.size} synchronized scoped layouts, found ${scopedLayouts.length}`)
    }

    const summaries = await Promise.all(
        scopedLayouts.map(async (layout) => {
            const detailResponse = await apiGet(api, `/api/v1/applications/${applicationId}/layouts/${layout.id}`)
            if (!detailResponse.ok) {
                throw new Error(`Reading a synchronized scoped layout failed with ${detailResponse.status} ${detailResponse.statusText}`)
            }
            const detail = (await detailResponse.json()) as {
                widgets?: Array<{
                    widgetKey?: unknown
                    zone?: unknown
                    isActive?: unknown
                    config?: unknown
                    sourceConfig?: unknown
                    sourceWidgetId?: unknown
                    sourceBaseWidgetId?: unknown
                    parentWidgetId?: unknown
                    slotKey?: unknown
                }>
            }
            const widgets = detail.widgets ?? []
            return {
                templateKey: layout.templateKey,
                compositionMode: layout.compositionMode,
                hasBaseLayout: typeof layout.baseLayoutId === 'string',
                hasEntityScope: typeof layout.scopeEntityId === 'string',
                widgets: widgets.map((widget) => ({
                    widgetKey: widget.widgetKey,
                    zone: widget.zone,
                    isActive: widget.isActive,
                    sourceLinked: typeof widget.sourceWidgetId === 'string',
                    inheritsBaseWidget: typeof widget.sourceBaseWidgetId === 'string',
                    sourceIdsMatch: typeof widget.sourceWidgetId === 'string' && widget.sourceWidgetId === widget.sourceBaseWidgetId,
                    hasSourceConfig: widget.sourceConfig !== null && widget.sourceConfig !== undefined,
                    configKeys:
                        widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config)
                            ? Object.keys(widget.config)
                            : [],
                    sourceConfigKeys:
                        widget.sourceConfig && typeof widget.sourceConfig === 'object' && !Array.isArray(widget.sourceConfig)
                            ? Object.keys(widget.sourceConfig)
                            : [],
                    hasParent: typeof widget.parentWidgetId === 'string',
                    hasSlot: typeof widget.slotKey === 'string'
                }))
            }
        })
    )
    const summary = { expectedScopedLayoutCount: expectedSourceLayoutIds.size, layouts: summaries }
    await testInfo.attach('mmoomm-application-scoped-layout-lineage.json', {
        body: Buffer.from(JSON.stringify(summary, null, 2)),
        contentType: 'application/json'
    })

    const invalidInheritedWidgets = summaries.flatMap((layout) =>
        layout.widgets
            .filter((widget) => widget.inheritsBaseWidget && !widget.sourceIdsMatch)
            .map((widget) => ({ widgetKey: widget.widgetKey, zone: widget.zone }))
    )
    expect(invalidInheritedWidgets, 'Inherited scoped application widgets must keep both source lineage references aligned').toEqual([])
}

export const createAndVerifyPublishedRuntimeBeforeExport = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    runId: string,
    sourceLayoutIds: readonly string[],
    testInfo: TestInfo
) => {
    const publicationId = await createPublicationThroughBrowser(page, metahubId, {
        name: localizedInput('Universo MMOOMM Runtime Proof', 'Проверка runtime Universo MMOOMM')
    })
    const { applicationId, connectorId } = await createPublicationLinkedApplicationThroughBrowser(page, api, metahubId, publicationId, {
        name: localizedInput(`MMOOMM App Generator Proof ${runId}`, `Проверка генератора MMOOMM ${runId}`)
    })
    await createApplicationSchemaThroughConnectorDialog(page, api, { applicationId, connectorId })
    await captureScopedApplicationLayoutLineage(api, applicationId, sourceLayoutIds, testInfo)

    await expectMmoommRuntimeReady(page, applicationId, {
        label: 'MMOOMM app generator runtime proof',
        checkViewportMatrix: true,
        expectClientRuntimeModule: false
    })
    await expectMmoommVisualLinkupLabRuntimeReady(page, applicationId, {
        label: 'MMOOMM app generator visual linkup lab runtime proof',
        checkViewportMatrix: true
    })
}
