import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useTranslation } from 'react-i18next'
import { resolvePublicMessengerAttribution, type MessengerZoneWidgets } from '../api/api'
import { AuthenticatedRuntimePlacementScopeProvider } from '../dashboard/AuthenticatedRuntimePlacementScopeContext'
import { DashboardDetailsProvider } from '../dashboard/DashboardDetailsContext'
import type { AuthenticatedRuntimePlacementScopes, DashboardDetailsSlot } from '../dashboard/contracts'
import type { RuntimePlacement } from '../dashboard/runtime/widgetPlacementGraph'
import { renderWidget } from '../dashboard/components/widgetRenderer'
import PageBlocksView from '../dashboard/components/PageBlocksView'
import { loadMessengerBridgeScript } from './bridgeScriptLoader'
import { getMaxMessengerBridge, type MaxMessengerBridge } from './bridges/max'
import { getTelegramMessengerBridge, type TelegramMessengerBridge } from './bridges/telegram'
import { detectMessengerLaunchPlatform, readMessengerLaunchHint, type MessengerLaunchPlatform } from './launchHints'

type MessengerBridge = TelegramMessengerBridge | MaxMessengerBridge
const MESSENGER_HISTORY_INDEX_KEY = '__universoMessengerHistoryIndex'
const CSS_DIMENSION_PATTERN = /^(\d+(?:\.\d+)?|\.\d+)(px|%|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw|vh|vw|rem|em|ch|ex|cm|mm|q|in|pt|pc)$/i

const isValidViewportDimension = (value: unknown): value is string => {
    if (typeof value !== 'string') return false
    const match = CSS_DIMENSION_PATTERN.exec(value.trim())
    return Boolean(match && Number.isFinite(Number(match[1])) && Number(match[1]) > 0)
}

const readMaxViewportHeight = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const viewport = value as Record<string, unknown>
    if (!isValidViewportDimension(viewport.width) || !isValidViewportDimension(viewport.height)) return undefined
    return viewport.height.trim()
}

const getMessengerBridgeForPlatform = (platform: MessengerLaunchPlatform | null): MessengerBridge | undefined => {
    if (platform === 'telegram') return getTelegramMessengerBridge()
    if (platform === 'max') return getMaxMessengerBridge()
    return getTelegramMessengerBridge() ?? getMaxMessengerBridge()
}

const readMessengerHistoryIndex = (state: unknown): number | null => {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null
    const index = (state as Record<string, unknown>)[MESSENGER_HISTORY_INDEX_KEY]
    return typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 ? index : null
}

const writeMessengerHistoryIndex = (index: number): void => {
    const currentState = window.history.state
    const state = currentState && typeof currentState === 'object' && !Array.isArray(currentState) ? currentState : {}
    window.history.replaceState({ ...state, [MESSENGER_HISTORY_INDEX_KEY]: index }, '', window.location.href)
}

export interface MessengerRuntimeShellProps {
    zones: MessengerZoneWidgets
    details: DashboardDetailsSlot
    placementScopes?: AuthenticatedRuntimePlacementScopes
    onBack?: () => void
    /** Use `div` when the embedding host already supplies the page's main landmark. */
    rootElement?: 'main' | 'div'
    onViewportHeightChange?: (height: string | undefined) => void
    children?: ReactNode
}

const selectRoots = (placements: readonly RuntimePlacement[]) =>
    placements.filter((placement) => placement.isActive && placement.parentInstanceKey === null)

/** Thin Messenger presentation shell over the existing runtime widget renderer. */
export function MessengerRuntimeShell({
    zones,
    details,
    placementScopes,
    onBack,
    rootElement = 'main',
    onViewportHeightChange,
    children
}: MessengerRuntimeShellProps) {
    const { t } = useTranslation('apps')
    const [bridge, setBridge] = useState<MessengerBridge | undefined>()
    const [bridgeReady, setBridgeReady] = useState(false)
    const [maxViewportHeight, setMaxViewportHeight] = useState<string | undefined>()
    const [resolvedLaunch, setResolvedLaunch] = useState<{ applicationRef: string; platform: MessengerLaunchPlatform } | null>(null)
    const closeBridge = bridge?.platform === 'telegram' ? bridge.close : undefined
    const getMaxViewportSize = bridge?.platform === 'max' ? bridge.getViewportSize : undefined
    const [canGoBack, setCanGoBack] = useState(false)
    const navigationDepthRef = useRef(0)
    const placements = useMemo(() => [...zones.top, ...zones.center, ...zones.bottom], [zones])
    const navigateTo = details.navigate
    const launchPlatform =
        details.runtimeAccessMode === 'public' && resolvedLaunch !== null && resolvedLaunch.applicationRef === details.applicationId
            ? resolvedLaunch.platform
            : null
    const navigate = useCallback(
        (href: string) => {
            if (typeof window !== 'undefined') {
                try {
                    if (new URL(href, window.location.href).href === window.location.href) return
                } catch {
                    return
                }
            }
            navigateTo?.(href)
            const currentIndex = readMessengerHistoryIndex(window.history.state)
            const nextIndex = Math.max(currentIndex ?? 0, navigationDepthRef.current) + 1
            try {
                writeMessengerHistoryIndex(nextIndex)
            } catch {
                // The route has already changed; keep the bridge usable if host history state cannot be extended.
            }
            navigationDepthRef.current = nextIndex
            setCanGoBack(true)
        },
        [navigateTo]
    )
    const shellDetails = useMemo(() => {
        const runtimeDetails = details.navigate ? { ...details, navigate } : details
        return {
            ...runtimeDetails,
            runtimeTemplateKey: 'messenger-app' as const,
            ...(details.runtimeAccessMode === 'public'
                ? { messengerLaunchAttribution: launchPlatform ? { platform: launchPlatform } : null }
                : {})
        }
    }, [details, launchPlatform, navigate])
    const handleBack = useCallback(() => {
        if (onBack) {
            onBack()
            return
        }
        if (typeof window !== 'undefined') window.history.back()
    }, [onBack])

    useEffect(() => {
        if (typeof window === 'undefined') return undefined
        setBridgeReady(false)
        const initialIndex = readMessengerHistoryIndex(window.history.state) ?? 0
        try {
            writeMessengerHistoryIndex(initialIndex)
        } catch {
            // History tracking remains best effort in hosts that disallow replaceState.
        }
        navigationDepthRef.current = initialIndex
        setCanGoBack(initialIndex > 0)
        const launchPlatform = details.runtimeAccessMode === 'public' ? detectMessengerLaunchPlatform() : null
        const detectedBridge = getMessengerBridgeForPlatform(launchPlatform)
        setBridge(detectedBridge)
        let ignoreBridgeResult = false
        if (detectedBridge || !launchPlatform) {
            setBridgeReady(true)
        } else {
            void loadMessengerBridgeScript(launchPlatform)
                .then(() => {
                    if (ignoreBridgeResult) return
                    setBridge(getMessengerBridgeForPlatform(launchPlatform))
                })
                .catch(() => {
                    if (!ignoreBridgeResult) setBridge(undefined)
                })
                .finally(() => {
                    if (!ignoreBridgeResult) setBridgeReady(true)
                })
        }
        const updateHistoryState = () => {
            navigationDepthRef.current = readMessengerHistoryIndex(window.history.state) ?? 0
            setCanGoBack(navigationDepthRef.current > 0)
        }
        window.addEventListener('popstate', updateHistoryState)
        return () => {
            ignoreBridgeResult = true
            window.removeEventListener('popstate', updateHistoryState)
        }
    }, [details.runtimeAccessMode])

    useEffect(() => {
        setResolvedLaunch(null)
        if (!bridgeReady) return undefined
        const applicationRef = details.applicationId
        if (details.runtimeAccessMode !== 'public' || !applicationRef) return undefined

        const launchHint = readMessengerLaunchHint()
        if (!launchHint) return undefined

        let ignoreResult = false
        const controller = new AbortController()
        void resolvePublicMessengerAttribution(applicationRef, launchHint.shortId, controller.signal)
            .then((platform) => {
                if (!ignoreResult && platform) setResolvedLaunch({ applicationRef, platform })
            })
            .catch(() => {
                // Attribution is optional; an unavailable resolver keeps the ordinary public runtime usable.
            })

        return () => {
            ignoreResult = true
            controller.abort()
        }
    }, [bridgeReady, details.applicationId, details.runtimeAccessMode])

    useEffect(() => {
        const button = bridge?.backButton
        if (!button || !canGoBack) return undefined
        button.onClick(handleBack)
        button.show()
        return () => {
            button.offClick(handleBack)
            button.hide()
        }
    }, [bridge, canGoBack, handleBack])

    useEffect(() => {
        setMaxViewportHeight(undefined)
        onViewportHeightChange?.(undefined)
        if (!getMaxViewportSize || typeof window === 'undefined') return undefined

        let active = true
        let requestSequence = 0
        const updateViewportHeight = () => {
            const currentRequest = ++requestSequence
            void Promise.resolve()
                .then(() => getMaxViewportSize())
                .then((viewport) => {
                    if (!active || currentRequest !== requestSequence) return
                    const height = readMaxViewportHeight(viewport)
                    setMaxViewportHeight(height)
                    onViewportHeightChange?.(height)
                })
                .catch(() => {
                    if (!active || currentRequest !== requestSequence) return
                    setMaxViewportHeight(undefined)
                    onViewportHeightChange?.(undefined)
                })
        }

        const visualViewport = window.visualViewport
        updateViewportHeight()
        window.addEventListener('resize', updateViewportHeight)
        window.addEventListener('orientationchange', updateViewportHeight)
        visualViewport?.addEventListener('resize', updateViewportHeight)

        return () => {
            active = false
            requestSequence += 1
            window.removeEventListener('resize', updateViewportHeight)
            window.removeEventListener('orientationchange', updateViewportHeight)
            visualViewport?.removeEventListener('resize', updateViewportHeight)
            onViewportHeightChange?.(undefined)
        }
    }, [getMaxViewportSize, onViewportHeightChange])

    const renderedZones = useMemo(
        () =>
            (['top', 'center', 'bottom'] as const).map((zone) => ({
                zone,
                content:
                    details.contentMode === 'page' && (zone === 'center' || zone === 'bottom')
                        ? []
                        : selectRoots(zones[zone]).map((widget) => ({
                              key: widget.instanceKey,
                              element: renderWidget(widget, { placements })
                          }))
            })),
        [details.contentMode, placements, zones]
    )
    const hostContent =
        details.content ??
        (details.pageBlocks?.length ? (
            <PageBlocksView
                blocks={details.pageBlocks}
                showOutline={details.pagePlayer?.showOutline}
                showProgressHeader={details.pagePlayer?.showProgressHeader}
                completeButtonMode={details.pagePlayer?.completeButtonMode}
                progressStorageKey={details.pagePlayer?.progressStorageKey}
                onProgressChange={details.pagePlayer?.onProgressChange}
            />
        ) : null)

    return (
        <DashboardDetailsProvider value={shellDetails}>
            <AuthenticatedRuntimePlacementScopeProvider value={placementScopes}>
                <Box
                    component={rootElement}
                    data-testid='messenger-runtime-shell'
                    style={maxViewportHeight ? ({ '--max-viewport-height': maxViewportHeight } as CSSProperties) : undefined}
                    sx={(theme) => ({
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        maxWidth: '100vw',
                        minWidth: 0,
                        minHeight: 'var(--max-viewport-height, var(--tg-viewport-stable-height, var(--tg-viewport-height, 100vh)))',
                        '@supports (height: 100dvh)': {
                            minHeight: 'var(--max-viewport-height, var(--tg-viewport-stable-height, var(--tg-viewport-height, 100dvh)))'
                        },
                        boxSizing: 'border-box',
                        overflowX: 'hidden',
                        color: 'text.primary',
                        bgcolor: 'background.default',
                        pt: 'var(--tg-content-safe-area-inset-top, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)))',
                        pb: 'var(--tg-content-safe-area-inset-bottom, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))',
                        pl: 'var(--tg-content-safe-area-inset-left, var(--tg-safe-area-inset-left, env(safe-area-inset-left, 0px)))',
                        pr: 'var(--tg-content-safe-area-inset-right, var(--tg-safe-area-inset-right, env(safe-area-inset-right, 0px)))',
                        [theme.breakpoints.up('sm')]: { maxWidth: '100%' }
                    })}
                >
                    {(canGoBack || closeBridge) && (
                        <Box
                            component='nav'
                            aria-label={t('messenger.navigation', 'Application navigation')}
                            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, px: 1 }}
                        >
                            {canGoBack ? (
                                bridge?.backButton ? (
                                    <Box />
                                ) : (
                                    <Button size='small' startIcon={<ArrowBackRoundedIcon />} onClick={handleBack}>
                                        {t('messenger.back', 'Back')}
                                    </Button>
                                )
                            ) : (
                                <Box />
                            )}
                            {closeBridge ? (
                                <Tooltip title={t('messenger.close', 'Close')}>
                                    <IconButton aria-label={t('messenger.close', 'Close')} onClick={closeBridge} size='small'>
                                        <CloseRoundedIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            ) : null}
                        </Box>
                    )}
                    {renderedZones.map(({ zone, content }) => (
                        <Box
                            key={zone}
                            data-testid={`messenger-zone-${zone}`}
                            sx={{
                                display: zone === 'center' ? 'flex' : 'grid',
                                flex: zone === 'center' ? '1 1 auto' : '0 0 auto',
                                flexDirection: 'column',
                                gap: 1.5,
                                width: '100%',
                                minWidth: 0,
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                px: { xs: 1.5, sm: 2.5 },
                                py: zone === 'center' ? 1.5 : 1
                            }}
                        >
                            {zone === 'center' ? (
                                <>
                                    {details.banner ? <Box sx={{ minWidth: 0 }}>{details.banner}</Box> : null}
                                    {hostContent ? <Box data-testid='messenger-host-content'>{hostContent}</Box> : null}
                                    {!hostContent && content.length === 0 ? (
                                        <Alert severity='info'>{t('messenger.empty', 'No application content is available yet.')}</Alert>
                                    ) : null}
                                </>
                            ) : null}
                            {content.map(({ key, element }) => (
                                <Box key={key} sx={{ minWidth: 0, maxWidth: '100%' }}>
                                    {element}
                                </Box>
                            ))}
                        </Box>
                    ))}
                    {children}
                </Box>
            </AuthenticatedRuntimePlacementScopeProvider>
        </DashboardDetailsProvider>
    )
}
