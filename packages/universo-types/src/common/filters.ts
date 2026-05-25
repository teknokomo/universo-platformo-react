/**
 * UI-Agnostic Filter Types
 *
 * Provides type-safe configuration for list filters.
 * These types are framework-agnostic and can be used with any UI library.
 *
 * This is the CANONICAL source for filter types in the monorepo.
 * UI-specific props (like FilterToolbarProps) should be defined in UI packages.
 */

/**
 * Available filter control types
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
