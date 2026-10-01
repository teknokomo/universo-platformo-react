import { expect, type APIRequestContext, type Page, type Request, type TestInfo } from '@playwright/test'
import { getLayoutWidgetBindingSlotDefinitions } from '@universo-react/types'
import { getLayout, getLayoutZoneWidgetBindings, listEntityInstances, listLayoutZoneWidgets, listRecords } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { expectNoTechnicalLeakage, expectSemanticFieldControls } from '../browser/runtimeUx'
import {
    fillLocalizedFieldValues,
    readLayoutWidgetConfig,
    responseIsMutation,
    type LayoutWidgetsResponse
} from '../marketingPageAuthoringHelpers'
import { parseJsonResponse, readLocalizedText } from '../entityRuntimeParsing'
import { verifyMarketingLayoutCopyDialogViewports } from './verifyMarketingLayoutCopyDialogViewports'

type LayoutBinding = {
    slot?: string
    sourceKey?: string
    selectorKind?: string
    semanticKey?: string
}

type LayoutBindingsResponse = {
    bindings?: LayoutBinding[]
}

type CopiedBindingState = {
    identity: string
    bindings: string[]
}

const bindingSignature = (binding: LayoutBinding): string =>
    [binding.slot ?? '', binding.sourceKey ?? '', binding.selectorKind ?? '', binding.semanticKey ?? ''].join('|')

const readBoundPlacementStates = async (api: APIRequestContext, metahubId: string, layoutId: string): Promise<CopiedBindingState[]> => {
    const response = (await listLayoutZoneWidgets(api, metahubId, layoutId)) as LayoutWidgetsResponse
    const states = await Promise.all(
        (response.items ?? []).map(async (widget) => {
            if (typeof widget.id !== 'string' || typeof widget.widgetKey !== 'string') return null
            const config = readLayoutWidgetConfig(widget)
            if (getLayoutWidgetBindingSlotDefinitions(widget.widgetKey, config).length === 0) return null
            const instanceKey = config.instanceKey
            if (typeof instanceKey !== 'string' || instanceKey.trim() === '') return null
            const bindingResponse = (await getLayoutZoneWidgetBindings(api, metahubId, layoutId, widget.id, 'en')) as LayoutBindingsResponse
            const bindings = (bindingResponse.bindings ?? []).map(bindingSignature).sort()
            return bindings.length > 0 ? { identity: `${widget.widgetKey}:${instanceKey}`, bindings } : null
        })
    )
    return states
        .filter((state): state is CopiedBindingState => state !== null)
        .sort((left, right) => left.identity.localeCompare(right.identity))
}

const readObjectRecordCounts = async (api: APIRequestContext, metahubId: string): Promise<Record<string, number>> => {
    const entityResponse = (await listEntityInstances(api, metahubId, { kind: 'object', limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string }>
    }
    const objectIds = (entityResponse.items ?? []).map((entity) => entity.id).filter((id): id is string => typeof id === 'string')
    expect(objectIds.length, 'The metahub should expose its Object entities before layout copy').toBeGreaterThan(0)

    const counts = await Promise.all(
        objectIds.map(async (objectId) => {
            const recordResponse = (await listRecords(api, metahubId, objectId, { limit: 1, offset: 0 })) as {
                pagination?: { total?: number }
            }
            if (!Number.isSafeInteger(recordResponse.pagination?.total) || recordResponse.pagination.total! < 0) {
                throw new Error(`The Object ${objectId} did not return a valid record count`)
            }
            return [objectId, recordResponse.pagination.total!] as const
        })
    )
    return Object.fromEntries(counts)
}

export async function copyEntityBackedMarketingLayouts(options: {
    api: APIRequestContext
    page: Page
    testInfo: TestInfo
    metahubId: string
    marketingLayoutId: string
    executionRunId: string
    sourceLayoutName: string
}): Promise<{ copiedLayoutId: string; copiedLayoutName: string }> {
    const { api, page, testInfo, metahubId, marketingLayoutId, executionRunId, sourceLayoutName } = options
    const sourceBindings = await readBoundPlacementStates(api, metahubId, marketingLayoutId)
    expect(sourceBindings.length, 'The Marketing Page layout must seed Entity-backed placements').toBeGreaterThan(0)
    const objectRecordCountsBeforeCopy = await readObjectRecordCounts(api, metahubId)

    const copyLayoutDialog = () => page.getByRole('dialog', { name: /^Copying Layout\b/i })
    const sourceLayoutRow = () => page.getByRole('row').filter({ has: page.getByRole('link', { name: sourceLayoutName, exact: true }) })
    await expect(sourceLayoutRow()).toBeVisible()
    await sourceLayoutRow()
        .getByRole('button', { name: `Actions for ${sourceLayoutName}`, exact: true })
        .click()
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()

    const copyDialog = copyLayoutDialog()
    await expect(copyDialog).toBeVisible()
    await expect(copyDialog.getByRole('tab', { name: 'Options', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expectNoTechnicalLeakage(copyDialog, { label: 'Marketing layout copy dialog', checkUuidSubstrings: true })
    await expect(copyDialog.getByRole('radio')).toHaveCount(0)
    await expect(copyDialog).not.toContainText(/Hero|heroBindingCopyMode/u)

    await copyDialog.getByRole('tab', { name: 'General', exact: true }).click()
    await expectSemanticFieldControls(copyDialog, { longTextLabels: ['Description'] })
    const copiedLayoutDescription = `A copied Marketing Page with preserved Entity bindings. ${executionRunId}`
    await fillLocalizedFieldValues(page, copyDialog, 'Description', {
        en: copiedLayoutDescription,
        ru: `Копия маркетинговой страницы с сохранёнными привязками Сущностей. ${executionRunId}`
    })
    await copyDialog.getByRole('tab', { name: 'Options', exact: true }).click()
    await verifyMarketingLayoutCopyDialogViewports({ page, testInfo, dialog: copyDialog })

    let copyRequestCount = 0
    let copyPayload: Record<string, unknown> | null = null
    const observeCopyRequest = (request: Request) => {
        if (
            request.method() === 'POST' &&
            new URL(request.url()).pathname === `/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/copy`
        ) {
            copyRequestCount += 1
            copyPayload = request.postDataJSON() as Record<string, unknown>
        }
    }
    page.on('request', observeCopyRequest)
    const copyResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/copy$`)),
        { label: 'Copying a Marketing Page while preserving its Entity bindings', timeout: 90_000 }
    )
    await copyDialog.getByRole('button', { name: 'Copy', exact: true }).click()
    const copyResponse = await copyResponsePromise
    page.off('request', observeCopyRequest)
    expect(copyResponse.ok()).toBe(true)
    expect(copyRequestCount).toBe(1)
    expect(copyPayload).toMatchObject({ entityBindingCopyMode: 'reuse' })

    const copiedLayout = await parseJsonResponse<{ id?: string; name?: unknown }>(copyResponse, 'Copying a bound Marketing Page layout')
    if (typeof copiedLayout.id !== 'string') throw new Error('The copied layout did not return its UUID v7 identity')
    expect(copiedLayout.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    const copiedLayoutName = readLocalizedText(copiedLayout.name, 'en')
    const persistedCopy = await getLayout(api, metahubId, copiedLayout.id)
    expect(readLocalizedText(persistedCopy.description, 'en')).toBe(copiedLayoutDescription)
    expect(readLocalizedText(persistedCopy.description, 'ru')).toBe(
        `Копия маркетинговой страницы с сохранёнными привязками Сущностей. ${executionRunId}`
    )
    const copiedLayoutRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: copiedLayoutName, exact: true }) })
    await expect(copiedLayoutRow).toBeVisible()
    await expectNoTechnicalLeakage(copiedLayoutRow, {
        label: 'Copied Marketing Page layout row',
        checkUuidSubstrings: true
    })

    const copiedBindings = await readBoundPlacementStates(api, metahubId, copiedLayout.id)
    expect(copiedBindings).toEqual(sourceBindings)
    expect(await readObjectRecordCounts(api, metahubId)).toEqual(objectRecordCountsBeforeCopy)

    return { copiedLayoutId: copiedLayout.id, copiedLayoutName }
}
