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

export function MatrixCellContent({
    children,
    positionLabel,
    compact = false
}: {
    children: React.ReactNode
    positionLabel?: string
    compact?: boolean
}) {
    return (
        <Box sx={{ minWidth: 0, width: '100%', position: 'relative', pt: positionLabel && compact ? 2.25 : 0 }}>
            {positionLabel ? (
                <Box
                    component='span'
                    data-testid='interpretation-network-cell-position'
                    sx={{
                        position: compact ? 'absolute' : 'static',
                        top: compact ? 0 : undefined,
                        left: compact ? 0 : undefined,
                        display: 'inline-flex',
                        maxWidth: '100%',
                        px: 0.75,
                        py: 0.125,
                        mb: compact ? 0 : 0.5,
                        borderRadius: 1,
                        typography: 'caption',
                        lineHeight: 1.4,
                        color: 'text.secondary',
                        bgcolor: 'action.hover',
                        pointerEvents: 'none'
                    }}
                >
                    {positionLabel}
                </Box>
            ) : null}
            <Box
                component='span'
                sx={{
                    display: 'block',
                    width: compact ? '100%' : 'fit-content',
                    minWidth: 0,
                    maxWidth: '100%',
                    mx: compact ? 0 : 'auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: compact ? 'normal' : 'nowrap',
                    overflowWrap: 'anywhere',
                    textAlign: compact ? 'left' : 'left'
                }}
            >
                {children}
            </Box>
        </Box>
    )
}

export function MatrixCellButton({
    cell,
    selected,
    children,
    onSelect,
    dragLabel,
    menuLabel,
    accessibleLabel,
    onOpenMenu,
    disabled = false,
    depth = 0,
    positionLabel,
    isOriginMuted = false,
    dropPlacement = null,
    dropIndicatorAxis = 'horizontal',
    isInvalidDropTarget = false,
    isOverlay = false,
    freezeSortableTransform = false
}: {
    cell: MatrixCell
    selected: boolean
    children: React.ReactNode
    onSelect: () => void
    dragLabel: string
    menuLabel: string
    onOpenMenu: (event: React.MouseEvent<HTMLElement>) => void
    accessibleLabel?: string
    disabled?: boolean
    depth?: number
    positionLabel?: string
    isOriginMuted?: boolean
    dropPlacement?: 'before' | 'after' | 'child' | null
    dropIndicatorAxis?: 'horizontal' | 'vertical'
    isInvalidDropTarget?: boolean
    isOverlay?: boolean
    freezeSortableTransform?: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: cell.id,
        disabled: disabled || isOverlay
    })
    const showDropIndicator = Boolean(dropPlacement)

    return (
        <Box
            ref={isOverlay ? undefined : setNodeRef}
            data-testid={isOverlay ? 'interpretation-network-cell-drag-overlay' : 'interpretation-network-cell'}
            data-cell-id={cell.id}
            data-selected={!isOverlay && selected ? 'true' : undefined}
            data-selected-outline={!isOverlay && selected ? 'inset' : undefined}
            data-drop-placement={dropPlacement ?? undefined}
            data-invalid-drop-target={isInvalidDropTarget ? 'true' : undefined}
            onClick={onSelect}
            sx={{
                position: 'relative',
                zIndex: isDragging || isOverlay ? 2 : 'auto',
                transform: isOverlay || freezeSortableTransform ? undefined : CSS.Transform.toString(transform),
                transition: freezeSortableTransform ? undefined : transition,
                opacity: isDragging || isOriginMuted ? 0.48 : 1,
                minHeight: 64,
                borderRadius: 1,
                bgcolor: cell.style.fill ?? 'background.paper',
                color: 'text.primary',
                borderTop: isInvalidDropTarget ? '1px dashed' : cell.style.borderTop,
                borderRight: isInvalidDropTarget ? '1px dashed' : cell.style.borderRight,
                borderBottom: isInvalidDropTarget ? '1px dashed' : cell.style.borderBottom,
                borderLeft: isInvalidDropTarget ? '1px dashed' : cell.style.borderLeft,
                borderColor: isInvalidDropTarget ? 'error.main' : undefined,
                outline: 0,
                boxShadow: isOverlay ? 6 : selected ? 3 : 0,
                overflow: 'hidden',
                ml: depth > 0 ? Math.min(depth * 3, 12) : 0,
                '&:hover': {
                    bgcolor: cell.style.fill ?? 'action.hover',
                    boxShadow: selected ? 4 : 1
                },
                '&:focus-visible': {
                    outline: 2,
                    outlineColor: 'primary.main',
                    outlineOffset: 2
                },
                ...(showDropIndicator
                    ? {
                          '&::before': {
                              content: '""',
                              position: 'absolute',
                              zIndex: 3,
                              pointerEvents: 'none',
                              borderColor: isInvalidDropTarget ? 'error.main' : 'primary.main',
                              ...(dropPlacement === 'before'
                                  ? dropIndicatorAxis === 'vertical'
                                      ? {
                                            top: 0,
                                            right: 0,
                                            left: 0,
                                            borderTop: 3,
                                            borderTopStyle: 'dashed'
                                        }
                                      : {
                                            top: 0,
                                            bottom: 0,
                                            left: 0,
                                            borderLeft: 3,
                                            borderLeftStyle: 'dashed'
                                        }
                                  : dropPlacement === 'after'
                                  ? dropIndicatorAxis === 'vertical'
                                      ? {
                                            right: 0,
                                            bottom: 0,
                                            left: 0,
                                            borderBottom: 3,
                                            borderBottomStyle: 'dashed'
                                        }
                                      : {
                                            top: 0,
                                            right: 0,
                                            bottom: 0,
                                            borderRight: 3,
                                            borderRightStyle: 'dashed'
                                        }
                                  : {
                                        inset: 4,
                                        border: 2,
                                        borderStyle: 'dashed',
                                        borderRadius: 1
                                    })
                          }
                      }
                    : {}),
                ...(selected && !isOverlay
                    ? {
                          '&::after': {
                              content: '""',
                              position: 'absolute',
                              zIndex: 4,
                              inset: 3,
                              border: 2,
                              borderStyle: 'solid',
                              borderColor: 'primary.main',
                              borderRadius: 0.75,
                              pointerEvents: 'none'
                          }
                      }
                    : {})
            }}
        >
            {showDropIndicator ? <Box data-testid='interpretation-network-drop-indicator' sx={{ position: 'absolute', inset: 0 }} /> : null}
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
                        {...(isOverlay ? {} : attributes)}
                        {...(isOverlay ? {} : listeners)}
                    >
                        <DragIndicatorRoundedIcon fontSize='small' />
                    </Box>
                </Tooltip>
                <Button
                    type='button'
                    variant='text'
                    data-testid='interpretation-network-cell-title'
                    data-position-label-overlay={positionLabel ? 'true' : undefined}
                    aria-label={accessibleLabel}
                    aria-pressed={selected}
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
                        py: 0.75,
                        pr: 4.5,
                        '&:hover': {
                            bgcolor: 'transparent'
                        }
                    }}
                >
                    <MatrixCellContent positionLabel={positionLabel}>{children}</MatrixCellContent>
                </Button>
            </Stack>
            <IconButton
                type='button'
                size='small'
                aria-label={menuLabel}
                disabled={isOverlay}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation()
                    onOpenMenu(event)
                }}
                sx={{ position: 'absolute', zIndex: 2, top: 4, right: 4, width: 28, height: 28, p: 0.25 }}
            >
                <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
        </Box>
    )
}
