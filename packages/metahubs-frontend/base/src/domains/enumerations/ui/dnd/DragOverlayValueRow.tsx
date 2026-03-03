import React from 'react'
import { Paper, Typography, Stack } from '@mui/material'
import type { EnumerationValueDisplay } from '../../../../types'

interface DragOverlayValueRowProps {
    value: EnumerationValueDisplay
}

export const DragOverlayValueRow: React.FC<DragOverlayValueRowProps> = ({ value }) => (
    <Paper
        elevation={8}
        sx={{
            px: 2,
            py: 1,
            borderRadius: 1,
            display: 'inline-flex',
            alignItems: 'center',
            maxWidth: 320
        }}
    >
        <Stack direction='row' spacing={1} alignItems='center'>
            <Typography variant='body2' noWrap sx={{ fontWeight: 500 }}>
                {value.name || value.codename || '—'}
            </Typography>
            {value.codename && (
                <Typography variant='caption' color='text.secondary' noWrap sx={{ fontFamily: 'monospace' }}>
                    {value.codename}
                </Typography>
            )}
        </Stack>
    </Paper>
)
