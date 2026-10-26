import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

export const MatrixSettingsRow = ({
    testId,
    title,
    description,
    children,
    extra
}: {
    testId: string
    title: string
    description: string
    children: ReactNode
    extra?: ReactNode
}) => (
    <Box
        data-testid={testId}
        sx={{
            py: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1.5, sm: 3 }
        }}
    >
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant='subtitle2'>{title}</Typography>
            <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                {description}
            </Typography>
            {extra}
        </Box>
        {children}
    </Box>
)
