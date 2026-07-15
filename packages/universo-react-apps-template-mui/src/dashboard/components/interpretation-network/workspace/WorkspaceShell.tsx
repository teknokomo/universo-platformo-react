import { useEffect, useMemo, useRef, useState } from 'react'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import {
    INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT,
    INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT,
    INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT
} from '@universo-react/types'
import { readColumnText } from '../model'
import { DetailsPaneBridge, type DetailsPaneBridgeProps } from './DetailsPaneBridge'
import { StructurePane, type StructurePaneProps } from './StructurePane'
import { WorkspaceDialogsBridge, type WorkspaceDialogsBridgeProps } from './WorkspaceDialogsBridge'

const SPLIT_PANE_SEPARATOR_WIDTH = 24

export interface WorkspaceShellProps {
    structure: StructurePaneProps
    details: DetailsPaneBridgeProps
    dialogs: WorkspaceDialogsBridgeProps
    splitPaneEnabled?: boolean
    structureReturnFocusId?: string | null
    onBackToStructureList?: () => void
}

export function WorkspaceShell({
    structure,
    details,
    dialogs,
    splitPaneEnabled = false,
    structureReturnFocusId,
    onBackToStructureList
}: WorkspaceShellProps) {
    const theme = useTheme()
    const desktop = useMediaQuery(theme.breakpoints.up('md'))
    const [leftPercent, setLeftPercent] = useState(INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT)
    const [isDragging, setIsDragging] = useState(false)
    const panesRef = useRef<HTMLDivElement>(null)
    const structureOpenControlsRef = useRef(new Map<string, HTMLElement>())
    const selectedConceptId = structure.selectedConcept?.id
    const selectedTitle = structure.selectedConcept
        ? readColumnText(structure.selectedConcept, structure.conceptColumns, structure.conceptNameField, structure.locale) ||
          structure.t('workspace.untitledConcept', 'Untitled concept')
        : ''

    useEffect(() => {
        if (!selectedConceptId) return
        setLeftPercent(INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT)
    }, [selectedConceptId])

    useEffect(() => {
        if (!isDragging) return
        const update = (event: PointerEvent) => {
            const rect = panesRef.current?.getBoundingClientRect()
            if (!rect || rect.width <= 0) return
            const raw = ((event.clientX - rect.left) / rect.width) * 100
            setLeftPercent(
                Math.min(INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT, Math.max(INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT, raw))
            )
        }
        const stop = () => {
            setIsDragging(false)
        }
        window.addEventListener('pointermove', update)
        window.addEventListener('pointerup', stop)
        return () => {
            window.removeEventListener('pointermove', update)
            window.removeEventListener('pointerup', stop)
        }
    }, [isDragging])

    const registerStructureOpenControl = (structureId: string, element: HTMLElement | null) => {
        if (element) {
            structureOpenControlsRef.current.set(structureId, element)
        } else {
            structureOpenControlsRef.current.delete(structureId)
        }
    }

    const paneSx = useMemo(
        () =>
            splitPaneEnabled && desktop
                ? {
                      flex: `0 0 calc(${leftPercent}% - ${(SPLIT_PANE_SEPARATOR_WIDTH * leftPercent) / 100}px)`,
                      width: `calc(${leftPercent}% - ${(SPLIT_PANE_SEPARATOR_WIDTH * leftPercent) / 100}px)`
                  }
                : undefined,
        [desktop, leftPercent, splitPaneEnabled]
    )

    return (
        <Stack data-testid='interpretation-network-workspace' spacing={2} sx={{ minWidth: 0, width: '100%', pt: 2 }}>
            {structure.selectedConcept ? (
                <Paper variant='outlined' data-testid='interpretation-network-structure-header' sx={{ p: 1.25, borderRadius: 1 }}>
                    <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0 }}>
                        <IconButton
                            type='button'
                            size='small'
                            aria-label={structure.t('workspace.structure.backToList', 'Structures')}
                            onClick={() => {
                                onBackToStructureList?.()
                                window.requestAnimationFrame(() => {
                                    if (structureReturnFocusId) structureOpenControlsRef.current.get(structureReturnFocusId)?.focus()
                                })
                            }}
                        >
                            <ArrowBackRoundedIcon fontSize='small' />
                        </IconButton>
                        <Typography variant='subtitle1' sx={{ minWidth: 0, flex: 1, fontWeight: 700 }} noWrap>
                            {selectedTitle}
                        </Typography>
                        {splitPaneEnabled && desktop ? (
                            <Button
                                type='button'
                                size='small'
                                color='inherit'
                                startIcon={<RestartAltRoundedIcon />}
                                onClick={() => setLeftPercent(INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT)}
                            >
                                {structure.t('workspace.splitPane.reset', 'Reset panes')}
                            </Button>
                        ) : null}
                    </Stack>
                </Paper>
            ) : null}
            <Stack
                ref={panesRef}
                data-testid='interpretation-network-panes'
                direction={{ xs: 'column', md: 'row' }}
                spacing={splitPaneEnabled && desktop ? 0 : 2}
                sx={{ minWidth: 0, alignItems: 'stretch' }}
            >
                <StructurePane {...structure} hideSelectedHeader paneSx={paneSx} onStructureOpenControl={registerStructureOpenControl} />
                {splitPaneEnabled && desktop ? (
                    <Stack
                        component='div'
                        role='separator'
                        aria-label={structure.t('workspace.splitPane.resize', 'Resize structure and details panes')}
                        aria-orientation='vertical'
                        aria-valuemin={INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT}
                        aria-valuemax={INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT}
                        aria-valuenow={Math.round(leftPercent)}
                        aria-controls='interpretation-network-structure-pane interpretation-network-details-container'
                        tabIndex={0}
                        data-testid='interpretation-network-pane-separator'
                        onPointerDown={(event) => {
                            if (!event.isPrimary || event.button !== 0) return
                            event.preventDefault()
                            setIsDragging(true)
                            ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
                        }}
                        onPointerCancel={() => setIsDragging(false)}
                        onLostPointerCapture={() => setIsDragging(false)}
                        onKeyDown={(event) => {
                            const step = event.shiftKey ? 10 : 5
                            const next =
                                event.key === 'ArrowLeft'
                                    ? leftPercent - step
                                    : event.key === 'ArrowRight'
                                    ? leftPercent + step
                                    : event.key === 'Home'
                                    ? INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT
                                    : event.key === 'End'
                                    ? INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT
                                    : null
                            if (next === null) return
                            event.preventDefault()
                            setLeftPercent(
                                Math.min(
                                    INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT,
                                    Math.max(INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT, next)
                                )
                            )
                        }}
                        sx={{
                            flex: `0 0 ${SPLIT_PANE_SEPARATOR_WIDTH}px`,
                            width: SPLIT_PANE_SEPARATOR_WIDTH,
                            cursor: 'col-resize',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&::before': { content: '""', height: '100%', borderLeft: 1, borderColor: 'divider' },
                            '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 }
                        }}
                    />
                ) : null}
                <Stack id='interpretation-network-details-container' sx={{ flex: '1 1 0%', minWidth: 0 }}>
                    <DetailsPaneBridge {...details} />
                </Stack>
            </Stack>
            <WorkspaceDialogsBridge {...dialogs} />
        </Stack>
    )
}
