import { keyframes } from '@mui/material/styles'

/**
 * Animated border color transition for pending cards.
 * Uses border-color cycling — works in ALL browsers without @property.
 */
export const pendingBorderPulse = keyframes`
  0%, 100% {
    border-color: #1976d2;
  }
  50% {
    border-color: #90caf9;
  }
`

/**
 * Subtle pulse for pending items (opacity oscillation).
 */
export const pendingPulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
`

/**
 * MUI sx props for pending card state.
 * Uses animated border-color pulse + subtle opacity oscillation.
 * Applied only when deferred feedback is visible (after user clicks a pending entity).
 */
export const pendingCardSx = {
    position: 'relative',
    border: '2px solid',
    borderColor: 'primary.main',
    animation: `${pendingBorderPulse} 1.5s ease-in-out infinite, ${pendingPulse} 2s ease-in-out infinite`,
    pointerEvents: 'none',
    transition: 'border-color 0.3s ease'
} as const

/**
 * MUI sx props for a card being deleted (fade-out).
 */
export const deletingCardSx = {
    opacity: 0.4,
    pointerEvents: 'none',
    textDecoration: 'line-through',
    transition: 'opacity 0.3s ease-out'
} as const

/**
 * MUI sx props for a pending table row.
 * Shows a running shimmer bar at the bottom of the row.
 * Applied only when deferred feedback is visible (after user clicks a pending entity).
 */
export const pendingRowSx = {
    opacity: 0.7,
    pointerEvents: 'none',
    backgroundImage: 'linear-gradient(90deg, transparent, #1976d2, transparent)',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '200% 2px',
    backgroundPosition: '0 100%',
    animation: 'pending-row-shimmer 1.5s infinite',
    '@keyframes pending-row-shimmer': {
        '0%': { backgroundPosition: '200% 100%' },
        '100%': { backgroundPosition: '-200% 100%' }
    }
} as const
