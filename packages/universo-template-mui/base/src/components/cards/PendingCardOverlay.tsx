import React from 'react'
import { Box, CircularProgress } from '@mui/material'
import type { PendingAction } from '@universo/utils'

interface PendingCardOverlayProps {
    action: PendingAction
}

/**
 * Centered spinner overlay for pending cards.
 * Shown for optimistic create/copy entities.
 * Displays only a spinner without text or background — the card content remains fully visible.
 */
export const PendingCardOverlay: React.FC<PendingCardOverlayProps> = ({ action }) => {
    void action // kept for potential future use (e.g. different spinner color per action)

    return (
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 'inherit',
                pointerEvents: 'none'
            }}
        >
            <CircularProgress size={28} color='primary' />
        </Box>
    )
}

export default PendingCardOverlay
