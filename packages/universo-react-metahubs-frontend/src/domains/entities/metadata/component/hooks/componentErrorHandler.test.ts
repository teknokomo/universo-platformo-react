import { describe, expect, it, vi } from 'vitest'
import { getComponentMutationErrorMessage } from './componentErrorHandler'

describe('getComponentMutationErrorMessage', () => {
    it('localizes the server-owned widget binding schema error', () => {
        const t = vi.fn((key: string, defaultValue?: string) => defaultValue ?? key)
        const error = Object.assign(new Error('raw server message'), {
            response: {
                data: {
                    code: 'ENTITY_COMPONENT_SCHEMA_PROTECTED',
                    message: 'This component is protected by the widget registry.'
                }
            }
        })

        const message = getComponentMutationErrorMessage(error, t, 'components.updateError')

        expect(message).toBe('This field is part of a widget binding and its data contract cannot be changed.')
        expect(t).toHaveBeenCalledWith(
            'components.bindingSchemaProtected',
            'This field is part of a widget binding and its data contract cannot be changed.'
        )
    })

    it('localizes a sibling-row reference conflict instead of displaying the raw server message', () => {
        const t = vi.fn((key: string, defaultValue?: string) => defaultValue ?? key)
        const error = Object.assign(new Error('raw server message'), {
            response: {
                data: {
                    code: 'INVALID_SIBLING_ROW_SELECT_REFERENCE',
                    error: 'Component is referenced by sibling row selectors and cannot be renamed.'
                }
            }
        })

        const message = getComponentMutationErrorMessage(error, t, 'components.updateError')

        expect(message).toBe('This change would invalidate a sibling-row selection. Update the linked table fields first.')
        expect(t).toHaveBeenCalledWith(
            'components.siblingRowSelectReferenceProtected',
            'This change would invalidate a sibling-row selection. Update the linked table fields first.'
        )
    })

    it('localizes a temporary component metadata lock conflict', () => {
        const t = vi.fn((key: string, defaultValue?: string) => defaultValue ?? key)
        const error = Object.assign(new Error('raw server message'), {
            response: { data: { code: 'COMPONENT_METADATA_LOCKED', error: 'internal lock detail' } }
        })

        expect(getComponentMutationErrorMessage(error, t, 'components.updateError')).toBe(
            'Component metadata is changing. Retry this change shortly.'
        )
        expect(t).toHaveBeenCalledWith(
            'components.metadataMutationInProgress',
            'Component metadata is changing. Retry this change shortly.'
        )
    })
})
