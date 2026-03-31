import { describe, expect, it, vi } from 'vitest'

import { createDomainErrorHandler, type DomainMutationError } from '../createDomainErrorHandler'

describe('createDomainErrorHandler', () => {
    const t = vi.fn((key: string, defaultValue?: string) => defaultValue ?? key)
    const enqueueSnackbar = vi.fn()

    beforeEach(() => {
        t.mockClear()
        enqueueSnackbar.mockClear()
    })

    it('calls matching error code handler and shows warning', () => {
        const handler = createDomainErrorHandler({
            LIMIT_REACHED: (data, t) => t('attributes.limitReached', `Limit: ${data.limit}`)
        })

        const error = {
            message: 'Error',
            response: { status: 409, data: { code: 'LIMIT_REACHED', limit: 50 } }
        } as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(enqueueSnackbar).toHaveBeenCalledWith('Limit: 50', { variant: 'warning' })
    })

    it('falls back to backend message when code is not mapped', () => {
        const handler = createDomainErrorHandler({})

        const error = {
            message: 'Error',
            response: { status: 500, data: { message: 'Internal server error' } }
        } as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(enqueueSnackbar).toHaveBeenCalledWith('Internal server error', { variant: 'error' })
    })

    it('falls back to error.response.data.error when message is missing', () => {
        const handler = createDomainErrorHandler({})

        const error = {
            message: 'Error',
            response: { status: 400, data: { error: 'Bad request detail' } }
        } as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(enqueueSnackbar).toHaveBeenCalledWith('Bad request detail', { variant: 'error' })
    })

    it('uses error.message when response has no backend message', () => {
        const handler = createDomainErrorHandler({})

        const error = {
            message: 'Network error',
            response: { status: 0, data: {} }
        } as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(enqueueSnackbar).toHaveBeenCalledWith('Network error', { variant: 'error' })
    })

    it('uses t(fallbackKey) when error has no useful message', () => {
        const handler = createDomainErrorHandler({})

        const error = {
            message: '',
            response: { data: {} }
        } as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(t).toHaveBeenCalledWith('fallback.key')
    })

    it('handles error without response gracefully', () => {
        const handler = createDomainErrorHandler({})

        const error = new Error('Unexpected') as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(enqueueSnackbar).toHaveBeenCalledWith('Unexpected', { variant: 'error' })
    })

    it('passes full response data to code handler', () => {
        const codeFn = vi.fn((_data, _t) => 'Custom message')
        const handler = createDomainErrorHandler({ CUSTOM_CODE: codeFn })

        const responseData = { code: 'CUSTOM_CODE', limit: 10, extra: 'info' }
        const error = {
            message: 'Error',
            response: { status: 409, data: responseData }
        } as DomainMutationError

        handler(error, t, enqueueSnackbar, 'fallback.key')

        expect(codeFn).toHaveBeenCalledWith(responseData, t)
    })
})
