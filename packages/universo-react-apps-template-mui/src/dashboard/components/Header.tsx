import { Children, type ReactNode } from 'react'
import Stack from '@mui/material/Stack'

export interface HeaderProps {
    leading?: ReactNode
    actions?: ReactNode
}

export default function Header({ leading, actions }: HeaderProps) {
    const hasLeading = Children.toArray(leading).length > 0
    const hasActions = Children.toArray(actions).length > 0
    if (!hasLeading && !hasActions) return null

    return (
        <Stack
            data-testid='runtime-header'
            direction={{ xs: 'column', md: 'row' }}
            sx={{
                width: '100%',
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: hasLeading ? 'space-between' : 'flex-end',
                maxWidth: { sm: '100%', md: '1700px' },
                pt: 0.5
            }}
            spacing={1}
        >
            {hasLeading ? leading : null}
            {hasActions ? (
                <Stack
                    data-testid='runtime-header-actions'
                    direction='row'
                    useFlexGap
                    sx={{
                        width: { xs: '100%', md: 'auto' },
                        gap: 1,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                        minWidth: 0
                    }}
                >
                    {actions}
                </Stack>
            ) : null}
        </Stack>
    )
}
