import { isUuidV7 } from '@universo-react/utils'
import { isRuntimeOpaqueHandle, issueRuntimeOpaqueHandle, readRuntimeOpaqueHandle } from './runtimeOpaqueHandleCodec'

const HANDLE_PREFIX = 'rh1.'
const KEY_CONTEXT = 'universo-runtime-record-handle:v1'
const MAX_HANDLE_LENGTH = 1024

type RuntimeRecordHandleClaims = {
    v: 1
    applicationId: string
    workspaceId: string | null
    entityCodename: string
    recordId: string
}

export type RuntimeRecordHandleScope = {
    applicationId: string
    workspaceId: string | null
    entityCodename: string
}

export const isRuntimeRecordHandle = (value: string): boolean => isRuntimeOpaqueHandle(value, HANDLE_PREFIX, MAX_HANDLE_LENGTH)

export const isRuntimeRecordReference = (value: string): boolean => isUuidV7(value) || isRuntimeRecordHandle(value)

export const issueRuntimeRecordHandle = (scope: RuntimeRecordHandleScope & { recordId: string }): string => {
    if (!isUuidV7(scope.recordId)) throw new Error('Runtime record handle requires a UUID v7 record ID')
    return issueRuntimeOpaqueHandle(HANDLE_PREFIX, KEY_CONTEXT, {
        v: 1,
        applicationId: scope.applicationId,
        workspaceId: scope.workspaceId,
        entityCodename: scope.entityCodename,
        recordId: scope.recordId
    })
}

export const resolveRuntimeRecordHandle = (handle: string, expected: RuntimeRecordHandleScope): string | null => {
    const claims = readRuntimeOpaqueHandle(
        handle,
        HANDLE_PREFIX,
        KEY_CONTEXT,
        MAX_HANDLE_LENGTH
    ) as Partial<RuntimeRecordHandleClaims> | null
    if (
        !claims ||
        claims.v !== 1 ||
        typeof claims.applicationId !== 'string' ||
        (claims.workspaceId !== null && typeof claims.workspaceId !== 'string') ||
        typeof claims.entityCodename !== 'string' ||
        typeof claims.recordId !== 'string' ||
        !isUuidV7(claims.recordId) ||
        claims.applicationId !== expected.applicationId ||
        claims.workspaceId !== expected.workspaceId ||
        claims.entityCodename !== expected.entityCodename
    ) {
        return null
    }
    return claims.recordId
}

export const resolveRuntimeRecordReference = (
    reference: string,
    expected: RuntimeRecordHandleScope
): { recordId: string; fromHandle: boolean } | null => {
    if (isUuidV7(reference)) return { recordId: reference, fromHandle: false }
    const recordId = resolveRuntimeRecordHandle(reference, expected)
    return recordId ? { recordId, fromHandle: true } : null
}
