import type React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { MatrixCell } from './model'

const DRAG_CELL_PREFIX = 'interpretation-cell:'

const toDragCellId = (cellId: string): string => `${DRAG_CELL_PREFIX}${cellId}`
const fromDragCellId = (value: unknown): string | null =>
    typeof value === 'string' && value.startsWith(DRAG_CELL_PREFIX) ? value.slice(DRAG_CELL_PREFIX.length) : null

export function MatrixCellButton({
    cell,
    selected,
    children,
    onSelect,
    dragLabel,
    menuLabel,
    onOpenMenu,
    onMoveCell
}: {
    cell: MatrixCell
    selected: boolean
    children: React.ReactNode
    onSelect: () => void
    dragLabel: string
    menuLabel: string
    onOpenMenu: (event: React.MouseEvent<HTMLElement>) => void
    onMoveCell: (sourceCellId: string, targetCellId: string) => void
}) {
    return (
        <Box
            data-testid='interpretation-network-cell'
            draggable
            onClick={onSelect}
            sx={{
                position: 'relative',
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
            onDragStart={(event) => {
                event.dataTransfer?.setData('text/plain', toDragCellId(cell.id))
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
                event.preventDefault()
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
                event.preventDefault()
                const sourceCellId = fromDragCellId(event.dataTransfer?.getData('text/plain'))
                if (sourceCellId && sourceCellId !== cell.id) {
                    onMoveCell(sourceCellId, cell.id)
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
