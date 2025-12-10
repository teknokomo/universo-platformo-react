/**
 * Filter Types for FilterToolbar component
 * Provides type-safe configuration for list filters
 */

export type FilterType = 'select' | 'multiselect' | 'toggle'

/**
 * Single option for select/multiselect filters
 */
export interface FilterOption {
    /** Value to submit to API */
    value: string
    /** Display label */
    label: string
    /** Optional color indicator (e.g., for role filters) */
    color?: string
}

/**
 * Configuration for a single filter
 */
export interface FilterConfig {
    /** Unique key for the filter (used in API params) */
    key: string
    /** Type of filter control */
    type: FilterType
    /** Label for the filter */
    label: string
    /** Options for select/multiselect types */
    options?: FilterOption[]
    /** Default value */
    defaultValue?: string | string[] | boolean
    /** Placeholder text for select */
    placeholder?: string
}

/**
 * Current filter values state
 */
export interface FilterValues {
    [key: string]: string | string[] | boolean | undefined
}

/**
 * Props for FilterToolbar component
 */
export interface FilterToolbarProps {
    /** Array of filter configurations */
    filters: FilterConfig[]
    /** Current filter values */
    values: FilterValues
    /** Callback when filter values change */
    onChange: (values: FilterValues) => void
    /** Loading state for filters (e.g., while loading options) */
    loading?: boolean
    /** Compact mode - smaller controls */
    compact?: boolean
}
