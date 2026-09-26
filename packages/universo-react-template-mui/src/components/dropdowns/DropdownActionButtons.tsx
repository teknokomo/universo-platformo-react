import type { ReactNode } from 'react'
import { Box, IconButton } from '@mui/material'
import type { IconButtonProps } from '@mui/material/IconButton'

export interface DropdownAction {
    /** Stable key for the action within this dropdown. */
    key: string
    /** Localized accessible name and pointer tooltip. */
    label: string
    icon: ReactNode
    onClick: () => void
    disabled?: boolean
    color?: IconButtonProps['color']
}

export interface DropdownActionButtonsProps {
    actions: readonly DropdownAction[]
}

/** Small, keyboard-accessible actions that share the dropdown input adornment. */
export function DropdownActionButtons({ actions }: DropdownActionButtonsProps) {
    if (actions.length === 0) return null

    return (
        <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
            {actions.map((action) => (
                <IconButton
                    key={action.key}
                    type='button'
                    aria-label={action.label}
                    title={action.label}
                    size='small'
                    color={action.color ?? 'default'}
                    disabled={action.disabled}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={action.onClick}
                    sx={{
                        width: 32,
                        height: 32,
                        minWidth: 32,
                        padding: 0.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        color: 'text.secondary',
                        backgroundColor: 'background.paper',
                        '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' }
                    }}
                >
                    {action.icon}
                </IconButton>
            ))}
        </Box>
    )
}
