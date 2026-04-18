import type { Locator, Page, Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getFieldDefinition,
    getRecord,
    getOptionValue,
    getOptionList,
    getTreeEntity,
    getValueGroup,
    getFixedValue,
    listFieldDefinitions,
    listRecords,
    listOptionValues,
    listLinkedCollections,
    listOptionLists,
    listTreeEntities,
    listValueGroups,
    listFixedValues
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
    codename?: string
    description?: unknown
    data?: Record<string, unknown>
}

type ListPayload<T> = {
    items?: T[]
}

type LocalizedLike = {
    _primary?: string
    locales?: Record<string, { content?: string }>
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object' || !('locales' in value)) {
        return undefined
    }

    const localized = value as LocalizedLike
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}
    const directValue = locales[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary ? locales[localized._primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

function findElementValueByText(data: Record<string, unknown> | undefined, expectedText: string, locale = 'en'): unknown {
    if (!data) {
        return undefined
    }

    for (const value of Object.values(data)) {
        if (readLocalizedText(value, locale) === expectedText) {
            return value
        }
    }

    return undefined
}

async function openEntityDialog(page: Page, dialogName: string | RegExp): Promise<Locator> {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: dialogName })
    await expect(dialog).toBeVisible()
    return dialog
}

async function fillNameAndCodename(dialog: Locator, values: { name?: string; codename: string }) {
    if (typeof values.name === 'string') {
        await dialog.getByLabel('Name').first().fill(values.name)
    }

    await dialog.getByLabel('Codename').first().fill(values.codename)
}

async function waitForListEntity<T extends { id?: string }>(
    loader: () => Promise<ListPayload<T>>,
    expectedId: string,
    label: string
): Promise<T> {
    let matched: T | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                matched = payload.items?.find((item) => item.id === expectedId)
                return Boolean(matched?.id)
            },
            { message: `Waiting for ${label} ${expectedId} to appear in backend list` }
        )
        .toBe(true)

    if (!matched) {
        throw new Error(`${label} ${expectedId} did not appear in backend list`)
    }

    return matched
}

async function waitForEntityAbsence<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, expectedId: string, label: string) {
    await expect
        .poll(
            async () => {
                const payload = await loader()
                return payload.items?.some((item) => item.id === expectedId) ?? false
            },
            { message: `Waiting for ${label} ${expectedId} to disappear from backend list` }
        )
        .toBe(false)
}

async function waitForFirstEntityId<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, label: string): Promise<string> {
    let firstId: string | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                firstId = payload.items?.[0]?.id
                return typeof firstId === 'string'
            },
            { message: `Waiting for first ${label} id` }
        )
        .toBe(true)

    if (!firstId) {
        throw new Error(`Unable to resolve first ${label} id`)
    }

    return firstId
}

test('@flow @combined metahub collection routes support browser create plus hub copy and delete with backend persistence', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} domain collections`
    const metahubCodename = `${runManifest.runId}-domain-collections`
    const hubName = `Hub ${runManifest.runId}`
    const hubCodename = `${runManifest.runId}-hub`
    const updatedHubDescription = `Updated hub description ${runManifest.runId}`
    const copiedHubCodename = `${runManifest.runId}-hub-copy`
    const catalogName = `Catalog ${runManifest.runId}`
    const catalogCodename = `${runManifest.runId}-catalog`
    const updatedCatalogDescription = `Updated catalog description ${runManifest.runId}`
    const copiedCatalogCodename = `${runManifest.runId}-catalog-copy`
    const enumerationName = `Enumeration ${runManifest.runId}`
    const enumerationCodename = `${runManifest.runId}-enumeration`
    const updatedEnumerationDescription = `Updated enumeration description ${runManifest.runId}`
    const copiedEnumerationCodename = `${runManifest.runId}-enumeration-copy`
    const setName = `Set ${runManifest.runId}`
    const setCodename = `${runManifest.runId}-set`
    const updatedSetDescription = `Updated set description ${runManifest.runId}`
    const copiedSetCodename = `${runManifest.runId}-set-copy`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for domain collection coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await page.goto(`/metahub/${metahub.id}/entities/hub/instances`)
        await expect(page.getByRole('heading', { name: 'Hubs' })).toBeVisible()

        const hubDialog = await openEntityDialog(page, 'Create Hub')
        await fillNameAndCodename(hubDialog, { name: hubName, codename: hubCodename })

        const createHubResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/hub/instances`),
            { label: 'Creating hub' }
        )
        await hubDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdHub = await parseJsonResponse<EntityRecord>(await createHubResponse, 'Creating hub')
        if (!createdHub.id) {
            throw new Error('Create hub response did not contain an id')
        }

        await expect(page.getByText(hubName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listTreeEntities(api, metahub.id, { limit: 100, offset: 0 }), createdHub.id, 'hub')
        const persistedHub = await getTreeEntity(api, metahub.id, createdHub.id)
        expect(persistedHub.id).toBe(createdHub.id)

        await page.getByTestId(buildEntityMenuTriggerSelector('hub', createdHub.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('hub', 'edit', createdHub.id)).click()

        const editHubDialog = page.getByRole('dialog', { name: 'Edit Hub' })
        await expect(editHubDialog).toBeVisible()
        await expect(editHubDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editHubDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editHubDialog.getByLabel('Codename').first()).toBeVisible()
        await editHubDialog.getByLabel('Description').first().fill(updatedHubDescription)
        await editHubDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(editHubDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const updatedHub = await getTreeEntity(api, metahub.id, createdHub.id)
                return readLocalizedText(updatedHub.description)
            })
            .toBe(updatedHubDescription)

        await page.getByTestId(buildEntityMenuTriggerSelector('hub', createdHub.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('hub', 'copy', createdHub.id)).click()

        const copyHubDialog = page.getByRole('dialog', { name: 'Copying Hub' })
        await expect(copyHubDialog).toBeVisible()
        await fillNameAndCodename(copyHubDialog, { codename: copiedHubCodename })

        const copyHubResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/hub/instance/${createdHub.id}/copy`),
            { label: 'Copying hub' }
        )
        await copyHubDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copiedHub = await parseJsonResponse<EntityRecord>(await copyHubResponse, 'Copying hub')
        if (!copiedHub.id) {
            throw new Error('Copy hub response did not contain an id')
        }

        await waitForListEntity(() => listTreeEntities(api, metahub.id, { limit: 100, offset: 0 }), copiedHub.id, 'copied hub')
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('hub', copiedHub.id))).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('hub', copiedHub.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('hub', 'delete', copiedHub.id)).click()

        const deleteHubDialog = page.getByRole('dialog', { name: 'Delete Hub' })
        await expect(deleteHubDialog).toBeVisible()

        const deleteHubResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/hub/instance/${copiedHub.id}`),
            { label: 'Deleting hub' }
        )
        await deleteHubDialog.getByRole('button', { name: 'Delete' }).click()
        const deleteHubResult = await deleteHubResponse
        expect(deleteHubResult.ok()).toBe(true)
        await waitForEntityAbsence(() => listTreeEntities(api, metahub.id, { limit: 100, offset: 0 }), copiedHub.id, 'copied hub')

        await page.goto(`/metahub/${metahub.id}/entities/catalog/instances`)
        await expect(page.getByRole('heading', { name: 'Catalogs' })).toBeVisible()

        const catalogDialog = await openEntityDialog(page, 'Create Catalog')
        await fillNameAndCodename(catalogDialog, { name: catalogName, codename: catalogCodename })

        const createCatalogResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instances`),
            { label: 'Creating catalog' }
        )
        await catalogDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdCatalog = await parseJsonResponse<EntityRecord>(await createCatalogResponse, 'Creating catalog')
        if (!createdCatalog.id) {
            throw new Error('Create catalog response did not contain an id')
        }

        await expect(page.getByText(catalogName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }), createdCatalog.id, 'catalog')

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdCatalog.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', createdCatalog.id)).click()

        const editCatalogDialog = page.getByRole('dialog', { name: 'Edit Catalog' })
        await expect(editCatalogDialog).toBeVisible()
        await expect(editCatalogDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editCatalogDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editCatalogDialog.getByLabel('Codename').first()).toBeVisible()
        await editCatalogDialog.getByLabel('Description').first().fill(updatedCatalogDescription)
        await editCatalogDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(editCatalogDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const payload = await listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 })
                const updatedCatalog = payload.items?.find((item) => item.id === createdCatalog.id)
                return readLocalizedText((updatedCatalog as { description?: unknown } | undefined)?.description)
            })
            .toBe(updatedCatalogDescription)

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdCatalog.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'copy', createdCatalog.id)).click()

        const copyCatalogDialog = page.getByRole('dialog', { name: 'Copying Catalog' })
        await expect(copyCatalogDialog).toBeVisible()
        await fillNameAndCodename(copyCatalogDialog, { codename: copiedCatalogCodename })

        const copyCatalogResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instance/${createdCatalog.id}/copy`),
            { label: 'Copying catalog' }
        )
        await copyCatalogDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copiedCatalog = await parseJsonResponse<EntityRecord>(await copyCatalogResponse, 'Copying catalog')
        if (!copiedCatalog.id) {
            throw new Error('Copy catalog response did not contain an id')
        }

        await waitForListEntity(() => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }), copiedCatalog.id, 'copied catalog')
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('catalog', copiedCatalog.id))).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', copiedCatalog.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'delete', copiedCatalog.id)).click()

        const deleteCatalogDialog = page.getByRole('dialog', { name: 'Delete Catalog' })
        await expect(deleteCatalogDialog).toBeVisible()

        const deleteCatalogResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instance/${copiedCatalog.id}`),
            { label: 'Deleting catalog' }
        )
        await deleteCatalogDialog.getByRole('button', { name: 'Delete' }).click()
        const deleteCatalogResult = await deleteCatalogResponse
        expect(deleteCatalogResult.ok()).toBe(true)
        await waitForEntityAbsence(
            () => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }),
            copiedCatalog.id,
            'copied catalog'
        )

        await page.goto(`/metahub/${metahub.id}/entities/enumeration/instances`)
        await expect(page.getByRole('heading', { name: 'Enumerations' })).toBeVisible()

        const enumerationDialog = await openEntityDialog(page, 'Create Enumeration')
        await fillNameAndCodename(enumerationDialog, { name: enumerationName, codename: enumerationCodename })

        const createEnumerationResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/enumeration/instances`),
            { label: 'Creating enumeration' }
        )
        await enumerationDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdEnumeration = await parseJsonResponse<EntityRecord>(await createEnumerationResponse, 'Creating enumeration')
        if (!createdEnumeration.id) {
            throw new Error('Create enumeration response did not contain an id')
        }

        await expect(page.getByText(enumerationName, { exact: true })).toBeVisible()
        await waitForListEntity(
            () => listOptionLists(api, metahub.id, { limit: 100, offset: 0 }),
            createdEnumeration.id,
            'enumeration'
        )
        const persistedEnumeration = await getOptionList(api, metahub.id, createdEnumeration.id)
        expect(persistedEnumeration.id).toBe(createdEnumeration.id)

        await page.getByTestId(buildEntityMenuTriggerSelector('enumeration', createdEnumeration.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumeration', 'edit', createdEnumeration.id)).click()

        const editEnumerationDialog = page.getByRole('dialog', { name: 'Edit Enumeration' })
        await expect(editEnumerationDialog).toBeVisible()
        await expect(editEnumerationDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editEnumerationDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editEnumerationDialog.getByLabel('Codename').first()).toBeVisible()
        await editEnumerationDialog.getByLabel('Description').first().fill(updatedEnumerationDescription)
        await editEnumerationDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(editEnumerationDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const updatedEnumeration = await getOptionList(api, metahub.id, createdEnumeration.id)
                return readLocalizedText((updatedEnumeration as { description?: unknown } | undefined)?.description)
            })
            .toBe(updatedEnumerationDescription)

        await page.getByTestId(buildEntityMenuTriggerSelector('enumeration', createdEnumeration.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumeration', 'copy', createdEnumeration.id)).click()

        const copyEnumerationDialog = page.getByRole('dialog', { name: 'Copying Enumeration' })
        await expect(copyEnumerationDialog).toBeVisible()
        await fillNameAndCodename(copyEnumerationDialog, { codename: copiedEnumerationCodename })

        const copyEnumerationResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/enumeration/instance/${createdEnumeration.id}/copy`),
            { label: 'Copying enumeration' }
        )
        await copyEnumerationDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copiedEnumeration = await parseJsonResponse<EntityRecord>(await copyEnumerationResponse, 'Copying enumeration')
        if (!copiedEnumeration.id) {
            throw new Error('Copy enumeration response did not contain an id')
        }

        await waitForListEntity(
            () => listOptionLists(api, metahub.id, { limit: 100, offset: 0 }),
            copiedEnumeration.id,
            'copied enumeration'
        )
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('enumeration', copiedEnumeration.id))).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('enumeration', copiedEnumeration.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('enumeration', 'delete', copiedEnumeration.id)).click()

        const deleteEnumerationDialog = page.getByRole('dialog', { name: 'Delete Enumeration' })
        await expect(deleteEnumerationDialog).toBeVisible()

        const deleteEnumerationResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/enumeration/instance/${copiedEnumeration.id}`),
            { label: 'Deleting enumeration' }
        )
        await deleteEnumerationDialog.getByRole('button', { name: 'Delete' }).click()
        const deleteEnumerationResult = await deleteEnumerationResponse
        expect(deleteEnumerationResult.ok()).toBe(true)
        await waitForEntityAbsence(
            () => listOptionLists(api, metahub.id, { limit: 100, offset: 0 }),
            copiedEnumeration.id,
            'copied enumeration'
        )

        await page.goto(`/metahub/${metahub.id}/entities/set/instances`)
        await expect(page.getByRole('heading', { name: 'Sets' })).toBeVisible()

        const setDialog = await openEntityDialog(page, 'Create Set')
        await fillNameAndCodename(setDialog, { name: setName, codename: setCodename })

        const createSetResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/set/instances`),
            { label: 'Creating set' }
        )
        await setDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdSet = await parseJsonResponse<EntityRecord>(await createSetResponse, 'Creating set')
        if (!createdSet.id) {
            throw new Error('Create set response did not contain an id')
        }

        await expect(page.getByText(setName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listValueGroups(api, metahub.id, { limit: 100, offset: 0 }), createdSet.id, 'set')
        const persistedSet = await getValueGroup(api, metahub.id, createdSet.id)
        expect(persistedSet.id).toBe(createdSet.id)

        await page.getByTestId(buildEntityMenuTriggerSelector('set', createdSet.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('set', 'edit', createdSet.id)).click()

        const editSetDialog = page.getByRole('dialog', { name: 'Edit Set' })
        await expect(editSetDialog).toBeVisible()
        await expect(editSetDialog.getByLabel('Name').first()).toBeVisible()
        await expect(editSetDialog.getByLabel('Description').first()).toBeVisible()
        await expect(editSetDialog.getByLabel('Codename').first()).toBeVisible()
        await editSetDialog.getByLabel('Description').first().fill(updatedSetDescription)
        await editSetDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(editSetDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const updatedSet = await getValueGroup(api, metahub.id, createdSet.id)
                return readLocalizedText((updatedSet as { description?: unknown } | undefined)?.description)
            })
            .toBe(updatedSetDescription)

        await page.getByTestId(buildEntityMenuTriggerSelector('set', createdSet.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('set', 'copy', createdSet.id)).click()

        const copySetDialog = page.getByRole('dialog', { name: 'Copying Set' })
        await expect(copySetDialog).toBeVisible()
        await fillNameAndCodename(copySetDialog, { codename: copiedSetCodename })

        const copySetResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/set/instance/${createdSet.id}/copy`),
            { label: 'Copying set' }
        )
        await copySetDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copiedSet = await parseJsonResponse<EntityRecord>(await copySetResponse, 'Copying set')
        if (!copiedSet.id) {
            throw new Error('Copy set response did not contain an id')
        }

        await waitForListEntity(() => listValueGroups(api, metahub.id, { limit: 100, offset: 0 }), copiedSet.id, 'copied set')
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('set', copiedSet.id))).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('set', copiedSet.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('set', 'delete', copiedSet.id)).click()

        const deleteSetDialog = page.getByRole('dialog', { name: 'Delete Set' })
        await expect(deleteSetDialog).toBeVisible()

        const deleteSetResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/set/instance/${copiedSet.id}`),
            { label: 'Deleting set' }
        )
        await deleteSetDialog.getByRole('button', { name: 'Delete' }).click()
        const deleteSetResult = await deleteSetResponse
        expect(deleteSetResult.ok()).toBe(true)
        await waitForEntityAbsence(() => listValueGroups(api, metahub.id, { limit: 100, offset: 0 }), copiedSet.id, 'copied set')
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @combined metahub leaf routes support browser attribute element enumeration value and constant create with backend persistence', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} domain leaves`
    const metahubCodename = `${runManifest.runId}-domain-leaves`
    const attributeName = `Title ${runManifest.runId}`
    const attributeCodename = `${runManifest.runId}-title`
    const elementValue = `Elt-${runManifest.runId.slice(-6)}`
    const enumerationValueName = `Value ${runManifest.runId}`
    const enumerationValueCodename = `${runManifest.runId}-value`
    const constantName = `Constant ${runManifest.runId}`
    const constantCodename = `${runManifest.runId}-constant`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for domain leaf coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const catalogId = await waitForFirstEntityId(() => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }), 'catalog')
        const enumerationId = await waitForFirstEntityId(
            () => listOptionLists(api, metahub.id, { limit: 100, offset: 0 }),
            'enumeration'
        )
        const setId = await waitForFirstEntityId(() => listValueGroups(api, metahub.id, { limit: 100, offset: 0 }), 'set')

        await page.goto(`/metahub/${metahub.id}/entities/catalog/instance/${catalogId}/field-definitions`)
        await expect(page.getByRole('heading', { name: 'Attributes' })).toBeVisible()

        const attributeDialog = await openEntityDialog(page, 'Add Field Definition')
        await fillNameAndCodename(attributeDialog, { name: attributeName, codename: attributeCodename })

        const createAttributeResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instance/${catalogId}/field-definitions`),
            { label: 'Creating attribute' }
        )
        await attributeDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdAttribute = await parseJsonResponse<EntityRecord>(await createAttributeResponse, 'Creating attribute')
        if (!createdAttribute.id) {
            throw new Error('Create attribute response did not contain an id')
        }

        await waitForListEntity(
            () => listFieldDefinitions(api, metahub.id, catalogId, { limit: 100, offset: 0 }),
            createdAttribute.id,
            'attribute'
        )
        const persistedAttribute = await getFieldDefinition(api, metahub.id, catalogId, createdAttribute.id)
        expect(persistedAttribute.id).toBe(createdAttribute.id)

        await page.getByRole('tab', { name: 'Settings' }).click()
        const attributeSettingsDialog = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Layout' }) })
        await expect(attributeSettingsDialog).toBeVisible()
        await expect(attributeSettingsDialog.getByRole('tab', { name: 'Layout' })).toBeVisible()
        await attributeSettingsDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(attributeSettingsDialog).toHaveCount(0)

        await page.goto(`/metahub/${metahub.id}/entities/catalog/instance/${catalogId}/records`)
        await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeEnabled()

        await page.getByRole('tab', { name: 'Settings' }).click()
        const elementSettingsDialog = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Layout' }) })
        await expect(elementSettingsDialog).toBeVisible()
        await expect(elementSettingsDialog.getByRole('tab', { name: 'Layout' })).toBeVisible()
        await elementSettingsDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(elementSettingsDialog).toHaveCount(0)

        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const elementDialog = page.getByRole('dialog', { name: 'Add Record' })
        await expect(elementDialog).toBeVisible()
        await elementDialog.getByLabel(attributeName).fill(elementValue)

        const createElementResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instance/${catalogId}/records`),
            { label: 'Creating element' }
        )
        await elementDialog.getByRole('button', { name: 'Create' }).click()

        const createdElement = await parseJsonResponse<EntityRecord>(await createElementResponse, 'Creating element')
        if (!createdElement.id) {
            throw new Error('Create element response did not contain an id')
        }

        await expect(page.getByText(elementValue, { exact: true })).toBeVisible()
        await waitForListEntity(
            () => listRecords(api, metahub.id, catalogId, { limit: 100, offset: 0 }),
            createdElement.id,
            'element'
        )
        const persistedElement = await getRecord(api, metahub.id, catalogId, createdElement.id)
        expect(persistedElement.id).toBe(createdElement.id)
        const persistedAttributeCodename = typeof persistedAttribute.codename === 'string' ? persistedAttribute.codename : attributeCodename
        const persistedElementValue =
            (persistedElement.data ?? {})[persistedAttributeCodename] ??
            findElementValueByText(persistedElement.data ?? {}, elementValue, 'en')
        expect(readLocalizedText(persistedElementValue, 'en')).toBe(elementValue)

        await page.goto(`/metahub/${metahub.id}/entities/enumeration/instance/${enumerationId}/values`)
        await expect(page.getByRole('heading', { name: 'Values' })).toBeVisible()

        const valueDialog = await openEntityDialog(page, 'Create value')
        await fillNameAndCodename(valueDialog, { name: enumerationValueName, codename: enumerationValueCodename })

        const createValueResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/enumeration/instance/${enumerationId}/values`),
            { label: 'Creating enumeration value' }
        )
        await valueDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdValue = await parseJsonResponse<EntityRecord>(await createValueResponse, 'Creating enumeration value')
        if (!createdValue.id) {
            throw new Error('Create enumeration value response did not contain an id')
        }

        await expect(page.getByText(enumerationValueName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listOptionValues(api, metahub.id, enumerationId), createdValue.id, 'enumeration value')
        const persistedValue = await getOptionValue(api, metahub.id, enumerationId, createdValue.id)
        expect(persistedValue.id).toBe(createdValue.id)

        await page.goto(`/metahub/${metahub.id}/entities/set/instance/${setId}/fixed-values`)
        await expect(page.getByRole('heading', { name: /(fixed values|constants)/i })).toBeVisible()

        const constantDialog = await openEntityDialog(page, /Create (Constant|Fixed Value)/i)
        await fillNameAndCodename(constantDialog, { name: constantName, codename: constantCodename })

        const createConstantResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/set/instance/${setId}/fixed-values`),
            { label: 'Creating constant' }
        )
        await constantDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdConstant = await parseJsonResponse<EntityRecord>(await createConstantResponse, 'Creating constant')
        if (!createdConstant.id) {
            throw new Error('Create constant response did not contain an id')
        }

        await expect(page.getByText(constantName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listFixedValues(api, metahub.id, setId, { limit: 100, offset: 0 }), createdConstant.id, 'constant')
        const persistedConstant = await getFixedValue(api, metahub.id, setId, createdConstant.id)
        expect(persistedConstant.id).toBe(createdConstant.id)
    } finally {
        await disposeApiContext(api)
    }
})
