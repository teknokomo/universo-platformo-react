import type { Locator, Page } from '@playwright/test'
import type { ObjectRuntimeMenuIcon } from '@universo-react/types'
import { createCodenameVLC } from '@universo-react/utils'
import { expect } from '../../fixtures/test'
import {
    createComponent,
    createRecord,
    deleteMetahub,
    getMetahubEntity,
    listFixedValues,
    listMetahubs,
    listMetahubModules,
    listObjectCollections,
    listOptionLists,
    listOptionValues,
    listValueGroups,
    updateMetahubEntityConfig,
    updateComponent
} from '../backend/api-session.mjs'
import { recordCreatedMetahub } from '../backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { expectSemanticFieldControls } from '../browser/runtimeUx'
import { entityDialogSelectors, toolbarSelectors } from '../selectors/contracts'
import { MMOOMM_APP_CANONICAL_METAHUB } from '../mmoommAppFixtureContract'
import {
    APP_RUNTIME_TIMEOUT,
    ASTEROID_CODE,
    ASTEROID_STATUS_ENUM,
    CHUNK_MASS_MAX_KG,
    CHUNK_MASS_MIN_KG,
    CHUNK_MASS_SKEW,
    CHUNKS_PER_HIT_MAX,
    CHUNKS_PER_HIT_MIN,
    CHUNK_VISUAL_LIFETIME_MS,
    CURRENCY_CODE,
    ECONOMY_CONSTANTS_CODE,
    ECONOMY_POSTING_MODULE_CODE,
    ECONOMY_POSTING_MODULE_NAME,
    FUEL_PRICE_PER_LITER,
    INVENTORY_LEDGER_CODE,
    MARKET_RADIUS_METERS,
    MAX_CARGO_MASS_KG,
    MINING_COOLDOWN_MS,
    MINING_CONSTANTS_CODE,
    MINING_RADIUS_METERS,
    MINING_STATE_POLL_MS,
    NOMENCLATURE_CODE,
    ORE_PRICE_PER_KG,
    OPERATION_CODE,
    OPERATION_TYPE_ENUM,
    SPACE_SECTION_CODENAME,
    STARTING_BALANCE,
    STARTING_ORE_KG,
    UNIT_ENUM,
    VISUAL_LINKUP_LAB_SECTION_CODENAME,
    WALLET_CODE,
    WALLET_LEDGER_CODE,
    WELCOME_SECTION_CODENAME,
    economyPostingModuleSource,
    localizedInput,
    localizedText,
    readRequestJson
} from '../mmoommAppGeneratorData'
import {
    apiGet,
    apiSend,
    parseJsonResponse,
    fillLocalizedInlineField,
    readLocalizedContent,
    readCodenameText,
    escapeRegExp,
    projectInstanceCodenameForName,
    requireProjectInstanceByName,
    requirePlayCanvasProjectByName,
    setLayoutSwitchThroughBrowser
} from './shared'
import type { ApiContext, ApiSessionLike, CreatedEntityResponse, MetahubSummary } from './shared'

export const createMetahubThroughBrowser = async (page: Page) => {
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

export const deleteExistingCanonicalMmoommMetahubs = async (api: ApiSessionLike) => {
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

export const connectPackageThroughBrowser = async (page: Page, label: string) => {
    const button = page.getByRole('button', { name: `Connect ${label}` })
    await expect(button).toBeVisible()
    await button.click()
    const dialog = page.getByRole('dialog', { name: 'Connect package' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Connect package' }).click()
    await expect(dialog).toHaveCount(0)
}

export const createProjectInstanceAndBindThroughBrowser = async (
    page: Page,
    api: ApiSessionLike,
    projectName: string,
    metahubId: string
) => {
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

export const openProjectEditDialogPlayCanvasTab = async (page: Page, metahubId: string, projectName: string) => {
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
    values: { name: string; codename: string; localizedName?: { en: string; ru: string }; menuIcon?: ObjectRuntimeMenuIcon }
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
    const createAction = page.getByTestId(toolbarSelectors.primaryAction)
    await expect(createAction).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
    await createAction.click({ timeout: APP_RUNTIME_TIMEOUT })
    const dialog = page.getByRole('dialog', { name: labels.dialog })
    await expect(dialog).toBeVisible()
    if (values.localizedName) {
        await fillLocalizedInlineField(page, dialog, 'Name', values.localizedName)
        await dialog.getByLabel('Codename').first().fill(values.codename)
    } else {
        await fillNameAndCodename(dialog, values)
    }

    if (kind === 'object' && values.menuIcon) {
        const iconLabelByKey: Record<ObjectRuntimeMenuIcon, string> = {
            home: 'Home',
            analytics: 'Analytics',
            users: 'People',
            tasks: 'Tasks',
            database: 'Database',
            folder: 'Folder',
            apps: 'Applications',
            dashboard: 'Dashboard',
            page: 'Page',
            article: 'Article',
            school: 'Learning',
            recent: 'Recent',
            star: 'Favorites',
            trash: 'Trash',
            settings: 'Settings',
            more: 'More'
        }
        await dialog.getByRole('tab', { name: 'Navigation', exact: true }).click()
        await dialog.getByRole('checkbox', { name: 'Show in application menu', exact: true }).check()
        await dialog.getByRole('combobox', { name: 'Menu icon', exact: true }).click()
        await page.getByRole('option', { name: iconLabelByKey[values.menuIcon], exact: true }).click()
    }

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

export const createObjectCollectionsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext) => {
    const createdNames: string[] = []
    const entities: Array<{
        name: string
        codename: string
        localizedName?: { en: string; ru: string }
        menuIcon?: ObjectRuntimeMenuIcon
    }> = [
        { name: 'Space', codename: SPACE_SECTION_CODENAME, localizedName: { en: 'Space', ru: 'Космос' }, menuIcon: 'apps' },
        {
            name: 'Visual Linkup Lab',
            codename: VISUAL_LINKUP_LAB_SECTION_CODENAME,
            localizedName: { en: 'Visual Linkup Lab', ru: 'Визуальная лаборатория' },
            menuIcon: 'analytics'
        },
        { name: 'Flight Ship', codename: 'FlightShip' },
        { name: 'Flight Station', codename: 'FlightStation' }
    ]
    for (const entity of entities) {
        const createdId = await createStandardEntityThroughBrowser(page, metahubId, 'object', entity)
        await expect
            .poll(
                async () => {
                    const payload = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
                    return payload.items?.some((item: { id?: string }) => item.id === createdId) ?? false
                },
                { timeout: APP_RUNTIME_TIMEOUT }
            )
            .toBe(true)
        createdNames.push(entity.name)
    }

    await page.goto(`/metahub/${metahubId}/entities/object/instances`, {
        waitUntil: 'domcontentloaded',
        timeout: 180_000
    })
    for (const name of createdNames) {
        await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
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

export const createMovementCommandsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext) => {
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
    values: { name: string; codename: string; value: number | string; dataType?: 'Number' | 'String'; scale?: number }
) => {
    const dataType = values.dataType ?? 'Number'
    await page.goto(`/metahub/${metahubId}/entities/set/instance/${setId}/fixed-values`)
    await expect(page.getByRole('heading', { name: /(Fixed Values|Constants)/i })).toBeVisible()
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: /Create (Constant|Fixed Value)/i })
    await expect(dialog).toBeVisible()
    await fillNameAndCodename(dialog, values)
    await dialog.getByLabel('Data Type').click()
    await page.getByRole('option', { name: dataType }).click()
    await dialog.getByRole('tab', { name: 'Value' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Value' })).toBeVisible({ timeout: 15_000 })
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

export const createSimulationConstantsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext) => {
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

export const authorWelcomePageThroughBrowser = async (page: Page, api: ApiContext, metahubId: string) => {
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

export const createRuntimeModuleThroughBrowser = async (
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

// ---------------------------------------------------------------------------
// MMOOMM economy MVP authoring (Phase F)
// ---------------------------------------------------------------------------

export type EconomyComponentSpec = {
    codename: string
    dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'REF'
    scale?: number
    required?: boolean
    /** REF target: entity kind plus the codename of the target instance. */
    ref?: { kind: 'object' | 'enumeration'; codename: string }
}

const waitForObjectComponentPersisted = async (
    api: ApiContext,
    metahubId: string,
    objectCollectionId: string,
    codename: string,
    label: string
) => {
    await expect
        .poll(
            async () => {
                const payload = (await listComponentsQuiet(api, metahubId, objectCollectionId)) as {
                    items?: Array<{ codename?: unknown }>
                }
                return payload.items?.some((item) => readCodenameText(item.codename) === codename) ?? false
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: `${label} must be visible through the API` }
        )
        .toBe(true)
}

const listComponentsQuiet = async (api: ApiContext, metahubId: string, objectCollectionId: string) => {
    const response = await apiGet(
        api,
        `/api/v1/metahub/${metahubId}/entities/object/instance/${objectCollectionId}/components?limit=200&offset=0`
    )
    if (!response.ok) {
        throw new Error(`Listing components for object ${objectCollectionId} failed with ${response.status}`)
    }
    return response.json()
}

const resolveObjectIdByCodename = async (api: ApiContext, metahubId: string, codename: string): Promise<string> => {
    let objectId: string | null = null
    await expect
        .poll(
            async () => {
                const payload = (await listObjectCollections(api, metahubId, { limit: 200, offset: 0 })) as {
                    items?: Array<{ id?: string; codename?: unknown }>
                }
                const match = payload.items?.find((item) => readCodenameText(item.codename) === codename)
                objectId = typeof match?.id === 'string' ? match.id : null
                return Boolean(objectId)
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: `Object ${codename} must be resolvable by codename` }
        )
        .toBe(true)
    if (!objectId) {
        throw new Error(`Could not resolve object entity by codename ${codename}`)
    }
    return objectId
}

const resolveEnumerationIdByCodename = async (api: ApiContext, metahubId: string, codename: string): Promise<string> => {
    let enumerationId: string | null = null
    await expect
        .poll(
            async () => {
                const payload = (await listOptionLists(api, metahubId, { limit: 200, offset: 0 })) as {
                    items?: Array<{ id?: string; codename?: unknown }>
                }
                const match = payload.items?.find((item) => readCodenameText(item.codename) === codename)
                enumerationId = typeof match?.id === 'string' ? match.id : null
                return Boolean(enumerationId)
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: `Enumeration ${codename} must be resolvable by codename` }
        )
        .toBe(true)
    if (!enumerationId) {
        throw new Error(`Could not resolve enumeration entity by codename ${codename}`)
    }
    return enumerationId
}

const resolveEnumerationValueIdByCodename = async (
    api: ApiContext,
    metahubId: string,
    enumerationId: string,
    codename: string
): Promise<string> => {
    let valueId: string | null = null
    await expect
        .poll(
            async () => {
                const payload = (await listOptionValues(api, metahubId, enumerationId, { limit: 200, offset: 0 })) as {
                    items?: Array<{ id?: string; codename?: unknown }>
                }
                const match = payload.items?.find((item) => readCodenameText(item.codename) === codename)
                valueId = typeof match?.id === 'string' ? match.id : null
                return Boolean(valueId)
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: `Enumeration value ${codename} must be resolvable by codename` }
        )
        .toBe(true)
    if (!valueId) {
        throw new Error(`Could not resolve enumeration value by codename ${codename}`)
    }
    return valueId
}

/**
 * Creates components for an object collection. Scalar components (STRING /
 * NUMBER / DATE / BOOLEAN) are authored through the real Components tab UI.
 * REF components are created through the same REST endpoint the frontend uses
 * (`POST /api/v1/metahub/:id/entities/object/instance/:id/components` with
 * `targetEntityKind` / `targetEntityId`): the dialog's ref targeting lives
 * behind a collapsed "Type settings" section plus a MUI Autocomplete, which is
 * the brittle surface this helper deliberately avoids (documented Phase F
 * deviation). Codenames double as EN display names so that Behavior/Ledger
 * select options are addressable by the codename itself.
 */
export const createObjectComponentsThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    objectCollectionId: string,
    components: EconomyComponentSpec[]
): Promise<void> => {
    const refComponents = components.filter((component) => component.dataType === 'REF')
    const scalarComponents = components.filter((component) => component.dataType !== 'REF')

    for (const component of refComponents) {
        if (!component.ref) {
            throw new Error(`REF component ${component.codename} is missing its ref target`)
        }
        const targetId =
            component.ref.kind === 'enumeration'
                ? await resolveEnumerationIdByCodename(api, metahubId, component.ref.codename)
                : await resolveObjectIdByCodename(api, metahubId, component.ref.codename)
        await createComponent(api, metahubId, objectCollectionId, {
            name: { en: component.codename },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', component.codename),
            dataType: 'REF',
            isRequired: component.required === true,
            targetEntityKind: component.ref.kind,
            targetEntityId: targetId
        })
        await waitForObjectComponentPersisted(api, metahubId, objectCollectionId, component.codename, `REF component ${component.codename}`)
    }

    if (scalarComponents.length === 0) {
        return
    }

    const componentsPath = `/metahub/${metahubId}/entities/object/instance/${objectCollectionId}/components`
    await page.goto(componentsPath, { waitUntil: 'domcontentloaded', timeout: APP_RUNTIME_TIMEOUT })
    await expect(page.getByTestId('view-header-title-region').getByText('Components', { exact: true })).toBeVisible({
        timeout: APP_RUNTIME_TIMEOUT
    })

    for (const component of scalarComponents) {
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const dialog = page.getByRole('dialog', { name: 'Create Component' })
        await expect(dialog).toBeVisible()
        await fillLocalizedInlineField(page, dialog, 'Name', { en: component.codename, ru: component.codename })
        await dialog.getByLabel('Data Type').click()
        const dataTypeLabels = {
            STRING: 'String',
            NUMBER: 'Number',
            DATE: 'Date',
            BOOLEAN: 'Boolean'
        } as const
        await page.getByRole('option', { name: dataTypeLabels[component.dataType] }).click()
        const needsTypeSettings =
            (component.dataType === 'NUMBER' && typeof component.scale === 'number') || component.dataType === 'STRING'
        if (needsTypeSettings) {
            // Precision/Scale/Max Length sit inside the collapsed 'Type Settings' section.
            const typeSettingsToggle = dialog.getByRole('button', { name: 'Type Settings' })
            if ((await typeSettingsToggle.getAttribute('aria-expanded')) !== 'true') {
                await typeSettingsToggle.click()
            }
        }
        if (component.dataType === 'NUMBER' && typeof component.scale === 'number') {
            // Default scale is 0; fractional seed values (TZ §7.6 VolumePerUnit 0.001)
            // need the decimal Places rule widened before the record is validated.
            await dialog.getByLabel('Decimal places').fill(String(component.scale))
        }
        if (component.dataType === 'STRING') {
            // The dialog defaults STRING maxLength to 10 (localizedFormDefaults), but
            // economy STRING values include UUIDs (36 chars) — clear the limit so the
            // column is TEXT ('Leave empty when the value should not have a fixed
            // length limit.' per the field helper text).
            await dialog.getByLabel('Max Length').fill('')
        }
        const requiredSwitch = dialog.getByRole('switch', { name: 'Required' })
        const desiredRequired = component.required === true
        const currentRequired = await requiredSwitch.isChecked().catch(() => false)
        if (await requiredSwitch.isEnabled().catch(() => false)) {
            if (currentRequired !== desiredRequired) {
                if (desiredRequired) {
                    await requiredSwitch.check()
                } else {
                    await requiredSwitch.uncheck()
                }
            }
        } else {
            // The first component on a fresh object is forced into the display
            // component slot (which implies required) — the switch is locked and
            // already checked, so the only acceptable spec there is required.
            expect(desiredRequired, `Component ${component.codename} is forced required as the first component`).toBe(true)
            expect(currentRequired).toBe(true)
        }
        await dialog.getByLabel('Codename').first().fill(component.codename)

        const createResponse = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().includes(`/instance/${objectCollectionId}/components`),
            { label: `Creating component ${component.codename}`, timeout: 120_000 }
        )
        await dialog.getByTestId(entityDialogSelectors.submitButton).click()
        await parseJsonResponse<CreatedEntityResponse>(await createResponse, `Creating component ${component.codename}`)
        await expect(dialog).toHaveCount(0)
        await waitForObjectComponentPersisted(api, metahubId, objectCollectionId, component.codename, `Component ${component.codename}`)
    }
}

export const createEconomyEnumerationsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext): Promise<void> => {
    const enumerations = [
        {
            name: 'Operation Type',
            codename: OPERATION_TYPE_ENUM,
            values: [
                { codename: 'StarterGrant', name: 'Starter grant', isDefault: true },
                { codename: 'Sell', name: 'Sell', isDefault: false },
                { codename: 'Buy', name: 'Buy', isDefault: false },
                { codename: 'Mine', name: 'Mine', isDefault: false },
                { codename: 'Fee', name: 'Fee', isDefault: false }
            ]
        },
        {
            name: 'Unit',
            codename: UNIT_ENUM,
            values: [
                { codename: 'Kg', name: 'Kilogram', isDefault: true },
                { codename: 'Liter', name: 'Liter', isDefault: false },
                { codename: 'Unit', name: 'Unit', isDefault: false },
                { codename: 'M3', name: 'Cubic meter', isDefault: false }
            ]
        }
    ]

    for (const enumeration of enumerations) {
        const enumerationId = await createStandardEntityThroughBrowser(page, metahubId, 'enumeration', {
            name: enumeration.name,
            codename: enumeration.codename
        })
        await expect
            .poll(async () => {
                const payload = (await listOptionLists(api, metahubId, { limit: 200, offset: 0 })) as { items?: Array<{ id?: string }> }
                return payload.items?.some((item) => item.id === enumerationId) ?? false
            })
            .toBe(true)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByText(enumeration.name, { exact: true }).first()).toBeVisible({ timeout: 60_000 })

        for (const value of enumeration.values) {
            const createdId = await createEnumerationValueThroughBrowser(page, metahubId, enumerationId, value)
            await expect
                .poll(async () => {
                    const payload = (await listOptionValues(api, metahubId, enumerationId, { limit: 200, offset: 0 })) as {
                        items?: Array<{ id?: string }>
                    }
                    return payload.items?.some((item) => item.id === createdId) ?? false
                })
                .toBe(true)
        }
    }
}

export const createEconomyConstantsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext): Promise<void> => {
    const setId = await createStandardEntityThroughBrowser(page, metahubId, 'set', {
        name: 'Economy Constants',
        codename: ECONOMY_CONSTANTS_CODE
    })
    await expect
        .poll(async () => {
            const payload = (await listValueGroups(api, metahubId, { limit: 200, offset: 0 })) as { items?: Array<{ id?: string }> }
            return payload.items?.some((item) => item.id === setId) ?? false
        })
        .toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Economy Constants', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

    for (const constant of [
        { codename: 'CurrencyCode', name: 'Currency code', value: CURRENCY_CODE, dataType: 'String' as const },
        { codename: 'StartingBalance', name: 'Starting balance', value: STARTING_BALANCE },
        { codename: 'StartingOreKg', name: 'Starting ore, kg', value: STARTING_ORE_KG },
        { codename: 'OrePricePerKg', name: 'Ore price per kg', value: ORE_PRICE_PER_KG },
        { codename: 'FuelPricePerLiter', name: 'Fuel price per liter', value: FUEL_PRICE_PER_LITER },
        { codename: 'MaxCargoMassKg', name: 'Max cargo mass, kg', value: MAX_CARGO_MASS_KG },
        { codename: 'MarketRadiusMeters', name: 'Market radius, m', value: MARKET_RADIUS_METERS }
    ]) {
        const createdId = await createFixedValueThroughBrowser(page, metahubId, setId, constant)
        await expect
            .poll(async () => {
                const payload = (await listFixedValues(api, metahubId, setId, { limit: 100, offset: 0 })) as {
                    items?: Array<{ id?: string }>
                }
                return payload.items?.some((item) => item.id === createdId) ?? false
            })
            .toBe(true)
    }
}

/**
 * Mining belt metadata (mining TZ §7.3/§7.4): the `AsteroidStatus` enumeration
 * (Active/Depleted) and the `MiningConstants` set with the nine baked values
 * the runtime service resolves fail-closed.
 */
export const createMiningEnumerationAndConstantsThroughBrowser = async (page: Page, metahubId: string, api: ApiContext): Promise<void> => {
    const statusEnumId = await createStandardEntityThroughBrowser(page, metahubId, 'enumeration', {
        name: 'Asteroid Status',
        codename: ASTEROID_STATUS_ENUM
    })
    await expect
        .poll(async () => {
            const payload = (await listOptionLists(api, metahubId, { limit: 200, offset: 0 })) as { items?: Array<{ id?: string }> }
            return payload.items?.some((item) => item.id === statusEnumId) ?? false
        })
        .toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Asteroid Status', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

    for (const value of [
        { codename: 'Active', name: 'Active', isDefault: true },
        { codename: 'Depleted', name: 'Depleted', isDefault: false }
    ]) {
        const createdId = await createEnumerationValueThroughBrowser(page, metahubId, statusEnumId, value)
        await expect
            .poll(async () => {
                const payload = (await listOptionValues(api, metahubId, statusEnumId, { limit: 200, offset: 0 })) as {
                    items?: Array<{ id?: string }>
                }
                return payload.items?.some((item) => item.id === createdId) ?? false
            })
            .toBe(true)
    }

    const miningSetId = await createStandardEntityThroughBrowser(page, metahubId, 'set', {
        name: 'Mining Constants',
        codename: MINING_CONSTANTS_CODE
    })
    await expect
        .poll(async () => {
            const payload = (await listValueGroups(api, metahubId, { limit: 200, offset: 0 })) as { items?: Array<{ id?: string }> }
            return payload.items?.some((item) => item.id === miningSetId) ?? false
        })
        .toBe(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Mining Constants', { exact: true }).first()).toBeVisible({ timeout: 60_000 })

    // Integer constants go through the browser UI; the fractional chunk-mass
    // constants are created through the API with `validationRules.scale = 3` —
    // the fixed-value dialog defaults NUMBER scale to 0 (decimals are nulled),
    // and driving the hidden Type Settings input from the generator proved
    // flaky across runs.
    for (const constant of [
        { codename: 'MiningRadiusMeters', name: 'Mining radius, m', value: MINING_RADIUS_METERS },
        { codename: 'MiningCooldownMs', name: 'Mining cooldown, ms', value: MINING_COOLDOWN_MS },
        { codename: 'ChunksPerHitMin', name: 'Chunks per hit, min', value: CHUNKS_PER_HIT_MIN },
        { codename: 'ChunksPerHitMax', name: 'Chunks per hit, max', value: CHUNKS_PER_HIT_MAX },
        { codename: 'ChunkVisualLifetimeMs', name: 'Chunk visual lifetime, ms', value: CHUNK_VISUAL_LIFETIME_MS },
        { codename: 'MiningStatePollMs', name: 'Mining state poll, ms', value: MINING_STATE_POLL_MS }
    ]) {
        const createdId = await createFixedValueThroughBrowser(page, metahubId, miningSetId, constant)
        await expect
            .poll(async () => {
                const payload = (await listFixedValues(api, metahubId, miningSetId, { limit: 100, offset: 0 })) as {
                    items?: Array<{ id?: string }>
                }
                return payload.items?.some((item) => item.id === createdId) ?? false
            })
            .toBe(true)
    }

    for (const constant of [
        { codename: 'ChunkMassMinKg', name: 'Chunk mass min, kg', value: CHUNK_MASS_MIN_KG, sortOrder: 5 },
        { codename: 'ChunkMassMaxKg', name: 'Chunk mass max, kg', value: CHUNK_MASS_MAX_KG, sortOrder: 6 },
        { codename: 'ChunkMassSkew', name: 'Chunk mass skew', value: CHUNK_MASS_SKEW, sortOrder: 7 }
    ]) {
        const response = await apiSend(api, 'POST', `/api/v1/metahub/${metahubId}/entities/set/instance/${miningSetId}/fixed-values`, {
            codename: localizedText(constant.codename, constant.codename),
            dataType: 'NUMBER',
            name: localizedInput(constant.name, constant.name),
            namePrimaryLocale: 'en',
            validationRules: { scale: 3 },
            value: constant.value,
            sortOrder: constant.sortOrder
        })
        if (!response.ok) {
            const bodyText = await response.text()
            throw new Error(`Creating fixed value ${constant.codename} failed with ${response.status} ${response.statusText}: ${bodyText}`)
        }
    }

    await expect
        .poll(async () => {
            const payload = (await listFixedValues(api, metahubId, miningSetId, { limit: 100, offset: 0 })) as {
                items?: Array<{ id?: string; value?: unknown }>
            }
            return payload.items?.filter((item) => item.value !== null && item.value !== undefined).length ?? 0
        })
        .toBe(9)
}

const openObjectEditDialogThroughBrowser = async (page: Page, metahubId: string, entityId: string, objectName: string) => {
    await page.goto(`/metahub/${metahubId}/entities/object/instances`, { waitUntil: 'domcontentloaded', timeout: APP_RUNTIME_TIMEOUT })
    await expect(page.getByRole('heading', { name: 'Objects' })).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
    // The instances surface renders entity cards (Card View by default), so target the
    // BaseEntityMenu trigger by its stable data-testid instead of a row role.
    const menuTrigger = page.getByTestId(`entity-menu-trigger-object-${entityId}`)
    await expect(menuTrigger, `Objects card menu for ${objectName} must be visible`).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
    await menuTrigger.click()
    await page.getByTestId(`entity-menu-item-object-edit-${entityId}`).click()
    const editDialog = page.getByRole('dialog', { name: 'Edit Object' })
    await expect(editDialog).toBeVisible({ timeout: APP_RUNTIME_TIMEOUT })
    await expect(editDialog.getByLabel('Name').first()).toHaveValue(objectName)
    return editDialog
}

const selectDialogOption = async (page: Page, label: string) => {
    await page.getByRole('option', { name: label, exact: true }).click()
}

const assertLedgerConfigThroughApi = async (
    api: ApiContext,
    metahubId: string,
    codename: string,
    expectedProjectionCodenames: readonly string[]
) => {
    let ledgerConfig: Record<string, unknown> | null = null
    await expect
        .poll(
            async () => {
                const payload = (await listObjectCollections(api, metahubId, { limit: 200, offset: 0 })) as {
                    items?: Array<{ id?: string; codename?: unknown; config?: Record<string, unknown> | null }>
                }
                const match = payload.items?.find((item) => readCodenameText(item.codename) === codename)
                const config = match?.config
                ledgerConfig =
                    config && typeof config === 'object' && !Array.isArray(config)
                        ? (config.ledger as Record<string, unknown>) ?? null
                        : null
                if (!ledgerConfig) return false
                const projections = Array.isArray(ledgerConfig.projections)
                    ? (ledgerConfig.projections as Array<{ codename?: unknown }>)
                    : []
                return expectedProjectionCodenames.every((expected) =>
                    projections.some((projection) => typeof projection.codename === 'string' && projection.codename.includes(expected))
                )
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: `Ledger config for ${codename} must be persisted with its projections` }
        )
        .toBe(true)
    if (!ledgerConfig) {
        throw new Error(`Ledger config for ${codename} did not persist`)
    }
    expect(ledgerConfig.sourcePolicy).toBe('registrar')
    return ledgerConfig
}

export type LedgerRegisterConfig = {
    codename: string
    components: EconomyComponentSpec[]
    fieldRoles: Array<{ fieldCodename: string; role: 'dimension' | 'resource' | 'component'; aggregate?: 'sum' }>
    projections: Array<{ codename: string; kind: 'balance' | 'turnover'; dimensions: string[]; resources: string[] }>
}

/**
 * Creates a register entity (object kind + `config.ledger`, the LMS pattern
 * pinned by D1): object → components → reopen the Edit dialog → Ledger schema
 * tab → enable the ledger, configure mode/mutation/source/periodicity/
 * effective date/registrar kinds/field roles/projections → submit.
 *
 * The projections are added while the ledger periodicity is temporarily 'day'
 * (new projections inherit the current periodicity), then the periodicity is
 * restored to 'instant' — the UI exposes no per-projection period control.
 */
const ECONOMY_OWNER_ONLY_ACCESS = { mode: 'ownerOnly', ownerColumnName: '_upl_created_by' } as const

/**
 * D6: Wallet/Operation runtime record reads must scope to their creator.
 * `runtimeRecordAccess` has no authoring UI (backend-only config), so the
 * generator merges it into the entity config through the entity PATCH API
 * after the UI authoring pass has produced the rest of the config.
 */
export const applyEconomyRecordAccessThroughApi = async (api: ApiContext, metahubId: string, entityId: string): Promise<void> => {
    const entity = (await getMetahubEntity(api, metahubId, entityId)) as {
        version?: number
        config?: Record<string, unknown>
    }
    const config = { ...(entity.config ?? {}), runtimeRecordAccess: ECONOMY_OWNER_ONLY_ACCESS }
    await updateMetahubEntityConfig(api, metahubId, entityId, config, Number(entity.version ?? 0))
    await expect
        .poll(async () => {
            const refreshed = (await getMetahubEntity(api, metahubId, entityId)) as { config?: Record<string, unknown> }
            const access = (refreshed.config?.runtimeRecordAccess ?? {}) as Record<string, unknown>
            return access.mode === 'ownerOnly'
        })
        .toBe(true)
}

export const configureLedgerRegisterThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    register: LedgerRegisterConfig
): Promise<void> => {
    const entityId = await createStandardEntityThroughBrowser(page, metahubId, 'object', {
        name: register.codename,
        codename: register.codename,
        localizedName: { en: register.codename, ru: register.codename }
    })
    await expect
        .poll(async () => {
            const payload = (await listObjectCollections(api, metahubId, { limit: 200, offset: 0 })) as { items?: Array<{ id?: string }> }
            return payload.items?.some((item) => item.id === entityId) ?? false
        })
        .toBe(true)

    await createObjectComponentsThroughBrowser(page, api, metahubId, entityId, register.components)

    const editDialog = await openObjectEditDialogThroughBrowser(page, metahubId, entityId, register.codename)
    await editDialog.getByRole('tab', { name: 'Ledger schema' }).click()
    const enableLedger = editDialog.getByRole('checkbox', { name: 'Use this entity as a ledger' })
    await expect(enableLedger).toBeVisible()
    if (!(await enableLedger.isChecked())) {
        await enableLedger.check()
    }

    // Periodicity first so every projection added below inherits 'day'.
    await editDialog.getByTestId('ledger-periodicity-select').locator('..').click()
    await selectDialogOption(page, 'Day')
    await editDialog.getByTestId('ledger-mode-select').locator('..').click()
    await selectDialogOption(page, 'Facts')
    await editDialog.getByTestId('ledger-mutation-policy-select').locator('..').click()
    await selectDialogOption(page, 'Append only')
    await editDialog.getByTestId('ledger-source-policy-select').locator('..').click()
    await selectDialogOption(page, 'Registrar only')
    await editDialog.getByTestId('ledger-effective-date-select').locator('..').click()
    await selectDialogOption(page, 'OccurredAt')
    await editDialog.getByTestId('ledger-registrar-kinds').locator('..').click()
    // Registrar kind options carry the entity kind key as their value; the
    // visible label is the localized entity type name, so select by value.
    const objectKindOption = page.locator('li[role="option"][data-value="object"]')
    await expect(objectKindOption).toBeVisible()
    await objectKindOption.click()
    await page.keyboard.press('Escape')

    for (const [roleIndex, role] of register.fieldRoles.entries()) {
        await editDialog.getByTestId('ledger-field-role-add').click()
        const fieldSelect = editDialog.getByRole('combobox', { name: 'Field', exact: true }).nth(roleIndex)
        await fieldSelect.click()
        await selectDialogOption(page, role.fieldCodename)
        const roleSelect = editDialog.getByRole('combobox', { name: 'Role', exact: true }).nth(roleIndex)
        await roleSelect.click()
        const roleLabels = { dimension: 'Dimension', resource: 'Resource', component: 'Component' } as const
        await selectDialogOption(page, roleLabels[role.role])
        // Aggregate defaults to 'sum' in LedgerSchemaFields for resource roles — no click needed.
    }

    for (const [projectionIndex, projection] of register.projections.entries()) {
        await editDialog.getByTestId('ledger-projection-add').click()
        await editDialog.getByTestId('ledger-projection-codename').nth(projectionIndex).fill(projection.codename)
        const kindSelect = editDialog.getByRole('combobox', { name: 'Kind', exact: true }).nth(projectionIndex)
        await kindSelect.click()
        await selectDialogOption(page, projection.kind === 'balance' ? 'Balance' : 'Turnover')
        await editDialog.getByTestId('ledger-projection-dimensions').nth(projectionIndex).fill(projection.dimensions.join(', '))
        await editDialog.getByTestId('ledger-projection-resources').nth(projectionIndex).fill(projection.resources.join(', '))
    }

    // Restore the ledger periodicity after the projections captured 'day'.
    await editDialog.getByTestId('ledger-periodicity-select').locator('..').click()
    await selectDialogOption(page, 'instant')

    const updateResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PATCH' &&
            (response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${entityId}`) ||
                response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/object/instance/${entityId}`)),
        { label: `Saving ledger config for ${register.codename}`, timeout: 120_000 }
    )
    await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await parseJsonResponse<CreatedEntityResponse>(await updateResponse, `Saving ledger config for ${register.codename}`)
    await expect(editDialog).toHaveCount(0)

    const persisted = await assertLedgerConfigThroughApi(
        api,
        metahubId,
        register.codename,
        register.projections.map((projection) => projection.codename)
    )
    expect(persisted.mutationPolicy).toBe('appendOnly')
}

export type EconomyObjectIds = {
    nomenclatureId: string
    walletId: string
    operationId: string
}

const readCodenameTextForAuthoring = (value: unknown): string => {
    if (typeof value === 'string') return value.trim()
    if (value && typeof value === 'object') {
        const record = value as { _primary?: unknown; locales?: Record<string, { content?: unknown }> }
        const primary = typeof record._primary === 'string' ? record._primary : 'en'
        const content = record.locales?.[primary]?.content ?? record.locales?.en?.content
        return typeof content === 'string' ? content.trim() : ''
    }
    return ''
}

export const createEconomyObjectsThroughBrowser = async (page: Page, api: ApiContext, metahubId: string): Promise<EconomyObjectIds> => {
    const nomenclatureId = await createStandardEntityThroughBrowser(page, metahubId, 'object', {
        name: NOMENCLATURE_CODE,
        codename: NOMENCLATURE_CODE,
        localizedName: { en: NOMENCLATURE_CODE, ru: 'Номенклатура' }
    })
    const walletId = await createStandardEntityThroughBrowser(page, metahubId, 'object', {
        name: WALLET_CODE,
        codename: WALLET_CODE,
        localizedName: { en: WALLET_CODE, ru: 'Кошелёк' }
    })
    const operationId = await createStandardEntityThroughBrowser(page, metahubId, 'object', {
        name: OPERATION_CODE,
        codename: OPERATION_CODE,
        localizedName: { en: OPERATION_CODE, ru: 'Операция' }
    })

    await createObjectComponentsThroughBrowser(page, api, metahubId, nomenclatureId, [
        { codename: 'Code', dataType: 'STRING', required: true },
        { codename: 'Name', dataType: 'STRING' },
        { codename: 'Unit', dataType: 'REF', ref: { kind: 'enumeration', codename: UNIT_ENUM } },
        { codename: 'MassPerUnit', dataType: 'NUMBER', required: true, scale: 3 },
        { codename: 'VolumePerUnit', dataType: 'NUMBER', scale: 3 },
        { codename: 'BasePrice', dataType: 'NUMBER', required: true },
        { codename: 'Status', dataType: 'STRING' }
    ])
    await createObjectComponentsThroughBrowser(page, api, metahubId, walletId, [
        { codename: 'OwnerKey', dataType: 'STRING', required: true },
        { codename: 'Currency', dataType: 'STRING', required: true },
        { codename: 'Status', dataType: 'STRING' }
    ])
    await createObjectComponentsThroughBrowser(page, api, metahubId, operationId, [
        { codename: 'OperationType', dataType: 'REF', required: true, ref: { kind: 'enumeration', codename: OPERATION_TYPE_ENUM } },
        { codename: 'Wallet', dataType: 'REF', required: true, ref: { kind: 'object', codename: WALLET_CODE } },
        { codename: 'Station', dataType: 'REF', ref: { kind: 'object', codename: 'FlightStation' } },
        { codename: 'Nomenclature', dataType: 'REF', ref: { kind: 'object', codename: NOMENCLATURE_CODE } },
        { codename: 'Quantity', dataType: 'NUMBER', required: true, scale: 3 },
        { codename: 'UnitPrice', dataType: 'NUMBER', required: true },
        // Server-stamped positive monetary magnitude (unit price x quantity;
        // the StarterGrant credits StartingBalance) the posting module turns
        // into signed ledger movements without baked price literals.
        { codename: 'TotalPrice', dataType: 'NUMBER', required: true, scale: 3 },
        { codename: 'OccurredAt', dataType: 'DATE', required: true },
        // Operation.Status stays optional: the economy service creates rows
        // without it and a required missing field fails row creation.
        { codename: 'Status', dataType: 'STRING' },
        // Mining TZ §10.2: server-stamped STRING discriminators — OperationKind
        // drives the posting-module Mine branch, AsteroidCode pins the source.
        { codename: 'OperationKind', dataType: 'STRING' },
        { codename: 'AsteroidCode', dataType: 'STRING' }
    ])

    // Greptile P1 fix: the economy amount fields are server-owned — the generic
    // rows API strips client-supplied values (and 400s explicit ones), so only
    // the economy service can stamp amounts. Without this an editor could mint
    // credits by creating and posting an operation with arbitrary amounts.
    const operationComponents = (await listComponentsQuiet(api, metahubId, operationId)) as {
        items?: Array<{ id?: unknown; codename?: unknown }>
    }
    const componentIdByCodename = new Map<string, string>()
    for (const component of operationComponents.items ?? []) {
        const codenameText = readCodenameTextForAuthoring(component.codename)
        if (codenameText) componentIdByCodename.set(codenameText, String(component.id))
    }
    for (const amountCodename of ['Quantity', 'UnitPrice', 'TotalPrice', 'OperationKind', 'AsteroidCode']) {
        const componentId = componentIdByCodename.get(amountCodename)
        expect(componentId, `Operation component ${amountCodename} must exist`).toBeTruthy()
        await updateComponent(api, metahubId, operationId, String(componentId), { uiConfig: { serverOwned: true } })
    }

    await applyEconomyRecordAccessThroughApi(api, metahubId, walletId)
    await applyEconomyRecordAccessThroughApi(api, metahubId, operationId)

    return { nomenclatureId, walletId, operationId }
}

export interface MiningObjectIds {
    asteroidId: string
}

/**
 * Mining belt object (mining TZ §7.2): the `Asteroid` object with its fields,
 * where `RemainingQuantityKg`/`Status`/`LastMinedAt` are server-owned (the
 * generic rows API rejects client writes — the fire flow is the only writer).
 */
export const createMiningObjectsThroughBrowser = async (page: Page, api: ApiContext, metahubId: string): Promise<MiningObjectIds> => {
    const asteroidId = await createStandardEntityThroughBrowser(page, metahubId, 'object', {
        name: ASTEROID_CODE,
        codename: ASTEROID_CODE,
        localizedName: { en: ASTEROID_CODE, ru: 'Астероид' }
    })

    await createObjectComponentsThroughBrowser(page, api, metahubId, asteroidId, [
        { codename: 'Code', dataType: 'STRING', required: true },
        { codename: 'Name', dataType: 'STRING' },
        { codename: 'ResourceCode', dataType: 'STRING', required: true },
        { codename: 'PositionX', dataType: 'NUMBER', required: true },
        { codename: 'PositionY', dataType: 'NUMBER', required: true },
        { codename: 'PositionZ', dataType: 'NUMBER', required: true },
        { codename: 'Scale', dataType: 'NUMBER', required: true },
        { codename: 'TotalQuantityKg', dataType: 'NUMBER', required: true, scale: 3 },
        { codename: 'RemainingQuantityKg', dataType: 'NUMBER', required: true, scale: 3 },
        { codename: 'Status', dataType: 'REF', ref: { kind: 'enumeration', codename: ASTEROID_STATUS_ENUM } },
        { codename: 'VisualVariant', dataType: 'NUMBER' },
        { codename: 'ChunkMinKg', dataType: 'NUMBER', scale: 3 },
        { codename: 'ChunkMaxKg', dataType: 'NUMBER', scale: 3 },
        { codename: 'LastMinedAt', dataType: 'DATE' }
    ])

    const asteroidComponents = (await listComponentsQuiet(api, metahubId, asteroidId)) as {
        items?: Array<{ id?: unknown; codename?: unknown }>
    }
    const componentIdByCodename = new Map<string, string>()
    for (const component of asteroidComponents.items ?? []) {
        const codenameText = readCodenameTextForAuthoring(component.codename)
        if (codenameText) componentIdByCodename.set(codenameText, String(component.id))
    }
    for (const serverOwnedCodename of ['RemainingQuantityKg', 'Status', 'LastMinedAt']) {
        const componentId = componentIdByCodename.get(serverOwnedCodename)
        expect(componentId, `Asteroid component ${serverOwnedCodename} must exist`).toBeTruthy()
        await updateComponent(api, metahubId, asteroidId, String(componentId), { uiConfig: { serverOwned: true } })
    }

    return { asteroidId }
}

/**
 * Five belt asteroids (mining TZ §7.7): global, non-ownerOnly, never primary
 * nav; positions clear the station guard zone and the ship spawn; Status REFs
 * seed with the target enumeration value id (the REF convention).
 */
export const seedAsteroidRowsThroughApi = async (api: ApiContext, metahubId: string, asteroidId: string): Promise<void> => {
    const statusEnumerationId = await resolveEnumerationIdByCodename(api, metahubId, ASTEROID_STATUS_ENUM)
    const activeStatusValueId = await resolveEnumerationValueIdByCodename(api, metahubId, statusEnumerationId, 'Active')

    const asteroidRows = [
        // UX round 2026-11-23 belt layout (5x distance): the belt lives 450-465 m
        // from the station — five times the previous 88-93 m — so mining always
        // requires a real flight, and 385-398 m from the ship spawn, clear of
        // the spawn→station flight corridor the occupiedSpheres colliders guard.
        // The relative belt shape is preserved (the rocks stay ~12-30 m apart).
        {
            Code: 'AST-01',
            Name: 'Asteroid A-01',
            PositionX: -249,
            PositionY: 7,
            PositionZ: 274,
            Scale: 7,
            TotalQuantityKg: 120,
            VisualVariant: 1
        },
        {
            Code: 'AST-02',
            Name: 'Asteroid A-02',
            PositionX: -229,
            PositionY: 2,
            PositionZ: 290,
            Scale: 9,
            TotalQuantityKg: 160,
            VisualVariant: 2
        },
        {
            Code: 'AST-03',
            Name: 'Asteroid A-03',
            PositionX: -243,
            PositionY: 10,
            PositionZ: 288,
            Scale: 6,
            TotalQuantityKg: 90,
            VisualVariant: 3
        },
        {
            Code: 'AST-04',
            Name: 'Asteroid A-04',
            PositionX: -215,
            PositionY: 1,
            PositionZ: 298,
            Scale: 10,
            TotalQuantityKg: 200,
            VisualVariant: 4
        },
        {
            Code: 'AST-05',
            Name: 'Asteroid A-05',
            PositionX: -235,
            PositionY: 11,
            PositionZ: 298,
            Scale: 8,
            TotalQuantityKg: 140,
            VisualVariant: 5
        }
    ]

    // Mining targets resolve by Code (`loadAsteroidByCodeForUpdate`) and the
    // client keys belt records by it — duplicate codes would make fire
    // targeting ambiguous, so the generator fails fast instead of seeding.
    const beltCodes = asteroidRows.map((row) => row.Code)
    if (new Set(beltCodes).size !== beltCodes.length) {
        throw new Error('Asteroid belt records must have unique Code values')
    }

    for (const row of asteroidRows) {
        await createRecord(api, metahubId, asteroidId, {
            data: {
                Code: row.Code,
                Name: row.Name,
                ResourceCode: 'ORE',
                PositionX: row.PositionX,
                PositionY: row.PositionY,
                PositionZ: row.PositionZ,
                Scale: row.Scale,
                TotalQuantityKg: row.TotalQuantityKg,
                RemainingQuantityKg: row.TotalQuantityKg,
                Status: activeStatusValueId,
                VisualVariant: row.VisualVariant,
                ChunkMinKg: 0.8,
                ChunkMaxKg: 3.2
            }
        })
    }
}

const WALLET_LEDGER_COMPONENTS: EconomyComponentSpec[] = [
    { codename: 'WalletKey', dataType: 'STRING', required: true },
    { codename: 'Currency', dataType: 'STRING', required: true },
    // REF passthrough: the module forwards the Operation's OperationType
    // enumeration value id (the module cannot resolve enum value codenames).
    { codename: 'OperationType', dataType: 'REF', ref: { kind: 'enumeration', codename: OPERATION_TYPE_ENUM } },
    { codename: 'Amount', dataType: 'NUMBER', required: true, scale: 3 },
    { codename: 'OccurredAt', dataType: 'DATE', required: true },
    { codename: 'SourceObjectId', dataType: 'STRING', required: true },
    { codename: 'SourceRowId', dataType: 'STRING', required: true },
    { codename: 'SourceLineId', dataType: 'STRING' }
]

const INVENTORY_LEDGER_COMPONENTS: EconomyComponentSpec[] = [
    { codename: 'OwnerKey', dataType: 'STRING', required: true },
    { codename: 'StationCode', dataType: 'STRING', required: true },
    { codename: 'NomenclatureCode', dataType: 'STRING', required: true },
    { codename: 'Quantity', dataType: 'NUMBER', required: true, scale: 3 },
    { codename: 'Cost', dataType: 'NUMBER', required: true, scale: 3 },
    { codename: 'OccurredAt', dataType: 'DATE', required: true },
    { codename: 'SourceObjectId', dataType: 'STRING', required: true },
    { codename: 'SourceRowId', dataType: 'STRING', required: true },
    { codename: 'SourceLineId', dataType: 'STRING' }
]

const ECONOMY_REGISTER_FIELD_ROLES = (register: 'wallet' | 'inventory') =>
    register === 'wallet'
        ? ([
              { fieldCodename: 'WalletKey', role: 'dimension' },
              { fieldCodename: 'Currency', role: 'dimension' },
              { fieldCodename: 'OperationType', role: 'dimension' },
              { fieldCodename: 'Amount', role: 'resource', aggregate: 'sum' },
              { fieldCodename: 'OccurredAt', role: 'component' },
              { fieldCodename: 'SourceObjectId', role: 'component' },
              { fieldCodename: 'SourceRowId', role: 'component' },
              { fieldCodename: 'SourceLineId', role: 'component' }
          ] as const)
        : ([
              { fieldCodename: 'OwnerKey', role: 'dimension' },
              { fieldCodename: 'StationCode', role: 'dimension' },
              { fieldCodename: 'NomenclatureCode', role: 'dimension' },
              { fieldCodename: 'Quantity', role: 'resource', aggregate: 'sum' },
              { fieldCodename: 'Cost', role: 'resource', aggregate: 'sum' },
              { fieldCodename: 'OccurredAt', role: 'component' },
              { fieldCodename: 'SourceObjectId', role: 'component' },
              { fieldCodename: 'SourceRowId', role: 'component' },
              { fieldCodename: 'SourceLineId', role: 'component' }
          ] as const)

export const configureEconomyRegistersThroughBrowser = async (page: Page, api: ApiContext, metahubId: string): Promise<void> => {
    await configureLedgerRegisterThroughBrowser(page, api, metahubId, {
        codename: WALLET_LEDGER_CODE,
        components: WALLET_LEDGER_COMPONENTS,
        fieldRoles: [...ECONOMY_REGISTER_FIELD_ROLES('wallet')],
        projections: [
            { codename: 'walletBalance', kind: 'balance', dimensions: ['WalletKey', 'Currency'], resources: ['Amount'] },
            { codename: 'walletTurnover', kind: 'turnover', dimensions: ['WalletKey', 'Currency'], resources: ['Amount'] }
        ]
    })
    await configureLedgerRegisterThroughBrowser(page, api, metahubId, {
        codename: INVENTORY_LEDGER_CODE,
        components: INVENTORY_LEDGER_COMPONENTS,
        fieldRoles: [...ECONOMY_REGISTER_FIELD_ROLES('inventory')],
        projections: [
            { codename: 'stockBalance', kind: 'balance', dimensions: ['OwnerKey', 'NomenclatureCode'], resources: ['Quantity', 'Cost'] },
            { codename: 'stockTurnover', kind: 'turnover', dimensions: ['OwnerKey', 'NomenclatureCode'], resources: ['Quantity', 'Cost'] }
        ]
    })
}

/**
 * Authors the `mmoomm-economy-posting-module` server module through the
 * Modules tab UI, then re-attaches it to the Operation object via the module
 * PATCH endpoint (documented deviation): the Behavior tab posting-module
 * select lists only modules attached to the edited object
 * (`attached_to_kind='object' AND attached_to_id=<operationId>` filter in
 * modulesStore), so a metahub-attached module would never appear there.
 */
export const createEconomyPostingModuleThroughBrowser = async (
    page: Page,
    api: ApiSessionLike,
    metahubId: string,
    operationObjectId: string
): Promise<void> => {
    const moduleId = await createRuntimeModuleThroughBrowser(page, api, metahubId, {
        name: ECONOMY_POSTING_MODULE_NAME,
        codename: ECONOMY_POSTING_MODULE_CODE,
        role: 'module',
        scope: 'metahub',
        sourceCode: economyPostingModuleSource,
        // `records.read` is required beyond the plan's baseline: the module
        // resolves Wallet/Nomenclature/FlightStation rows and the operation row
        // through ctx.records.get (component-codename-keyed payloads) because
        // ctx.metadata.getAttachedEntity() returns only { kind, id } and
        // getByCodename('component', ...) is ambiguous for shared codenames.
        capabilities: ['lifecycle', 'metadata.read', 'records.read']
    })

    const reattachResponse = await apiSend(api, 'PATCH', `/api/v1/metahub/${metahubId}/module/${moduleId}`, {
        attachedToKind: 'object',
        attachedToId: operationObjectId
    })
    if (!reattachResponse.ok) {
        const body = await reattachResponse.text()
        throw new Error(`Re-attaching the economy posting module to Operation failed: ${reattachResponse.status} ${body}`)
    }

    await expect
        .poll(
            async () => {
                const payload = (await listMetahubModules(api, metahubId, {
                    attachedToKind: 'object',
                    attachedToId: operationObjectId
                })) as { items?: Array<{ id?: string; codename?: unknown }> }
                return (
                    payload.items?.some(
                        (item) => item.id === moduleId && readCodenameText(item.codename) === ECONOMY_POSTING_MODULE_CODE
                    ) ?? false
                )
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: 'Economy posting module must be attached to the Operation object' }
        )
        .toBe(true)
}

export const configureOperationPostingThroughBrowser = async (
    page: Page,
    api: ApiContext,
    metahubId: string,
    operationName: string
): Promise<void> => {
    const operationId = await resolveObjectIdByCodename(api, metahubId, operationName)
    const editDialog = await openObjectEditDialogThroughBrowser(page, metahubId, operationId, operationName)
    await editDialog.getByRole('tab', { name: 'Behavior' }).click()

    await editDialog.getByTestId('behavior-record-mode-select').locator('..').click()
    await selectDialogOption(page, 'Transactional')
    await editDialog.getByTestId('behavior-posting-mode-select').locator('..').click()
    await selectDialogOption(page, 'Manual')

    await editDialog.getByTestId('behavior-posting-targets').locator('..').click()
    // Target ledger options carry the ledger entity codename as their value;
    // the visible label is the entity name, so select by value.
    const walletLedgerOption = page.locator('li[role="option"][data-value="WalletLedger"]')
    const inventoryLedgerOption = page.locator('li[role="option"][data-value="InventoryLedger"]')
    await expect(walletLedgerOption).toBeVisible()
    await expect(inventoryLedgerOption).toBeVisible()
    await walletLedgerOption.click()
    await inventoryLedgerOption.click()
    await page.keyboard.press('Escape')
    // The `behavior-posting-targets` testid sits on MUI Select's hidden native
    // input (inputProps); the selected-value chips render in the visible select
    // root (the input's parent), so target the parent for the chip assertions.
    await expect(editDialog.getByTestId('behavior-posting-targets').locator('..').getByText(WALLET_LEDGER_CODE)).toBeVisible()
    await expect(editDialog.getByTestId('behavior-posting-targets').locator('..').getByText(INVENTORY_LEDGER_CODE)).toBeVisible()

    // Same hidden-input rule: click the visible select root, not the testid input.
    await editDialog.getByTestId('behavior-posting-module').locator('..').click()
    const postingModuleOption = page.locator(`li[role="option"][data-value="${ECONOMY_POSTING_MODULE_CODE}"]`)
    await expect(postingModuleOption).toBeVisible()
    await postingModuleOption.click()

    await editDialog.getByRole('checkbox', { name: 'Enable lifecycle states' }).check()
    const states = [
        { codename: 'Draft', isInitial: true },
        { codename: 'Posted', isInitial: false },
        { codename: 'Voided', isInitial: false }
    ]
    for (const [stateIndex, state] of states.entries()) {
        await editDialog.getByTestId('behavior-state-add').click()
        await editDialog.getByLabel('State codename', { exact: true }).nth(stateIndex).fill(state.codename)
        await editDialog.getByLabel('State title', { exact: true }).nth(stateIndex).fill(state.codename)
        if (state.isInitial) {
            const initialCheckbox = editDialog.getByRole('checkbox', { name: 'Initial', exact: true }).nth(stateIndex)
            if (!(await initialCheckbox.isChecked())) {
                await initialCheckbox.check()
            }
        }
    }

    // TZ §7.3 record display prefix — the UI exposes it through the record
    // numbering block (enable numbering, then set the prefix).
    await editDialog.getByRole('checkbox', { name: 'Enable record numbering' }).check()
    await editDialog.getByLabel('Prefix', { exact: true }).fill('OP-')

    await editDialog.getByRole('checkbox', { name: 'Enable effective date' }).check()
    await editDialog.getByTestId('behavior-effective-date-select').locator('..').click()
    await selectDialogOption(page, 'OccurredAt')

    await editDialog.getByRole('combobox', { name: 'Immutability', exact: true }).click()
    await selectDialogOption(page, 'Posted records')

    const updateResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PATCH' &&
            (response.url().endsWith(`/api/v1/metahub/${metahubId}/entity/${operationId}`) ||
                response.url().endsWith(`/api/v1/metahub/${metahubId}/entities/object/instance/${operationId}`)),
        { label: 'Saving Operation record behavior', timeout: 120_000 }
    )
    await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await parseJsonResponse<CreatedEntityResponse>(await updateResponse, 'Saving Operation record behavior')
    await expect(editDialog).toHaveCount(0)

    let recordBehavior: Record<string, unknown> | null = null
    await expect
        .poll(
            async () => {
                const payload = (await listObjectCollections(api, metahubId, { limit: 200, offset: 0 })) as {
                    items?: Array<{ id?: string; codename?: unknown; config?: Record<string, unknown> | null }>
                }
                const match = payload.items?.find((item) => readCodenameText(item.codename) === operationName)
                const config = match?.config
                recordBehavior =
                    config && typeof config === 'object' && !Array.isArray(config)
                        ? (config.recordBehavior as Record<string, unknown>) ?? null
                        : null
                if (!recordBehavior) return false
                const posting = recordBehavior.posting as Record<string, unknown> | undefined
                const targetLedgers = Array.isArray(posting?.targetLedgers) ? (posting.targetLedgers as unknown[]) : []
                return (
                    posting?.moduleCodename === ECONOMY_POSTING_MODULE_CODE &&
                    targetLedgers.includes(WALLET_LEDGER_CODE) &&
                    targetLedgers.includes(INVENTORY_LEDGER_CODE)
                )
            },
            { timeout: APP_RUNTIME_TIMEOUT, message: 'Operation recordBehavior posting config must be persisted' }
        )
        .toBe(true)
    if (!recordBehavior) {
        throw new Error('Operation recordBehavior config did not persist')
    }
    expect(recordBehavior.mode).toBe('transactional')
    // Posted-row immutability is the defense behind Mine postings (QA MEDIUM
    // backlog): posted operations must reject generic edits/copies via
    // RECORD_IMMUTABLE, so the persisted config must carry it explicitly.
    expect(recordBehavior.immutability).toBe('posted')
}

export const addFlightStationMarketComponentsThroughBrowser = async (page: Page, api: ApiContext, metahubId: string): Promise<void> => {
    const flightStationId = await resolveObjectIdByCodename(api, metahubId, 'FlightStation')
    // FlightStation carries no components before this step, so both market
    // components hit the UI's forced-first-component rule
    // (`shouldForceFirstComponentDefaults`: componentCount <= 1 locks the
    // Required switch checked and marks the component as the display component).
    // The specs must therefore declare required: true — the economy runtime only
    // reads FlightStation rows and the generator's market seed provides both values.
    await createObjectComponentsThroughBrowser(page, api, metahubId, flightStationId, [
        { codename: 'MarketEnabled', dataType: 'BOOLEAN', required: true },
        { codename: 'MarketFeePercent', dataType: 'NUMBER', required: true }
    ])
}

export const seedEconomyRowsThroughApi = async (api: ApiContext, metahubId: string): Promise<void> => {
    const flightStationId = await resolveObjectIdByCodename(api, metahubId, 'FlightStation')
    await createRecord(api, metahubId, flightStationId, {
        data: {
            MarketEnabled: true,
            MarketFeePercent: 0
        }
    })

    const unitEnumerationId = await resolveEnumerationIdByCodename(api, metahubId, UNIT_ENUM)
    const kgValueId = await resolveEnumerationValueIdByCodename(api, metahubId, unitEnumerationId, 'Kg')
    const literValueId = await resolveEnumerationValueIdByCodename(api, metahubId, unitEnumerationId, 'Liter')
    const nomenclatureId = await resolveObjectIdByCodename(api, metahubId, NOMENCLATURE_CODE)

    // TZ §7.6 market nomenclature rows (REF fields are seeded with the target
    // enumeration value id, the same way existing generators seed enum refs).
    await createRecord(api, metahubId, nomenclatureId, {
        data: {
            Code: 'ORE',
            Name: 'Ore',
            Unit: kgValueId,
            MassPerUnit: 1,
            VolumePerUnit: 0.001,
            BasePrice: ORE_PRICE_PER_KG,
            Status: 'Active'
        }
    })
    await createRecord(api, metahubId, nomenclatureId, {
        data: {
            Code: 'FUEL',
            Name: 'Fuel',
            Unit: literValueId,
            MassPerUnit: 0.8,
            VolumePerUnit: 0.001,
            BasePrice: FUEL_PRICE_PER_LITER,
            Status: 'Active'
        }
    })
}
