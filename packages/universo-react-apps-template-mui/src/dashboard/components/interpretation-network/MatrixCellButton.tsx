import type React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MatrixCell } from './model'

export function MatrixCellButton({
    cell,
    selected,
    children,
    onSelect,
    dragLabel,
    menuLabel,
    onOpenMenu,
    disabled = false
}: {
    cell: MatrixCell
    selected: boolean
    children: React.ReactNode
    onSelect: () => void
    dragLabel: string
    menuLabel: string
    onOpenMenu: (event: React.MouseEvent<HTMLElement>) => void
    disabled?: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cell.id, disabled })

    return (
        <Box
            ref={setNodeRef}
            data-testid='interpretation-network-cell'
            data-cell-id={cell.id}
            onClick={onSelect}
            sx={{
                position: 'relative',
                zIndex: isDragging ? 1 : 'auto',
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.55 : 1,
                minHeight: 64,
                borderRadius: 1,
                bgcolor: cell.style.fill ?? 'background.paper',
                color: 'text.primary',
                borderTop: cell.style.borderTop,
                borderRight: cell.style.borderRight,
                borderBottom: cell.style.borderBottom,
                borderLeft: cell.style.borderLeft,
                outline: selected ? 2 : 0,
                outlineColor: 'primary.main',
                outlineOffset: selected ? 2 : 0,
                boxShadow: selected ? 3 : 0,
                overflow: 'hidden',
                '&:hover': {
                    bgcolor: cell.style.fill ?? 'action.hover',
                    boxShadow: selected ? 4 : 1
                },
                '&:focus-visible': {
                    outline: 2,
                    outlineColor: 'primary.main',
                    outlineOffset: 2
                }
            }}
        >
            <Stack direction='row' spacing={0} alignItems='stretch' sx={{ minHeight: 64, minWidth: 0 }}>
                <Tooltip title={dragLabel}>
                    <Box
                        aria-label={dragLabel}
                        sx={{
                            width: 28,
                            alignSelf: 'stretch',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.secondary',
                            bgcolor: 'action.hover',
                            flexShrink: 0,
                            cursor: 'grab'
                        }}
                        {...attributes}
                        {...listeners}
                    >
                        <DragIndicatorRoundedIcon fontSize='small' />
                    </Box>
                </Tooltip>
                <Button
                    type='button'
                    variant='text'
                    onClick={onSelect}
                    sx={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        minHeight: 64,
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                        borderRadius: 0,
                        color: 'text.primary',
                        px: 1.5,
                        pr: 4.5,
                        '&:hover': {
                            bgcolor: 'transparent'
                        }
                    }}
                >
                    {children}
                </Button>
            </Stack>
            <IconButton
                type='button'
                size='small'
                aria-label={menuLabel}
                onClick={(event) => {
                    event.stopPropagation()
                    onOpenMenu(event)
                }}
                sx={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, p: 0.25 }}
            >
                <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
        </Box>
    )
}
