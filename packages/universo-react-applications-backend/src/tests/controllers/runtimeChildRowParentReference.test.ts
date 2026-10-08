import { issueRuntimeRecordHandle } from '../../services/runtimeRecordHandle'
import { isRuntimeChildParentReference, resolveRuntimeChildParentRecordId } from '../../controllers/runtimeChildRowParentReference'

const applicationId = '019f2000-0000-7000-8000-000000000001'
const workspaceId = '019f2000-0000-7000-8000-000000000002'
const recordId = '019f2000-0000-7000-8000-000000000003'
const entityCodename = 'LearningResources'

describe('runtimeChildRowParentReference', () => {
    const originalSecret = process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET

    beforeEach(() => {
        process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = 'runtime-child-row-parent-reference-test-secret'
    })

    afterAll(() => {
        if (originalSecret === undefined) {
            delete process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET
        } else {
            process.env.UNIVERSO_RUNTIME_RECORD_HANDLE_SECRET = originalSecret
        }
    })

    it('preserves existing raw UUID parent references, including non-v7 UUIDs', () => {
        const legacyUuid = '550e8400-e29b-41d4-a716-446655440000'

        expect(isRuntimeChildParentReference(legacyUuid)).toBe(true)
        expect(
            resolveRuntimeChildParentRecordId({
                reference: legacyUuid,
                applicationId,
                workspaceId,
                entityCodename
            })
        ).toBe(legacyUuid)
    })

    it('resolves an opaque parent handle only inside the matching application, workspace, and Entity scope', () => {
        const handle = issueRuntimeRecordHandle({ applicationId, workspaceId, entityCodename, recordId })

        expect(isRuntimeChildParentReference(handle)).toBe(true)
        expect(
            resolveRuntimeChildParentRecordId({
                reference: handle,
                applicationId,
                workspaceId,
                entityCodename
            })
        ).toBe(recordId)
        expect(
            resolveRuntimeChildParentRecordId({
                reference: handle,
                applicationId: '019f2000-0000-7000-8000-000000000004',
                workspaceId,
                entityCodename
            })
        ).toBeNull()
        expect(
            resolveRuntimeChildParentRecordId({
                reference: handle,
                applicationId,
                workspaceId: '019f2000-0000-7000-8000-000000000005',
                entityCodename
            })
        ).toBeNull()
        expect(
            resolveRuntimeChildParentRecordId({
                reference: handle,
                applicationId,
                workspaceId,
                entityCodename: 'Courses'
            })
        ).toBeNull()
    })

    it('rejects tampered opaque parent handles', () => {
        const handle = issueRuntimeRecordHandle({ applicationId, workspaceId, entityCodename, recordId })
        const tamperIndex = 'rh1.'.length + 12
        const originalCharacter = handle[tamperIndex]
        const tampered = `${handle.slice(0, tamperIndex)}${originalCharacter === 'A' ? 'B' : 'A'}${handle.slice(tamperIndex + 1)}`

        expect(isRuntimeChildParentReference(tampered)).toBe(true)
        expect(
            resolveRuntimeChildParentRecordId({
                reference: tampered,
                applicationId,
                workspaceId,
                entityCodename
            })
        ).toBeNull()
    })
})
