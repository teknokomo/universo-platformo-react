import { MatrixWorkspaceBridge, type MatrixWorkspaceBridgeProps } from './MatrixWorkspaceBridge'
import { WorkspaceShell, type WorkspaceShellProps } from './WorkspaceShell'

export interface InterpretationNetworkWorkspaceContentProps {
    matrix: MatrixWorkspaceBridgeProps | null
    structure: Omit<WorkspaceShellProps['structure'], 'matrixWorkspace'>
    details: WorkspaceShellProps['details']
    dialogs: WorkspaceShellProps['dialogs']
}

export function InterpretationNetworkWorkspaceContent({ matrix, structure, details, dialogs }: InterpretationNetworkWorkspaceContentProps) {
    return (
        <WorkspaceShell
            structure={{
                ...structure,
                matrixWorkspace: matrix ? <MatrixWorkspaceBridge {...matrix} /> : null
            }}
            details={details}
            dialogs={dialogs}
        />
    )
}
