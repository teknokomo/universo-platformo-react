import type { DbExecutor } from '@universo-react/utils'
import { applyWorkspaceSettingOverrides } from '@universo-react/types'
import { listWorkspaceSettingOverrideRows } from '../persistence/workspaceSettingsResolutionStore'
import { isWorkspaceSettingAddressAllowed, type WorkspaceSettingOverrideRow } from '../shared/workspaceSettingsContracts'

export { isWorkspaceSettingAddressAllowed }
export type { WorkspaceSettingOverrideRow }

export async function listWorkspaceSettingOverrides(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        layoutId?: string | null
    }
): Promise<WorkspaceSettingOverrideRow[]> {
    return listWorkspaceSettingOverrideRows(executor, input)
}

export async function getWorkspaceSettingOverrideMap(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
    }
): Promise<Record<string, unknown>> {
    const rows = await listWorkspaceSettingOverrides(executor, input)
    const overrides: Record<string, unknown> = {}

    for (const row of rows) {
        if (row.target.kind === 'global' && isWorkspaceSettingAddressAllowed(input.applicationSettings, row)) {
            overrides[row.key] = row.value
        }
    }

    return overrides
}

export async function resolveEffectiveApplicationSettingsForWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
    }
): Promise<Record<string, unknown>> {
    const overrides = await getWorkspaceSettingOverrideMap(executor, input)
    return applyWorkspaceSettingOverrides(input.applicationSettings, overrides)
}
