import { UpdateFailure } from '../shared/runtimeHelpers'

export const createRuntimeVersionConflictFailure = (
    expectedVersion: number | undefined,
    actualVersion?: number,
    details: { childRowId?: string } = {}
): UpdateFailure =>
    new UpdateFailure(409, {
        error: 'Record version conflict',
        code: 'RUNTIME_RECORD_VERSION_CONFLICT',
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
        ...(actualVersion === undefined ? {} : { actualVersion }),
        ...details
    })
