import {
    isRuntimeRecordHandle,
    isRuntimeRecordReference,
    issueRuntimeRecordHandle,
    resolveRuntimeRecordHandle,
    resolveRuntimeRecordReference
} from '../../services/runtimeRecordHandle'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789b1'
const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789b2'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789b3'
const scope = { applicationId, workspaceId, entityCodename: 'Courses' }

describe('runtimeRecordHandle', () => {
    const originalSecret = process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET

    beforeEach(() => {
        process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = 'runtime-record-handle-test-secret'
    })

    afterAll(() => {
        if (originalSecret === undefined) {
            delete process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET
        } else {
            process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = originalSecret
        }
    })

    it('round-trips an opaque record handle only in the issuing runtime scope', () => {
        const handle = issueRuntimeRecordHandle({ ...scope, recordId })

        expect(handle).toMatch(/^rh1\.[A-Za-z0-9_-]+$/u)
        expect(isRuntimeRecordHandle(handle)).toBe(true)
        expect(resolveRuntimeRecordHandle(handle, scope)).toBe(recordId)
        expect(resolveRuntimeRecordReference(handle, scope)).toEqual({ recordId, fromHandle: true })
    })

    it('rejects tampering and scope substitution', () => {
        const handle = issueRuntimeRecordHandle({ ...scope, recordId })
        const tamperIndex = 'rh1.'.length + 12
        const originalCharacter = handle[tamperIndex]
        const tampered = `${handle.slice(0, tamperIndex)}${originalCharacter === 'A' ? 'B' : 'A'}${handle.slice(tamperIndex + 1)}`

        expect(resolveRuntimeRecordHandle(tampered, scope)).toBeNull()
        expect(resolveRuntimeRecordHandle(handle, { ...scope, applicationId: '0190a9b5-3cde-7abc-8def-0123456789b4' })).toBeNull()
        expect(resolveRuntimeRecordHandle(handle, { ...scope, workspaceId: '0190a9b5-3cde-7abc-8def-0123456789b5' })).toBeNull()
        expect(resolveRuntimeRecordHandle(handle, { ...scope, entityCodename: 'LearningTracks' })).toBeNull()
    })

    it('does not expose the physical UUID and randomizes repeated handles for the same record', () => {
        const first = issueRuntimeRecordHandle({ ...scope, recordId })
        const second = issueRuntimeRecordHandle({ ...scope, recordId })

        expect(first).not.toContain(recordId)
        expect(second).not.toContain(recordId)
        expect(first).not.toBe(second)
        expect(resolveRuntimeRecordHandle(first, scope)).toBe(recordId)
        expect(resolveRuntimeRecordHandle(second, scope)).toBe(recordId)
    })

    it('keeps intentional UUID callers compatible without classifying UUIDs as handles', () => {
        expect(isRuntimeRecordHandle(recordId)).toBe(false)
        expect(isRuntimeRecordReference(recordId)).toBe(true)
        expect(resolveRuntimeRecordReference(recordId, scope)).toEqual({ recordId, fromHandle: false })
    })
})
