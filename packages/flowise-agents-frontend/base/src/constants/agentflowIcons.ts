// Universo Platformo | Agents Frontend - AgentFlow Icons Constants
// Copied from @flowise/template-mui/constants.ts for tsc compatibility
// Maps agentflow node names to their corresponding Tabler icons

import {
    IconArrowsSplit,
    IconPlayerPlayFilled,
    IconSparkles,
    IconRobot,
    IconReplaceUser,
    IconRepeat,
    IconMessageCircleFilled,
    IconFunctionFilled,
    IconTools,
    IconLibrary,
    IconSubtask,
    IconNote,
    IconWorld,
    IconRelationOneToManyFilled,
    IconVectorBezier2,
    type Icon
} from '@tabler/icons-react'
import { type ForwardRefExoticComponent, type RefAttributes } from 'react'

// Type for Tabler icon component
type TablerIcon = ForwardRefExoticComponent<Omit<Icon, 'ref'> & RefAttributes<Icon>>

// Type for AGENTFLOW_ICONS items
export interface AgentFlowIcon {
    name: string
    icon: TablerIcon
    color: string
}

/**
 * AgentFlow node icons mapping
 * Maps agentflow node names to their corresponding Tabler icons
 */
export const AGENTFLOW_ICONS: AgentFlowIcon[] = [
    {
        name: 'conditionAgentflow',
        icon: IconArrowsSplit,
        color: '#FFB938'
    },
    {
        name: 'startAgentflow',
        icon: IconPlayerPlayFilled,
        color: '#7EE787'
    },
    {
        name: 'llmAgentflow',
        icon: IconSparkles,
        color: '#64B5F6'
    },
    {
        name: 'agentAgentflow',
        icon: IconRobot,
        color: '#4DD0E1'
    },
    {
        name: 'humanInputAgentflow',
        icon: IconReplaceUser,
        color: '#6E6EFD'
    },
    {
        name: 'loopAgentflow',
        icon: IconRepeat,
        color: '#FFA07A'
    },
    {
        name: 'directReplyAgentflow',
        icon: IconMessageCircleFilled,
        color: '#4DDBBB'
    },
    {
        name: 'customFunctionAgentflow',
        icon: IconFunctionFilled,
        color: '#E4B7FF'
    },
    {
        name: 'toolAgentflow',
        icon: IconTools,
        color: '#d4a373'
    },
    {
        name: 'retrieverAgentflow',
        icon: IconLibrary,
        color: '#b8bedd'
    },
    {
        name: 'conditionAgentAgentflow',
        icon: IconSubtask,
        color: '#ff8fab'
    },
    {
        name: 'stickyNoteAgentflow',
        icon: IconNote,
        color: '#fee440'
    },
    {
        name: 'httpAgentflow',
        icon: IconWorld,
        color: '#FF7F7F'
    },
    {
        name: 'iterationAgentflow',
        icon: IconRelationOneToManyFilled,
        color: '#9C89B8'
    },
    {
        name: 'executeFlowAgentflow',
        icon: IconVectorBezier2,
        color: '#a3b18a'
    }
]
