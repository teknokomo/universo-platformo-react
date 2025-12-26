import React from 'react'
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Checkbox,
    Skeleton,
    Typography,
    alpha,
    useTheme
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { OnboardingItem } from '../types'

interface SelectableListCardProps {
    items: OnboardingItem[]
    selectedIds: string[]
    onSelectionChange: (selectedIds: string[]) => void
    isLoading?: boolean
}

/**
 * SelectableListCard - Card-based list with checkboxes for selection
 *
 * Features:
 * - Large number on the left side
 * - Title and description stacked vertically
 * - Checkbox on the right for selection
 * - Click anywhere on card to toggle selection
 */
export const SelectableListCard: React.FC<SelectableListCardProps> = ({
    items,
    selectedIds,
    onSelectionChange,
    isLoading
}) => {
    const theme = useTheme()
    const { t } = useTranslation('onboarding')

    const handleToggle = (id: string) => {
        const isCurrentlySelected = selectedIds.includes(id)
        const newSelected = isCurrentlySelected
            ? selectedIds.filter((selectedId) => selectedId !== id)
            : [...selectedIds, id]
        onSelectionChange(newSelected)
    }

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3].map((i) => (
                    <Card key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: 80, minHeight: 80, p: 2 }}>
                            <Skeleton variant="circular" width={48} height={48} />
                        </Box>
                        <CardContent sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="60%" height={28} />
                            <Skeleton variant="text" width="80%" height={20} />
                        </CardContent>
                        <Box sx={{ pr: 2 }}>
                            <Skeleton variant="rectangular" width={24} height={24} />
                        </Box>
                    </Card>
                ))}
            </Box>
        )
    }

    if (items.length === 0) {
        return (
            <Box
                sx={{
                    textAlign: 'center',
                    py: 4,
                    color: 'text.secondary'
                }}
            >
                <Typography variant="body1">{t('errors.noItemsAvailable')}</Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((item, index) => {
                const isSelected = selectedIds.includes(item.id)
                return (
                    <Card
                        key={item.id}
                        sx={{
                            display: 'flex',
                            alignItems: 'stretch',
                            border: isSelected
                                ? `2px solid ${theme.palette.primary.main}`
                                : `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                borderColor: isSelected
                                    ? theme.palette.primary.main
                                    : alpha(theme.palette.primary.main, 0.3)
                            }
                        }}
                    >
                        {/* Large number on the left */}
                        <Box
                            sx={{
                                width: 80,
                                minWidth: 80,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isSelected
                                    ? alpha(theme.palette.primary.main, 0.12)
                                    : alpha(theme.palette.primary.main, 0.04),
                                transition: 'background-color 0.2s ease'
                            }}
                        >
                            <Typography
                                variant="h3"
                                sx={{
                                    fontWeight: 700,
                                    color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary,
                                    opacity: isSelected ? 1 : 0.5,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {index + 1}
                            </Typography>
                        </Box>

                        {/* Content - clickable area */}
                        <CardActionArea
                            onClick={() => handleToggle(item.id)}
                            sx={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start'
                            }}
                        >
                            <CardContent sx={{ flex: 1, py: 2 }}>
                                <Typography
                                    variant="h6"
                                    component="div"
                                    sx={{
                                        fontWeight: isSelected ? 600 : 500,
                                        color: isSelected ? theme.palette.primary.main : 'inherit'
                                    }}
                                >
                                    {item.name}
                                </Typography>
                                {item.description && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 0.5, lineHeight: 1.4 }}
                                    >
                                        {item.description}
                                    </Typography>
                                )}
                            </CardContent>

                            {/* Checkbox on the right */}
                            <Box sx={{ pr: 2 }}>
                                <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleToggle(item.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    color="primary"
                                    sx={{
                                        '& .MuiSvgIcon-root': {
                                            fontSize: 28
                                        }
                                    }}
                                />
                            </Box>
                        </CardActionArea>
                    </Card>
                )
            })}
        </Box>
    )
}
