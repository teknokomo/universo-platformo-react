import { useEffect, useMemo, useRef, type MouseEvent, type RefObject } from 'react'
import Drawer, { drawerClasses } from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import MenuContent from './MenuContent'
import { renderWidget } from './widgetRenderer'
import type { DashboardMenuSlot, DashboardMenusMap, ZoneWidgets } from '../Dashboard'

interface SideMenuMobileProps {
    open: boolean | undefined
    drawerId?: string
    restoreFocusRef?: RefObject<HTMLButtonElement | null>
    toggleDrawer: (newOpen: boolean) => () => void
    /** @deprecated Use `menus` map instead. */
    menu?: DashboardMenuSlot
    menus?: DashboardMenusMap
    zoneWidgets?: ZoneWidgets
}

export default function SideMenuMobile({ open, drawerId, restoreFocusRef, toggleDrawer, menu, menus, zoneWidgets }: SideMenuMobileProps) {
    // Resolve effective menu for mobile: first from menus map (sorted by widget ID for stability), or fallback to legacy menu prop
    const firstEntry = menus ? Object.values(menus).find((slot) => (slot?.items ?? []).length > 0) : undefined
    const effectiveMenu = firstEntry ?? menu
    const leftWidgets = zoneWidgets?.left ?? []
    const hasMenuWidget = leftWidgets.some((widget) => widget.widgetKey === 'menuWidget')
    const menuSlots = useMemo(() => [effectiveMenu, ...Object.values(menus ?? {})].filter(Boolean), [effectiveMenu, menus])
    const navigableMenuLabels = useMemo(
        () => new Set(menuSlots.flatMap((slot) => slot?.items ?? []).map((item) => item.label)),
        [menuSlots]
    )
    const overflowMenuLabels = useMemo(
        () => new Set(menuSlots.flatMap((slot) => slot?.overflowItems ?? []).map((item) => item.label)),
        [menuSlots]
    )
    const wasOpenRef = useRef(Boolean(open))

    useEffect(() => {
        if (wasOpenRef.current && !open) {
            const trigger = restoreFocusRef?.current
            if (trigger?.isConnected && !trigger.disabled) trigger.focus()
        }
        wasOpenRef.current = Boolean(open)
    }, [open, restoreFocusRef])

    useEffect(() => {
        if (!open || overflowMenuLabels.size === 0 || typeof document === 'undefined') return undefined

        const closeAfterOverflowNavigation = (event: globalThis.MouseEvent) => {
            const target = event.target as HTMLElement | null
            const menuItem = target?.closest<HTMLElement>('[role="menuitem"]')
            if (!menuItem || !overflowMenuLabels.has(menuItem.textContent?.trim() ?? '')) return

            toggleDrawer(false)()
        }

        document.addEventListener('click', closeAfterOverflowNavigation)
        return () => document.removeEventListener('click', closeAfterOverflowNavigation)
    }, [open, overflowMenuLabels, toggleDrawer])

    const handleNavigationClick = (event: MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement | null
        const interactive = target?.closest<HTMLElement>('a[href], button, [role="button"]')
        if (!interactive || interactive.closest('nav') === null) return
        if (interactive.hasAttribute('disabled') || interactive.getAttribute('aria-disabled') === 'true') return
        if (!interactive.matches('a[href]') && !navigableMenuLabels.has(interactive.getAttribute('aria-label') ?? '')) return

        toggleDrawer(false)()
    }

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
            <Stack
                onClick={handleNavigationClick}
                sx={{
                    maxWidth: '70dvw',
                    minWidth: 240,
                    height: '100%'
                }}
            >
                <Stack sx={{ flexGrow: 1 }}>
                    {hasMenuWidget ? null : <MenuContent menu={effectiveMenu} />}
                    {leftWidgets.length > 0 ? (
                        <Box sx={{ flexShrink: 0 }}>{leftWidgets.map((widget) => renderWidget(widget, menus, menu))}</Box>
                    ) : null}
                </Stack>
            </Stack>
        </Drawer>
    )
}
