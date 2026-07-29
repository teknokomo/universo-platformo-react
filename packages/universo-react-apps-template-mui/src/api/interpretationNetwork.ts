import { z } from 'zod'
import { extractErrorMessage, fetchWithCsrf, throwAppsApiError } from './client'

const interpretationNetworkLocalizedValueSchema = z.unknown()
const interpretationNetworkUuidSchema = z.string().uuid()

export const interpretationNetworkSystemStructureResponseSchema = z.object({
    structureId: interpretationNetworkUuidSchema,
    interpretationId: interpretationNetworkUuidSchema,
    rootCellId: interpretationNetworkUuidSchema,
    created: z.boolean(),
    canCreate: z.boolean().optional()
})

export const interpretationNetworkTemplateSummarySchema = z.object({
    id: interpretationNetworkUuidSchema,
    name: interpretationNetworkLocalizedValueSchema,
    description: interpretationNetworkLocalizedValueSchema.optional().nullable(),
    includesMaterials: z.boolean(),
    version: z.number()
})

export const interpretationNetworkTemplateListResponseSchema = z.object({
    items: z.array(interpretationNetworkTemplateSummarySchema)
})

export const interpretationNetworkTemplateDetailSchema = interpretationNetworkTemplateSummarySchema.extend({
    matrix: z.object({
        cellCount: z.number().int().nonnegative(),
        rootCount: z.number().int().nonnegative(),
        maxDepth: z.number().int().nonnegative()
    }),
    materialCount: z.number().int().nonnegative()
})

export const interpretationNetworkTemplateInstantiateResponseSchema = z.object({
    structureId: interpretationNetworkUuidSchema,
    interpretationId: interpretationNetworkUuidSchema
})

export const interpretationNetworkStructureCreateResponseSchema = interpretationNetworkTemplateInstantiateResponseSchema.extend({
    rootCellId: interpretationNetworkUuidSchema
})

export const interpretationNetworkMaterialCreateResponseSchema = z.object({
    id: interpretationNetworkUuidSchema.or(z.string().min(1)),
    matrixRowId: z.string().min(1)
})

const interpretationNetworkMatrixCellPlacementSchema = z
    .object({
        parentCellId: interpretationNetworkUuidSchema.nullable().optional(),
        rowKey: z.string().min(1).optional(),
        colKey: z.string().min(1).optional(),
        sortOrder: z.number().int().nonnegative().optional()
    })
    .strict()

export const interpretationNetworkMatrixCellCreateResponseSchema = z.object({
    id: interpretationNetworkUuidSchema,
    status: z.literal('created'),
    item: z.record(z.unknown())
})

export const interpretationNetworkMatrixCellsMoveResponseSchema = z.object({
    status: z.literal('ok'),
    updated: z.array(interpretationNetworkUuidSchema)
})

export type InterpretationNetworkSystemStructureResponse = z.infer<typeof interpretationNetworkSystemStructureResponseSchema>
export type InterpretationNetworkTemplateSummary = z.infer<typeof interpretationNetworkTemplateSummarySchema>
export type InterpretationNetworkTemplateListResponse = z.infer<typeof interpretationNetworkTemplateListResponseSchema>
export type InterpretationNetworkTemplateDetail = z.infer<typeof interpretationNetworkTemplateDetailSchema>
export type InterpretationNetworkTemplateInstantiateResponse = z.infer<typeof interpretationNetworkTemplateInstantiateResponseSchema>
export type InterpretationNetworkStructureCreateResponse = z.infer<typeof interpretationNetworkStructureCreateResponseSchema>
export type InterpretationNetworkMaterialCreateResponse = z.infer<typeof interpretationNetworkMaterialCreateResponseSchema>
export type InterpretationNetworkMatrixCellPlacement = z.infer<typeof interpretationNetworkMatrixCellPlacementSchema>
export type InterpretationNetworkMatrixCellCreateResponse = z.infer<typeof interpretationNetworkMatrixCellCreateResponseSchema>
export type InterpretationNetworkMatrixCellsMoveResponse = z.infer<typeof interpretationNetworkMatrixCellsMoveResponseSchema>

type InterpretationNetworkRuntimeScope = {
    widgetId?: string | null
    layoutId?: string | null
}

const buildInterpretationNetworkUrl = (
    apiBaseUrl: string,
    applicationId: string,
    path: string,
    workspaceId?: string | null,
    scope?: InterpretationNetworkRuntimeScope
): string => {
    const normalizedBase = apiBaseUrl.replace(/\/$/, '')
    const runtimePath = `${normalizedBase}/applications/${encodeURIComponent(applicationId)}/runtime/interpretation-network${path}`
    const url = /^https?:\/\//i.test(normalizedBase) ? new URL(runtimePath) : new URL(runtimePath, window.location.origin)
    const params = new URLSearchParams()
    if (workspaceId?.trim()) {
        params.set('workspaceId', workspaceId.trim())
    }
    if (scope?.widgetId?.trim()) params.set('widgetId', scope.widgetId.trim())
    if (scope?.layoutId?.trim()) params.set('layoutId', scope.layoutId.trim())
    params.forEach((value, key) => url.searchParams.set(key, value))
    return url.toString()
}

export async function ensureInterpretationNetworkSystemStructure(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    locale?: string
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkSystemStructureResponse> {
    const { apiBaseUrl, applicationId, workspaceId, locale, widgetId, layoutId } = options
    const body: Record<string, unknown> = {}
    if (locale) body.locale = locale
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/system-structure/ensure', workspaceId, { widgetId, layoutId }),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Ensure system structure failed'))
    }
    const parsed = interpretationNetworkSystemStructureResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('System structure response validation failed')
    }
    return parsed.data
}

export async function fetchInterpretationNetworkTemplates(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkTemplateListResponse> {
    const { apiBaseUrl, applicationId, workspaceId, widgetId, layoutId } = options
    const res = await fetch(buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/templates', workspaceId, { widgetId, layoutId }), {
        credentials: 'include'
    })
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Fetch interpretation network templates failed'))
    }
    const parsed = interpretationNetworkTemplateListResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Template list response validation failed')
    }
    return parsed.data
}

export async function fetchInterpretationNetworkTemplateDetail(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    templateId: string
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkTemplateDetail> {
    const { apiBaseUrl, applicationId, workspaceId, templateId, widgetId, layoutId } = options
    const res = await fetch(
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/templates/${encodeURIComponent(templateId)}`, workspaceId, {
            widgetId,
            layoutId
        }),
        { credentials: 'include' }
    )
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Fetch interpretation network template failed'))
    const parsed = interpretationNetworkTemplateDetailSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Template detail response validation failed')
    return parsed.data
}

export async function saveInterpretationNetworkTemplate(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    sourceStructureId: string
    templateName: unknown
    description?: unknown
    includeMaterials: boolean
    expectedVersion?: number
    locale?: string
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkTemplateSummary> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        sourceStructureId,
        templateName,
        description,
        includeMaterials,
        expectedVersion,
        locale,
        widgetId,
        layoutId
    } = options
    const body: Record<string, unknown> = { sourceStructureId, templateName, includeMaterials }
    if (description !== undefined) body.description = description
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion
    if (locale) body.locale = locale
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/templates', workspaceId, { widgetId, layoutId }),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Save interpretation network template failed'))
    }
    const parsed = interpretationNetworkTemplateSummarySchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Template response validation failed')
    }
    return parsed.data
}

export async function updateInterpretationNetworkTemplate(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    templateId: string
    templateName: unknown
    description?: unknown
    expectedVersion?: number
    locale?: string
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkTemplateSummary> {
    const { apiBaseUrl, applicationId, workspaceId, templateId, templateName, description, expectedVersion, locale, widgetId, layoutId } =
        options
    const body: Record<string, unknown> = { templateName }
    if (description !== undefined) body.description = description
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion
    if (locale) body.locale = locale
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/templates/${encodeURIComponent(templateId)}`, workspaceId, {
            widgetId,
            layoutId
        }),
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Update interpretation network template failed'))
    }
    const parsed = interpretationNetworkTemplateSummarySchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Template response validation failed')
    }
    return parsed.data
}

export async function deleteInterpretationNetworkTemplate(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    templateId: string
    expectedVersion?: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<void> {
    const { apiBaseUrl, applicationId, workspaceId, templateId, expectedVersion, widgetId, layoutId } = options
    const body: Record<string, unknown> = {}
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/templates/${encodeURIComponent(templateId)}`, workspaceId, {
            widgetId,
            layoutId
        }),
        {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete interpretation network template failed'))
    }
}

export async function deleteInterpretationNetworkStructure(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    structureId: string
    expectedVersion?: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<void> {
    const { apiBaseUrl, applicationId, workspaceId, structureId, expectedVersion, widgetId, layoutId } = options
    const body: Record<string, unknown> = {}
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/structures/${encodeURIComponent(structureId)}`, workspaceId, {
            widgetId,
            layoutId
        }),
        {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Delete interpretation network structure failed'))
    }
}

export async function instantiateInterpretationNetworkTemplate(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    templateId: string
    structureName: unknown
    description?: unknown
    expectedVersion?: number
    locale?: string
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkTemplateInstantiateResponse> {
    const { apiBaseUrl, applicationId, workspaceId, templateId, structureName, description, expectedVersion, locale, widgetId, layoutId } =
        options
    const body: Record<string, unknown> = { structureName }
    if (description !== undefined) body.description = description
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion
    if (locale) body.locale = locale
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/templates/${encodeURIComponent(templateId)}/instantiate`, workspaceId, {
            widgetId,
            layoutId
        }),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Instantiate interpretation network template failed'))
    }
    const parsed = interpretationNetworkTemplateInstantiateResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Template instantiation response validation failed')
    }
    return parsed.data
}

export async function createInterpretationNetworkStructure(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    name: unknown
    description?: unknown
    locale?: string
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkStructureCreateResponse> {
    const { apiBaseUrl, applicationId, workspaceId, name, description, locale, widgetId, layoutId } = options
    const body: Record<string, unknown> = { name }
    if (description !== undefined) body.description = description
    if (locale) body.locale = locale
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/structures', workspaceId, { widgetId, layoutId }),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Create interpretation network structure failed'))
    const parsed = interpretationNetworkStructureCreateResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Structure response validation failed')
    return parsed.data
}

export async function createInterpretationNetworkMaterial(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    matrixRowId: string
    cellId: string
    data: Record<string, unknown>
    expectedVersion?: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkMaterialCreateResponse> {
    const { apiBaseUrl, applicationId, workspaceId, interpretationId, matrixRowId, cellId, data, expectedVersion, widgetId, layoutId } =
        options
    const body: Record<string, unknown> = {
        interpretationId,
        matrixRowId,
        cellId,
        data
    }
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/materials', workspaceId, { widgetId, layoutId }),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Create interpretation network material failed'))
    }
    const parsed = interpretationNetworkMaterialCreateResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
        throw new Error('Material response validation failed')
    }
    return parsed.data
}

export async function createInterpretationNetworkMatrixCell(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    data: Record<string, unknown>
    placement: InterpretationNetworkMatrixCellPlacement
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkMatrixCellCreateResponse> {
    const { apiBaseUrl, applicationId, workspaceId, interpretationId, data, placement, widgetId, layoutId } = options
    const parsedPlacement = interpretationNetworkMatrixCellPlacementSchema.parse(placement)
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/matrix/cells', workspaceId, { widgetId, layoutId }),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interpretationId, data, placement: parsedPlacement })
        }
    )
    if (!res.ok) await throwAppsApiError(res, 'Create interpretation network matrix cell failed')
    const parsed = interpretationNetworkMatrixCellCreateResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Matrix cell response validation failed')
    return parsed.data
}

export async function moveInterpretationNetworkMatrixCells(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    updates: Array<{
        matrixRowId: string
        expectedVersion?: number
        data?: Record<string, unknown>
        placement: InterpretationNetworkMatrixCellPlacement
    }>
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkMatrixCellsMoveResponse> {
    const { apiBaseUrl, applicationId, workspaceId, interpretationId, updates, widgetId, layoutId } = options
    const body = {
        interpretationId,
        updates: updates.map((update) => ({
            ...update,
            placement: interpretationNetworkMatrixCellPlacementSchema.parse(update.placement)
        }))
    }
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/matrix/cells/move', workspaceId, { widgetId, layoutId }),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }
    )
    if (!res.ok) await throwAppsApiError(res, 'Move interpretation network matrix cells failed')
    const parsed = interpretationNetworkMatrixCellsMoveResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Matrix move response validation failed')
    return parsed.data
}
