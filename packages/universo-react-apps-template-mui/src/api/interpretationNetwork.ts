import { z } from 'zod'
import {
    interpretationNetworkMaterialAssociationPageSchema,
    uuidV7Schema,
    type InterpretationNetworkMaterialAssociation
} from '@universo-react/types'
import { extractErrorMessage, fetchWithCsrf, throwAppsApiError } from './client'

const interpretationNetworkLocalizedValueSchema = z.unknown()
const interpretationNetworkUuidSchema = z.string().uuid()

export const interpretationNetworkTemplateSaveScopeSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('wholeStructure') }).strict(),
    z.object({ kind: z.literal('selectedBranch'), rootCellId: uuidV7Schema }).strict()
])
export type InterpretationNetworkTemplateSaveScope = z.infer<typeof interpretationNetworkTemplateSaveScopeSchema>

export async function fetchInterpretationNetworkMaterialAssociations(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    widgetId?: string | null
    layoutId?: string | null
    signal?: AbortSignal
}): Promise<InterpretationNetworkMaterialAssociation[]> {
    const { apiBaseUrl, applicationId, workspaceId, interpretationId, widgetId, layoutId, signal } = options
    const pageSize = 250
    const maxOffset = 100_000
    const items: InterpretationNetworkMaterialAssociation[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        if (offset > maxOffset) throw new Error('Material association pagination limit exceeded')
        const url = new URL(
            buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/material-associations', workspaceId, { widgetId, layoutId })
        )
        url.searchParams.set('interpretationId', interpretationId)
        url.searchParams.set('limit', String(pageSize))
        url.searchParams.set('offset', String(offset))
        const response = await fetch(url.toString(), { credentials: 'include', signal })
        if (!response.ok) throw new Error(await extractErrorMessage(response, 'Fetch interpretation network materials failed'))

        const parsed = interpretationNetworkMaterialAssociationPageSchema.safeParse(await response.json())
        if (!parsed.success || parsed.data.page.offset !== offset || parsed.data.page.limit !== pageSize) {
            throw new Error('Material association response validation failed')
        }
        if (parsed.data.page.hasMore && parsed.data.items.length === 0) {
            throw new Error('Material association pagination did not advance')
        }

        items.push(...parsed.data.items)
        offset += pageSize
        hasMore = parsed.data.page.hasMore
    }

    return items
}

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

export const interpretationNetworkTemplateApplyResponseSchema = z
    .object({
        templateId: uuidV7Schema,
        templateVersion: z.number().int().positive(),
        interpretationId: uuidV7Schema,
        targetCellId: uuidV7Schema,
        targetCellVersion: z.number().int().positive(),
        insertedRootCellId: uuidV7Schema,
        insertedCellCount: z.number().int().positive(),
        insertedMaterialCount: z.number().int().nonnegative()
    })
    .strict()

export const interpretationNetworkStructureCreateResponseSchema = interpretationNetworkTemplateInstantiateResponseSchema.extend({
    rootCellId: interpretationNetworkUuidSchema
})

export const interpretationNetworkMaterialCreateResponseSchema = z
    .object({
        id: interpretationNetworkUuidSchema,
        matrixRowId: interpretationNetworkUuidSchema
    })
    .strict()

export const interpretationNetworkMaterialUpdateResponseSchema = z
    .object({
        id: z.string().min(1),
        version: z.number().int().positive()
    })
    .strict()

export const interpretationNetworkMaterialPrimaryResponseSchema = z
    .object({
        primaryMaterialId: z.string().min(1).nullable(),
        cellVersion: z.number().int().positive()
    })
    .strict()

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

export const interpretationNetworkMatrixCellUpdateResponseSchema = z
    .object({
        cellId: interpretationNetworkUuidSchema,
        version: z.number().int().positive()
    })
    .strict()

export type InterpretationNetworkSystemStructureResponse = z.infer<typeof interpretationNetworkSystemStructureResponseSchema>
export type InterpretationNetworkTemplateSummary = z.infer<typeof interpretationNetworkTemplateSummarySchema>
export type InterpretationNetworkTemplateListResponse = z.infer<typeof interpretationNetworkTemplateListResponseSchema>
export type InterpretationNetworkTemplateDetail = z.infer<typeof interpretationNetworkTemplateDetailSchema>
export type InterpretationNetworkTemplateInstantiateResponse = z.infer<typeof interpretationNetworkTemplateInstantiateResponseSchema>
export type InterpretationNetworkTemplateApplyResponse = z.infer<typeof interpretationNetworkTemplateApplyResponseSchema>
export type InterpretationNetworkStructureCreateResponse = z.infer<typeof interpretationNetworkStructureCreateResponseSchema>
export type InterpretationNetworkMaterialCreateResponse = z.infer<typeof interpretationNetworkMaterialCreateResponseSchema>
export type InterpretationNetworkMaterialUpdateResponse = z.infer<typeof interpretationNetworkMaterialUpdateResponseSchema>
export type InterpretationNetworkMaterialPrimaryResponse = z.infer<typeof interpretationNetworkMaterialPrimaryResponseSchema>
export type InterpretationNetworkMatrixCellPlacement = z.infer<typeof interpretationNetworkMatrixCellPlacementSchema>
export type InterpretationNetworkMatrixCellCreateResponse = z.infer<typeof interpretationNetworkMatrixCellCreateResponseSchema>
export type InterpretationNetworkMatrixCellsMoveResponse = z.infer<typeof interpretationNetworkMatrixCellsMoveResponseSchema>
export type InterpretationNetworkMatrixCellUpdateResponse = z.infer<typeof interpretationNetworkMatrixCellUpdateResponseSchema>

type InterpretationNetworkRuntimeScope = {
    widgetId?: string | null
    layoutId?: string | null
    instanceKey?: string
    targetKind?: 'page' | 'object'
    entityTypeId?: string
    locale?: string
    themeVariant?: 'light' | 'dark' | 'system'
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
    if (scope?.instanceKey?.trim()) params.set('instanceKey', scope.instanceKey.trim())
    if (scope?.targetKind) params.set('targetKind', scope.targetKind)
    if (scope?.entityTypeId?.trim()) params.set('entityTypeId', scope.entityTypeId.trim())
    if (scope?.locale?.trim()) params.set('locale', scope.locale.trim())
    if (scope?.themeVariant) params.set('themeVariant', scope.themeVariant)
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
    scope: InterpretationNetworkTemplateSaveScope
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
        scope,
        expectedVersion,
        locale,
        widgetId,
        layoutId
    } = options
    const parsedScope = interpretationNetworkTemplateSaveScopeSchema.parse(scope)
    const body: Record<string, unknown> = { sourceStructureId, templateName, includeMaterials, scope: parsedScope }
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

export async function applyInterpretationNetworkTemplateToCell(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    templateId: string
    interpretationId: string
    targetCellId: string
    expectedTemplateVersion: number
    expectedTargetVersion: number
    widgetId?: string | null
    layoutId?: string | null
    instanceKey?: string
    targetKind?: 'page' | 'object'
    entityTypeId?: string
    locale?: string
    themeVariant?: 'light' | 'dark' | 'system'
}): Promise<InterpretationNetworkTemplateApplyResponse> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        templateId,
        interpretationId,
        targetCellId,
        expectedTemplateVersion,
        expectedTargetVersion,
        widgetId,
        layoutId,
        instanceKey,
        targetKind,
        entityTypeId,
        locale,
        themeVariant
    } = options
    const body = { interpretationId, targetCellId, expectedTemplateVersion, expectedTargetVersion }
    const response = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/templates/${encodeURIComponent(templateId)}/apply`, workspaceId, {
            widgetId,
            layoutId,
            instanceKey,
            targetKind,
            entityTypeId,
            locale,
            themeVariant
        }),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Apply interpretation network template failed'))
    }
    const parsed = interpretationNetworkTemplateApplyResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw new Error('Template application response validation failed')
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
    cellId: string
    data: Record<string, unknown>
    expectedCellVersion?: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkMaterialCreateResponse> {
    const { apiBaseUrl, applicationId, workspaceId, interpretationId, cellId, data, expectedCellVersion, widgetId, layoutId } = options
    const body: Record<string, unknown> = {
        interpretationId,
        cellId,
        data
    }
    if (expectedCellVersion !== undefined) body.expectedCellVersion = expectedCellVersion
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

export async function updateInterpretationNetworkMaterial(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    cellId: string
    materialId: string
    data: Record<string, unknown>
    expectedCellVersion: number
    expectedMaterialVersion: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkMaterialUpdateResponse> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        interpretationId,
        cellId,
        materialId,
        data,
        expectedCellVersion,
        expectedMaterialVersion,
        widgetId,
        layoutId
    } = options
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/materials/${encodeURIComponent(materialId)}`, workspaceId, {
            widgetId,
            layoutId
        }),
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interpretationId, cellId, data, expectedCellVersion, expectedMaterialVersion })
        }
    )
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Update interpretation network material failed'))
    const parsed = interpretationNetworkMaterialUpdateResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Material response validation failed')
    return parsed.data
}

export async function setInterpretationNetworkPrimaryMaterial(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    cellId: string
    materialId: string | null
    expectedCellVersion: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<InterpretationNetworkMaterialPrimaryResponse> {
    const { apiBaseUrl, applicationId, workspaceId, interpretationId, cellId, materialId, expectedCellVersion, widgetId, layoutId } =
        options
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/materials/primary', workspaceId, { widgetId, layoutId }),
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interpretationId, cellId, materialId, expectedCellVersion })
        }
    )
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Set Primary Material failed'))
    const parsed = interpretationNetworkMaterialPrimaryResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Primary Material response validation failed')
    return parsed.data
}

export async function deleteInterpretationNetworkMaterial(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    cellId: string
    materialId: string
    expectedCellVersion: number
    expectedMaterialVersion: number
    widgetId?: string | null
    layoutId?: string | null
}): Promise<void> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        interpretationId,
        cellId,
        materialId,
        expectedCellVersion,
        expectedMaterialVersion,
        widgetId,
        layoutId
    } = options
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, `/materials/${encodeURIComponent(materialId)}`, workspaceId, {
            widgetId,
            layoutId
        }),
        {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interpretationId, cellId, expectedCellVersion, expectedMaterialVersion })
        }
    )
    if (!res.ok) throw new Error(await extractErrorMessage(res, 'Delete interpretation network material failed'))
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
    instanceKey?: string
    targetKind?: 'page' | 'object'
    entityTypeId?: string
    locale?: string
}): Promise<InterpretationNetworkMatrixCellCreateResponse> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        interpretationId,
        data,
        placement,
        widgetId,
        layoutId,
        instanceKey,
        targetKind,
        entityTypeId,
        locale
    } = options
    const parsedPlacement = interpretationNetworkMatrixCellPlacementSchema.parse(placement)
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/matrix/cells', workspaceId, {
            widgetId,
            layoutId,
            instanceKey,
            targetKind,
            entityTypeId,
            locale
        }),
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

export async function updateInterpretationNetworkMatrixCell(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    cellId: string
    expectedCellVersion: number
    data: Record<string, unknown>
    widgetId?: string | null
    layoutId?: string | null
    instanceKey?: string
    targetKind?: 'page' | 'object'
    entityTypeId?: string
    locale?: string
}): Promise<InterpretationNetworkMatrixCellUpdateResponse> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        interpretationId,
        cellId,
        expectedCellVersion,
        data,
        widgetId,
        layoutId,
        instanceKey,
        targetKind,
        entityTypeId,
        locale
    } = options
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(
            apiBaseUrl,
            applicationId,
            `/matrix/cells/${encodeURIComponent(interpretationNetworkUuidSchema.parse(cellId))}`,
            workspaceId,
            { widgetId, layoutId, instanceKey, targetKind, entityTypeId, locale }
        ),
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interpretationId, data, expectedCellVersion })
        }
    )
    if (!res.ok) await throwAppsApiError(res, 'Update interpretation network matrix cell failed')
    const parsed = interpretationNetworkMatrixCellUpdateResponseSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error('Matrix cell update response validation failed')
    return parsed.data
}

export async function deleteInterpretationNetworkMatrixCell(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    cellId: string
    expectedCellVersion: number
    widgetId?: string | null
    layoutId?: string | null
    instanceKey?: string
    targetKind?: 'page' | 'object'
    entityTypeId?: string
    locale?: string
}): Promise<void> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        interpretationId,
        cellId,
        expectedCellVersion,
        widgetId,
        layoutId,
        instanceKey,
        targetKind,
        entityTypeId,
        locale
    } = options
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(
            apiBaseUrl,
            applicationId,
            `/matrix/cells/${encodeURIComponent(interpretationNetworkUuidSchema.parse(cellId))}`,
            workspaceId,
            { widgetId, layoutId, instanceKey, targetKind, entityTypeId, locale }
        ),
        {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                interpretationId,
                ...(expectedCellVersion === undefined ? {} : { expectedCellVersion })
            })
        }
    )
    if (!res.ok) await throwAppsApiError(res, 'Delete interpretation network matrix cell failed')
}

export async function moveInterpretationNetworkMatrixCells(options: {
    apiBaseUrl: string
    applicationId: string
    workspaceId?: string | null
    interpretationId: string
    updates: Array<{
        cellId: string
        expectedVersion: number
        data?: Record<string, unknown>
        placement: InterpretationNetworkMatrixCellPlacement
    }>
    widgetId?: string | null
    layoutId?: string | null
    instanceKey?: string
    targetKind?: 'page' | 'object'
    entityTypeId?: string
    locale?: string
}): Promise<InterpretationNetworkMatrixCellsMoveResponse> {
    const {
        apiBaseUrl,
        applicationId,
        workspaceId,
        interpretationId,
        updates,
        widgetId,
        layoutId,
        instanceKey,
        targetKind,
        entityTypeId,
        locale
    } = options
    const body = {
        interpretationId,
        updates: updates.map((update) => ({
            cellId: interpretationNetworkUuidSchema.parse(update.cellId),
            expectedVersion: update.expectedVersion,
            ...(update.data === undefined ? {} : { data: update.data }),
            placement: interpretationNetworkMatrixCellPlacementSchema.parse(update.placement)
        }))
    }
    const res = await fetchWithCsrf(
        apiBaseUrl,
        buildInterpretationNetworkUrl(apiBaseUrl, applicationId, '/matrix/cells/move', workspaceId, {
            widgetId,
            layoutId,
            instanceKey,
            targetKind,
            entityTypeId,
            locale
        }),
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
