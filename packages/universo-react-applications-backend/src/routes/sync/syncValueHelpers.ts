import {
    ComponentDefinitionDataType,
    applicationTemplateKeySchema,
    type ApplicationTemplateKey,
    type ComponentDefinitionValidationRules
} from '@universo-react/types'

/**
 * Validate the persisted application template discriminator at every sync
 * boundary. A missing/unknown key is data corruption, not permission to
 * silently reinterpret a marketing layout as a dashboard.
 */
export const parseApplicationTemplateKey = (value: unknown, context: string): ApplicationTemplateKey => {
    const parsed = applicationTemplateKeySchema.safeParse(value)
    if (!parsed.success) {
        throw new Error(`[SchemaSync] Invalid application template key in ${context}`)
    }
    return parsed.data
}

// --- Field helpers ---

export function isVLCField(field: { dataType: ComponentDefinitionDataType; validationRules?: Record<string, unknown> }): boolean {
    if (field.dataType !== ComponentDefinitionDataType.STRING) {
        return false
    }
    const rules = field.validationRules as Partial<ComponentDefinitionValidationRules> | undefined
    return rules?.versioned === true || rules?.localized === true
}

/**
 * Prepares a value for insertion into a JSONB column.
 * Always pass JSON text so arrays are not adapted by node-postgres as PostgreSQL
 * array literals before PostgreSQL parses the value as JSONB.
 */
export function prepareJsonbValue(value: unknown): string | null {
    if (value === undefined || value === null) {
        return null
    }
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
        throw new TypeError('JSONB values must be JSON-serializable')
    }
    return serialized
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

export function resolveLocalizedPreviewText(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    if (!isRecord(value)) return null

    const locales = value.locales
    const primary = value._primary
    if (!isRecord(locales)) return null

    if (typeof primary === 'string' && isRecord(locales[primary]) && typeof locales[primary].content === 'string') {
        const content = locales[primary].content.trim()
        if (content.length > 0) return content
    }

    for (const localeValue of Object.values(locales)) {
        if (isRecord(localeValue) && typeof localeValue.content === 'string') {
            const content = localeValue.content.trim()
            if (content.length > 0) return content
        }
    }

    return null
}

export function normalizeReferenceId(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }
    if (!isRecord(value)) return null

    const directId = value.id
    if (typeof directId === 'string' && directId.trim().length > 0) {
        return directId.trim()
    }

    const nestedValue = value.value
    if (typeof nestedValue === 'string' && nestedValue.trim().length > 0) {
        return nestedValue.trim()
    }

    if (isRecord(nestedValue) && typeof nestedValue.id === 'string' && nestedValue.id.trim().length > 0) {
        return nestedValue.id.trim()
    }

    return null
}
