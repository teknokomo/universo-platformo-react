import React from 'react'
import { Box, Typography } from '@mui/material'
import { SelectableListCard } from './SelectableListCard'
import type { OnboardingItem } from '../types'

interface SelectionStepProps {
    title: string
    subtitle: string
    items: OnboardingItem[]
    selectedIds: string[]
    onSelectionChange: (selectedIds: string[]) => void
    isLoading?: boolean
}

/**
 * SelectionStep - Reusable step for selecting items
 *
 * Used for Projects (Global Goals), Campaigns (Personal Interests),
 * and Clusters (Platform Features)
 */
export const SelectionStep: React.FC<SelectionStepProps> = ({
    title,
    subtitle,
    items,
    selectedIds,
    onSelectionChange,
    isLoading
}) => {
    return (
        <Box>
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                {title}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {subtitle}
            </Typography>

            <SelectableListCard
                items={items}
                selectedIds={selectedIds}
                onSelectionChange={onSelectionChange}
                isLoading={isLoading}
            />
        </Box>
    )
}
