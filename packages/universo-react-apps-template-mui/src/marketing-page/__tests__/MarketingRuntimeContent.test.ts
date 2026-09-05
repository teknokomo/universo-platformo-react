import { describe, expect, it } from 'vitest'

import { shouldRetryMarketingRuntime } from '../MarketingRuntimeContent'

describe('shouldRetryMarketingRuntime', () => {
    it('retries transient server errors only within the retry budget', () => {
        expect(shouldRetryMarketingRuntime(0, { status: 500 })).toBe(true)
        expect(shouldRetryMarketingRuntime(1, { status: 503 })).toBe(true)
        expect(shouldRetryMarketingRuntime(2, { status: 503 })).toBe(false)
    })

    it('does not retry client, rate-limit, or network errors', () => {
        expect(shouldRetryMarketingRuntime(0, { status: 400 })).toBe(false)
        expect(shouldRetryMarketingRuntime(0, { status: 429 })).toBe(false)
        expect(shouldRetryMarketingRuntime(0, new Error('Marketing page runtime API request failed (503): unavailable'))).toBe(true)
        expect(shouldRetryMarketingRuntime(0, new Error('Failed to fetch'))).toBe(false)
    })
})
