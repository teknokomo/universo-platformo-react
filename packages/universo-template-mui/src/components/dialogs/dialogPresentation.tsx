import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { DialogProps, SxProps, Theme } from '@mui/material'
import { Box, IconButton, Stack, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import type { DialogCloseBehavior, DialogSizePreset } from '@universo/types'

type DialogMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false

export interface DialogPresentationActionLabels {
    resetSize?: string
    expand?: string
    restoreSize?: string
    resizeHandle?: string
}

export interface DialogPresentationContextValue {
    enabled?: boolean
    sizePreset?: DialogSizePreset
    allowFullscreen?: boolean
    allowResize?: boolean
    closeBehavior?: DialogCloseBehavior
    storageScopeKey?: string | null
    titleActionLabels?: DialogPresentationActionLabels
}

interface StoredDialogSize {
    width: number
    height: number
}

interface ResizeState {
    startX: number
    startY: number
    startWidth: number
    startHeight: number
}

export interface DialogPresentationHookOptions {
    open: boolean
    onClose: NonNullable<DialogProps['onClose']> | (() => void)
    fallbackMaxWidth?: DialogMaxWidth
    isBusy?: boolean
}

export interface DialogPresentationResolvedDialogProps {
    onClose: NonNullable<DialogProps['onClose']>
    maxWidth: DialogMaxWidth
    fullWidth: NonNullable<DialogProps['fullWidth']>
    PaperProps: DialogProps['PaperProps']
    disableEscapeKeyDown: NonNullable<DialogProps['disableEscapeKeyDown']>
}

export interface DialogPresentationHookResult {
    enabled: boolean
    dialogProps: DialogPresentationResolvedDialogProps
    titleActions: ReactNode | null
    resizeHandle: ReactNode | null
    contentSx: Record<string, unknown> | undefined
}

const PRESET_WIDTHS: Record<DialogSizePreset, number> = {
    small: 480,
    medium: 600,
    large: 800
}

const VIEWPORT_MARGIN_DESKTOP = 16
const VIEWPORT_MARGIN_MOBILE = 12
const MIN_WIDTH = 360
const MIN_HEIGHT = 260
const STORAGE_PREFIX = 'universo:dialog-presentation:'
const BLOCKED_CLOSE_FEEDBACK_DURATION_MS = 320
const DIALOG_MAX_WIDTHS = ['xs', 'sm', 'md', 'lg', 'xl'] as const

const DEFAULT_TITLE_ACTION_LABELS: Required<DialogPresentationActionLabels> = {
    resetSize: 'Reset dialog size',
    expand: 'Expand dialog',
    restoreSize: 'Restore dialog size',
    resizeHandle: 'Resize dialog'
}

const DEFAULT_PRESENTATION: Required<Omit<DialogPresentationContextValue, 'storageScopeKey'>> & { storageScopeKey: string | null } = {
    enabled: false,
    sizePreset: 'medium',
    allowFullscreen: false,
    allowResize: false,
    closeBehavior: 'backdrop-close',
    storageScopeKey: null,
    titleActionLabels: DEFAULT_TITLE_ACTION_LABELS
}

const DialogPresentationContext = createContext(DEFAULT_PRESENTATION)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const resolveDialogMaxWidth = (value: unknown, fallback: DialogMaxWidth = 'sm'): DialogMaxWidth => {
    if (value === false) {
        return false
    }

    if (typeof value === 'string' && (DIALOG_MAX_WIDTHS as readonly string[]).includes(value)) {
        return value as Exclude<DialogMaxWidth, false>
    }

    return fallback
}

const applyRef = (ref: unknown, value: HTMLDivElement | null) => {
    if (typeof ref === 'function') {
        ref(value)
        return
    }

    if (ref && typeof ref === 'object' && 'current' in ref) {
        ;(ref as { current: HTMLDivElement | null }).current = value
    }
}

export const mergeDialogSx = (...parts: Array<SxProps<Theme> | undefined>): SxProps<Theme> | undefined => {
    const merged = parts.flatMap((part) => {
        if (!part) return []
        return Array.isArray(part) ? part : [part]
    })

    return merged.length > 0 ? merged : undefined
}

export const mergeDialogPaperProps = (
    baseProps?: DialogProps['PaperProps'],
    overrideProps?: DialogProps['PaperProps']
): DialogProps['PaperProps'] => ({
    ...baseProps,
    ...overrideProps,
    ref: (node: HTMLDivElement | null) => {
        applyRef(baseProps?.ref, node)
        applyRef(overrideProps?.ref, node)
    },
    sx: mergeDialogSx(baseProps?.sx, overrideProps?.sx)
})

const getStorageKey = (scopeKey: string | null) => `${STORAGE_PREFIX}${scopeKey ?? 'global'}:size`

const readStoredDialogSize = (storageKey: string): StoredDialogSize | null => {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<StoredDialogSize>
        if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
            return null
        }

        return {
            width: parsed.width,
            height: parsed.height
        }
    } catch {
        return null
    }
}

const persistStoredDialogSize = (storageKey: string, size: StoredDialogSize | null) => {
    if (typeof window === 'undefined') return

    try {
        if (!size) {
            window.localStorage.removeItem(storageKey)
            return
        }

        window.localStorage.setItem(storageKey, JSON.stringify(size))
    } catch {
        // Ignore storage failures in private mode or constrained environments.
    }
}

export function DialogPresentationProvider({ value, children }: { value: DialogPresentationContextValue; children: ReactNode }) {
    const merged = useMemo(
        () => ({
            ...DEFAULT_PRESENTATION,
            ...value,
            titleActionLabels: {
                ...DEFAULT_TITLE_ACTION_LABELS,
                ...value.titleActionLabels
            },
            enabled: value.enabled === true
        }),
        [value]
    )

    return <DialogPresentationContext.Provider value={merged}>{children}</DialogPresentationContext.Provider>
}

export function useDialogPresentationContext() {
    return useContext(DialogPresentationContext)
}

export function useDialogPresentation({
    open,
    onClose,
    fallbackMaxWidth = 'sm',
    isBusy = false
}: DialogPresentationHookOptions): DialogPresentationHookResult {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const presentation = useDialogPresentationContext()
    const enabled = presentation.enabled === true
    const allowResize = enabled && presentation.allowResize === true && !isMobile
    const allowFullscreen = enabled && presentation.allowFullscreen === true
    const titleActionLabels = presentation.titleActionLabels ?? DEFAULT_TITLE_ACTION_LABELS
    const presetWidth = PRESET_WIDTHS[presentation.sizePreset ?? 'medium']
    const viewportMargin = isMobile ? VIEWPORT_MARGIN_MOBILE : VIEWPORT_MARGIN_DESKTOP
    const storageKey = useMemo(() => getStorageKey(presentation.storageScopeKey ?? null), [presentation.storageScopeKey])

    const paperNodeRef = useRef<HTMLDivElement | null>(null)
    const resizeStateRef = useRef<ResizeState | null>(null)
    const pendingSizeRef = useRef<StoredDialogSize | null>(null)
    const blockedCloseFeedbackTimeoutRef = useRef<number | null>(null)

    const [isFullscreen, setIsFullscreen] = useState(false)
    const [customSize, setCustomSize] = useState<StoredDialogSize | null>(null)
    const [isResizing, setIsResizing] = useState(false)
    const [showBlockedCloseFeedback, setShowBlockedCloseFeedback] = useState(false)

    const clearResizeDocumentState = useCallback(() => {
        if (typeof document === 'undefined') return

        document.body.style.userSelect = ''
        document.body.style.cursor = ''
    }, [])

    const clearBlockedCloseFeedbackTimeout = useCallback(() => {
        if (typeof window === 'undefined' || blockedCloseFeedbackTimeoutRef.current === null) {
            return
        }

        window.clearTimeout(blockedCloseFeedbackTimeoutRef.current)
        blockedCloseFeedbackTimeoutRef.current = null
    }, [])

    const triggerBlockedCloseFeedback = useCallback(() => {
        clearBlockedCloseFeedbackTimeout()
        setShowBlockedCloseFeedback(true)

        if (typeof window === 'undefined') {
            return
        }

        blockedCloseFeedbackTimeoutRef.current = window.setTimeout(() => {
            blockedCloseFeedbackTimeoutRef.current = null
            setShowBlockedCloseFeedback(false)
        }, BLOCKED_CLOSE_FEEDBACK_DURATION_MS)
    }, [clearBlockedCloseFeedbackTimeout])

    useEffect(() => {
        if (!open) {
            setIsFullscreen(false)
            resizeStateRef.current = null
            pendingSizeRef.current = null
            setIsResizing(false)
            setShowBlockedCloseFeedback(false)
            clearBlockedCloseFeedbackTimeout()
            clearResizeDocumentState()
            return
        }

        if (allowResize) {
            setCustomSize(readStoredDialogSize(storageKey))
            return
        }

        setCustomSize(null)
    }, [allowResize, clearBlockedCloseFeedbackTimeout, clearResizeDocumentState, open, storageKey])

    useEffect(() => {
        return () => {
            clearBlockedCloseFeedbackTimeout()
            clearResizeDocumentState()
        }
    }, [clearBlockedCloseFeedbackTimeout, clearResizeDocumentState])

    const handleClose = useCallback<NonNullable<DialogProps['onClose']>>(
        (_event, reason) => {
            if (isBusy) return

            if (enabled && presentation.closeBehavior === 'strict-modal' && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
                triggerBlockedCloseFeedback()
                return
            }

            ;(onClose as (...args: [unknown?, unknown?]) => void)(_event, reason)
        },
        [enabled, isBusy, onClose, presentation.closeBehavior, triggerBlockedCloseFeedback]
    )

    const setPaperNode = useCallback((node: HTMLDivElement | null) => {
        paperNodeRef.current = node
    }, [])

    const clearCustomSize = useCallback(() => {
        setCustomSize(null)
        pendingSizeRef.current = null
        persistStoredDialogSize(storageKey, null)
    }, [storageKey])

    const finishResize = useCallback(() => {
        const nextSize = pendingSizeRef.current
        resizeStateRef.current = null
        pendingSizeRef.current = null
        setIsResizing(false)
        clearResizeDocumentState()

        if (!nextSize) return

        setCustomSize(nextSize)
        persistStoredDialogSize(storageKey, nextSize)
    }, [clearResizeDocumentState, storageKey])

    useEffect(() => {
        if (!isResizing || !resizeStateRef.current) return undefined

        const handleMouseMove = (event: globalThis.MouseEvent) => {
            const state = resizeStateRef.current
            if (!state) return

            const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - viewportMargin * 2)
            const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - viewportMargin * 2)

            const nextSize = {
                width: clamp(state.startWidth + (event.clientX - state.startX), MIN_WIDTH, maxWidth),
                height: clamp(state.startHeight + (event.clientY - state.startY), MIN_HEIGHT, maxHeight)
            }

            pendingSizeRef.current = nextSize
            setCustomSize(nextSize)
        }

        const handleMouseUp = () => finishResize()

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [finishResize, isResizing, viewportMargin])

    const handleResizeMouseDown = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            if (!allowResize || isFullscreen || isBusy) return

            const paperNode = paperNodeRef.current
            if (!paperNode) return

            event.preventDefault()
            event.stopPropagation()

            const rect = paperNode.getBoundingClientRect()
            resizeStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                startWidth: rect.width,
                startHeight: rect.height
            }
            pendingSizeRef.current = {
                width: rect.width,
                height: rect.height
            }
            setIsResizing(true)

            if (typeof document !== 'undefined') {
                document.body.style.userSelect = 'none'
                document.body.style.cursor = 'nwse-resize'
            }
        },
        [allowResize, isBusy, isFullscreen]
    )

    const hasCustomSize = Boolean(customSize)

    const paperSx = useMemo(() => {
        if (!enabled) {
            return { borderRadius: 1 }
        }

        const viewportWidth = `calc(100vw - ${viewportMargin * 2}px)`
        const viewportHeight = `calc(100dvh - ${viewportMargin * 2}px)`
        const resolvedWidth = customSize?.width ?? presetWidth
        const resolvedHeight = customSize?.height

        return {
            borderRadius: 1,
            position: 'relative',
            overflow: 'hidden',
            margin: `${viewportMargin}px`,
            outline: showBlockedCloseFeedback ? `2px solid ${theme.palette.warning.main}` : '2px solid transparent',
            outlineOffset: -2,
            transition: theme.transitions.create(['outline-color', 'box-shadow'], {
                duration: theme.transitions.duration.shorter
            }),
            ...(showBlockedCloseFeedback
                ? {
                      boxShadow: theme.shadows[12]
                  }
                : {}),
            ...(showBlockedCloseFeedback
                ? {
                      animation: 'dialogBlockedClosePulse 220ms ease-out',
                      '@keyframes dialogBlockedClosePulse': {
                          '0%': {
                              transform: 'scale(0.992)'
                          },
                          '100%': {
                              transform: 'scale(1)'
                          }
                      }
                  }
                : {}),
            width: isFullscreen ? viewportWidth : `min(${viewportWidth}, ${resolvedWidth}px)`,
            maxWidth: isFullscreen ? viewportWidth : `min(${viewportWidth}, ${resolvedWidth}px)`,
            maxHeight: viewportHeight,
            ...(isFullscreen
                ? {
                      height: viewportHeight
                  }
                : resolvedHeight
                ? {
                      height: `min(${viewportHeight}, ${resolvedHeight}px)`
                  }
                : {})
        }
    }, [customSize, enabled, isFullscreen, presetWidth, showBlockedCloseFeedback, theme, viewportMargin])

    const titleActions = useMemo(() => {
        if (!enabled) return null

        return (
            <Stack direction='row' spacing={0.5} alignItems='center' sx={{ mr: -1 }}>
                {allowResize && hasCustomSize ? (
                    <Tooltip title={titleActionLabels.resetSize}>
                        <span>
                            <IconButton size='small' onClick={clearCustomSize} data-testid='dialog-reset-size' disabled={isBusy}>
                                <RestartAltIcon fontSize='small' />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}
                {allowFullscreen ? (
                    <Tooltip title={isFullscreen ? titleActionLabels.restoreSize : titleActionLabels.expand}>
                        <span>
                            <IconButton
                                size='small'
                                onClick={() => setIsFullscreen((prev) => !prev)}
                                data-testid='dialog-toggle-fullscreen'
                                disabled={isBusy}
                            >
                                {isFullscreen ? <CloseFullscreenIcon fontSize='small' /> : <OpenInFullIcon fontSize='small' />}
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}
            </Stack>
        )
    }, [allowFullscreen, allowResize, clearCustomSize, enabled, hasCustomSize, isBusy, isFullscreen, titleActionLabels])

    const resizeHandle =
        enabled && allowResize && !isFullscreen ? (
            <Box
                role='button'
                aria-label={titleActionLabels.resizeHandle}
                data-testid='dialog-resize-handle'
                onMouseDown={handleResizeMouseDown}
                sx={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    width: 18,
                    height: 18,
                    cursor: 'nwse-resize',
                    borderBottom: (theme) => `2px solid ${theme.palette.divider}`,
                    borderRight: (theme) => `2px solid ${theme.palette.divider}`,
                    opacity: 0.9,
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        right: 3,
                        bottom: 3,
                        width: 8,
                        height: 8,
                        borderBottom: (theme) => `2px solid ${theme.palette.divider}`,
                        borderRight: (theme) => `2px solid ${theme.palette.divider}`
                    }
                }}
            />
        ) : null

    return {
        enabled,
        dialogProps: {
            onClose: handleClose,
            maxWidth: enabled ? false : fallbackMaxWidth,
            fullWidth: enabled ? false : true,
            disableEscapeKeyDown: enabled && presentation.closeBehavior === 'strict-modal',
            PaperProps: {
                ref: setPaperNode,
                'data-dialog-attention': showBlockedCloseFeedback ? 'active' : 'idle',
                sx: paperSx
            }
        },
        titleActions,
        resizeHandle,
        contentSx: enabled
            ? {
                  overflowX: 'hidden'
              }
            : undefined
    }
}
