import React from 'react'
import { Stack, Box, Typography, Button, SxProps, Theme } from '@mui/material'

export interface EmptyListStateProps {
    /** Image source (SVG or PNG URL) */
    image: string
    /** Alt text for accessibility */
    imageAlt?: string
    /** Primary message */
    title: string
    /** Optional secondary message */
    description?: string
    /** Optional action button */
    action?: {
        label: string
        onClick: () => void
        startIcon?: React.ReactNode
    }
    /** Image height (default: '25vh') */
    imageHeight?: string | number
    /** Custom styles for the root Stack */
    sx?: SxProps<Theme>
}

/**
 * Universal empty state component for lists and data views
 *
 * @example
 * <EmptyListState
 *     image={APIEmptySVG}
 *     imageAlt="No data"
 *     title={t('metaverses.noMetaversesFound')}
 * />
 *
 * @example With description
 * <EmptyListState
 *     image={APIEmptySVG}
 *     title="No metaverses found"
 *     description="Create your first metaverse to get started"
 * />
 *
 * @example With action button
 * <EmptyListState
 *     image={APIEmptySVG}
 *     title="No entities"
 *     action={{
 *         label: "Add entity",
 *         onClick: handleAdd,
 *         startIcon: <IconPlus />
 *     }}
 * />
 */
export const EmptyListState: React.FC<EmptyListStateProps> = ({
    image,
    imageAlt = 'No data',
    title,
    description,
    action,
    imageHeight = '25vh',
    sx
}) => {
    return (
        <Stack
            sx={{
                alignItems: 'center',
                justifyContent: 'center',
                py: 4,
                ...sx
            }}
            flexDirection='column'
        >
            <Box sx={{ p: 2, height: 'auto' }}>
                <img
                    style={{
                        objectFit: 'cover',
                        height: imageHeight,
                        width: 'auto'
                    }}
                    src={image}
                    alt={imageAlt}
                />
            </Box>

            <Typography variant='body1' sx={{ color: 'text.secondary', mb: description ? 1 : action ? 2 : 0 }}>
                {title}
            </Typography>

            {description && (
                <Typography
                    variant='body2'
                    sx={{
                        color: 'text.secondary',
                        mb: action ? 2 : 0,
                        textAlign: 'center',
                        maxWidth: 400
                    }}
                >
                    {description}
                </Typography>
            )}

            {action && (
                <Button variant='contained' onClick={action.onClick} startIcon={action.startIcon} sx={{ mt: 1 }}>
                    {action.label}
                </Button>
            )}
        </Stack>
    )
}

export default EmptyListState
