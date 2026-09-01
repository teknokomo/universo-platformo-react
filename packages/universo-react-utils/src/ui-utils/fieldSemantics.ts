export interface RuntimeFieldSemanticInput {
    id?: unknown
    field?: unknown
    codename?: unknown
    label?: unknown
    headerName?: unknown
    uiConfig?: Record<string, unknown> | null
}

const SEMANTIC_LONG_TEXT_FIELD_NAMES = new Set([
    'description',
    'summary',
    'details',
    'detail',
    'body',
    'content',
    'instructions',
    'instruction',
    'notes',
    'note',
    'feedback',
    'comment',
    'comments',
    'message',
    'quote',
    'answer',
    'termstext',
    'newsletterdescription',
    'subheader',
    'subtitle',
    'copyrighttext'
])

const normalizeFieldName = (value: unknown): string =>
    typeof value === 'string'
        ? value
              .replace(/[\s_-]+/g, '')
              .toLowerCase()
              .trim()
        : ''

const matchesSemanticLongTextName = (value: unknown): boolean => {
    const normalized = normalizeFieldName(value)
    if (!normalized) return false
    return (
        SEMANTIC_LONG_TEXT_FIELD_NAMES.has(normalized) ||
        Array.from(SEMANTIC_LONG_TEXT_FIELD_NAMES).some((name) => normalized.endsWith(name))
    )
}

/**
 * Identifies string fields that should use a multiline editor in runtime forms.
 * Explicit UI metadata takes precedence over the semantic name fallback.
 */
export const isSemanticLongTextRuntimeField = (field: RuntimeFieldSemanticInput): boolean => {
    const uiConfig = field.uiConfig ?? {}
    if (uiConfig.widget === 'textarea' || uiConfig.multiline === true || uiConfig.longText === true) return true
    if (uiConfig.widget === 'text' || uiConfig.multiline === false || uiConfig.longText === false) return false

    return (
        matchesSemanticLongTextName(field.id) ||
        matchesSemanticLongTextName(field.field) ||
        matchesSemanticLongTextName(field.codename) ||
        matchesSemanticLongTextName(field.label) ||
        matchesSemanticLongTextName(field.headerName)
    )
}
