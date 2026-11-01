import type { DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock, acquireAdvisoryXactSharedLock } from '@universo-react/utils/database'

const applicationCopyLockKey = (applicationId: string): string => `application-copy:${applicationId}`

/** Exclude copies and parent/child mutations while copying or deleting an Application source. */
export const acquireApplicationCopyLock = async (executor: Pick<DbExecutor, 'query'>, applicationId: string): Promise<void> => {
    await acquireAdvisoryXactLock(executor, applicationCopyLockKey(applicationId))
}

/** Serialize relation writers with copies while allowing peer writers to proceed together. */
export const acquireApplicationCopyMutationLock = async (executor: Pick<DbExecutor, 'query'>, applicationId: string): Promise<void> => {
    await acquireAdvisoryXactSharedLock(executor, applicationCopyLockKey(applicationId))
}

/** Run an Application relation mutation under the transaction-scoped copy/delete coordination lock. */
export const withApplicationCopyMutationLock = async <T>(
    executor: Pick<DbExecutor, 'query'>,
    applicationId: string,
    mutation: () => Promise<T>
): Promise<T> => {
    await acquireApplicationCopyMutationLock(executor, applicationId)
    return mutation()
}
