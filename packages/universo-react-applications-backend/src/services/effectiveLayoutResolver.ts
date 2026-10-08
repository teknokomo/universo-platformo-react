import type { DbExecutor } from '@universo-react/utils'
import {
    resolveEffectiveLayoutForPublicTransactionWithRuntimeData,
    resolveEffectiveLayoutForRequestWithRuntimeData,
    type EffectiveLayoutAuthContext
} from './effectiveLayoutResolverCore'
import { resolveEffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeDataResolver'

export type { EffectiveLayoutAuthContext } from './effectiveLayoutResolverCore'

export async function resolveEffectiveLayoutForPublicTransaction(executor: DbExecutor, input: unknown, publicWorkspaceId: string | null) {
    return resolveEffectiveLayoutForPublicTransactionWithRuntimeData(executor, input, publicWorkspaceId, resolveEffectiveWidgetRuntimeData)
}

export async function resolveEffectiveLayoutForRequest(executor: DbExecutor, authContext: EffectiveLayoutAuthContext, input: unknown) {
    return resolveEffectiveLayoutForRequestWithRuntimeData(executor, authContext, input, resolveEffectiveWidgetRuntimeData)
}
