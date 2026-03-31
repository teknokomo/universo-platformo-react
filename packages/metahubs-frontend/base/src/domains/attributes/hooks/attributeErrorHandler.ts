import { createDomainErrorHandler } from '../../shared'

/**
 * Domain error handler for attribute mutations.
 * Maps backend error codes to translated snackbar messages.
 *
 * Shared across useCreateAttribute and useCreateChildAttribute.
 */
export const handleAttributeError = createDomainErrorHandler({
    ATTRIBUTE_LIMIT_REACHED: (data, t) =>
        t('attributes.limitReached', { limit: data.limit ?? '—' }),
    TABLE_CHILD_LIMIT_REACHED: (data, t) =>
        t('attributes.tableValidation.maxChildAttributes', 'Maximum {{max}} child attributes per TABLE', {
            max: data.maxChildAttributes ?? '—'
        }),
    TABLE_ATTRIBUTE_LIMIT_REACHED: (data, t) =>
        t('attributes.tableValidation.maxTableAttributes', 'Maximum {{max}} TABLE attributes per catalog', {
            max: data.maxTableAttributes ?? '—'
        }),
    TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN: (_data, t) =>
        t('attributes.tableValidation.tableCannotBeDisplay', 'TABLE attributes cannot be set as the display attribute'),
    NESTED_TABLE_FORBIDDEN: (_data, t) =>
        t('attributes.tableValidation.nestedTableNotAllowed', 'Nested TABLE attributes are not allowed')
})
