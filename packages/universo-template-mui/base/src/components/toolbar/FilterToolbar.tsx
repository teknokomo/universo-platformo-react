import React from 'react'
import { Box, FormControl, InputLabel, Select, MenuItem, Chip, ToggleButton, Tooltip, Skeleton } from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import { IconFilter } from '@tabler/icons-react'
import type { FilterToolbarProps, FilterConfig } from '../../types/filters'

// Re-export types for convenience
export type { FilterToolbarProps, FilterConfig, FilterValues, FilterType, FilterOption } from '../../types/filters'

/**
 * FilterToolbar - Reusable filter bar component for list pages
 *
 * Renders configurable filters (select, multiselect, toggle) in a horizontal bar.
 * Designed to be placed in ViewHeader's `filters` prop slot.
 *
 * @example
 * ```tsx
 * <ViewHeader
 *   title="Users"
 *   search={true}
 *   onSearchChange={handleSearch}
 *   filters={
 *     <FilterToolbar
 *       filters={[
 *         { key: 'roleId', type: 'select', label: 'Role', options: roleOptions },
 *         { key: 'globalOnly', type: 'toggle', label: 'Global Only' }
 *       ]}
 *       values={filterValues}
 *       onChange={setFilterValues}
 *     />
 *   }
 * >
 *   <ToolbarControls ... />
 * </ViewHeader>
 * ```
 */
export const FilterToolbar: React.FC<FilterToolbarProps> = ({ filters, values, onChange, loading = false, compact = false }) => {
    const handleFilterChange = (key: string, value: string | string[] | boolean) => {
        onChange({ ...values, [key]: value })
    }

    const renderFilter = (config: FilterConfig) => {
        if (loading) {
            return <Skeleton key={config.key} variant='rectangular' width={150} height={compact ? 32 : 40} sx={{ borderRadius: 1 }} />
        }

        switch (config.type) {
            case 'select':
                return (
                    <FormControl key={config.key} size='small' sx={{ minWidth: compact ? 120 : 150 }}>
                        <InputLabel id={`filter-${config.key}-label`}>{config.label}</InputLabel>
                        <Select
                            labelId={`filter-${config.key}-label`}
                            id={`filter-${config.key}`}
                            value={(values[config.key] as string) || 'all'}
                            label={config.label}
                            onChange={(e: SelectChangeEvent) => handleFilterChange(config.key, e.target.value)}
                            sx={{ borderRadius: 1, height: compact ? 32 : 40 }}
                        >
                            <MenuItem value='all'>
                                <em>{config.placeholder || 'All'}</em>
                            </MenuItem>
                            {config.options?.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {opt.color && (
                                            <Chip
                                                size='small'
                                                sx={{
                                                    bgcolor: opt.color,
                                                    width: 12,
                                                    height: 12,
                                                    minWidth: 12,
                                                    '& .MuiChip-label': { display: 'none' }
                                                }}
                                            />
                                        )}
                                        {opt.label}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )

            case 'toggle':
                return (
                    <Tooltip key={config.key} title={config.label}>
                        <ToggleButton
                            value='check'
                            selected={Boolean(values[config.key])}
                            onChange={() => handleFilterChange(config.key, !values[config.key])}
                            size='small'
                            sx={{
                                borderRadius: 1,
                                px: 2,
                                height: compact ? 32 : 40,
                                textTransform: 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <IconFilter size={16} style={{ marginRight: 6 }} />
                            {config.label}
                        </ToggleButton>
                    </Tooltip>
                )

            default:
                return null
        }
    }

    if (filters.length === 0) {
        return null
    }

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
            }}
        >
            {filters.map(renderFilter)}
        </Box>
    )
}

export default FilterToolbar
