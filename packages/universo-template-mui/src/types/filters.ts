/**
 * Filter Types for FilterToolbar component
 *
 * Core types (FilterType, FilterOption, FilterConfig, FilterValues) are
 * re-exported from @universo/types for consistency across the monorepo.
 *
 * MUI-specific component props are defined here.
 */

// Re-export core filter types from canonical source
export type { FilterType, FilterOption, FilterConfig, FilterValues } from '@universo/types'

// Import for use in local interface
import type { FilterConfig, FilterValues } from '@universo/types'

/**
 * Props for FilterToolbar component
 * MUI-specific: used with MUI Select, Checkbox, Switch components
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
