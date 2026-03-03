import React from 'react'
import { Paper, Typography, Chip, Stack } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { AttributeDisplay } from '../../../../types'

interface DragOverlayRowProps {
    attribute: AttributeDisplay
}

export const DragOverlayRow: React.FC<DragOverlayRowProps> = ({ attribute }) => {
    return (
        <Paper
            elevation={8}
            sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 300,
                maxWidth: 500,
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                opacity: 0.95
            }}
        >
            <DragIndicatorIcon fontSize='small' sx={{ color: 'primary.main' }} />
            <Stack direction='row' alignItems='center' spacing={1} sx={{ flex: 1, overflow: 'hidden' }}>
                <Typography variant='body2' fontWeight={500} noWrap>
                    {attribute.name || attribute.codename}
                </Typography>
                <Chip label={attribute.dataType} size='small' sx={{ ml: 'auto' }} />
            </Stack>
        </Paper>
    )
}
