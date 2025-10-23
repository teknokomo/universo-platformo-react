import React from 'react'
import { Box, Skeleton, SxProps, Theme } from '@mui/material'

export interface SkeletonGridProps {
    /** Number of skeleton items to display (default: 3) */
    count?: number
    /** Height of each skeleton item in pixels (default: 160) */
    height?: number
    /** Variant of skeleton animation (default: 'rounded') */
    variant?: 'text' | 'rectangular' | 'rounded' | 'circular'
    /** Gap between skeleton items in spacing units (default: 3) */
    gap?: number
    /** Responsive grid column configuration */
    columns?: {
        xs?: string
        sm?: string
        md?: string
        lg?: string
    }
    /** Horizontal margin (default: { xs: -1.5, md: -2 }) */
    mx?: number | string | { xs?: number; sm?: number; md?: number; lg?: number }
    /** Additional custom styles for the container Box */
    sx?: SxProps<Theme>
}

/**
 * Universal skeleton grid component for loading states
 *
 * Displays a responsive grid of skeleton placeholders while data is being loaded.
 * Follows Material-UI Skeleton component patterns with responsive grid layout.
 *
 * @example
 * // Basic usage with defaults (3 rounded skeletons, 160px height)
 * <SkeletonGrid />
 *
 * @example
 * // Custom count and height
 * <SkeletonGrid count={6} height={200} />
 *
 * @example
 * // Custom grid columns for different breakpoints
 * <SkeletonGrid
 *     count={4}
 *     columns={{
 *         xs: '1fr',
 *         sm: 'repeat(2, 1fr)',
 *         md: 'repeat(3, 1fr)'
 *     }}
 * />
 */
export const SkeletonGrid: React.FC<SkeletonGridProps> = ({
    count = 3,
    height = 160,
    variant = 'rounded',
    gap = 3,
    columns = {
        xs: '1fr',
        sm: 'repeat(auto-fill, minmax(240px, 1fr))',
        lg: 'repeat(auto-fill, minmax(260px, 1fr))'
    },
    mx = { xs: -1.5, md: -2 },
    sx
}) => {
    return (
        <Box
            sx={{
                display: 'grid',
                gap,
                mx,
                gridTemplateColumns: columns,
                justifyContent: 'start',
                alignContent: 'start',
                ...sx
            }}
        >
            {Array.from({ length: count }).map((_, index) => (
                <Skeleton key={index} variant={variant} height={height} />
            ))}
        </Box>
    )
}
