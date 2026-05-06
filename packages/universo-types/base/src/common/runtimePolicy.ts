export const WORKSPACE_MODE_POLICIES = ['optional', 'required'] as const

export type WorkspaceModePolicy = (typeof WORKSPACE_MODE_POLICIES)[number]

export interface MetahubRuntimePolicySnapshot {
    workspaceMode: WorkspaceModePolicy
}

export const DEFAULT_WORKSPACE_MODE_POLICY: WorkspaceModePolicy = 'optional'

export const isWorkspaceModePolicy = (value: unknown): value is WorkspaceModePolicy =>
    typeof value === 'string' && (WORKSPACE_MODE_POLICIES as readonly string[]).includes(value)
