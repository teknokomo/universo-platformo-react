// Focused helpers for the imported Interpretation Network snapshot flow.

import type { Locator, Response } from '@playwright/test'

import { createLoggedInApiContext } from '../../support/backend/api-session.mjs'

import { setInterpretationNetworkWidgetConfig } from '../../support/interpretationNetworkFocused'

export type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

export const createdStructureName = 'E2E created structure'
export const createdStructureDescription = 'Created through the Interpretation Network structure browser flow.'
export const createdMaterialTitle = 'E2E source note'
export const createdMaterialDescription = 'Created through the Interpretation Network material browser flow.'
export const updatedMaterialTitle = 'E2E edited source note'
export const updatedMaterialDescription = 'Updated Interpretation Network material description.'
export const materialBodyText = 'Browser-authored material body'
export const firstChildCellTitle = 'E2E first child cell'
export const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const codenameVlc = (content: string) => {
    const timestamp = new Date(0).toISOString()
    return {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content,
                version: 1,
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        }
    }
}

export const getRuntimeRowsUrl = (response: Response): URL => new URL(response.url())

export const matchesInterpretationNetworkStructureCreate = (response: Response, applicationId: string, workspaceId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return (
        url.pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/structures` &&
        url.searchParams.get('workspaceId') === workspaceId
    )
}

export const matchesInterpretationNetworkMaterialCreate = (response: Response, applicationId: string, workspaceId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return (
        url.pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/materials` &&
        url.searchParams.get('workspaceId') === workspaceId
    )
}

export const matchesInterpretationNetworkMaterialUpdate = (response: Response, applicationId: string, workspaceId: string): boolean => {
    if (response.request().method() !== 'PATCH') return false
    const url = getRuntimeRowsUrl(response)
    const materialPathPrefix = `/api/v1/applications/${applicationId}/runtime/interpretation-network/materials/`
    const materialId = url.pathname.startsWith(materialPathPrefix) ? url.pathname.slice(materialPathPrefix.length) : ''
    return uuidV7Pattern.test(materialId) && url.searchParams.get('workspaceId') === workspaceId
}

export const matchesApplicationLayoutWidgetConfigUpdate = (response: Response, applicationId: string): boolean => {
    if (response.request().method() !== 'PATCH') return false
    const url = getRuntimeRowsUrl(response)
    if (url.pathname === `/api/v1/applications/${applicationId}/layouts/zone-widgets/config/batch`) {
        return true
    }
    return (
        url.pathname.startsWith(`/api/v1/applications/${applicationId}/layouts/`) &&
        url.pathname.includes('/zone-widget/') &&
        url.pathname.endsWith('/config')
    )
}

export const matchesApplicationLayoutWidgetConfigReset = (response: Response, applicationId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return url.pathname === `/api/v1/applications/${applicationId}/layouts/zone-widgets/config/reset`
}

export const matchesTemplateSave = (response: Response, applicationId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return url.pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/templates`
}

export const matchesTemplateInstantiate = (response: Response, applicationId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return (
        url.pathname.startsWith(`/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/`) &&
        url.pathname.endsWith('/instantiate')
    )
}

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const getMaterialOpenButton = (surface: Locator, title: string): Locator =>
    surface.getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}(?:\\s|$)`) }).first()

export const hasLocalizedPayloadValue = (payload: unknown, expectedText: string, locale = 'en'): boolean => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
    return Object.values(payload as Record<string, unknown>).some((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false
        const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
        return locales?.[locale]?.content === expectedText
    })
}

export const setInterpretationNetworkStructureMode = async (
    api: ApiContext,
    applicationId: string,
    structureMode: 'multiple' | 'singleSystem'
): Promise<void> => {
    await setInterpretationNetworkWidgetConfig(api, applicationId, { structureMode })
}
