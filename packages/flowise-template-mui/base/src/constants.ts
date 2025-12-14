// Tabler icons for AgentFlow nodes
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
    IconVectorBezier2
} from '@tabler/icons-react'

/**
 * Grid spacing constant for consistent layout spacing
 * Used across all components for margin/padding consistency
 * Value: 3 means 24px (8px base × 3)
 */
export const gridSpacing = 3

/**
 * Maximum scroll value for canvas/dialog components
 */
export const maxScroll = 100000

/**
 * API base URL - extracted from flowise-ui store/constant
 * Resolves to current window origin in browser, fallback to localhost in Node.js
 */
export const baseURL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

/**
 * Redacted credential placeholder value
 * Used to mask sensitive credentials in the UI
 */
export const REDACTED_CREDENTIAL_VALUE = '_FLOWISE_BLANK_07167752-1a71-43b1-bf8f-4f32252165db'

/**
 * AgentFlow node icons mapping
 * Maps agentflow node names to their corresponding Tabler icons
 */
export const AGENTFLOW_ICONS = [
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
