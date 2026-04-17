import { createDomainErrorHandler } from '../../../../shared'

/**
 * Domain error handler for attribute mutations.
 * Maps backend error codes to translated snackbar messages.
 *
 * Shared across useCreateAttribute and useCreateChildAttribute.
 */
export const handleAttributeError = createDomainErrorHandler({
    ATTRIBUTE_LIMIT_REACHED: (data, t) => t('fieldDefinitions.limitReached', { limit: data.limit ?? '—' }),
    TABLE_CHILD_LIMIT_REACHED: (data, t) =>
        t('fieldDefinitions.tableValidation.maxChildAttributes', 'Maximum {{max}} child fieldDefinitions per TABLE', {
            max: data.maxChildAttributes ?? '—'
        }),
    TABLE_ATTRIBUTE_LIMIT_REACHED: (data, t) =>
        t('fieldDefinitions.tableValidation.maxTableAttributes', 'Maximum {{max}} TABLE fieldDefinitions per catalog', {
            max: data.maxTableAttributes ?? '—'
        }),
    TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN: (_data, t) =>
        t('fieldDefinitions.tableValidation.tableCannotBeDisplay', 'TABLE fieldDefinitions cannot be set as the display attribute'),
    NESTED_TABLE_FORBIDDEN: (_data, t) =>
        t('fieldDefinitions.tableValidation.nestedTableNotAllowed', 'Nested TABLE fieldDefinitions are not allowed')
})
