import type { DbExecutor } from '@universo-react/utils'
import { lockInterpretationNetworkCellStylePolicy } from '../../persistence/workspaceSettingsStore'
import { WORKSPACE_SETTINGS_ERROR_CODES, WorkspaceSettingsError } from '../workspaceSettingsCore'
import {
    resolveInterpretationNetworkRuntimeSurface,
    type InterpretationNetworkRuntimeSurfaceParams
} from './runtimeInterpretationNetworkSurface'
import {
    InterpretationNetworkCommandError,
    assertReadySurface,
    interpretationNetworkCommandErrorCodes,
    type InterpretationNetworkRuntimeSurface,
    type RuntimeSurfaceReady
} from './runtimeInterpretationNetworkCore'

export type InterpretationNetworkMatrixMutationContext = Pick<
    InterpretationNetworkRuntimeSurfaceParams,
    'applicationId' | 'schemaName' | 'workspaceId' | 'scopeEntityId' | 'layoutId' | 'widgetId' | 'workspaceSettings'
>

/** Re-resolve and lock the active Matrix placement after serializing policy reads with workspace policy writes. */
export const resolveMatrixMutationSurface = async (
    tx: DbExecutor,
    context: InterpretationNetworkMatrixMutationContext,
    expectedSurface: InterpretationNetworkRuntimeSurface
): Promise<RuntimeSurfaceReady> => {
    if (context.workspaceSettings && context.workspaceId) {
        await lockInterpretationNetworkCellStylePolicy(tx, context.schemaName, context.workspaceId)
    }
    let refreshedSurface: InterpretationNetworkRuntimeSurface
    try {
        refreshedSurface = await resolveInterpretationNetworkRuntimeSurface(tx, { ...context, lockRuntimePlacement: true })
    } catch (error) {
        if (!(error instanceof WorkspaceSettingsError)) throw error
        const details = error.code === WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid ? { policyInvalid: true } : undefined
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidCell,
            'Matrix configuration changed. Reload the workspace and try again.',
            details
        )
    }
    const refreshed = assertReadySurface(refreshedSurface, 'refreshMatrixPolicy')
    const previous = assertReadySurface(expectedSurface, 'refreshMatrixPolicy')
    const resolvedObjectKeys = Object.keys(previous.resolvedObjects) as Array<keyof typeof previous.resolvedObjects>
    const refreshedObjectKeys = Object.keys(refreshed.resolvedObjects)
    const resolvedObjectsMatch =
        resolvedObjectKeys.length === refreshedObjectKeys.length &&
        resolvedObjectKeys.every((key) => previous.resolvedObjects[key] === refreshed.resolvedObjects[key])
    if (
        previous.layoutId !== refreshed.layoutId ||
        previous.widgetId !== refreshed.widgetId ||
        previous.widgetKey !== refreshed.widgetKey ||
        previous.structureMode !== refreshed.structureMode ||
        !resolvedObjectsMatch
    ) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidCell,
            'Matrix configuration changed. Reload the workspace and try again.'
        )
    }
    return refreshed
}
