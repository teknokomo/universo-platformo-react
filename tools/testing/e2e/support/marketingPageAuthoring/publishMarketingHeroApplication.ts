import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { recordCreatedApplication, recordCreatedPublication } from '../backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import { entityDialogSelectors } from '../selectors/contracts'
import {
    enableSwitch,
    ensureListView,
    fillLocalizedField,
    openCreateDialog,
    openVisibleRowMenu,
    responseIsMutation,
    waitForApplicationConnector,
    waitForPublicationApplication,
    waitForPublicationVersion
} from '../marketingPageAuthoringHelpers'
import { parseJsonResponse, readLocalizedText } from '../entityRuntimeParsing'

type EntityResponse = {
    id?: string
    data?: { id?: string }
}

const unwrapEntity = <T extends EntityResponse>(payload: T): { id?: string } => payload.data ?? payload

export async function publishMarketingHeroApplication(options: {
    api: APIRequestContext
    page: Page
    metahubId: string
    publicationName: string
}): Promise<{ applicationId: string; connectorName: string }> {
    const { api, page, metahubId, publicationName } = options
    // Create a publication and linked application from the UI. Application
    // schema creation is intentionally completed below in ConnectorBoard,
    // where the real diff/confirmation dialog is available.
    await applyBrowserPreferences(page, { language: 'en' })
    await page.goto(`/metahub/${metahubId}/publications`)
    await expect(page.getByRole('heading', { name: 'Publications', exact: true })).toBeVisible()
    await ensureListView(page)

    const publicationResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahubId}/publications$`)),
        { label: 'Creating the marketing publication through the browser dialog', timeout: 120_000 }
    )
    const publicationDialog = await openCreateDialog(page, 'Create Publication')
    await fillLocalizedField(publicationDialog, 'Name', publicationName)
    await enableSwitch(publicationDialog, 'Create application')
    await publicationDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(publicationDialog).toHaveCount(0)

    const publicationPayload = await parseJsonResponse<EntityResponse>(
        await publicationResponsePromise,
        'Creating the marketing publication through the browser dialog'
    )
    const publication = unwrapEntity(publicationPayload)
    if (!publication.id) {
        throw new Error('The browser-created marketing publication did not return an id')
    }
    await recordCreatedPublication({ id: publication.id, metahubId: metahubId })
    await waitForPublicationVersion(api, metahubId, publication.id)

    // Exercise the publication-level Sync action via its accessible row
    // action menu, then verify that the backend settled successfully.
    await page.goto(`/metahub/${metahubId}/publications`)
    await ensureListView(page)
    const publicationRow = await openVisibleRowMenu(page, publicationName)
    const publicationSyncPromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahubId}/publication/${publication.id}/sync$`)),
        { label: 'Synchronizing the marketing publication from the UI', timeout: 120_000 }
    )
    await page.getByRole('menuitem', { name: 'Sync Schema', exact: true }).click()
    const publicationSyncResponse = await publicationSyncPromise
    expect(publicationSyncResponse.ok()).toBe(true)
    await expect(publicationRow).toBeVisible()

    const application = await waitForPublicationApplication(api, metahubId, publication.id)
    if (!application.id) {
        throw new Error('The linked marketing application did not return an id')
    }
    await recordCreatedApplication({ id: application.id })
    const connector = await waitForApplicationConnector(api, application.id)
    const connectorName = readLocalizedText(connector.name)
    if (!connectorName) {
        throw new Error('The linked marketing application connector did not return a localized display name')
    }

    return { applicationId: application.id, connectorName }
}
