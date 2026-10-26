import type { FlowListTableData } from '../components/runtime-ui'
import type { RuntimeWorkspace, RuntimeWorkspaceMember } from '../api/workspaces'

export type WorkspaceViewRow = FlowListTableData &
    RuntimeWorkspace & {
        displayName: string
        rawName: unknown
        rawDescription: unknown
        description: string
    }

export type MemberViewRow = FlowListTableData & RuntimeWorkspaceMember & { name: string; description: string }
export type WorkspaceViewMode = 'card' | 'list'
export type WorkspaceFormPayload = { name: unknown; description: unknown }
