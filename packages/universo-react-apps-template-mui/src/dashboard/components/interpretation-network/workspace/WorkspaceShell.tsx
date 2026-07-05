import Stack from '@mui/material/Stack'
import { DetailsPaneBridge, type DetailsPaneBridgeProps } from './DetailsPaneBridge'
import { StructurePane, type StructurePaneProps } from './StructurePane'
import { WorkspaceDialogsBridge, type WorkspaceDialogsBridgeProps } from './WorkspaceDialogsBridge'

export interface WorkspaceShellProps {
    structure: StructurePaneProps
    details: DetailsPaneBridgeProps
    dialogs: WorkspaceDialogsBridgeProps
}

export function WorkspaceShell({ structure, details, dialogs }: WorkspaceShellProps) {
    return (
        <Stack data-testid='interpretation-network-workspace' spacing={2} sx={{ minWidth: 0, width: '100%', pt: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ minWidth: 0, alignItems: 'stretch' }}>
                <StructurePane {...structure} />
                <DetailsPaneBridge {...details} />
            </Stack>
            <WorkspaceDialogsBridge {...dialogs} />
        </Stack>
    )
}
