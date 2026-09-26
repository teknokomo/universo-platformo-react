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
})
