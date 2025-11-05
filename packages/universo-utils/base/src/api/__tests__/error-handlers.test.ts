import { describe, it, expect } from 'vitest'
import axios, { AxiosError } from 'axios'
import { extractAxiosError, isApiError, isHttpStatus } from '../error-handlers'

describe('extractAxiosError', () => {
    it('should extract error information from AxiosError with response', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                status: 404,
                data: {
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                }
            },
            message: 'Request failed with status code 404'
        } as AxiosError

        // Mock axios.isAxiosError to return true
        const result = extractAxiosError(axiosError)

        expect(result.status).toBe(404)
        expect(result.code).toBe('USER_NOT_FOUND')
        expect(result.message).toBe('User not found')
    })

    it('should extract error information from AxiosError without data.error', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                status: 500,
                data: {
                    code: 'INTERNAL_ERROR'
                }
            },
            message: 'Internal Server Error'
        } as AxiosError

        const result = extractAxiosError(axiosError)

        expect(result.status).toBe(500)
        expect(result.code).toBe('INTERNAL_ERROR')
        expect(result.message).toBe('Internal Server Error')
    })

    it('should extract error information from AxiosError without response', () => {
        const axiosError = {
            isAxiosError: true,
            message: 'Network Error'
        } as AxiosError

        const result = extractAxiosError(axiosError)

        expect(result.status).toBeUndefined()
        expect(result.code).toBeUndefined()
        expect(result.message).toBe('Network Error')
    })

    it('should handle standard Error objects', () => {
        const standardError = new Error('Something went wrong')

        const result = extractAxiosError(standardError)

        expect(result.message).toBe('Something went wrong')
        expect(result.status).toBeUndefined()
        expect(result.code).toBeUndefined()
    })

    it('should handle unknown error types', () => {
        const unknownError = { foo: 'bar' }

        const result = extractAxiosError(unknownError)

        expect(result.message).toBe('Unknown error occurred')
        expect(result.status).toBeUndefined()
        expect(result.code).toBeUndefined()
    })

    it('should handle null error', () => {
        const result = extractAxiosError(null)

        expect(result.message).toBe('Unknown error occurred')
    })

    it('should handle undefined error', () => {
        const result = extractAxiosError(undefined)

        expect(result.message).toBe('Unknown error occurred')
    })
})

describe('isApiError', () => {
    it('should return true for AxiosError with matching code', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                data: {
                    code: 'USER_NOT_FOUND'
                }
            }
        } as AxiosError

        const result = isApiError(axiosError, 'USER_NOT_FOUND')

        expect(result).toBe(true)
    })

    it('should return false for AxiosError with non-matching code', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                data: {
                    code: 'USER_NOT_FOUND'
                }
            }
        } as AxiosError

        const result = isApiError(axiosError, 'DIFFERENT_CODE')

        expect(result).toBe(false)
    })

    it('should return true for AxiosError when no code specified', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                data: {
                    code: 'ANY_CODE'
                }
            }
        } as AxiosError

        const result = isApiError(axiosError)

        expect(result).toBe(true)
    })

    it('should return false for non-AxiosError', () => {
        const standardError = new Error('Standard error')

        const result = isApiError(standardError, 'ANY_CODE')

        expect(result).toBe(false)
    })

    it('should return false for AxiosError without response data', () => {
        const axiosError = {
            isAxiosError: true,
            response: {}
        } as AxiosError

        const result = isApiError(axiosError, 'USER_NOT_FOUND')

        expect(result).toBe(false)
    })
})

describe('isHttpStatus', () => {
    it('should return true for AxiosError with matching status code', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                status: 404
            }
        } as AxiosError

        const result = isHttpStatus(axiosError, 404)

        expect(result).toBe(true)
    })

    it('should return false for AxiosError with non-matching status code', () => {
        const axiosError = {
            isAxiosError: true,
            response: {
                status: 404
            }
        } as AxiosError

        const result = isHttpStatus(axiosError, 500)

        expect(result).toBe(false)
    })

    it('should return false for non-AxiosError', () => {
        const standardError = new Error('Standard error')

        const result = isHttpStatus(standardError, 404)

        expect(result).toBe(false)
    })

    it('should return false for AxiosError without response', () => {
        const axiosError = {
            isAxiosError: true
        } as AxiosError

        const result = isHttpStatus(axiosError, 404)

        expect(result).toBe(false)
    })

    it('should handle common HTTP status codes correctly', () => {
        const testCases = [
            { status: 200, expected: true },
            { status: 201, expected: false },
            { status: 400, expected: false },
            { status: 401, expected: false },
            { status: 404, expected: false },
            { status: 500, expected: false }
        ]

        const axiosError = {
            isAxiosError: true,
            response: {
                status: 200
            }
        } as AxiosError

        testCases.forEach(({ status, expected }) => {
            const result = isHttpStatus(axiosError, status)
            expect(result).toBe(expected)
        })
    })
})
