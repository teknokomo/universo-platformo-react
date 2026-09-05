import fs from 'fs'
import path from 'path'
import type { Locator, Page, Response } from '@playwright/test'
import { generateUuidV7 } from '@universo-react/utils'
import type { PlayCanvasRuntimeManifest } from '@universo-react/types'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    deleteMetahub,
    disposeApiContext,
    getApplication,
    listFixedValues,
    listConnectors,
    listLayoutZoneWidgets,
    listLayouts,
    listMetahubs,
    listObjectCollections,
    listEntityInstances,
    listOptionLists,
    listOptionValues,
    listPublicationApplications,
    listPlayCanvasProjects,
    listValueGroups,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    expectLocalizedValidation,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import { buildSnapshotEnvelope, createCodenameVLC, validateSnapshotEnvelope } from '@universo-react/utils'
import {
    MMOOMM_APP_CANONICAL_METAHUB,
    MMOOMM_APP_FIXTURE_FILENAME,
    assertMmoommAppFixtureEnvelopeContract
} from '../../support/mmoommAppFixtureContract'
import {
    expectPlayCanvasEditorFullscreenHost,
    expectPlayCanvasEditorIframeLoaded,
    fetchPlayCanvasEditorCompatibilityConfig,
    readPlayCanvasEditorCompatibilityScene,
    savePlayCanvasEditorSceneAndExpectReload
} from '../../support/playcanvasEditorAuthoring'
import {
    MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME,
    authorMmoommScriptAssetsThroughEditor,
    authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload,
    authorMmoommSceneThroughPlayCanvasEditorAndExpectReload,
    exportMetahubSnapshotThroughBrowser
} from '../../support/mmoommPlaycanvasEditorAuthoring'
import { expectMmoommRuntimeReady, expectMmoommVisualLinkupLabRuntimeReady } from '../../support/mmoommRuntimeProof'
import {
    APP_RUNTIME_TIMEOUT,
    SPACE_SECTION_CODENAME,
    VISUAL_LINKUP_LAB_SECTION_CODENAME,
    WELCOME_SECTION_CODENAME,
    localizedInput,
    localizedText,
    readRequestJson,
    serverModuleSource
} from '../../support/mmoommAppGeneratorData'
import {
    assertPlayCanvasBuiltinScriptCatalog,
    PLAYCANVAS_BUILTIN_SCRIPT_ASSETS,
    readCanonicalPlayCanvasBuiltinAsset
} from '../../support/playcanvasBuiltinScriptParity'

assertPlayCanvasBuiltinScriptCatalog(repoRoot)
const MMOOMM_BUILTIN_SCRIPT_ASSETS = PLAYCANVAS_BUILTIN_SCRIPT_ASSETS.map((asset) => ({
    filename: asset.filename,
    source: readCanonicalPlayCanvasBuiltinAsset(repoRoot, asset.filename)
}))

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type ApiSessionLike = Pick<ApiContext, 'baseURL' | 'cookies'>
type CreatedEntityResponse = { id?: string; data?: { id?: string } }
type MetahubSummary = { id?: string; name?: unknown; codename?: unknown }
type ProjectInstanceSummary = { id?: string; name?: unknown; codename?: unknown; config?: Record<string, unknown> | null }
type PlayCanvasProjectSummary = { id?: string; displayName?: unknown; codename?: unknown }
type PublishedRuntimeManifestSummary = {
    projectId?: string
    sceneId?: string | null
    checksum?: string
    runtimeManifest?: PlayCanvasRuntimeManifest
}
type TargetedPublishedRuntimeManifestSummary = PlayCanvasRuntimeManifest & { projectName: string }
type PlayCanvasWidgetRuntimeOptions = {
    runtimeManifest: TargetedPublishedRuntimeManifestSummary
    title: { en: string; ru: string }
    visibleSectionName: RegExp | string
    clientModuleName?: string
    realtimeServerModuleName?: string
}
type BrowserCreatedApplicationResponse = {
    id?: string
    slug?: string
    connector?: { id?: string }
    application?: { id?: string; slug?: string }
    data?: { id?: string; slug?: string; connector?: { id?: string }; application?: { id?: string; slug?: string } }
}

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')
const explicitFixtureOutputPath = process.env.MMOOMM_APP_FIXTURE_OUTPUT_PATH

async function apiGet(api: ApiContext, urlPath: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(urlPath, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

async function apiSend(api: ApiContext, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', urlPath: string, body?: unknown) {
    return sendWithCsrf(api, method, urlPath, body)
}

const parseJsonResponse = async <T>(response: Response, label: string): Promise<T> => {
    const bodyText = await response.text()
    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }
    return JSON.parse(bodyText) as T
}

const fillLocalizedInlineField = async (page: Page, root: Locator, label: string, value: { en: string; ru: string }): Promise<void> => {
    const enRow = root.getByTestId('localized-inline-row-en').first()
    if ((await enRow.count()) > 0) {
        await enRow.getByLabel(label).fill(value.en)
        const ruRow = root.getByTestId('localized-inline-row-ru').first()
        if ((await ruRow.count()) === 0) {
            await enRow.getByTestId('localized-inline-badge-en').click()
            await page.getByRole('menuitem', { name: 'Add language' }).click()
            await page.getByRole('menuitem', { name: 'Русский' }).click()
        }
        await root.getByTestId('localized-inline-row-ru').first().getByLabel(label).fill(value.ru)
        return
    }

    await root.getByLabel(label).first().fill(value.en)
    await root.getByRole('button', { name: /^EN$/ }).click()
    await page.getByRole('menuitem', { name: 'Add language' }).click()
    await page.getByRole('menuitem', { name: 'Русский' }).click()
    const ruRow = root.getByTestId('localized-inline-row-ru').first()
    if ((await ruRow.count()) === 0) {
        throw new Error(`Localized field ${label} did not expose a Russian row after adding the locale`)
    }
    await ruRow.getByLabel(label).fill(value.ru)
}

const readLocalizedContent = (value: unknown, locale: 'en' | 'ru' = 'en'): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const primary = record._primary ?? locale
    const content = record.locales?.[locale]?.content ?? record.locales?.[primary]?.content
    return typeof content === 'string' ? content.trim() : ''
}

const readCodenameText = (value: unknown): string => readLocalizedContent(value, 'en')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const projectInstanceCodenameForName = (projectName: string): string => projectName.replace(/\s+/g, '')

const publishedManifestSelectValuePrefix = (manifest: PublishedRuntimeManifestSummary): string =>
    manifest.projectId ? `${manifest.projectId}:${manifest.sceneId ?? ''}:` : ''

const requireProjectInstanceByName = async (
    api: ApiSessionLike,
    metahubId: string,
    projectName: string
): Promise<ProjectInstanceSummary> => {
    const projectInstances = (await listEntityInstances(api, metahubId, { kind: 'project', limit: 100, offset: 0 })) as {
        items?: ProjectInstanceSummary[]
    }
    const expectedCodename = projectInstanceCodenameForName(projectName)
    const target = projectInstances.items?.find(
        (item) => readLocalizedContent(item.name, 'en') === projectName || readCodenameText(item.codename) === expectedCodename
    )
    if (!target?.id) {
        throw new Error(`MMOOMM project instance ${projectName} was not found in the Projects section`)
    }
    return target
}

const requirePlayCanvasProjectByName = async (
    api: ApiSessionLike,
    metahubId: string,
    projectName: string
): Promise<PlayCanvasProjectSummary> => {
    const projectsPayload = (await listPlayCanvasProjects(api, metahubId)) as { items?: PlayCanvasProjectSummary[] }
    const target = projectsPayload.items?.find((item) => readLocalizedContent(item.displayName, 'en') === projectName)
    if (!target?.id) {
        throw new Error(`MMOOMM generator did not receive a PlayCanvas project id for ${projectName}`)
    }
    return target
}

const requirePublishedManifestForProject = (
    manifests: PublishedRuntimeManifestSummary[] | undefined,
    projectId: string,
    label: string
): PlayCanvasRuntimeManifest => {
    const manifest = manifests?.find((item) => item.projectId === projectId && /^[a-f0-9]{64}$/i.test(String(item.checksum ?? '')))
    if (!manifest?.runtimeManifest) {
        throw new Error(`MMOOMM generator did not receive a published runtime manifest for ${label}`)
    }
    return manifest.runtimeManifest
}

const expectFullscreenEditorProject = async (page: Page, metahubId: string, projectId: string, label: string): Promise<void> => {
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId)
    expect(compatibilityConfig.projectId, `${label} compatibility config must target the requested PlayCanvas project`).toBe(projectId)
}

const createMetahubThroughBrowser = async (page: Page) => {
    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog')
    await expectSemanticFieldControls(dialog, {
        longTextLabels: ['Description']
    })
    await dialog.getByLabel('Name').first().fill(MMOOMM_APP_CANONICAL_METAHUB.name.en)
    await dialog.getByLabel('Codename').first().fill(MMOOMM_APP_CANONICAL_METAHUB.codename.en)
    const descriptionField = dialog.getByLabel('Description').first()
    if (await descriptionField.isVisible().catch(() => false)) {
        await descriptionField.fill(MMOOMM_APP_CANONICAL_METAHUB.description.en)
    }
    // Pick the "PlayCanvas" template so the metahub boots with the Projects entity type
    // (kind: 'project') required by the project-binding flow below.
    const templateField = dialog.getByLabel('Select template')
    if (await templateField.isVisible().catch(() => false)) {
        await templateField.click()
        await page
            .getByRole('option', { name: /PlayCanvas/ })
            .first()
            .click()
    }
    const createResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/metahubs'),
        { label: 'Creating MMOOMM metahub through UI', timeout: 90_000 }
    )
    const createButton = dialog.getByTestId(entityDialogSelectors.submitButton)
    await expect(createButton).toBeEnabled({ timeout: 15_000 })
    await createButton.click()
    const created = await parseJsonResponse<CreatedEntityResponse>(await createResponse, 'Creating MMOOMM metahub through UI')
    await expect(dialog).toHaveCount(0)

    const metahubId = created.id ?? created.data?.id
    if (!metahubId) {
        throw new Error('Browser-created MMOOMM metahub response did not contain an id')
    }
    await recordCreatedMetahub({
        id: metahubId,
        name: MMOOMM_APP_CANONICAL_METAHUB.name.en,
        codename: MMOOMM_APP_CANONICAL_METAHUB.codename.en
    })
    return metahubId
}

const deleteExistingCanonicalMmoommMetahubs = async (api: ApiSessionLike) => {
    const metahubs = (await listMetahubs(api, { limit: 100, offset: 0 })) as { items?: MetahubSummary[] }
    const canonicalCodename = MMOOMM_APP_CANONICAL_METAHUB.codename.en
    const canonicalName = MMOOMM_APP_CANONICAL_METAHUB.name.en
    const staleMetahubs =
        metahubs.items?.filter((item) => {
            return readCodenameText(item.codename) === canonicalCodename || readLocalizedContent(item.name, 'en') === canonicalName
        }) ?? []

    for (const metahub of staleMetahubs) {
        if (!metahub.id) continue
        await deleteMetahub(api, metahub.id)
    }
}

const connectPackageThroughBrowser = async (page: Page, label: string) => {
    const button = page.getByRole('button', { name: `Connect ${label}` })
    await expect(button).toBeVisible()
    await button.click()
    const dialog = page.getByRole('dialog', { name: 'Connect package' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Connect package' }).click()
    await expect(dialog).toHaveCount(0)
}

const createProjectInstanceAndBindThroughBrowser = async (page: Page, api: ApiSessionLike, projectName: string, metahubId: string) => {
    // Create a "Projects" entity instance via the generic instance list.
    await page.goto(`/metahub/${metahubId}/entities/project/instances`)
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const createDialog = page.getByRole('dialog', { name: 'Create Project' })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel('Name').first().fill(projectName)
    await createDialog.getByLabel('Codename').first().fill(projectInstanceCodenameForName(projectName))
    const createResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entities`),
        { label: `Creating project instance ${projectName}` }
    )
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await parseJsonResponse<{ data?: { id?: string }; id?: string }>(await createResponse, `Creating project instance ${projectName}`)
    await expect(createDialog).toHaveCount(0)

    // Open the Project Binding resource tab and create+bind a PlayCanvas project.
    await requireProjectInstanceByName(api, metahubId, projectName)
    // Open the instance Edit dialog → "PlayCanvas" tab (the binding surface).
    // There is no standalone /project page anymore.
    const editDialog = await openProjectEditDialogPlayCanvasTab(page, metahubId, projectName)
    await expect(editDialog.getByText('No PlayCanvas project bound yet')).toBeVisible()
    await editDialog.getByRole('button', { name: 'Create & bind project' }).click()
    const createDialogBinding = page.getByRole('dialog', { name: 'Create & bind PlayCanvas project' })
    await expect(createDialogBinding).toBeVisible()
    await createDialogBinding.getByLabel('Project name').fill(projectName)
    const createBindResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/playcanvas/projects`),
        { label: `Creating & binding PlayCanvas project ${projectName}` }
    )
    await createDialogBinding.getByRole('button', { name: 'Create' }).click()
    await parseJsonResponse(await createBindResponse, `Creating & binding PlayCanvas project ${projectName}`)
    await expect(createDialogBinding).toHaveCount(0, { timeout: 30_000 })
    await expect(editDialog.getByText('No PlayCanvas project bound yet')).toHaveCount(0, { timeout: 30_000 })
    await expect(editDialog.getByText(projectName, { exact: true })).toBeVisible({ timeout: 30_000 })
    const projectId = (await requirePlayCanvasProjectByName(api, metahubId, projectName)).id
    // Close the edit dialog so subsequent steps start from the instances list.
    await editDialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(editDialog).toHaveCount(0)
    return projectId
}

const openProjectEditDialogPlayCanvasTab = async (page: Page, metahubId: string, projectName: string) => {
    await page.goto(`/metahub/${metahubId}/entities/project/instances`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 60_000 })
    const row = page.getByRole('row', { name: new RegExp(escapeRegExp(projectName)) }).first()
    await expect(row, `Projects row for ${projectName} must be visible`).toBeVisible({ timeout: 60_000 })
    await row.getByRole('button', { name: /Options|Опции/i }).click()
    await page.getByRole('menuitem', { name: /^Edit$/i }).click()
    const editDialog = page.getByRole('dialog', { name: 'Edit Project' })
    await expect(editDialog).toBeVisible()
    await expect(editDialog.getByLabel('Name').first(), `Edit dialog must target ${projectName}`).toHaveValue(projectName)
    await editDialog.getByRole('tab', { name: 'PlayCanvas' }).click()
    return editDialog
}

const fillNameAndCodename = async (dialog: Locator, values: { name: string; codename: string }) => {
    await dialog.getByLabel('Name').first().fill(values.name)
    await dialog.getByLabel('Codename').first().fill(values.codename)
}

const createStandardEntityThroughBrowser = async (
    page: Page,
    metahubId: string,
    kind: 'object' | 'set' | 'enumeration',
    values: { name: string; codename: string }
) => {
    const labels = {
        object: { route: 'object', heading: 'Objects', dialog: 'Create Object', endpoint: 'object/instances' },
        set: { route: 'set', heading: 'Sets', dialog: 'Create Set', endpoint: 'set/instances' },
        enumeration: { route: 'enumeration', heading: 'Enumerations', dialog: 'Create Enumeration', endpoint: 'enumeration/instances' }
    }[kind]

    await page.goto(`/metahub/${metahubId}/entities/${labels.route}/instances`, {
        waitUntil: 'domcontentloaded',
        // The first route after closing a PlayCanvas Editor session can wait
        // for the editor's final ShareDB/backup requests on a cold CI stack.
        // Keep the navigation bounded, but do not fail before the same
        // application readiness budget used by the rest of this generator.
        timeout: APP_RUNTIME_TIMEOUT
    })
    await expect(page.getByRole('heading', { name: labels.heading })).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: labels.dialog })
    await expect(dialog).toBeVisible()
    await fillNameAndCodename(dialog, values)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/${labels.endpoint}`),
        {
            label: `Creating ${kind} ${values.codename}`,
            // Entity creation follows a browser navigation and a schema-aware
            // transaction. Keep the generator deterministic on a cold local
            // Supabase stack where the first request can exceed the shared
            // 30-second mutation default under PlayCanvas Editor load.
            timeout: 120_000
        }
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    const created = await parseJsonResponse<CreatedEntityResponse>(await createResponse, `Creating ${kind} ${values.codename}`)
    const createdId = created.id ?? created.data?.id
    if (!createdId) {
        throw new Error(`Create ${kind} response did not contain an id`)
    }
    return createdId
}

const createObjectCollectionsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext) => {
    for (const entity of [
        { name: 'Space', codename: SPACE_SECTION_CODENAME },
        { name: 'Visual Linkup Lab', codename: VISUAL_LINKUP_LAB_SECTION_CODENAME },
        { name: 'Flight Ship', codename: 'FlightShip' },
        { name: 'Flight Station', codename: 'FlightStation' }
    ]) {
        const createdId = await createStandardEntityThroughBrowser(page, metahubId, 'object', entity)
        await expect
            .poll(async () => {
                const payload = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
                return payload.items?.some((item: { id?: string }) => item.id === createdId) ?? false
            })
            .toBe(true)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByText(entity.name, { exact: true }).first()).toBeVisible({ timeout: 60_000 })
    }
}

const createEnumerationValueThroughBrowser = async (
    page: Page,
    metahubId: string,
    enumerationId: string,
    values: { name: string; codename: string; isDefault?: boolean }
) => {
    await page.goto(`/metahub/${metahubId}/entities/enumeration/instance/${enumerationId}/values`)
    await expect(page.getByRole('heading', { name: 'Values' })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: 'Create value' })
    await expect(dialog).toBeVisible()
    await fillNameAndCodename(dialog, values)
    if (values.isDefault) {
        await setLayoutSwitchThroughBrowser(dialog, 'Default value', true)
    }

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/enumeration/instance/${enumerationId}/values`),
        { label: `Creating enumeration value ${values.codename}` }
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    const created = await parseJsonResponse<CreatedEntityResponse>(await createResponse, `Creating enumeration value ${values.codename}`)
    const createdId = created.id ?? created.data?.id
    if (!createdId) {
        throw new Error('Create enumeration value response did not contain an id')
    }
    const valueRow = page.getByRole('row', { name: new RegExp(`\\b${values.codename}\\b`) })
    try {
        await expect(valueRow).toBeVisible({ timeout: 20_000 })
    } catch {
        // The values grid keeps its previous query result after the mutation on
        // a cold local stack. Reload once so the durable response, rather than
        // a stale virtualized row set, is the source of generator evidence.
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { name: 'Values' })).toBeVisible({ timeout: 60_000 })
        await expect(page.getByRole('row', { name: new RegExp(`\\b${values.codename}\\b`) })).toBeVisible({ timeout: 60_000 })
    }
    return createdId
}

const createMovementCommandsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext) => {
    const enumerationId = await createStandardEntityThroughBrowser(page, metahubId, 'enumeration', {
        name: 'Movement Commands',
        codename: 'MovementCommands'
    })
    await expect
        .poll(async () => {
            const payload = await listOptionLists(api, metahubId, { limit: 100, offset: 0 })
            return payload.items?.some((item: { id?: string }) => item.id === enumerationId) ?? false
        })
        .toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Movement Commands', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

    for (const command of [
        { codename: 'MoveToPoint', name: 'Move to point', isDefault: true },
        { codename: 'MoveToObject', name: 'Move to object', isDefault: false },
        { codename: 'Stop', name: 'Stop', isDefault: false }
    ]) {
        const createdId = await createEnumerationValueThroughBrowser(page, metahubId, enumerationId, command)
        await expect
            .poll(async () => {
                const payload = await listOptionValues(api, metahubId, enumerationId, { limit: 100, offset: 0 })
                return payload.items?.some((item: { id?: string }) => item.id === createdId) ?? false
            })
            .toBe(true)
    }
}

const createFixedValueThroughBrowser = async (
    page: Page,
    metahubId: string,
    setId: string,
    values: { name: string; codename: string; value: number }
) => {
    await page.goto(`/metahub/${metahubId}/entities/set/instance/${setId}/fixed-values`)
    await expect(page.getByRole('heading', { name: /(Fixed Values|Constants)/i })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: /Create (Constant|Fixed Value)/i })
    await expect(dialog).toBeVisible()
    await fillNameAndCodename(dialog, values)
    await dialog.getByLabel('Data Type').click()
    await page.getByRole('option', { name: 'Number' }).click()
    await dialog.getByRole('tab', { name: 'Value' }).click()
    await dialog.getByRole('textbox', { name: 'Value' }).fill(String(values.value))

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/set/instance/${setId}/fixed-values`),
        { label: `Creating fixed value ${values.codename}` }
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    const created = await parseJsonResponse<CreatedEntityResponse>(await createResponse, `Creating fixed value ${values.codename}`)
    const createdId = created.id ?? created.data?.id
    if (!createdId) {
        throw new Error('Create fixed value response did not contain an id')
    }
    await expect(page.getByText(values.name, { exact: true })).toBeVisible()
    return createdId
}

const createSimulationConstantsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext) => {
    const setId = await createStandardEntityThroughBrowser(page, metahubId, 'set', {
        name: 'Flight Simulation Constants',
        codename: 'FlightSimulationConstants'
    })
    await expect
        .poll(async () => {
            const payload = await listValueGroups(api, metahubId, { limit: 100, offset: 0 })
            return payload.items?.some((item: { id?: string }) => item.id === setId) ?? false
        })
        .toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Flight Simulation Constants', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

    for (const constant of [
        { codename: 'CruiseSpeedMetersPerSecond', name: 'Cruise speed, m/s', value: 36 },
        { codename: 'AccelerationMetersPerSecond2', name: 'Acceleration, m/s2', value: 48 },
        { codename: 'DecelerationMetersPerSecond2', name: 'Deceleration, m/s2', value: 48 },
        { codename: 'ArrivalRadiusMeters', name: 'Arrival radius, m', value: 0.5 }
    ]) {
        const createdId = await createFixedValueThroughBrowser(page, metahubId, setId, constant)
        await expect
            .poll(async () => {
                const payload = await listFixedValues(api, metahubId, setId, { limit: 100, offset: 0 })
                return payload.items?.some((item: { id?: string }) => item.id === createdId) ?? false
            })
            .toBe(true)
    }
}

const resolveEntityIdByCodename = async (api: ApiContext, metahubId: string, kind: 'page', codename: string): Promise<string> => {
    let entityId: string | null = null
    await expect
        .poll(async () => {
            const response = await apiGet(api, `/api/v1/metahub/${metahubId}/entities/${kind}/instances?limit=100&offset=0`)
            if (!response.ok) return false
            const payload = (await response.json()) as {
                items?: Array<{ id?: string; codename?: { _primary?: string; locales?: Record<string, { content?: string }> } }>
            }
            const match = payload.items?.find((item) => {
                const primary = item.codename?._primary ?? 'en'
                return item.codename?.locales?.[primary]?.content === codename || item.codename?.locales?.en?.content === codename
            })
            entityId = typeof match?.id === 'string' ? match.id : null
            return Boolean(entityId)
        })
        .toBe(true)

    if (!entityId) {
        throw new Error(`Could not resolve ${kind} entity by codename ${codename}`)
    }
    return entityId
}

const replaceFirstEditorJsBlockThroughBrowser = async (page: Page, text: string) => {
    const editorRoot = page.getByTestId('editorjs-block-editor')
    await expect(editorRoot).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
    const previousCommittedSequence = await editorRoot.getAttribute('data-editorjs-committed-sequence')
    await editorRoot.click({ position: { x: 24, y: 24 } })

    const editableBlock = editorRoot.locator('[contenteditable="true"]').first()
    await expect(editableBlock).toBeVisible({ timeout: 20_000 })
    await editableBlock.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.insertText(text)
    await expect(editorRoot.getByText(text)).toBeVisible()
    await expect(editableBlock).toContainText(text)
    await expect
        .poll(() => editorRoot.getAttribute('data-editorjs-committed-sequence'), {
            message: 'Editor.js page content must commit the latest visible text before saving',
            timeout: 20_000
        })
        .not.toBe(previousCommittedSequence)
}

const authorWelcomePageThroughBrowser = async (page: Page, api: ApiContext, metahubId: string) => {
    const welcomePageId = await resolveEntityIdByCodename(api, metahubId, 'page', WELCOME_SECTION_CODENAME)
    await page.goto(`/metahub/${metahubId}/entities/page/instance/${welcomePageId}/content`)
    await expect(page.getByRole('heading', { name: 'Welcome', level: 1 })).toBeVisible({ timeout: 60_000 })
    await replaceFirstEditorJsBlockThroughBrowser(page, 'Welcome to Universo MMOOMM')

    const saveButton = page.getByRole('button', { name: 'Save' })
    if (await saveButton.isDisabled()) {
        await expect(page.getByRole('heading', { name: 'Welcome to Universo MMOOMM', level: 2 })).toBeVisible()
        return
    }

    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PATCH' &&
            (response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/page/instance/${welcomePageId}`) ||
                response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${welcomePageId}`)),
        { label: 'Saving MMOOMM welcome page content' }
    )
    await saveButton.click()
    await parseJsonResponse<CreatedEntityResponse>(await saveResponse, 'Saving MMOOMM welcome page content')
    await expect(saveButton).toBeDisabled()
}

const setCapabilityThroughBrowser = async (page: Page, label: string, checked: boolean) => {
    const checkbox = page.getByRole('checkbox', { name: label })
    if ((await checkbox.count()) === 0) {
        if (checked) {
            throw new Error(`Requested module capability is not visible for the selected role: ${label}`)
        }
        return
    }
    await expect(checkbox).toBeVisible()
    const current = await checkbox.isChecked()
    if (current !== checked) {
        await checkbox.click()
        await expect(checkbox).toBeChecked({ checked })
    }
}

const fillModuleSourceThroughBrowser = async (page: Page, sourceCode: string) => {
    const editorShell = page.getByTestId('entity-modules-editor-shell')
    await expect(editorShell).toBeVisible()
    const editorContent = editorShell.locator('.cm-content')
    await expect(editorContent).toBeVisible()
    const initialEditorText = await editorContent.textContent()
    await editorContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.insertText(sourceCode)
    // CodeMirror virtualizes long documents, so the first line can be absent
    // from the DOM even after a successful edit.  Compare the rendered slice
    // with its pre-edit value instead of asserting a particular line is
    // visible in the current scroll position.
    await expect.poll(async () => editorContent.textContent(), { timeout: 20_000 }).not.toBe(initialEditorText)
}

const createRuntimeModuleThroughBrowser = async (
    page: Page,
    api: ApiSessionLike,
    metahubId: string,
    module: {
        name: string
        codename: string
        role: 'module' | 'widget' | 'library'
        scope?: 'metahub' | 'general'
        sourceCode: string
        capabilities: string[]
    }
) => {
    const openModuleScope = async () => {
        await page.goto(`/metahub/${metahubId}/resources`, {
            waitUntil: 'domcontentloaded',
            timeout: APP_RUNTIME_TIMEOUT
        })
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible({ timeout: 60_000 })
        await page.getByRole('tab', { name: 'Modules', exact: true }).click()
        await page.getByRole('tab', { name: module.scope === 'general' ? 'Shared modules' : 'Metahub modules', exact: true }).click()
        await expect(page.getByTestId('entity-modules-root')).toBeVisible({ timeout: 60_000 })
    }

    await openModuleScope()
    const newButton = page.getByRole('button', { name: 'New' })
    if (await newButton.isEnabled().catch(() => false)) {
        await newButton.click()
    }
    const createModuleButton = page.getByRole('button', { name: 'Create module', exact: true })
    await expect(createModuleButton).toBeVisible()

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(module.name)
    await page.getByRole('textbox', { name: 'Codename' }).fill(module.codename)
    const roleLabel = module.role === 'widget' ? 'Widget' : module.role === 'library' ? 'Library' : 'Module'
    const moduleRoleSelect = page.getByLabel('Module role')
    if (await moduleRoleSelect.isEnabled()) {
        await moduleRoleSelect.click()
        await page.getByRole('option', { name: roleLabel, exact: true }).click()
    } else {
        // General/shared modules intentionally expose only the Library role;
        // MUI disables the select when no alternative is valid.
        await expect(moduleRoleSelect).toHaveText(roleLabel)
    }

    const capabilityLabels = new Map<string, string>([
        ['records.read', 'Read records'],
        ['records.write', 'Write records'],
        ['metadata.read', 'Read metadata'],
        ['rpc.client', 'Call server methods from client code'],
        ['lifecycle', 'Receive lifecycle events'],
        ['posting', 'Run posting handlers'],
        ['ledger.read', 'Read ledgers'],
        ['ledger.write', 'Write ledgers']
    ])
    for (const [capability, label] of capabilityLabels) {
        await setCapabilityThroughBrowser(page, label, module.capabilities.includes(capability))
    }
    await fillModuleSourceThroughBrowser(page, module.sourceCode)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(`/api/v1/metahub/${metahubId}/modules`) &&
            readRequestJson(response)?.codename === module.codename,
        { label: `Creating runtime module ${module.codename}` }
    )
    await createModuleButton.click()
    const created = await parseJsonResponse<CreatedEntityResponse>(await createResponse, `Creating runtime module ${module.codename}`)
    const createdId = created.id ?? created.data?.id
    if (!createdId) {
        throw new Error(`Create runtime module ${module.codename} response did not contain an id`)
    }

    await expect
        .poll(
            async () => {
                const response = await apiGet(
                    api,
                    `/api/v1/metahub/${metahubId}/modules?attachedToKind=${encodeURIComponent(module.scope ?? 'metahub')}`
                )
                if (!response.ok) return false
                const payload = (await response.json()) as { items?: Array<{ id?: string }> }
                return payload.items?.some((item) => item.id === createdId) ?? false
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: `Created runtime module ${module.codename} must be visible through the API` }
        )
        .toBe(true)

    const moduleName = page.getByTestId('entity-modules-root').getByText(module.name, { exact: true }).first()
    try {
        await expect(moduleName).toBeVisible({ timeout: 20_000 })
    } catch {
        // The module mutation invalidates the query asynchronously. Re-open the
        // same browser surface after the durable API check so a stale list cache
        // cannot turn a successful authoring step into a false negative.
        await openModuleScope()
        await expect(page.getByTestId('entity-modules-root').getByText(module.name, { exact: true }).first()).toBeVisible({
            timeout: APP_RUNTIME_TIMEOUT
        })
    }
    return createdId
}

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
    let applicationSlug = created.application?.slug ?? created.data?.application?.slug ?? created.data?.slug ?? created.slug
    let connectorId = created.connector?.id ?? created.data?.connector?.id

    await expect
        .poll(
            async () => {
                const payload = await listPublicationApplications(api, metahubId, publicationId)
                const application = (payload.items ?? []).find(
                    (item: { id?: string; name?: { locales?: Record<string, { content?: string }> }; slug?: string }) =>
                        Object.values(item.name?.locales ?? {}).some((localeValue) => localeValue?.content === values.name.en)
                )
                applicationId = applicationId ?? application?.id
                applicationSlug = applicationSlug ?? application?.slug
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
    await recordCreatedApplication({ id: applicationId, slug: applicationSlug })
    return { applicationId, applicationSlug, connectorId }
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

const setEditorDefaultProjectThroughBrowser = async (page: Page, metahubId: string, projectName: string) => {
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

const openFullscreenEditorThroughBrowser = async (page: Page, metahubId: string, projectId?: string) => {
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

const publishPlayCanvasProjectThroughBrowser = async (page: Page, api: ApiContext, metahubId: string, projectName: string) => {
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

const setLayoutSwitchThroughBrowser = async (container: Page | Locator, label: string, checked: boolean) => {
    const control = container.getByRole('switch', { name: label, exact: true })
    await expect(control).toBeVisible()
    const current = await control.isChecked()
    if (current !== checked) {
        await control.click()
        await expect(control).toBeChecked({ checked })
    }
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

const addMenuItemThroughBrowser = async (page: Page, item: { title: { en: string; ru: string }; icon: string; sectionName: string }) => {
    const menuDialog = page.getByRole('dialog', { name: 'Create menu' })
    await menuDialog.getByRole('button', { name: 'Add item' }).click()
    const itemDialog = page.getByRole('dialog', { name: 'Add item' })
    await expect(itemDialog).toBeVisible()
    await fillLocalizedInlineField(page, itemDialog, 'Name', item.title)
    const itemType = getDialogComboboxByVisibleLabel(itemDialog, 'Item type')
    await itemType.click()
    await page.getByRole('option', { name: 'Entity section' }).click()
    await itemDialog.getByLabel('Icon').fill(item.icon)
    const entitySection = itemDialog.getByLabel('Entity section')
    await entitySection.fill(item.sectionName)
    await page.getByRole('option', { name: new RegExp(`^${escapeRegExp(item.sectionName)}\\s+·`) }).click()
    await itemDialog.getByRole('button', { name: 'Save' }).click()
    await expect(itemDialog).toHaveCount(0)
    await expect(menuDialog.getByText(item.title.en, { exact: true })).toBeVisible()
}

const configureMenuWidgetThroughBrowser = async (page: Page, metahubId: string, layoutId: string) => {
    const leftZone = page.getByTestId('layout-zone-left')
    await leftZone.getByRole('button', { name: 'Add widget' }).click()
    const menuWidgetOption = page.getByRole('menuitem', { name: 'Menu' })
    await expect(menuWidgetOption).toBeVisible()
    await menuWidgetOption.click({ force: true })
    const dialog = page.getByRole('dialog', { name: 'Create menu' })
    await expect(dialog).toBeVisible()
    await fillLocalizedInlineField(page, dialog, 'Name', { en: 'Navigation', ru: 'Навигация' })
    await setLayoutSwitchThroughBrowser(dialog, 'Automatically show all sections', false)
    const workspacePlacement = getDialogComboboxByVisibleLabel(dialog, 'Workspace menu placement')
    await workspacePlacement.scrollIntoViewIfNeeded()
    await workspacePlacement.click()
    await page.getByRole('option', { name: 'Hidden' }).click()
    await addMenuItemThroughBrowser(page, {
        title: { en: 'Welcome', ru: 'Добро пожаловать' },
        icon: 'home',
        sectionName: 'Welcome'
    })
    await addMenuItemThroughBrowser(page, { title: { en: 'Space', ru: 'Космос' }, icon: 'rocket', sectionName: 'Space' })
    await addMenuItemThroughBrowser(page, {
        title: { en: 'Visual Linkup Lab', ru: 'Визуальная лаборатория' },
        icon: 'visibility',
        sectionName: 'Visual Linkup Lab'
    })
    const startPage = getDialogComboboxByVisibleLabel(dialog, 'Start page')
    await startPage.scrollIntoViewIfNeeded()
    await startPage.click()
    await page.getByRole('option', { name: new RegExp(`^${escapeRegExp('Welcome')}\\s+·`) }).click()
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
    try {
        await expect(leftZone.getByText(/Menu: Navigation/)).toBeVisible({ timeout: 20_000 })
    } catch {
        // Layout mutations are persisted transactionally, but the authoring
        // query may still contain the pre-save widget list. Reload the same
        // layout route to verify the durable result through the UI.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: APP_RUNTIME_TIMEOUT })
        await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible({ timeout: 60_000 })
        await expect(page.getByTestId('layout-zone-left').getByText(/Menu: Navigation/)).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
    }
}

const configurePlayCanvasCanvasWidgetThroughBrowser = async (page: Page, options: PlayCanvasWidgetRuntimeOptions) => {
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
    await expectSemanticFieldControls(dialog, {
        referenceFieldLabels: ['Client module', 'Realtime server module', 'Published scene', 'Visible in sections'],
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
    await getDialogComboboxByVisibleLabel(dialog, 'Visible in sections').click()
    await page.getByRole('option', { name: options.visibleSectionName }).click()
    await page.keyboard.press('Escape')
    const saveButton = dialog
        .getByRole('button', { name: 'Save' })
        .or(page.getByRole('dialog').last().getByRole('button', { name: 'Save' }))
        .last()
    await saveButton.click()
    await expect(dialog).toHaveCount(0)
    await expect(centerZone.getByText(/^PlayCanvas canvas$/)).toHaveCount(widgetCountBefore + 1)
}

const configureRuntimeLayoutThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    layoutId: string,
    authoringRuntimeManifest: TargetedPublishedRuntimeManifestSummary,
    visualLabRuntimeManifest: TargetedPublishedRuntimeManifestSummary
) => {
    await page.goto(`/metahub/${metahubId}/resources/layouts/${layoutId}`)
    await expect(page.getByTestId('metahub-layout-details-content')).toBeVisible()
    await expectNoTechnicalLeakage(page.getByTestId('metahub-layout-details-content'), {
        label: 'MMOOMM layout authoring surface before widget configuration',
        checkUuidSubstrings: true
    })
    for (const label of ['Details table', 'Details title', 'Footer', 'Search', 'Breadcrumbs', 'Overview cards']) {
        await setLayoutSwitchThroughBrowser(page, label, false)
    }
    await removeDefaultLayoutWidgetsThroughBrowser(page, api, metahubId, layoutId)
    await configureMenuWidgetThroughBrowser(page, metahubId, layoutId)
    await configurePlayCanvasCanvasWidgetThroughBrowser(page, {
        runtimeManifest: authoringRuntimeManifest,
        title: { en: 'Universo MMOOMM', ru: 'Universo MMOOMM' },
        visibleSectionName: /Space/,
        realtimeServerModuleName: 'Fixed Tick Flight Runtime'
    })
    await configurePlayCanvasCanvasWidgetThroughBrowser(page, {
        runtimeManifest: visualLabRuntimeManifest,
        title: { en: 'Visual Linkup Lab', ru: 'Визуальная лаборатория' },
        visibleSectionName: /Visual Linkup Lab|Визуальная лаборатория/
    })
    await expectNoTechnicalLeakage(page.getByTestId('metahub-layout-details-content'), {
        label: 'MMOOMM layout authoring surface',
        allowTextPatterns: [/fixed-tick-flight-runtime/i],
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, 'MMOOMM layout authoring surface')
}

const createAndVerifyPublishedRuntimeBeforeExport = async (page: Page, api: ApiContext, metahubId: string, runId: string) => {
    const publicationId = await createPublicationThroughBrowser(page, metahubId, {
        name: localizedInput('Universo MMOOMM Runtime Proof', 'Проверка runtime Universo MMOOMM')
    })
    const { applicationId, connectorId } = await createPublicationLinkedApplicationThroughBrowser(page, api, metahubId, publicationId, {
        name: localizedInput(`MMOOMM App Generator Proof ${runId}`, `Проверка генератора MMOOMM ${runId}`)
    })
    await createApplicationSchemaThroughConnectorDialog(page, api, { applicationId, connectorId })

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

test.describe('MMOOMM PlayCanvas Editor fixture generator', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator create canonical mmoomm app through browser PlayCanvas Editor and export snapshot fixture', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(600_000)
        const shouldUpdateTrackedFixture = process.env.UPDATE_MMOOMM_APP_FIXTURE === '1'
        if (shouldUpdateTrackedFixture) {
            fs.mkdirSync(FIXTURES_DIR, { recursive: true })
        }
        await applyBrowserPreferences(page, { language: 'en' })
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        await deleteExistingCanonicalMmoommMetahubs(api)
        const metahubId = await createMetahubThroughBrowser(page)
        await page.goto(`/metahub/${metahubId}/resources`)
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        for (const packageLabel of ['PlayCanvas Editor', 'PlayCanvas Engine', 'Colyseus Client', 'Colyseus Server']) {
            await connectPackageThroughBrowser(page, packageLabel)
        }
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'MMOOMM resources packages table',
            checkUuidSubstrings: true
        })
        await expectLocalizedValidation(page.getByTestId('metahub-packages-tab'), 'en', {
            label: 'MMOOMM resources packages table'
        })
        const authoringProjectId = await createProjectInstanceAndBindThroughBrowser(page, api, 'MMOOMM Authoring', metahubId)
        const visualLabProjectId = await createProjectInstanceAndBindThroughBrowser(
            page,
            api,
            MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME,
            metahubId
        )

        expect((await requirePlayCanvasProjectByName(api, metahubId, 'MMOOMM Authoring')).id).toBe(authoringProjectId)
        expect((await requirePlayCanvasProjectByName(api, metahubId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)).id).toBe(visualLabProjectId)

        // The fullscreen PlayCanvas Editor host resolves the editor context from the
        // editor package's `playcanvasProject.defaultProjectId`. Without a default
        // project the host renders the "Select a default PlayCanvas project before
        // opening the editor" notice and never mounts the editor iframe.
        await setEditorDefaultProjectThroughBrowser(page, metahubId, 'MMOOMM Authoring')

        const editorPage = await openFullscreenEditorThroughBrowser(page, metahubId, authoringProjectId)
        await expectFullscreenEditorProject(editorPage, metahubId, authoringProjectId, 'MMOOMM Authoring Editor')
        await savePlayCanvasEditorSceneAndExpectReload(editorPage, metahubId)
        await authorMmoommSceneThroughPlayCanvasEditorAndExpectReload(editorPage, metahubId)
        await editorPage.close()

        await setEditorDefaultProjectThroughBrowser(page, metahubId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
        const visualLabEditorPage = await openFullscreenEditorThroughBrowser(page, metahubId, visualLabProjectId)
        await expectFullscreenEditorProject(visualLabEditorPage, metahubId, visualLabProjectId, 'MMOOMM Visual Linkup Lab Editor')
        await authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload(visualLabEditorPage, metahubId)
        await visualLabEditorPage.close()

        await createObjectCollectionsThroughBrowser(page, metahubId, api)
        await createMovementCommandsThroughBrowser(page, metahubId, api)
        await createSimulationConstantsThroughBrowser(page, metahubId, api)
        await authorWelcomePageThroughBrowser(page, api, metahubId)

        // Author the builtin gameplay scripts through the Editor ("+" → Script):
        // createScript uploads the builtin source, the editor parses it through the
        // ESM worker, and the compatibility backend mirrors the parse result into
        // durable script-asset rows — the full user-facing asset loop.
        await setEditorDefaultProjectThroughBrowser(page, metahubId, 'MMOOMM Authoring')
        const scriptEditorPage = await openFullscreenEditorThroughBrowser(page, metahubId, authoringProjectId)
        await expectPlayCanvasEditorIframeLoaded(scriptEditorPage)
        const authoringCompatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(scriptEditorPage, metahubId)
        const authoringCompatibilityScene = (await readPlayCanvasEditorCompatibilityScene(
            scriptEditorPage,
            authoringCompatibilityConfig
        )) as {
            item?: {
                payload?: {
                    entities?: Array<{
                        id?: string
                        name?: string
                        position?: { x?: number; y?: number; z?: number } | number[]
                        scale?: { x?: number; y?: number; z?: number } | number[]
                    }>
                } | null
            }
        }
        const authoringCompatibilityEntities = authoringCompatibilityScene.item?.payload?.entities ?? []
        await authorMmoommScriptAssetsThroughEditor(scriptEditorPage, MMOOMM_BUILTIN_SCRIPT_ASSETS)
        await scriptEditorPage.close()

        await createRuntimeModuleThroughBrowser(page, api, metahubId, {
            scope: 'general',
            codename: 'flight-math',
            name: 'Flight Math',
            role: 'library',
            sourceCode: readCanonicalPlayCanvasBuiltinAsset(repoRoot, path.join('libraries', 'flight-math.ts')),
            capabilities: []
        })
        await createRuntimeModuleThroughBrowser(page, api, metahubId, {
            codename: 'fixed-tick-flight-runtime',
            name: 'Fixed Tick Flight Runtime',
            role: 'module',
            sourceCode: serverModuleSource,
            capabilities: ['metadata.read']
        })

        // Bind every authored gameplay script before publishing so the generated
        // runtime manifest is derived from the same Editor-authored scene graph.
        const scriptAssetsResponse = await apiGet(
            api,
            `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/script-assets`
        )
        expect(scriptAssetsResponse.ok).toBe(true)
        const scriptAssetsPayload = (await scriptAssetsResponse.json()) as {
            items?: Array<{ id: string; scriptName: string; parseStatus?: string }>
        }
        const scriptAssetByName = new Map((scriptAssetsPayload.items ?? []).map((item) => [item.scriptName, item]))
        for (const scriptName of ['flightControl', 'followCamera', 'remoteShips']) {
            expect(scriptAssetByName.get(scriptName), `${scriptName} script asset must be mirrored after editor authoring`).toBeDefined()
        }

        const scenesResponse = await apiGet(api, `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/scenes`)
        expect(scenesResponse.ok).toBe(true)
        const scenesPayload = (await scenesResponse.json()) as { items?: Array<{ id: string }> }
        const authoringScene = (scenesPayload.items ?? [])[0]
        expect(authoringScene?.id, 'MMOOMM Authoring project must expose a scene').toBeDefined()

        const sceneDetailResponse = await apiGet(
            api,
            `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/scenes/${authoringScene.id}`
        )
        expect(sceneDetailResponse.ok).toBe(true)
        const sceneDetail = (await sceneDetailResponse.json()) as {
            item?: {
                payload?: {
                    entities?: Array<{
                        id?: string
                        name?: string
                        position?: { x?: number; y?: number; z?: number } | number[]
                        scale?: { x?: number; y?: number; z?: number } | number[]
                    }>
                } | null
            }
        }
        const sceneEntities = sceneDetail.item?.payload?.entities?.length
            ? sceneDetail.item.payload.entities
            : authoringCompatibilityEntities
        const shipEntity = sceneEntities.find((entity) => entity.name === 'MMOOMM Ship')
        const cameraEntity = sceneEntities.find((entity) => entity.name === 'MMOOMM Follow Camera')
        expect(shipEntity?.id, 'MMOOMM Ship entity id is required for the flightControl binding').toBeDefined()
        expect(cameraEntity?.id, 'MMOOMM Follow Camera entity id is required for the followCamera binding').toBeDefined()

        const readVector = (
            value: { x?: number; y?: number; z?: number } | number[] | undefined,
            fallback: { x: number; y: number; z: number }
        ) => {
            if (Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))) {
                return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) }
            }
            if (value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)) {
                return { x: Number(value.x), y: Number(value.y), z: Number(value.z) }
            }
            return fallback
        }
        const shipScale = readVector(shipEntity.scale, { x: 12, y: 4, z: 4 })
        const station = sceneEntities.find((entity) => entity.name === 'MMOOMM Station')
        const stationPosition = readVector(station?.position, { x: 72, y: 0, z: -48 })
        const stationScale = readVector(station?.scale, { x: 48, y: 16, z: 16 })
        const guardBoxes = [
            {
                center: stationPosition,
                halfExtents: {
                    x: Math.abs(stationScale.x) / 2,
                    y: Math.abs(stationScale.y) / 2,
                    z: Math.abs(stationScale.z) / 2
                }
            }
        ]
        const commonScriptAttributes = {
            controlledEntityId: shipEntity.id,
            guardBoxes
        }
        const scriptAttributeValues: Record<string, Record<string, unknown>> = {
            flightControl: {
                ...commonScriptAttributes,
                shipHalfExtents: {
                    x: Math.abs(shipScale.x) / 2,
                    y: Math.abs(shipScale.y) / 2,
                    z: Math.abs(shipScale.z) / 2
                }
            },
            followCamera: commonScriptAttributes,
            remoteShips: {
                controlledEntityId: shipEntity.id,
                fallbackScale: shipScale,
                shipHalfExtents: {
                    x: Math.abs(shipScale.x) / 2,
                    y: Math.abs(shipScale.y) / 2,
                    z: Math.abs(shipScale.z) / 2
                }
            }
        }

        const bindings = [
            { scriptName: 'flightControl', sceneEntityStableId: shipEntity.id, sortOrder: 0 },
            { scriptName: 'followCamera', sceneEntityStableId: cameraEntity.id, sortOrder: 1 },
            { scriptName: 'remoteShips', sceneEntityStableId: shipEntity.id, sortOrder: 2 }
        ] as const
        for (const binding of bindings) {
            const scriptAsset = scriptAssetByName.get(binding.scriptName)
            if (!scriptAsset) throw new Error(`Missing mirrored script asset ${binding.scriptName}`)
            const bindingResponse = await apiSend(
                api,
                'PUT',
                `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/script-bindings/${generateUuidV7()}`,
                {
                    sceneId: authoringScene.id,
                    sceneEntityStableId: binding.sceneEntityStableId,
                    scriptAssetId: scriptAsset.id,
                    scriptName: binding.scriptName,
                    attributeValues: scriptAttributeValues[binding.scriptName],
                    bindingSchemaVersion: '1',
                    sortOrder: binding.sortOrder,
                    enabled: true
                }
            )
            if (!bindingResponse.ok) {
                const responseBody = await bindingResponse.text()
                throw new Error(
                    `${binding.scriptName} binding must persist before publication: ${bindingResponse.status} ${bindingResponse.statusText} ${responseBody}`
                )
            }
        }

        await publishPlayCanvasProjectThroughBrowser(page, api, metahubId, 'MMOOMM Authoring')
        await publishPlayCanvasProjectThroughBrowser(page, api, metahubId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
        const publishResponse = await apiGet(api, `/api/v1/metahub/${metahubId}/playcanvas/published-runtime-manifests`)
        expect(publishResponse.ok).toBe(true)
        const publishPayload = (await publishResponse.json()) as {
            items?: PublishedRuntimeManifestSummary[]
        }
        const publishedAuthoringManifest = requirePublishedManifestForProject(publishPayload.items, authoringProjectId, 'MMOOMM Authoring')
        expect(publishedAuthoringManifest.scripts?.map((script) => script.scriptName).sort()).toEqual(
            ['flightControl', 'followCamera', 'remoteShips'].sort()
        )
        const runtimeManifest = {
            ...publishedAuthoringManifest,
            projectName: 'MMOOMM Authoring'
        }
        const visualLabRuntimeManifest = {
            ...requirePublishedManifestForProject(publishPayload.items, visualLabProjectId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME),
            projectName: MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME
        }

        const layouts = await listLayouts(api, metahubId)
        const layoutItems = Array.isArray(layouts?.items) ? layouts.items : Array.isArray(layouts) ? layouts : []
        const layout = layoutItems.find((item: { isDefault?: unknown }) => item.isDefault === true) ?? layoutItems[0]
        if (!layout?.id) {
            throw new Error('MMOOMM app generator could not find a default layout')
        }
        await setEditorDefaultProjectThroughBrowser(page, metahubId, 'MMOOMM Authoring')
        await configureRuntimeLayoutThroughBrowser(page, api, metahubId, layout.id, runtimeManifest, visualLabRuntimeManifest)
        await createAndVerifyPublishedRuntimeBeforeExport(page, api, metahubId, runManifest.runId)

        const exportedEnvelope = await exportMetahubSnapshotThroughBrowser(
            page,
            metahubId,
            testInfo.outputPath(`${MMOOMM_APP_FIXTURE_FILENAME}.download.json`)
        )
        const envelope = buildSnapshotEnvelope({
            metahub: {
                ...exportedEnvelope.metahub,
                name: localizedText(MMOOMM_APP_CANONICAL_METAHUB.name.en, MMOOMM_APP_CANONICAL_METAHUB.name.ru),
                description: localizedText(MMOOMM_APP_CANONICAL_METAHUB.description.en, MMOOMM_APP_CANONICAL_METAHUB.description.ru),
                codename: createCodenameVLC('en', MMOOMM_APP_CANONICAL_METAHUB.codename.en) as unknown as Record<string, unknown>
            },
            publication: exportedEnvelope.publication,
            sourceInstance: exportedEnvelope.sourceInstance,
            snapshot: exportedEnvelope.snapshot
        } as never)
        validateSnapshotEnvelope(envelope as unknown as Record<string, unknown>)
        assertMmoommAppFixtureEnvelopeContract(envelope as never)

        const fixturePath = explicitFixtureOutputPath
            ? path.resolve(repoRoot, explicitFixtureOutputPath)
            : shouldUpdateTrackedFixture
            ? path.join(FIXTURES_DIR, MMOOMM_APP_FIXTURE_FILENAME)
            : testInfo.outputPath(MMOOMM_APP_FIXTURE_FILENAME)
        fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')
        expect(fs.existsSync(fixturePath)).toBe(true)
        if (!shouldUpdateTrackedFixture && !explicitFixtureOutputPath) {
            expect(fixturePath).not.toBe(path.join(FIXTURES_DIR, MMOOMM_APP_FIXTURE_FILENAME))
        }
        await expectNoPageHorizontalOverflow(page, 'MMOOMM app generator resources page')
    })
})
