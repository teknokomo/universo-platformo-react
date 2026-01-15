/**
 * Centralized localStorage keys for Projects frontend
 * Using constants prevents typos and enables easier refactoring
 */
export const STORAGE_KEYS = {
    /** Display style for Projects list (card/table) */
    PROJECT_DISPLAY_STYLE: 'projectsProjectDisplayStyle',
    /** Display style for Milestones list (card/table) */
    MILESTONE_DISPLAY_STYLE: 'projectsMilestoneDisplayStyle',
    /** Display style for Tasks list (card/table) */
    TASK_DISPLAY_STYLE: 'projectsTaskDisplayStyle',
    /** Display style for Members list (card/table) */
    MEMBERS_DISPLAY_STYLE: 'projectsMembersDisplayStyle'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Default view style for list pages */
export const DEFAULT_VIEW_STYLE = 'card' as const
export type ViewStyle = 'card' | 'table'
