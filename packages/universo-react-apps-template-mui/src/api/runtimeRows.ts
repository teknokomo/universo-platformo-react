import { z } from 'zod'
import type { RuntimeRecordCommand, RuntimeRestoreTarget } from './types'
import { extractErrorMessage, fetchWithCsrf } from './client'

const buildRuntimeApiUrl = (apiBaseUrl: string, applicationId: string, path = ''): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const apiPath = `${normalizedBase}/applications/${applicationId}/runtime${path}`

    if (/^https?:\/\//i.test(normalizedBase)) {
        return new URL(apiPath).toString()
    }

    return new URL(apiPath, window.location.origin).toString()
}

const appendWorkspaceId = (url: string, workspaceId?: string | null): string => {
    if (!workspaceId?.trim()) return url
    const parsed = new URL(url, window.location.origin)
    parsed.searchParams.set('workspaceId', workspaceId.trim())
    return parsed.toString()
}

/** Fetch a single row (raw data, VLC not resolved — for edit forms). */
export async function fetchAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    let url = buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)
    if (resolvedSectionId) {
        url += `?objectCollectionId=${encodeURIComponent(resolvedSectionId)}`
    }

    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Fetch row failed'))
    }
    return res.json()
}

/** Create a new row. Returns the created row with its id. */
export async function createAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, objectCollectionId, sectionId, workspaceId, data } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const url = appendWorkspaceId(buildRuntimeApiUrl(apiBaseUrl, applicationId, '/rows'), workspaceId)

    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Create row failed'))
    }
    return res.json()
}

/** Update an existing row (bulk update via /rows/:rowId). */
export async function updateAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    data: Record<string, unknown>
    expectedVersion?: number
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId, workspaceId, data, expectedVersion } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const url = appendWorkspaceId(buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`), workspaceId)

    const body: Record<string, unknown> = { data }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Update row failed'))
    }
    return res.json()
}

/** Soft-delete a row. */
export async function deleteAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    expectedVersion?: number
}): Promise<void> {
    const { apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId, workspaceId, expectedVersion } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams()
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    if (resolvedSectionId) {
        params.set('objectCollectionId', resolvedSectionId)
    }
    if (typeof expectedVersion === 'number') {
        params.set('expectedVersion', String(expectedVersion))
    }
    const queryString = params.toString()
    const url = `${buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}`)}${queryString ? `?${queryString}` : ''}`

    const res = await fetchWithCsrf(apiBaseUrl, url, { method: 'DELETE' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete row failed'))
    }
}

/** Remove a just-created row as server-validated compensation for a failed composite create flow. */
export async function compensateCreatedAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
}): Promise<void> {
    const { apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId, workspaceId } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const url = appendWorkspaceId(buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/compensate-create`), workspaceId)
    const body: Record<string, unknown> = { expectedVersion: 1 }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Compensate created row failed'))
    }
}

/** Restore a soft-deleted row. */
export async function restoreAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    expectedVersion?: number
    restoreTarget?: RuntimeRestoreTarget
}): Promise<void> {
    const { apiBaseUrl, applicationId, rowId, objectCollectionId, sectionId, expectedVersion, restoreTarget } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = {}
    if (resolvedSectionId) {
        body.objectCollectionId = resolvedSectionId
    }
    if (typeof expectedVersion === 'number') {
        body.expectedVersion = expectedVersion
    }
    if (restoreTarget) {
        body.restoreTarget = restoreTarget
    }

    const res = await fetchWithCsrf(apiBaseUrl, buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/restore`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Restore row failed'))
    }
}

/** Copy an existing row. */
export async function copyAppRow(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    copyChildTables?: boolean
    data?: Record<string, unknown>
    expectedVersion?: number
}): Promise<Record<string, unknown>> {
    const {
        apiBaseUrl,
        applicationId,
        rowId,
        objectCollectionId,
        sectionId,
        workspaceId,
        copyChildTables = true,
        data,
        expectedVersion
    } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const url = appendWorkspaceId(buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/copy`), workspaceId)
    const body: Record<string, unknown> = { copyChildTables }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (data && Object.keys(data).length > 0) body.data = data
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Copy row failed'))
    }
    return res.json()
}

export async function runAppRecordCommand(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    command: RuntimeRecordCommand
    objectCollectionId?: string
    sectionId?: string
    expectedVersion?: number
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, command, objectCollectionId, sectionId, expectedVersion } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const url = buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/${command}`)
    const body: Record<string, unknown> = {}
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Record command failed'))
    }
    return res.json()
}

export async function runAppWorkflowAction(options: {
    apiBaseUrl: string
    applicationId: string
    rowId: string
    actionCodename: string
    objectCollectionId?: string
    sectionId?: string
    expectedVersion: number
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, rowId, actionCodename, objectCollectionId, sectionId, expectedVersion } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const url = buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${rowId}/workflow/${encodeURIComponent(actionCodename)}`)
    const body: Record<string, unknown> = { expectedVersion }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Workflow action failed'))
    }
    return res.json()
}

export async function updateLearningContentProgress(options: {
    apiBaseUrl: string
    applicationId: string
    targetObjectCodename: string
    targetRecordId: string
    action?: 'view' | 'complete'
}): Promise<{ persisted: boolean; reason?: string; progressPercent?: number; status?: string }> {
    const { apiBaseUrl, applicationId, targetObjectCodename, targetRecordId, action = 'view' } = options
    const url = buildRuntimeApiUrl(apiBaseUrl, applicationId, '/progress/content')
    const body: Record<string, unknown> = { targetObjectCodename, targetRecordId, action }

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Update learning content progress failed'))
    }
    return res.json()
}

export async function recalculateLearningContentProgress(options: {
    apiBaseUrl: string
    applicationId: string
    targetObjectCodename: string
    targetRecordId: string
}): Promise<{ persisted: boolean; action?: string; targetObjectCodename?: string; targetRecordId?: string }> {
    const { apiBaseUrl, applicationId, targetObjectCodename, targetRecordId } = options
    const url = buildRuntimeApiUrl(apiBaseUrl, applicationId, '/progress/content')

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetObjectCodename, targetRecordId, action: 'recalculate' })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Recalculate learning content progress failed'))
    }
    return res.json()
}

/** Persist a complete row order for runtime objects that explicitly enable row reordering. */
export async function reorderAppRows(options: {
    apiBaseUrl: string
    applicationId: string
    objectCollectionId?: string
    sectionId?: string
    workspaceId?: string | null
    orderedRowIds: string[]
    expectedVersionsByRowId?: Record<string, number>
}): Promise<void> {
    const { apiBaseUrl, applicationId, objectCollectionId, sectionId, workspaceId, orderedRowIds, expectedVersionsByRowId } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const body: Record<string, unknown> = { orderedRowIds }
    if (resolvedSectionId) body.objectCollectionId = resolvedSectionId
    if (expectedVersionsByRowId && Object.keys(expectedVersionsByRowId).length > 0) {
        body.expectedVersionsByRowId = expectedVersionsByRowId
    }

    const url = appendWorkspaceId(buildRuntimeApiUrl(apiBaseUrl, applicationId, '/rows/reorder'), workspaceId)

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Reorder rows failed'))
    }
}

/** Zod schema for the tabular child rows API response. */
export const tabularRowsResponseSchema = z.object({
    items: z.array(z.record(z.unknown()).and(z.object({ id: z.string() }))),
    total: z.number()
})

export type TabularRowsResponse = z.infer<typeof tabularRowsResponseSchema>

/** Fetch child rows for a TABLE component. */
export async function fetchTabularRows(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
}): Promise<TabularRowsResponse> {
    const { apiBaseUrl, applicationId, parentRecordId, componentId, objectCollectionId, sectionId, workspaceId } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams({ objectCollectionId: resolvedSectionId })
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    const url = `${buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${componentId}`)}?${params.toString()}`

    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Fetch tabular rows failed'))
    }
    const json = await res.json()
    const parsed = tabularRowsResponseSchema.safeParse(json)
    if (!parsed.success) {
        throw new Error('Tabular rows response validation failed')
    }
    return parsed.data
}

/** Create a new child row in a TABLE component. */
export async function createTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
    data: Record<string, unknown>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, componentId, objectCollectionId, sectionId, workspaceId, data } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams({ objectCollectionId: resolvedSectionId })
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    const url = `${buildRuntimeApiUrl(apiBaseUrl, applicationId, `/rows/${parentRecordId}/tabular/${componentId}`)}?${params.toString()}`

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Create tabular row failed'))
    }
    return res.json()
}

/** Update a child row in a TABLE component. */
export async function updateTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
    childRowId: string
    data: Record<string, unknown>
    expectedVersion?: number
}): Promise<Record<string, unknown>> {
    const {
        apiBaseUrl,
        applicationId,
        parentRecordId,
        componentId,
        objectCollectionId,
        sectionId,
        workspaceId,
        childRowId,
        data,
        expectedVersion
    } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams({ objectCollectionId: resolvedSectionId })
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    const url = `${buildRuntimeApiUrl(
        apiBaseUrl,
        applicationId,
        `/rows/${parentRecordId}/tabular/${componentId}/${encodeURIComponent(childRowId)}`
    )}?${params.toString()}`
    const body: Record<string, unknown> = { data }
    if (typeof expectedVersion === 'number') {
        body.expectedVersion = expectedVersion
    }

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Update tabular row failed'))
    }
    return res.json()
}

/** Atomically update multiple child rows in a TABLE component. */
export async function batchUpdateTabularRows(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
    updates: Array<{ childRowId: string; data: Record<string, unknown>; expectedVersion?: number }>
    uniformUpdates?: Array<{
        rows: Array<{ childRowId: string; expectedVersion?: number }>
        data: Record<string, unknown>
    }>
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, componentId, objectCollectionId, sectionId, workspaceId, updates, uniformUpdates } =
        options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams({ objectCollectionId: resolvedSectionId })
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    const url = `${buildRuntimeApiUrl(
        apiBaseUrl,
        applicationId,
        `/rows/${parentRecordId}/tabular/${componentId}/batch`
    )}?${params.toString()}`

    const res = await fetchWithCsrf(apiBaseUrl, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, ...(uniformUpdates?.length ? { uniformUpdates } : {}) })
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Batch update tabular rows failed'))
    }
    return res.json()
}

/** Delete a child row in a TABLE component. */
export async function deleteTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
    childRowId: string
    expectedVersion?: number
}): Promise<void> {
    const {
        apiBaseUrl,
        applicationId,
        parentRecordId,
        componentId,
        objectCollectionId,
        sectionId,
        workspaceId,
        childRowId,
        expectedVersion
    } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams({ objectCollectionId: resolvedSectionId })
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    if (expectedVersion !== undefined) {
        params.set('expectedVersion', String(expectedVersion))
    }
    const url = `${buildRuntimeApiUrl(
        apiBaseUrl,
        applicationId,
        `/rows/${parentRecordId}/tabular/${componentId}/${encodeURIComponent(childRowId)}`
    )}?${params.toString()}`

    const res = await fetchWithCsrf(apiBaseUrl, url, { method: 'DELETE' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete tabular row failed'))
    }
}

/** Copy a child row in a TABLE component. */
export async function copyTabularRow(options: {
    apiBaseUrl: string
    applicationId: string
    parentRecordId: string
    componentId: string
    objectCollectionId: string
    sectionId?: string
    workspaceId?: string | null
    childRowId: string
}): Promise<Record<string, unknown>> {
    const { apiBaseUrl, applicationId, parentRecordId, componentId, objectCollectionId, sectionId, workspaceId, childRowId } = options
    const resolvedSectionId = sectionId ?? objectCollectionId
    const params = new URLSearchParams({ objectCollectionId: resolvedSectionId })
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    const url = `${buildRuntimeApiUrl(
        apiBaseUrl,
        applicationId,
        `/rows/${parentRecordId}/tabular/${componentId}/${encodeURIComponent(childRowId)}/copy`
    )}?${params.toString()}`

    const res = await fetchWithCsrf(apiBaseUrl, url, { method: 'POST' })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Copy tabular row failed'))
    }
    return res.json()
}
