import {
    isWorkspaceSettingAddressAllowed as isApplicationWorkspaceSettingAddressAllowed,
    workspaceSettingAddressSchema,
    type WorkspaceSettingAddress
} from '@universo-react/types'

/** Persisted Workspace override projected into the runtime contract. */
export type WorkspaceSettingOverrideRecord = WorkspaceSettingAddress & {
    value: unknown
    version: number
}

export type WorkspaceSettingOverrideRow = WorkspaceSettingOverrideRecord

/** Application membership context required to resolve effective Workspace settings. */
export type WorkspaceSettingsRole = 'owner' | 'admin' | 'editor' | 'member'

export type WorkspaceSettingsResolverAuthContext = {
    applicationId: string
    userId: string
    role: WorkspaceSettingsRole
}

/** Applies the Application delegation policy to a validated semantic setting address. */
export const isWorkspaceSettingAddressAllowed = (
    applicationSettings: Record<string, unknown> | null | undefined,
    inputAddress: WorkspaceSettingAddress
): boolean => {
    const parsedAddress = workspaceSettingAddressSchema.safeParse({ key: inputAddress.key, target: inputAddress.target })
    if (!parsedAddress.success) return false
    return isApplicationWorkspaceSettingAddressAllowed(applicationSettings, parsedAddress.data)
}
