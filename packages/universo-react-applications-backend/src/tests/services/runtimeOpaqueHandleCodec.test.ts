import { isRuntimeOpaqueHandle, issueRuntimeOpaqueHandle, readRuntimeOpaqueHandle } from '../../services/runtimeOpaqueHandleCodec'

describe('runtime opaque handle codec', () => {
    const previousSecret = process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET
    const previousSessionSecret = process.env.SESSION_SECRET
    const previousNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
        process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = 'runtime-opaque-handle-test-secret'
        delete process.env.SESSION_SECRET
        process.env.NODE_ENV = 'test'
    })

    afterAll(() => {
        if (previousSecret === undefined) delete process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET
        else process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = previousSecret
        if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET
        else process.env.SESSION_SECRET = previousSessionSecret
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = previousNodeEnv
    })

    it('encrypts JSON claims with a fresh nonce and reads them only in the matching key context', () => {
        const claims = { v: 1, recordId: '018f8a78-7b8f-7c1d-a111-222233334444' }
        const first = issueRuntimeOpaqueHandle('rh1.', 'runtime-record:v1', claims)
        const second = issueRuntimeOpaqueHandle('rh1.', 'runtime-record:v1', claims)

        expect(first).not.toBe(second)
        expect(isRuntimeOpaqueHandle(first, 'rh1.')).toBe(true)
        expect(readRuntimeOpaqueHandle(first, 'rh1.', 'runtime-record:v1')).toEqual(claims)
        expect(readRuntimeOpaqueHandle(first, 'rh1.', 'different-scope:v1')).toBeNull()
    })

    it('rejects modified, malformed, oversized, and wrongly prefixed handles', () => {
        const handle = issueRuntimeOpaqueHandle('pn1.', 'public-network:v1', { v: 1, cellId: 'cell-1' })
        const lastCharacter = handle.at(-1)
        const modified = `${handle.slice(0, -1)}${lastCharacter === 'A' ? 'B' : 'A'}`

        expect(isRuntimeOpaqueHandle(handle, 'rh1.')).toBe(false)
        expect(readRuntimeOpaqueHandle(modified, 'pn1.', 'public-network:v1')).toBeNull()
        expect(readRuntimeOpaqueHandle('pn1.%%%', 'pn1.', 'public-network:v1')).toBeNull()
        expect(readRuntimeOpaqueHandle(handle, 'pn1.', 'public-network:v1', 8)).toBeNull()
        expect(() => issueRuntimeOpaqueHandle('pn1.', 'public-network:v1', { body: 'x'.repeat(2048) })).toThrow(
            'Opaque handle exceeds the configured length limit'
        )
    })
})
