import type { VersionedLocalizedContent, MetaEntityKind } from '@universo/types'
import type { AttributeDataType, AttributeValidationRules } from '../../../types'

export type ActionBaseContext = {
    t: (key: string, defaultValue?: string, opts?: Record<string, unknown>) => string
}

export type ConfirmSpec = {
    titleKey?: string
    title?: string
    descriptionKey?: string
    description?: string
    confirmKey?: string
    confirmButtonName?: string
    cancelKey?: string
    cancelButtonName?: string
    interpolate?: Record<string, unknown>
}

export type CatalogTab = 'attributes' | 'system' | 'elements' | 'settings'

export type AttributeFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    dataType?: AttributeDataType
    isRequired?: boolean
    isDisplayAttribute?: boolean
    validationRules?: AttributeValidationRules
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
    targetConstantId?: string | null
    uiConfig?: Record<string, unknown>
}

export const extractResponseData = (error: unknown): Record<string, unknown> | null => {
    if (!error || typeof error !== 'object' || !('response' in error)) return null
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object' || !('data' in response)) return null
    const data = (response as { data?: unknown }).data
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

export const hasResponseStatus = (error: unknown): boolean => {
    if (!error || typeof error !== 'object' || !('response' in error)) return false
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return false
    return 'status' in response
}

export const extractResponseMessage = (error: unknown): string | undefined => {
    const data = extractResponseData(error)
    const message = data?.message
    if (typeof message === 'string' && message.trim().length > 0) return message
    const fallbackError = data?.error
    return typeof fallbackError === 'string' && fallbackError.trim().length > 0 ? fallbackError : undefined
}

export const extractResponseCode = (error: unknown): string | undefined => {
    const data = extractResponseData(error)
    const code = data?.code
    return typeof code === 'string' ? code : undefined
}

export const extractResponseMaxChildAttributes = (error: unknown): number | undefined => {
    const data = extractResponseData(error)
    const max = data?.maxChildAttributes
    return typeof max === 'number' && Number.isFinite(max) ? max : undefined
}

export const sanitizeAttributeUiConfig = (
    dataType: AttributeDataType,
    targetEntityKind: MetaEntityKind | null | undefined,
    sourceUiConfig: Record<string, unknown>
): Record<string, unknown> => {
    const nextUiConfig = { ...sourceUiConfig }
    const isEnumerationRef = dataType === 'REF' && targetEntityKind === 'enumeration'

    if (!isEnumerationRef) {
        delete nextUiConfig.enumPresentationMode
        delete nextUiConfig.defaultEnumValueId
        delete nextUiConfig.enumAllowEmpty
        delete nextUiConfig.enumLabelEmptyDisplay
        return nextUiConfig
    }

    if (
        nextUiConfig.enumPresentationMode !== 'select' &&
        nextUiConfig.enumPresentationMode !== 'radio' &&
        nextUiConfig.enumPresentationMode !== 'label'
    ) {
        nextUiConfig.enumPresentationMode = 'select'
    }

    if (
        'defaultEnumValueId' in nextUiConfig &&
        nextUiConfig.defaultEnumValueId !== null &&
        typeof nextUiConfig.defaultEnumValueId !== 'string'
    ) {
        delete nextUiConfig.defaultEnumValueId
    }

    if (typeof nextUiConfig.enumAllowEmpty !== 'boolean') {
        nextUiConfig.enumAllowEmpty = true
    }

    if (nextUiConfig.enumLabelEmptyDisplay !== 'empty' && nextUiConfig.enumLabelEmptyDisplay !== 'dash') {
        nextUiConfig.enumLabelEmptyDisplay = 'dash'
    }

    return nextUiConfig
}

export const getDataTypeColor = (
    dataType: AttributeDataType
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (dataType) {
        case 'STRING':
            return 'primary'
        case 'NUMBER':
            return 'secondary'
        case 'BOOLEAN':
            return 'success'
        case 'DATE':
            return 'warning'
        case 'REF':
            return 'info'
        case 'JSON':
            return 'default'
        case 'TABLE':
            return 'warning'
        default:
            return 'default'
    }
}
