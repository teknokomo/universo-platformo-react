import { InterpretationNetworkWorkspaceContent } from './InterpretationNetworkWorkspaceContent'

type WorkspaceContentProps = Parameters<typeof InterpretationNetworkWorkspaceContent>[0]

export interface InterpretationNetworkWorkspaceViewProps extends WorkspaceContentProps {}

export function InterpretationNetworkWorkspaceView(props: InterpretationNetworkWorkspaceViewProps) {
    return <InterpretationNetworkWorkspaceContent {...props} />
}
