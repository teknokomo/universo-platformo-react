import type { Locator, Page, Response } from '@playwright/test'
import { createLocalizedContent, getVLCString } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubAttribute,
    disposeApiContext,
    getCatalogAttribute,
    getEnumerationValue,
    getSetConstant,
    listMetahubCatalogs,
    listMetahubEnumerations,
    listMetahubSets,
    updateMetahubSettings
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'

type EntityRecord = {
    id?: string
    codename?: unknown
    description?: unknown
}

type ListPayload<T> = {
    items?: T[]
}

async function waitForEntity<T>(loader: () => Promise<T>, predicate: (value: T) => boolean, label: string) {
    let resolved: T | null = null

    await expect
        .poll(
            async () => {
                resolved = await loader()
                return predicate(resolved)
            },
            { message: `Waiting for ${label}` }
        )
        .toBe(true)

    if (!resolved) {
        throw new Error(`Unable to resolve ${label}`)
    }

    return resolved
}

function readPrimaryText(value: unknown, locale = 'en') {
    return getVLCString(value, locale)
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function openEntityDialog(page: Page, dialogName: string): Promise<Locator> {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: dialogName })
    await expect(dialog).toBeVisible()
    return dialog
}

async function fillNameCodenameAndDescription(
    dialog: Locator,
    values: {
        name: string
        codename?: string
        description?: string
    }
) {
    await dialog.getByLabel('Name').first().fill(values.name)
    if (typeof values.description === 'string') {
        await dialog.getByLabel('Description').first().fill(values.description)
    }
    if (typeof values.codename === 'string') {
        await dialog.getByLabel('Codename').first().fill(values.codename)
    }
}

async function fillNameAndCodename(
    dialog: Locator,
    values: {
        name: string
        codename?: string
    }
) {
    await dialog.getByLabel('Name').first().fill(values.name)
    if (typeof values.codename === 'string') {
        await dialog.getByLabel('Codename').first().fill(values.codename)
    }
}

async function waitForFirstEntityId<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, label: string) {
    let firstId: string | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                firstId = payload.items?.[0]?.id
                return typeof firstId === 'string'
            },
            {
                message: `Waiting for ${label} id`
            }
        )
        .toBe(true)

    if (!firstId) {
        throw new Error(`Unable to resolve ${label} id`)
    }

    return firstId
}

async function expectNoHorizontalOverflow(locator: Locator, label: string) {
    const metrics = await locator.evaluate((node) => {
        const element = node as HTMLElement
        return {
            clientWidth: Math.ceil(element.clientWidth),
            scrollWidth: Math.ceil(element.scrollWidth)
        }
    })

    expect(metrics.scrollWidth, `${label} should not exceed its own width`).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

async function expectViewportWithoutHorizontalOverflow(page: Page) {
    const metrics = await page.evaluate(() => {
        const scrollingRoot = document.scrollingElement ?? document.documentElement
        return {
            clientWidth: Math.ceil(scrollingRoot.clientWidth),
            scrollWidth: Math.ceil(scrollingRoot.scrollWidth)
        }
    })

    expect(metrics.scrollWidth, 'Viewport should not gain horizontal overflow').toBeLessThanOrEqual(metrics.clientWidth + 1)
}

test('@flow metahub entity dialogs cover constant edit, enumeration value edit-copy fields, and localized attribute copy codename generation', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahubName = `E2E ${runManifest.runId} dialog regressions`
        const metahubCodename = `${runManifest.runId}-dialog-regressions`
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for entity dialog coverage')
        }

        const initialConstantValue = 'Initial10'
        const updatedConstantValue = 'Updated10'

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await updateMetahubSettings(api, metahub.id, [
            {
                key: 'general.codenameLocalizedEnabled',
                value: { _value: true }
            }
        ])

        const setId = await waitForFirstEntityId(() => listMetahubSets(api, metahub.id, { limit: 100, offset: 0 }), 'set')
        const enumerationId = await waitForFirstEntityId(
            () => listMetahubEnumerations(api, metahub.id, { limit: 100, offset: 0 }),
            'enumeration'
        )
        const catalogId = await waitForFirstEntityId(() => listMetahubCatalogs(api, metahub.id, { limit: 100, offset: 0 }), 'catalog')

        await page.goto(`/metahub/${metahub.id}/sets`)
        await expect(page.getByRole('heading', { name: 'Sets' })).toBeVisible()
        await page.getByTestId(buildEntityMenuTriggerSelector('set', setId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('set', 'edit', setId)).click()

        const editSetDialog = page.getByRole('dialog', { name: 'Edit Set' })
        await expect(editSetDialog).toBeVisible()
        await expect(editSetDialog.getByRole('tab', { name: 'General' })).toBeVisible()
        await expect(editSetDialog.getByRole('tab', { name: 'Hubs' })).toBeVisible()
        await expect(editSetDialog.getByRole('tab', { name: 'Scripts' })).toBeVisible()
        await expect(editSetDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editSetDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editSetDialog.getByLabel('Codename').first()).toBeVisible()
        await expect(editSetDialog.getByTestId('dialog-toggle-fullscreen')).toBeVisible()
        await expect(editSetDialog.getByTestId('dialog-resize-handle')).toBeVisible()

        const initialDialogBox = await editSetDialog.boundingBox()
        if (!initialDialogBox) {
            throw new Error('Edit Set dialog bounding box is unavailable')
        }

        await page.mouse.click(12, 12)
        await expect(editSetDialog).toBeVisible()

        await editSetDialog.getByTestId('dialog-toggle-fullscreen').click()
        await expect
            .poll(async () => {
                const fullscreenBox = await editSetDialog.boundingBox()
                return fullscreenBox?.width ?? 0
            })
            .toBeGreaterThan(initialDialogBox.width + 100)

        await editSetDialog.getByTestId('dialog-toggle-fullscreen').click()
        await editSetDialog.getByRole('tab', { name: 'Scripts' }).click()
        await expect(editSetDialog.getByTestId('entity-scripts-layout')).toHaveAttribute('data-layout-mode', 'compact')
        await expect(editSetDialog.getByTestId('entity-scripts-list-toggle')).toBeVisible()
        await expect(editSetDialog.getByTestId('entity-scripts-editor-shell')).toBeVisible()
        await expectNoHorizontalOverflow(editSetDialog, 'Edit Set dialog')
        await expectViewportWithoutHorizontalOverflow(page)

        await editSetDialog.getByRole('tab', { name: 'General' }).click()
        await editSetDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(editSetDialog).toHaveCount(0)

        await page.getByTestId(buildEntityMenuTriggerSelector('set', setId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('set', 'copy', setId)).click()

        const copySetDialog = page.getByRole('dialog', { name: 'Copying Set' })
        await expect(copySetDialog).toBeVisible()
        await expect(copySetDialog.getByRole('tab', { name: 'General' })).toBeVisible()
        await expect(copySetDialog.getByRole('tab', { name: 'Hubs' })).toBeVisible()
        await expect(copySetDialog.getByLabel('Name').first()).toBeVisible()
        await expect(copySetDialog.getByLabel('Description').first()).toBeVisible()
        await expect(copySetDialog.getByLabel('Codename').first()).toBeVisible()
        await copySetDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(copySetDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/enumerations`)
        await expect(page.getByRole('heading', { name: 'Enumerations' })).toBeVisible()
        await page.getByTestId(buildEntityMenuTriggerSelector('enumeration', enumerationId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumeration', 'edit', enumerationId)).click()

        const editEnumerationDialog = page.getByRole('dialog', { name: 'Edit Enumeration' })
        await expect(editEnumerationDialog).toBeVisible()
        await expect(editEnumerationDialog.getByRole('tab', { name: 'General' })).toBeVisible()
        await expect(editEnumerationDialog.getByRole('tab', { name: 'Hubs' })).toBeVisible()
        await expect(editEnumerationDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editEnumerationDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editEnumerationDialog.getByLabel('Codename').first()).toBeVisible()
        await editEnumerationDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(editEnumerationDialog).toHaveCount(0)

        await page.getByTestId(buildEntityMenuTriggerSelector('enumeration', enumerationId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumeration', 'copy', enumerationId)).click()

        const copyEnumerationDialog = page.getByRole('dialog', { name: 'Copying Enumeration' })
        await expect(copyEnumerationDialog).toBeVisible()
        await expect(copyEnumerationDialog.getByRole('tab', { name: 'General' })).toBeVisible()
        await expect(copyEnumerationDialog.getByRole('tab', { name: 'Hubs' })).toBeVisible()
        await expect(copyEnumerationDialog.getByLabel('Name').first()).toBeVisible()
        await expect(copyEnumerationDialog.getByLabel('Description').first()).toBeVisible()
        await expect(copyEnumerationDialog.getByLabel('Codename').first()).toBeVisible()
        await copyEnumerationDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(copyEnumerationDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/set/${setId}/constants`)
        await expect(page.getByRole('heading', { name: 'Constants' })).toBeVisible()

        const constantDialog = await openEntityDialog(page, 'Create Constant')
        await fillNameAndCodename(constantDialog, {
            name: `Constant ${runManifest.runId}`,
            codename: `${runManifest.runId}-constant`
        })
        await constantDialog.getByRole('tab', { name: 'Value' }).click()
        await constantDialog.getByRole('textbox', { name: 'Value' }).fill(initialConstantValue)
        const createConstantRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/set/${setId}/constants`)
        )
        await constantDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdConstant = await parseJsonResponse<EntityRecord>(await createConstantRequest, 'Creating constant')
        if (!createdConstant?.id) {
            throw new Error('Constant creation did not return an id')
        }

        await waitForEntity(
            () => getSetConstant(api, metahub.id, setId, createdConstant.id!),
            (constant) => typeof (constant as EntityRecord)?.id === 'string',
            'persisted constant after create'
        )

        await page.reload()
        await expect(page.getByRole('heading', { name: 'Constants' })).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('constant', createdConstant.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('constant', 'edit', createdConstant.id)).click()
        const editConstantDialog = page.getByRole('dialog', { name: 'Edit Constant' })
        await expect(editConstantDialog).toBeVisible()
        await expect(editConstantDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editConstantDialog.getByLabel('Codename').first()).toBeVisible()
        await editConstantDialog.getByRole('tab', { name: 'Value' }).click()
        const constantValueField = editConstantDialog.getByRole('textbox', { name: 'Value' })
        await expect(constantValueField).toBeVisible()
        await constantValueField.fill(updatedConstantValue)
        await constantValueField.press('Tab')
        await expect(editConstantDialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
        const updateConstantRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/set/${setId}/constant/${createdConstant.id}`)
        )
        await editConstantDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await parseJsonResponse<EntityRecord>(await updateConstantRequest, 'Updating constant')

        const persistedConstant = await getSetConstant(api, metahub.id, setId, createdConstant.id)
        expect(String(persistedConstant.value ?? '')).toBe(updatedConstantValue)

        await page.goto(`/metahub/${metahub.id}/enumeration/${enumerationId}/values`)
        await expect(page.getByRole('heading', { name: 'Values' })).toBeVisible()

        const valueDialog = await openEntityDialog(page, 'Create value')
        await fillNameCodenameAndDescription(valueDialog, {
            name: `Value ${runManifest.runId}`,
            codename: `${runManifest.runId}-value`,
            description: `Value description ${runManifest.runId}`
        })
        const createValueRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/enumeration/${enumerationId}/values`)
        )
        await valueDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdValue = await parseJsonResponse<EntityRecord>(await createValueRequest, 'Creating enumeration value')
        if (!createdValue?.id) {
            throw new Error('Enumeration value creation did not return an id')
        }

        await page.getByTestId(buildEntityMenuTriggerSelector('enumerationValue', createdValue.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumerationValue', 'edit', createdValue.id)).click()
        const editValueDialog = page.getByRole('dialog', { name: 'Edit enumeration value' })
        await expect(editValueDialog).toBeVisible()
        await expect(editValueDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editValueDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editValueDialog.getByLabel('Codename').first()).toBeVisible()
        await editValueDialog.getByLabel('Description').first().fill(`Updated value description ${runManifest.runId}`)
        const updateValueRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/enumeration/${enumerationId}/value/${createdValue.id}`)
        )
        await editValueDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await parseJsonResponse<EntityRecord>(await updateValueRequest, 'Updating enumeration value')

        const persistedValue = await getEnumerationValue(api, metahub.id, enumerationId, createdValue.id)
        expect(readPrimaryText(persistedValue.description)).toBe(`Updated value description ${runManifest.runId}`)

        await page.getByTestId(buildEntityMenuTriggerSelector('enumerationValue', createdValue.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumerationValue', 'copy', createdValue.id)).click()
        const copyValueDialog = page.getByRole('dialog', { name: 'Copy Value' })
        await expect(copyValueDialog).toBeVisible()
        await expect(copyValueDialog.getByLabel('Name').first()).toBeVisible()
        await expect(copyValueDialog.getByLabel('Description').first()).toBeVisible()
        await expect(copyValueDialog.getByLabel('Codename').first()).toBeVisible()
        await copyValueDialog.getByLabel('Description').first().fill(`Copied value description ${runManifest.runId}`)
        const copyValueRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/enumeration/${enumerationId}/value/${createdValue.id}/copy`)
        )
        await copyValueDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const copiedValue = await parseJsonResponse<EntityRecord>(await copyValueRequest, 'Copying enumeration value')
        if (!copiedValue?.id) {
            throw new Error('Enumeration value copy did not return an id')
        }

        const persistedCopiedValue = await getEnumerationValue(api, metahub.id, enumerationId, copiedValue.id)
        expect(readPrimaryText(persistedCopiedValue.description)).toBe(`Copied value description ${runManifest.runId}`)

        const attribute = await createMetahubAttribute(api, metahub.id, catalogId, {
            name: { en: `Attribute ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-attribute`),
            dataType: 'STRING',
            isRequired: false
        })

        if (!attribute?.id) {
            throw new Error('Attribute creation did not return an id for copy regression coverage')
        }

        await page.goto(`/metahub/${metahub.id}/catalog/${catalogId}/attributes`)
        await expect(page.getByRole('heading', { name: 'Attributes' })).toBeVisible()
        await page.getByTestId(buildEntityMenuTriggerSelector('attribute', attribute.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('attribute', 'copy', attribute.id)).click()

        const copyAttributeDialog = page.getByRole('dialog', { name: 'Copy Attribute' })
        await expect(copyAttributeDialog).toBeVisible()
        await expect(copyAttributeDialog.getByLabel('Name').first()).toBeVisible()
        await expect(copyAttributeDialog.getByLabel('Codename').first()).toBeVisible()
        await expect(copyAttributeDialog.getByRole('tab', { name: 'General' })).toBeVisible()
        await expect(copyAttributeDialog.getByRole('tab', { name: 'Presentation' })).toBeVisible()

        await expect.poll(async () => (await copyAttributeDialog.getByLabel('Codename').first().inputValue()).trim()).not.toBe('')
        const autoGeneratedCopyCodename = await copyAttributeDialog.getByLabel('Codename').first().inputValue()

        expect(autoGeneratedCopyCodename.toLowerCase()).toContain('copy')

        const copyAttributeRequest = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/catalog/${catalogId}/attribute/${attribute.id}/copy`)
        )
        await copyAttributeDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const copiedAttribute = await parseJsonResponse<EntityRecord>(await copyAttributeRequest, 'Copying attribute')
        if (!copiedAttribute?.id) {
            throw new Error('Attribute copy did not return an id')
        }

        const persistedCopiedAttribute = await getCatalogAttribute(api, metahub.id, catalogId, copiedAttribute.id)
        const copiedAttributeCodename = readPrimaryText(persistedCopiedAttribute.codename) ?? ''
        expect(copiedAttributeCodename.toLowerCase()).toContain('copy')
    } finally {
        await disposeApiContext(api)
    }
})
