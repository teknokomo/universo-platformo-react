// English-only comments in source files under memory-bank/ or code. This is code.
import React, { useState, useRef, useEffect, memo, useCallback } from 'react'
import { useTranslation } from '@universo/i18n'
import {
    Box,
    Tab,
    Tabs,
    IconButton,
    Menu,
    MenuItem,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Tooltip,
    Divider,
    CircularProgress
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconPlus, IconEdit, IconCopy, IconTrash, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import {
    CSS,
} from '@dnd-kit/utilities'
import './CanvasTabs.styles.css'

// Canvas Tabs component, copied from packages/flowise-ui with no business logic changes
// to minimize diff and risk. Any future edits should happen here.
const CanvasTabs = ({
    canvases = [],
    activeCanvasId,
    onCanvasSelect,
    onCanvasCreate,
    onCanvasRename,
    onCanvasDelete,
    onCanvasDuplicate,
    onCanvasReorder,
    disabled = false,
    onHeightChange
}) => {
    const theme = useTheme()
    const { t } = useTranslation('canvas')

    const [contextMenu, setContextMenu] = useState(null)
    const [selectedCanvas, setSelectedCanvas] = useState(null)
    const [renameDialog, setRenameDialog] = useState(false)
    const [newName, setNewName] = useState('')
    const [renameTargetId, setRenameTargetId] = useState(null)
    const [activeId, setActiveId] = useState(null)
    const [optimisticCanvases, setOptimisticCanvases] = useState(canvases)
    const [pendingReorder, setPendingReorder] = useState(null) // {canvasId, fromIndex, toIndex}
    const tabsRef = useRef(null)

    // Sync optimistic state with props
    useEffect(() => {
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'
        if (!pendingReorder) {
            if (debug) console.debug('[CanvasTabs] sync -> mirror props (no pending)')
            setOptimisticCanvases(canvases)
            return
        }

        // When there is a pending reorder, only accept server updates
        // once the order coming from props matches our optimistic order.
        const propIds = (canvases || []).map(c => c.id).join('|')
        const optimisticIds = (optimisticCanvases || []).map(c => c.id).join('|')
        if (debug) console.debug('[CanvasTabs] sync while pending', { propIds, optimisticIds })

        if (propIds === optimisticIds) {
            if (debug) console.debug('[CanvasTabs] backend confirmed order, clear pending')
            setOptimisticCanvases(canvases)
            setPendingReorder(null)
        } else {
            if (debug) console.debug('[CanvasTabs] ignore props change until order matches')
        }
    }, [canvases, pendingReorder, optimisticCanvases])

    // Debug mount/unmount
    useEffect(() => {
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'
        if (debug) console.debug('[CanvasTabs] mounted')
        return () => {
            if (debug) console.debug('[CanvasTabs] unmounted')
        }
    }, [])

    // @dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Minimum distance to start dragging
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const [forceUpdate, setForceUpdate] = useState(0)
    const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false })

    useEffect(() => {
        setForceUpdate((prev) => prev + 1)
    }, [activeCanvasId])

    // Check scroll state for proper arrow display
    const updateScrollState = useCallback(() => {
        const tabsContainer = tabsRef.current
        if (!tabsContainer) return

        const scroller = tabsContainer.querySelector('.MuiTabs-scroller')
        if (!scroller) return

        const { scrollLeft, scrollWidth, clientWidth } = scroller
        const canScrollLeft = scrollLeft > 0
        const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1 // -1 for rounding

        setScrollState(prev => {
            if (prev.canScrollLeft !== canScrollLeft || prev.canScrollRight !== canScrollRight) {
                return { canScrollLeft, canScrollRight }
            }
            return prev
        })
    }, [])

    useEffect(() => {
        const tabsContainer = tabsRef.current
        if (!tabsContainer) return

        const scroller = tabsContainer.querySelector('.MuiTabs-scroller')
        if (!scroller) return

        // Initial check
        updateScrollState()

        // Listen for scroll events
        scroller.addEventListener('scroll', updateScrollState)

        // Listen for resize events
        const resizeObserver = new ResizeObserver(updateScrollState)
        resizeObserver.observe(scroller)

        return () => {
            scroller.removeEventListener('scroll', updateScrollState)
            resizeObserver.disconnect()
        }
    }, [updateScrollState, canvases.length])

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1') {
            // Lightweight render trace for diagnostics
            // eslint-disable-next-line no-console
            console.debug('[CanvasTabs] render', { activeCanvasId, count: canvases?.length })
        }
    })

    const handleTabChange = (_event, newValue) => {
        if (newValue && onCanvasSelect) onCanvasSelect(newValue)
    }

    const handleContextMenu = (event, canvas) => {
        event.preventDefault()
        setContextMenu({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 })
        setSelectedCanvas(canvas)
    }
    const handleContextMenuClose = () => {
        setContextMenu(null)
        setSelectedCanvas(null)
    }

    const handleRename = () => {
        setNewName(selectedCanvas?.name || '')
        setRenameTargetId(selectedCanvas?.id || null)
        setRenameDialog(true)
        // Не сбрасываем selectedCanvas до открытия диалога, но закрываем контекст-меню
        setContextMenu(null)
    }
    const handleRenameConfirm = () => {
        const id = renameTargetId || selectedCanvas?.id
        if (newName.trim() && id && onCanvasRename) onCanvasRename(id, newName.trim())
        setRenameDialog(false)
        setNewName('')
        setRenameTargetId(null)
    }
    const handleRenameCancel = () => {
        setRenameDialog(false)
        setNewName('')
        setRenameTargetId(null)
    }

    const handleDuplicate = () => {
        if (selectedCanvas && onCanvasDuplicate) onCanvasDuplicate(selectedCanvas.id)
        handleContextMenuClose()
    }
    const handleDelete = () => {
        if (selectedCanvas && onCanvasDelete) onCanvasDelete(selectedCanvas.id)
        handleContextMenuClose()
    }

    const handleMoveLeft = async () => {
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'
        if (selectedCanvas && onCanvasReorder) {
            const currentIndex = optimisticCanvases.findIndex(c => c.id === selectedCanvas.id)
            if (currentIndex > 0) {
                // Perform optimistic update
                performOptimisticReorder(selectedCanvas.id, currentIndex, currentIndex - 1)
                // Call backend
                try {
                    await onCanvasReorder(selectedCanvas.id, currentIndex - 1)
                    if (debug) console.debug('[CanvasTabs] moveLeft success', { id: selectedCanvas.id })
                } catch (e) {
                    // Revert on error and clear pending indicator
                    const movedTo = currentIndex - 1
                    const newCanvases = [...optimisticCanvases]
                    const [moved] = newCanvases.splice(movedTo, 1)
                    newCanvases.splice(currentIndex, 0, moved)
                    setOptimisticCanvases(newCanvases)
                    setPendingReorder(null)
                    if (debug) console.debug('[CanvasTabs] moveLeft failed, reverted', e)
                }
            }
        }
        handleContextMenuClose()
    }

    const handleMoveRight = async () => {
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'
        if (selectedCanvas && onCanvasReorder) {
            const currentIndex = optimisticCanvases.findIndex(c => c.id === selectedCanvas.id)
            if (currentIndex < optimisticCanvases.length - 1) {
                // Perform optimistic update
                performOptimisticReorder(selectedCanvas.id, currentIndex, currentIndex + 1)
                // Call backend
                try {
                    await onCanvasReorder(selectedCanvas.id, currentIndex + 1)
                    if (debug) console.debug('[CanvasTabs] moveRight success', { id: selectedCanvas.id })
                } catch (e) {
                    // Revert on error and clear pending indicator
                    const movedTo = currentIndex + 1
                    const newCanvases = [...optimisticCanvases]
                    const [moved] = newCanvases.splice(movedTo, 1)
                    newCanvases.splice(currentIndex, 0, moved)
                    setOptimisticCanvases(newCanvases)
                    setPendingReorder(null)
                    if (debug) console.debug('[CanvasTabs] moveRight failed, reverted', e)
                }
            }
        }
        handleContextMenuClose()
    }

    // Helper function for optimistic reorder
    const performOptimisticReorder = (canvasId, fromIndex, toIndex) => {
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'
        const newCanvases = [...optimisticCanvases]
        const [movedCanvas] = newCanvases.splice(fromIndex, 1)
        newCanvases.splice(toIndex, 0, movedCanvas)
        if (debug) console.debug('[CanvasTabs] optimistic reorder', { canvasId, fromIndex, toIndex, order: newCanvases.map(c => c.id) })
        // Mark pending first, then update list to avoid any race with effects depending on pending
        setPendingReorder({ canvasId, fromIndex, toIndex })
        setOptimisticCanvases(newCanvases)
    }

    // @dnd-kit drag handlers
    const handleDragStart = (event) => {
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'
        if (debug) console.debug('[CanvasTabs] dragStart', { id: event.active.id })
        setActiveId(event.active.id)
    }

    const handleDragEnd = async (event) => {
        const { active, over } = event
        const debug = typeof window !== 'undefined' && localStorage.getItem('debugTabs') === '1'

        if (active.id !== over?.id && onCanvasReorder) {
            const oldIndex = optimisticCanvases.findIndex(canvas => canvas.id === active.id)
            const newIndex = optimisticCanvases.findIndex(canvas => canvas.id === over.id)

            // Perform optimistic update immediately
            performOptimisticReorder(active.id, oldIndex, newIndex)

            // Call backend operation
            try {
                await onCanvasReorder(active.id, newIndex)
                if (debug) console.debug('[CanvasTabs] reorder success (awaited)', { id: active.id, from: oldIndex, to: newIndex })
            } catch (e) {
                // Revert order on error and clear pending state
                const newList = [...optimisticCanvases]
                const [moved] = newList.splice(newIndex, 1)
                newList.splice(oldIndex, 0, moved)
                setOptimisticCanvases(newList)
                setPendingReorder(null)
                if (debug) console.debug('[CanvasTabs] reorder failed, reverted', e)
            }
        }

        setActiveId(null)
    }





    // Create a sortable tab component
    const SortableTab = ({ canvas, isActive }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({ id: canvas.id })

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        }

        // Check if this canvas is pending reorder
        const isPending = pendingReorder?.canvasId === canvas.id

        // Check if this specific canvas is being dragged
        const isBeingDragged = activeId === canvas.id

        // Check if any canvas is being dragged (for global drag state)
        const isAnyDragging = activeId !== null

        // Handle click separately from drag
        const handleClick = (e) => {
            // Only handle click if not dragging
            if (!isDragging && !isBeingDragged && onCanvasSelect) {
                onCanvasSelect(canvas.id)
            }
        }

        return (
            <Tab
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                key={canvas.id}
                value={canvas.id}
                onClick={handleClick}
                onContextMenu={(e) => handleContextMenu(e, canvas)}
                disableRipple
                selected={isActive}
                label={
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.3,
                            minWidth: 0,
                            maxWidth: 200,
                            width: '100%',
                            height: '100%',
                        }}
                    >
                        {isPending && (
                            <CircularProgress
                                size={12}
                                thickness={6}
                                sx={{
                                    mr: 0.5,
                                    color: isActive ? theme.palette.primary.contrastText : theme.palette.primary.main,
                                    flexShrink: 0,
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                        <Box sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem',
                            flex: 1,
                            pointerEvents: 'none', // Prevent text selection during drag
                        }}>
                            {canvas.name}
                        </Box>
                        {canvas.isDirty && (
                            <Box sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: theme.palette.warning.main,
                                flexShrink: 0,
                                pointerEvents: 'none',
                            }} />
                        )}
                    </Box>
                }
                sx={{
                    minHeight: 33,
                    minWidth: 100,
                    maxWidth: 200,
                    textTransform: 'none',
                    padding: '6px 12px', // Restore normal padding
                    cursor: isBeingDragged ? 'grabbing' : 'pointer',
                    borderRadius: '0 0 8px 8px', // Round bottom corners for static tabs
                    position: 'relative',
                    transition: isBeingDragged ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: isActive
                        ? theme.palette.primary.main
                        : 'transparent',
                    color: isActive
                        ? theme.palette.primary.contrastText
                        : theme.palette.text.primary,
                    border: isActive ? 'none' : `1px solid ${theme.palette.action.hover}`,
                    boxSizing: 'border-box',
                    '&:hover': {
                        backgroundColor: isActive
                            ? theme.palette.primary.dark
                            : theme.palette.action.hover,
                        cursor: isBeingDragged ? 'grabbing' : 'pointer',
                    },
                    // Remove any margin that might create gaps
                    margin: 0,
                    // Ensure tabs connect seamlessly
                    borderBottom: 'none',
                    // Make entire tab area draggable
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                }}
            />
        )
    }



    const containerRef = useRef(null)

    useEffect(() => {
        if (!onHeightChange) return
        const el = containerRef.current
        if (!el) return
        let lastHeight = el.getBoundingClientRect().height
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const h = entry.contentRect.height
                if (Math.abs(h - lastHeight) > 0.5) {
                    lastHeight = h
                    onHeightChange(h)
                }
            }
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [onHeightChange])

    if (!optimisticCanvases || optimisticCanvases.length === 0) return null

    return (
        <>
            <Box
                ref={containerRef}
                sx={{
                    position: 'fixed',
                    bottom: 3,
                    left: 0,
                    right: 0,
                    backgroundColor: theme.palette.background.default,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 'auto', // Changed from 48 to auto
                    px: 1, // Reduced padding from 2 to 1
                    py: 0 // Explicitly set vertical padding to 0
                }}
            >
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', gap: 0.5 }}>
                    <Box sx={{ flex: '0 1 auto', overflow: 'hidden', maxWidth: 'calc(100% - 40px)' }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={optimisticCanvases.map(canvas => canvas.id)}
                            strategy={horizontalListSortingStrategy}
                        >
                            <Tabs
                                key={`tabs-${forceUpdate}-${activeCanvasId}`}
                                ref={tabsRef}
                                value={activeCanvasId || (optimisticCanvases.length > 0 ? optimisticCanvases[0].id : false)}
                                onChange={handleTabChange}
                                variant="scrollable"
                                scrollButtons={(direction) => {
                                    if (direction === 'left') return scrollState.canScrollLeft
                                    if (direction === 'right') return scrollState.canScrollRight
                                    return false
                                }}
                                slotProps={{ indicator: { style: { transition: 'none' } } }}
                                sx={{
                                    minHeight: 'auto', // Remove fixed height
                                    '& .MuiTabs-indicator': {
                                        height: 3,
                                        backgroundColor: theme.palette.primary.main,
                                        top: 0,
                                        bottom: 'auto'
                                    },
                                    '& .MuiTabs-scroller': {
                                        overflow: 'auto !important'
                                    },
                                    '& .MuiTabs-flexContainer': {
                                        alignItems: 'stretch' // Make tabs stretch to full height
                                    }
                                }}
                            >
                                {optimisticCanvases.map((canvas) => (
                                    <SortableTab
                                        key={canvas.id}
                                        canvas={canvas}
                                        isActive={canvas.id === activeCanvasId}
                                    />
                                ))}
                            </Tabs>
                        </SortableContext>
                        <DragOverlay>
                            {activeId ? (
                                <Tab
                                    sx={{
                                        minHeight: 33,
                                        minWidth: 100,
                                        maxWidth: 200,
                                        textTransform: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '0 0 8px 8px',
                                        backgroundColor: theme.palette.primary.main,
                                        color: theme.palette.primary.contrastText,
                                        boxShadow: theme.shadows[8],
                                        transform: 'rotate(5deg)',
                                    }}
                                    label={optimisticCanvases.find(c => c.id === activeId)?.name || ''}
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                    </Box>

                    {/* Create Canvas button immediately after tabs */}
                    <Tooltip title={t('createCanvas', 'Create Canvas')}>
                        <IconButton
                            onClick={onCanvasCreate}
                            disabled={disabled}
                            size="small"
                            sx={{
                                ml: 0.5,
                                width: 30,
                                height: 30,
                                minWidth: 30,
                                minHeight: 30,
                                borderRadius: '50%',
                                backgroundColor: theme.palette.canvasHeader?.deployLight || theme.palette.action.hover,
                                color: theme.palette.canvasHeader?.deployDark || theme.palette.text.primary,
                                '&:hover': {
                                    backgroundColor: theme.palette.canvasHeader?.deployDark || theme.palette.primary.dark,
                                    color: theme.palette.canvasHeader?.deployLight || theme.palette.primary.contrastText
                                },
                                '&:disabled': { backgroundColor: theme.palette.action.disabled, color: theme.palette.action.disabled }
                            }}
                        >
                            <IconPlus size={16} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Menu
                open={contextMenu !== null}
                onClose={handleContextMenuClose}
                anchorReference="anchorPosition"
                anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
            >
                <MenuItem
                    onClick={handleMoveLeft}
                    disabled={!selectedCanvas || optimisticCanvases.findIndex(c => c.id === selectedCanvas.id) === 0}
                >
                    <IconChevronLeft size={16} style={{ marginRight: 8 }} />
                    Переместить влево
                </MenuItem>
                <MenuItem
                    onClick={handleMoveRight}
                    disabled={!selectedCanvas || optimisticCanvases.findIndex(c => c.id === selectedCanvas.id) === optimisticCanvases.length - 1}
                >
                    <IconChevronRight size={16} style={{ marginRight: 8 }} />
                    Переместить вправо
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleRename}>
                    <IconEdit size={16} style={{ marginRight: 8 }} />
                    {t('rename', 'Rename')}
                </MenuItem>
                <MenuItem onClick={handleDuplicate}>
                    <IconCopy size={16} style={{ marginRight: 8 }} />
                    {t('duplicate', 'Duplicate')}
                </MenuItem>
                <MenuItem onClick={handleDelete} disabled={optimisticCanvases.length <= 1} sx={{ color: optimisticCanvases.length <= 1 ? 'text.disabled' : 'error.main' }}>
                    <IconTrash size={16} style={{ marginRight: 8 }} />
                    {t('common.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <Dialog open={renameDialog} onClose={handleRenameCancel} maxWidth="sm" fullWidth>
                <DialogTitle>{t('rename', 'Rename Canvas')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('name', 'Canvas Name')}
                        fullWidth
                        variant="outlined"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameConfirm()
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleRenameCancel}>{t('common.cancel', 'Cancel')}</Button>
                    <Button onClick={handleRenameConfirm} variant="contained" disabled={!newName.trim()}>
                        {t('common.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

// Prevent re-render unless canvases structure or active id changes
const areEqual = (prev, next) => {
    if (prev.activeCanvasId !== next.activeCanvasId) return false
    if (prev.disabled !== next.disabled) return false
    const a = prev.canvases || []
    const b = next.canvases || []
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        const pa = a[i]
        const pb = b[i]
        if (pa.id !== pb.id || pa.name !== pb.name || (pa.sortOrder || i) !== (pb.sortOrder || i)) return false
    }
    // ignore function prop identity changes intentionally
    return true
}

export default memo(CanvasTabs, areEqual)
