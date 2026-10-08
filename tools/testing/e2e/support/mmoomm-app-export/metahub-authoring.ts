import type { Locator, Page } from '@playwright/test'
import type { ObjectRuntimeMenuIcon } from '@universo-react/types'
import { expect } from '../../fixtures/test'
import {
    deleteMetahub,
    listFixedValues,
    listMetahubs,
    listObjectCollections,
    listOptionLists,
    listOptionValues,
    listValueGroups
} from '../backend/api-session.mjs'
import { recordCreatedMetahub } from '../backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { expectSemanticFieldControls } from '../browser/runtimeUx'
import { entityDialogSelectors, toolbarSelectors } from '../selectors/contracts'
import { MMOOMM_APP_CANONICAL_METAHUB } from '../mmoommAppFixtureContract'
import {
    APP_RUNTIME_TIMEOUT,
    SPACE_SECTION_CODENAME,
    VISUAL_LINKUP_LAB_SECTION_CODENAME,
    WELCOME_SECTION_CODENAME,
    readRequestJson
} from '../mmoommAppGeneratorData'
import {
    apiGet,
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
            school: 'Learning',
            recent: 'Recent',
            star: 'Favorites',
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
