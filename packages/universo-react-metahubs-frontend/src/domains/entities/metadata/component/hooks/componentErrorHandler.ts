import { createDomainErrorHandler } from '../../../../shared'
import type { DomainMutationError } from '../../../../shared/createDomainErrorHandler'

type ComponentMutationTranslator = (key: string, defaultValue?: string) => string

export const getComponentMutationErrorMessage = (
    error: DomainMutationError,
    t: ComponentMutationTranslator,
    fallbackKey: string
): string => {
    if (error.response?.data?.code === 'ENTITY_COMPONENT_SCHEMA_PROTECTED') {
        return t('components.bindingSchemaProtected', 'This field is part of a widget binding and its data contract cannot be changed.')
    }

    return error.response?.data?.message || error.response?.data?.error || error.message || t(fallbackKey)
}

/**
 * Domain error handler for component mutations.
 * Maps backend error codes to translated snackbar messages.
 *
 * Shared across useCreateComponent and useCreateChildComponent.
 */
export const handleComponentError = createDomainErrorHandler({
    COMPONENT_LIMIT_REACHED: (data, t) => t('components.limitReached', { limit: data.limit ?? '—' }),
    TABLE_CHILD_LIMIT_REACHED: (data, t) =>
        t('components.tableValidation.maxChildComponents', 'Maximum {{max}} child components per TABLE', {
            max: data.maxChildComponents ?? '—'
        }),
    TABLE_COMPONENT_LIMIT_REACHED: (data, t) =>
        t('components.tableValidation.maxTableComponents', 'Maximum {{max}} TABLE components per object', {
            max: data.maxTableComponents ?? '—'
        }),
    TABLE_DISPLAY_COMPONENT_FORBIDDEN: (_data, t) =>
        t('components.tableValidation.tableCannotBeDisplay', 'TABLE components cannot be set as the display component'),
    NESTED_TABLE_FORBIDDEN: (_data, t) => t('components.tableValidation.nestedTableNotAllowed', 'Nested TABLE components are not allowed')
})
