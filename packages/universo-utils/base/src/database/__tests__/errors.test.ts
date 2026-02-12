import { describe, expect, it } from 'vitest'
import { isDatabaseConnectTimeoutError } from '../errors'

describe('isDatabaseConnectTimeoutError', () => {
    it('returns true for pg-pool connect timeout message', () => {
        expect(isDatabaseConnectTimeoutError(new Error('timeout exceeded when trying to connect'))).toBe(true)
    })

    it('returns true for terminated connection message', () => {
        expect(isDatabaseConnectTimeoutError(new Error('connection terminated unexpectedly'))).toBe(true)
    })

    it('returns false for non-timeout errors', () => {
        expect(isDatabaseConnectTimeoutError(new Error('syntax error at or near "FROM"'))).toBe(false)
    })

    it('returns false for non-error values', () => {
        expect(isDatabaseConnectTimeoutError('timeout exceeded when trying to connect')).toBe(false)
    })
})
