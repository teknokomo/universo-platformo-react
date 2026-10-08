import { useEffect, useRef, type RefObject } from 'react'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { renderWidget } from './widgetRenderer'
import type { ZoneWidgets } from '../contracts'
import type { RuntimePlacement } from '../runtime/widgetPlacementGraph'

interface SideMenuMobileProps {
    open: boolean | undefined
    drawerId?: string
    restoreFocusRef?: RefObject<HTMLButtonElement | null>
    toggleDrawer: (newOpen: boolean) => () => void
    zoneWidgets?: ZoneWidgets
    placements?: readonly RuntimePlacement[]
}

export default function SideMenuMobile({
    open,
    drawerId,
    restoreFocusRef,
    toggleDrawer,
    zoneWidgets,
    placements = []
}: SideMenuMobileProps) {
    const leftWidgets = zoneWidgets?.left ?? []
    const wasOpenRef = useRef(Boolean(open))

    useEffect(() => {
        if (wasOpenRef.current && !open) {
            const trigger = restoreFocusRef?.current
            if (trigger?.isConnected && !trigger.disabled) trigger.focus()
        }
        wasOpenRef.current = Boolean(open)
    }, [open, restoreFocusRef])

    useEffect(() => {
        if (!open || typeof document === 'undefined') return undefined

        const closeAfterRuntimeNavigation = (event: globalThis.MouseEvent) => {
            const target = event.target as HTMLElement | null
            if (!target?.closest<HTMLElement>('[data-runtime-navigation-link]')) return
            toggleDrawer(false)()
        }

        document.addEventListener('click', closeAfterRuntimeNavigation)
        return () => document.removeEventListener('click', closeAfterRuntimeNavigation)
    }, [open, toggleDrawer])

    return (
        <Drawer
            // Intentionally anchored to 'left' — the right side is now served by SideMenuMobileRight.
            // Before the right drawer was introduced, this was anchored to 'right'.
            anchor='left'
            open={open}
            onClose={toggleDrawer(false)}
            slotProps={{ root: { id: drawerId, keepMounted: true } }}
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                [`& .${drawerClasses.paper}`]: {
                    backgroundImage: 'none',
                    backgroundColor: 'background.paper'
                }
            }}
        >
            <Stack sx={{ maxWidth: '70dvw', minWidth: 240, height: '100%' }}>
                <Stack sx={{ flexGrow: 1 }}>
                    {leftWidgets.length > 0 ? (
                        <Box sx={{ flexShrink: 0 }}>{leftWidgets.map((widget) => renderWidget(widget, { placements }))}</Box>
                    ) : null}
                </Stack>
            </Stack>
        </Drawer>
    )
}
