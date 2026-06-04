import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { StandardDialog } from '@universo-react/template-mui/components/dialogs'
import type {
    PlayCanvasEditorBridgeCommand,
    PlayCanvasEditorBridgeError,
    PlayCanvasEditorBridgeSessionDescriptor,
    PlayCanvasEditorScenePayload
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES,
    PLAYCANVAS_EDITOR_BRIDGE_VERSION,
    playCanvasEditorBridgeCommandSchema,
    playCanvasEditorBridgeErrorSchema
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { packagesApi, playcanvasEditorBridgeApi } from '../api'
import { metahubsQueryKeys } from '../../shared'
import { getLocalizedContentText, normalizeLocale } from '../../../utils/localizedInput'

const getHttpStatus = (error: unknown): number | undefined => {
    const status = (error as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === 'number' ? status : undefined
}

const getBridgeErrorResponse = (error: unknown): PlayCanvasEditorBridgeError | null => {
    const data = (error as { response?: { data?: unknown } } | null)?.response?.data
    const parsed = playCanvasEditorBridgeErrorSchema.safeParse(data)
    return parsed.success ? parsed.data : null
}

type FrameStatus = 'checking' | 'loading' | 'loaded' | 'error'
type BridgeStatus = 'disabled' | 'waiting' | 'ready' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error'
const bridgeCommandTypes = new Set<string>(PLAYCANVAS_EDITOR_BRIDGE_CAPABILITIES)
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const readRequestId = (value: unknown): string | null => (typeof value === 'string' && uuidV7Pattern.test(value) ? value : null)

const isAuthenticatedFrameMessage = (data: Record<string, unknown>, bridgeDescriptor: PlayCanvasEditorBridgeSessionDescriptor): boolean =>
    data.sessionId === bridgeDescriptor.sessionId && data.nonce === bridgeDescriptor.nonce

const parseBridgeCommand = (value: unknown): PlayCanvasEditorBridgeCommand | null => {
    const parsed = playCanvasEditorBridgeCommandSchema.safeParse(value)
    return parsed.success ? parsed.data : null
}

const createBridgeCommand = (
    data: Record<string, unknown>,
    bridgeDescriptor: PlayCanvasEditorBridgeSessionDescriptor
): PlayCanvasEditorBridgeCommand | null => {
    if (!isAuthenticatedFrameMessage(data, bridgeDescriptor)) {
        return null
    }
    const type = typeof data.type === 'string' ? data.type : ''
    if (!bridgeCommandTypes.has(type)) {
        return null
    }
    const requestId = readRequestId(data.requestId)
    if (!requestId) {
        return null
    }

    const base = {
        requestId,
        sessionId: bridgeDescriptor.sessionId,
        nonce: bridgeDescriptor.nonce
    }

    switch (type) {
        case 'project.loadSelected':
            return parseBridgeCommand({ ...base, type })
        case 'scene.list':
            if (typeof data.projectId !== 'string') {
                return null
            }
            return parseBridgeCommand({ ...base, type, projectId: data.projectId })
        case 'scene.read':
        case 'scene.saveStatus':
        case 'asset.listMinimalForScene':
            if (typeof data.projectId !== 'string' || typeof data.sceneId !== 'string') {
                return null
            }
            return parseBridgeCommand({
                ...base,
                type,
                projectId: data.projectId,
                sceneId: data.sceneId
            })
        case 'scene.save':
            if (
                !(
                    typeof data.projectId === 'string' &&
                    typeof data.sceneId === 'string' &&
                    (typeof data.expectedCurrentChecksum === 'string' || data.expectedCurrentChecksum === null) &&
                    data.payload != null &&
                    typeof data.payload === 'object'
                )
            ) {
                return null
            }
            return parseBridgeCommand({
                ...base,
                type,
                projectId: data.projectId,
                sceneId: data.sceneId,
                expectedCurrentChecksum: data.expectedCurrentChecksum,
                payload: data.payload as PlayCanvasEditorScenePayload
            })
        case 'bridge.capabilities':
            return parseBridgeCommand({ ...base, type })
        case 'bridge.close':
            return parseBridgeCommand(typeof data.dirty === 'boolean' ? { ...base, type, dirty: data.dirty } : { ...base, type })
        case 'bridge.dirtyState':
            if (typeof data.dirty !== 'boolean') {
                return null
            }
            return parseBridgeCommand({ ...base, type, dirty: data.dirty })
        default:
            return null
    }
}

export default function PlayCanvasEditorHostPage() {
    const { metahubId = '', packageSlug = '' } = useParams()
    const [searchParams] = useSearchParams()
    const { t, i18n } = useTranslation(['metahubs'])
    const queryClient = useQueryClient()
    const locale = normalizeLocale(i18n.language)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const backLinkRef = useRef<HTMLAnchorElement | null>(null)
    const trustedFrameSourceRef = useRef<MessageEventSource | null>(null)
    const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>('disabled')
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const [dirty, setDirty] = useState(false)
    const [dirtyDialogOpen, setDirtyDialogOpen] = useState(false)
    const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)
    const [saveConflictDialogOpen, setSaveConflictDialogOpen] = useState(false)

    const hostQuery = useQuery({
        queryKey: [...metahubsQueryKeys.packagesAttached(metahubId), 'authoring-host', packageSlug],
        queryFn: () => packagesApi.getAuthoringHost(metahubId, packageSlug),
        enabled: Boolean(metahubId && packageSlug)
    })

    const host = hostQuery.data
    const fallbackDisplayName =
        packageSlug === 'playcanvas-editor' ? 'PlayCanvas Editor' : t('packages.editorHost.fallbackName', 'Package editor')
    const displayName = useMemo(
        () => getLocalizedContentText(host?.displayName, locale, fallbackDisplayName),
        [fallbackDisplayName, host?.displayName, locale]
    )
    const displayConfig = host?.attachmentConfig.kind === 'display' ? host.attachmentConfig : null
    const mode = displayConfig?.display.mode ?? 'disabled'
    const defaultProjectId = displayConfig?.playcanvasProject?.defaultProjectId ?? null
    const forceSandboxedFrame = searchParams.get('view') === 'sandboxed-frame'
    const frameUrl = useMemo(() => {
        if (mode === 'developmentUrl') {
            return displayConfig?.display.developmentUrl ?? null
        }
        if (!host?.artifactUrl) {
            return null
        }
        const separator = host.artifactUrl.includes('?') ? '&' : '?'
        return `${host.artifactUrl}${separator}locale=${encodeURIComponent(locale)}`
    }, [displayConfig?.display.developmentUrl, host?.artifactUrl, locale, mode])
    const [frameStatus, setFrameStatus] = useState<FrameStatus>('checking')
    const bridgeDescriptor = host?.playcanvasEditor?.bridge ?? null
    const bridgeEnabled = Boolean(bridgeDescriptor && mode !== 'developmentUrl')
    const bootstrapDescriptor = useMemo(() => {
        if (!host?.playcanvasEditor || !bridgeDescriptor) {
            return null
        }
        return {
            schemaVersion: host.playcanvasEditor.schemaVersion,
            bridge: {
                sessionId: bridgeDescriptor.sessionId,
                nonce: bridgeDescriptor.nonce,
                expiresAt: bridgeDescriptor.expiresAt,
                bridgeVersion: bridgeDescriptor.bridgeVersion,
                writeMode: bridgeDescriptor.writeMode,
                capabilities: bridgeDescriptor.capabilities
            },
            selectedProject: host.playcanvasEditor.selectedProject ?? null,
            compatibilityStatus: host.playcanvasEditor.compatibilityStatus
        }
    }, [bridgeDescriptor, host?.playcanvasEditor])
    const postBootstrapInit = useCallback(
        (bootstrapRequestId: string) => {
            if (!bootstrapRequestId || !bootstrapDescriptor || !iframeRef.current?.contentWindow || !frameUrl) {
                return
            }
            const targetOrigin = new URL(frameUrl, window.location.href).origin
            iframeRef.current.contentWindow.postMessage(
                {
                    type: 'editor.bootstrap.init',
                    source: 'universo-playcanvas-editor-host',
                    bootstrapRequestId,
                    descriptor: bootstrapDescriptor,
                    locale
                },
                targetOrigin
            )
        },
        [bootstrapDescriptor, frameUrl, locale]
    )
    const postBootstrapInitFromFrame = useCallback(() => {
        let attempt = 0
        const tryPostBootstrapInit = () => {
            attempt += 1
            try {
                const bridge = (
                    iframeRef.current?.contentWindow as
                        | {
                              __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                  bootstrapRequestId?: unknown
                                  ready?: unknown
                              }
                          }
                        | undefined
                )?.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                if (bridge?.ready === true) {
                    return
                }
                const bootstrapRequestId = bridge?.bootstrapRequestId
                if (typeof bootstrapRequestId === 'string' && bootstrapRequestId) {
                    postBootstrapInit(bootstrapRequestId)
                    return
                }
            } catch {
                return
            }
            if (attempt < 20) {
                window.setTimeout(tryPostBootstrapInit, 250)
            }
        }
        tryPostBootstrapInit()
    }, [postBootstrapInit])

    useEffect(() => {
        if (!frameUrl) {
            setFrameStatus('checking')
            return undefined
        }

        let active = true
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const resolvedFrameUrl = new URL(frameUrl, window.location.href)

        setFrameStatus('checking')

        if (mode === 'developmentUrl') {
            setFrameStatus('loading')
            timeoutId = setTimeout(() => {
                if (!active) return
                setFrameStatus((current) => (current === 'loaded' || current === 'error' ? current : 'error'))
            }, 15000)
        } else {
            fetch(resolvedFrameUrl.toString(), {
                cache: 'no-store',
                credentials: resolvedFrameUrl.origin === window.location.origin ? 'same-origin' : 'omit'
            })
                .then((response) => {
                    if (!active) return
                    setFrameStatus(response.ok ? 'loading' : 'error')
                })
                .catch(() => {
                    if (!active) return
                    setFrameStatus('error')
                })
        }

        return () => {
            active = false
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [frameUrl, mode])

    useEffect(() => {
        if (!bridgeEnabled || !bridgeDescriptor) {
            setBridgeStatus('disabled')
            setSaveStatus('idle')
            return undefined
        }
        setBridgeStatus('waiting')
        trustedFrameSourceRef.current = null
        const expectedFrameOrigin = frameUrl ? new URL(frameUrl, window.location.href).origin : null
        const listener = (event: MessageEvent) => {
            if (!iframeRef.current?.contentWindow) {
                return
            }
            if (expectedFrameOrigin && event.origin !== expectedFrameOrigin) {
                return
            }
            const data = event.data as { type?: unknown; source?: unknown; dirty?: unknown } | null
            if (!data || typeof data.type !== 'string') {
                return
            }
            if (data.source !== 'universo-playcanvas-editor-artifact') {
                return
            }
            if (data.type === 'editor.bootstrap.requestInit') {
                const bootstrapRequestId =
                    typeof (data as { bootstrapRequestId?: unknown }).bootstrapRequestId === 'string'
                        ? (data as { bootstrapRequestId: string }).bootstrapRequestId
                        : undefined
                if (!bootstrapRequestId) {
                    return
                }
                trustedFrameSourceRef.current = event.source
                postBootstrapInit(bootstrapRequestId)
                return
            }
            const trustedFrameSource = trustedFrameSourceRef.current ?? iframeRef.current.contentWindow
            if (event.source !== iframeRef.current.contentWindow && event.source !== trustedFrameSource) {
                return
            }
            if (!isAuthenticatedFrameMessage(data as Record<string, unknown>, bridgeDescriptor)) {
                return
            }
            if (data.type === 'editor.ready') {
                void playcanvasEditorBridgeApi
                    .sendCommand(metahubId, {
                        sessionToken: bridgeDescriptor.sessionToken,
                        command: {
                            type: 'editor.ready',
                            requestId: generateUuidV7(),
                            sessionId: bridgeDescriptor.sessionId,
                            nonce: bridgeDescriptor.nonce,
                            bridgeVersion: PLAYCANVAS_EDITOR_BRIDGE_VERSION,
                            capabilities: bridgeDescriptor.capabilities
                        }
                    })
                    .then(() => setBridgeStatus('ready'))
                    .catch(() => setBridgeStatus('error'))
                return
            }
            if (data.type === 'bridge.dirtyState' && typeof data.dirty === 'boolean') {
                setDirty(data.dirty)
                if (!data.dirty) {
                    setSaveStatus((current) => (current === 'saving' ? 'saved' : current))
                }
            }
            if (data.type === 'bridge.focusBackLink') {
                backLinkRef.current?.focus()
                return
            }

            const command = createBridgeCommand(data as Record<string, unknown>, bridgeDescriptor)
            if (!command) {
                return
            }
            if (command.type === 'scene.save') {
                setSaveStatus('saving')
                setSaveConflictDialogOpen(false)
            }
            void playcanvasEditorBridgeApi
                .sendCommand(metahubId, {
                    sessionToken: bridgeDescriptor.sessionToken,
                    command
                })
                .then((response) => {
                    if (command.type === 'scene.save') {
                        setSaveStatus('saved')
                        setDirty(false)
                        void Promise.all([
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.playcanvasProjects(metahubId) }),
                            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.packagesAttached(metahubId) })
                        ])
                    }
                    iframeRef.current?.contentWindow?.postMessage(
                        {
                            type: 'bridge.response',
                            source: 'universo-playcanvas-editor-host',
                            commandType: command.type,
                            requestId: command.requestId,
                            response
                        },
                        expectedFrameOrigin ?? '*'
                    )
                })
                .catch((error: unknown) => {
                    const response = getBridgeErrorResponse(error) ?? {
                        ok: false,
                        requestId: command.requestId,
                        code: 'internalError',
                        status: 500
                    }
                    if (command.type === 'scene.save') {
                        if (response.code === 'saveConflict') {
                            setSaveStatus('conflict')
                            setSaveConflictDialogOpen(true)
                        } else {
                            setSaveStatus('error')
                            setBridgeStatus('error')
                        }
                    } else {
                        setBridgeStatus('error')
                    }
                    iframeRef.current?.contentWindow?.postMessage(
                        {
                            type: 'bridge.response',
                            source: 'universo-playcanvas-editor-host',
                            commandType: command.type,
                            requestId: command.requestId,
                            response
                        },
                        expectedFrameOrigin ?? '*'
                    )
                })
        }
        window.addEventListener('message', listener)
        return () => window.removeEventListener('message', listener)
    }, [bridgeDescriptor, bridgeEnabled, frameUrl, metahubId, postBootstrapInit, queryClient])

    useEffect(() => {
        if (!dirty) {
            return undefined
        }
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [dirty])

    const sandboxedSeparateHostUrl =
        metahubId && packageSlug
            ? `/metahub/${encodeURIComponent(metahubId)}/resources/packages/${encodeURIComponent(packageSlug)}/editor?view=sandboxed-frame`
            : '#'
    const packagesUrl = metahubId ? `/metahub/${encodeURIComponent(metahubId)}/resources` : '#'
    const shouldRedirectToSandboxedSeparateHost = mode === 'openSeparately' && !forceSandboxedFrame

    useEffect(() => {
        if (shouldRedirectToSandboxedSeparateHost && sandboxedSeparateHostUrl !== '#') {
            window.location.replace(sandboxedSeparateHostUrl)
        }
    }, [sandboxedSeparateHostUrl, shouldRedirectToSandboxedSeparateHost])

    const handleBackClick = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            if (!dirty) {
                return
            }
            event.preventDefault()
            setPendingNavigationHref(packagesUrl)
            setDirtyDialogOpen(true)
        },
        [dirty, packagesUrl]
    )
    const handleConfirmLeave = useCallback(() => {
        const target = pendingNavigationHref ?? packagesUrl
        setDirtyDialogOpen(false)
        setPendingNavigationHref(null)
        window.location.assign(target)
    }, [packagesUrl, pendingNavigationHref])
    const handleKeepEditing = useCallback(() => {
        setDirtyDialogOpen(false)
        setPendingNavigationHref(null)
    }, [])
    const handleReloadLatest = useCallback(() => {
        setSaveConflictDialogOpen(false)
        window.location.reload()
    }, [])
    const handleHostSave = useCallback(() => {
        if (!bridgeDescriptor || !frameUrl || !iframeRef.current?.contentWindow) {
            setSaveStatus('error')
            return
        }
        const targetOrigin = new URL(frameUrl, window.location.href).origin
        setSaveStatus('saving')
        setSaveConflictDialogOpen(false)
        iframeRef.current.contentWindow.postMessage(
            {
                type: 'bridge.saveRequested',
                source: 'universo-playcanvas-editor-host',
                requestId: generateUuidV7(),
                sessionId: bridgeDescriptor.sessionId,
                nonce: bridgeDescriptor.nonce
            },
            targetOrigin
        )
    }, [bridgeDescriptor, frameUrl])
    const canRequestSave = bridgeEnabled && bridgeStatus === 'ready' && frameStatus === 'loaded' && saveStatus !== 'saving'

    useEffect(() => {
        const handleSaveShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') {
                return
            }
            event.preventDefault()
            if (!canRequestSave) {
                return
            }
            handleHostSave()
        }
        window.addEventListener('keydown', handleSaveShortcut)
        return () => window.removeEventListener('keydown', handleSaveShortcut)
    }, [canRequestSave, handleHostSave])
    const renderHeader = () => (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                    component='a'
                    href={packagesUrl}
                    ref={backLinkRef}
                    variant='outlined'
                    startIcon={<ArrowBackRoundedIcon />}
                    onClick={handleBackClick}
                >
                    {t('packages.editorHost.backToPackages', 'Back to packages')}
                </Button>
                <Button
                    variant='contained'
                    startIcon={<SaveRoundedIcon />}
                    disabled={!canRequestSave}
                    onClick={handleHostSave}
                    title={
                        !canRequestSave
                            ? t('packages.editorHost.saveUnavailable', 'Save is available after the editor bridge is ready.')
                            : undefined
                    }
                >
                    {t('packages.editorHost.save', 'Save')}
                </Button>
            </Stack>
            <Typography variant='h4' sx={{ overflowWrap: 'anywhere' }}>
                {displayName}
            </Typography>
        </Stack>
    )
    const renderState = (severity: 'info' | 'warning' | 'error' | 'success', message: string) => (
        <Stack spacing={2} sx={{ p: 3, maxWidth: 760 }}>
            {renderHeader()}
            <Alert severity={severity}>{message}</Alert>
        </Stack>
    )

    if (hostQuery.isLoading) {
        return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ p: 3 }}>
                <CircularProgress size={18} />
                <Typography variant='body2' color='text.secondary'>
                    {t('packages.editorHost.loading', 'Loading editor...')}
                </Typography>
            </Stack>
        )
    }

    if (hostQuery.isError || !host) {
        const status = getHttpStatus(hostQuery.error)
        const message =
            status === 401 || status === 403
                ? t('packages.editorHost.permissionDenied', 'You do not have permission to open this editor.')
                : t('packages.editorHost.loadError', 'Failed to load editor settings.')
        return renderState('error', message)
    }

    if (mode === 'disabled') {
        return renderState('info', t('packages.editorHost.disabled', 'This editor is disabled for the metahub.'))
    }

    if (host.artifactStatus === 'blocked' && defaultProjectId && !bridgeDescriptor && mode !== 'developmentUrl') {
        return renderState(
            'warning',
            t('packages.editorHost.defaultProjectUnavailable', 'The selected default PlayCanvas project is unavailable.')
        )
    }

    if (host.artifactStatus === 'blocked' || host.artifactStatus === 'misconfigured') {
        return renderState('warning', t('packages.editorHost.misconfigured', 'Editor display settings are incomplete.'))
    }

    if (host.artifactStatus !== 'available' && mode !== 'developmentUrl') {
        return renderState('warning', t('packages.editorHost.artifactMissing', 'The editor artifact is not available yet.'))
    }

    if (!frameUrl) {
        return renderState('warning', t('packages.editorHost.misconfigured', 'Editor display settings are incomplete.'))
    }

    if (mode !== 'developmentUrl' && !bridgeDescriptor && !defaultProjectId) {
        return renderState(
            'warning',
            t('packages.editorHost.defaultProjectRequired', 'Select a default PlayCanvas project before opening the editor.')
        )
    }

    if (shouldRedirectToSandboxedSeparateHost) {
        return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ p: 3 }}>
                <CircularProgress size={18} />
                <Typography variant='body2' color='text.secondary'>
                    {t('packages.editorHost.loading', 'Loading editor...')}
                </Typography>
            </Stack>
        )
    }

    return (
        <Stack sx={{ minHeight: 'calc(100vh - 96px)', p: 2 }} spacing={1.5}>
            {renderHeader()}
            {frameStatus === 'error' ? (
                <Alert severity='error'>{t('packages.editorHost.frameLoadError', 'The editor frame could not be loaded.')}</Alert>
            ) : displayConfig?.display.showArtifactOnlyNotice ? (
                <Alert severity={frameStatus === 'loaded' && mode !== 'developmentUrl' ? 'success' : 'info'}>
                    {frameStatus === 'loaded'
                        ? mode === 'developmentUrl'
                            ? t('packages.editorHost.developmentNotice', 'Development URL mode is active.')
                            : t('packages.editorHost.artifactReady', 'Editor artifact is ready.')
                        : t('packages.editorHost.frameLoading', 'Loading editor frame...')}
                </Alert>
            ) : null}
            {bridgeEnabled ? (
                <Alert severity={bridgeStatus === 'ready' ? 'success' : bridgeStatus === 'error' ? 'error' : 'info'}>
                    {bridgeStatus === 'ready'
                        ? t('packages.editorHost.bridgeReady', 'Editor bridge is ready.')
                        : bridgeStatus === 'error'
                        ? t('packages.editorHost.bridgeError', 'Editor bridge failed.')
                        : t('packages.editorHost.bridgeWaiting', 'Waiting for editor bridge...')}
                </Alert>
            ) : null}
            {dirty ? (
                <Alert
                    severity='warning'
                    action={<Button onClick={() => setDirtyDialogOpen(true)}>{t('packages.editorHost.reviewDirty', 'Review')}</Button>}
                >
                    {t('packages.editorHost.unsavedChanges', 'The editor reports unsaved changes.')}
                </Alert>
            ) : null}
            {saveStatus !== 'idle' ? (
                <Alert severity={saveStatus === 'saved' ? 'success' : saveStatus === 'saving' ? 'info' : 'error'}>
                    {saveStatus === 'saved'
                        ? t('packages.editorHost.saveSaved', 'Scene saved.')
                        : saveStatus === 'saving'
                        ? t('packages.editorHost.saveSaving', 'Saving scene...')
                        : saveStatus === 'conflict'
                        ? t('packages.editorHost.saveConflict', 'The scene changed elsewhere. Reload the latest scene before saving again.')
                        : t('packages.editorHost.saveFailed', 'Scene save failed.')}
                </Alert>
            ) : null}
            {frameStatus !== 'checking' && frameStatus !== 'error' ? (
                <Box
                    component='iframe'
                    ref={iframeRef}
                    data-testid='playcanvas-editor-frame'
                    title={displayName}
                    src={frameUrl}
                    sandbox={mode === 'developmentUrl' ? 'allow-scripts' : 'allow-scripts allow-same-origin'}
                    referrerPolicy='no-referrer'
                    allow=''
                    tabIndex={0}
                    onLoad={() => {
                        setFrameStatus('loaded')
                        postBootstrapInitFromFrame()
                    }}
                    onError={() => setFrameStatus('error')}
                    sx={{
                        flex: 1,
                        width: '100%',
                        minHeight: 640,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1
                    }}
                />
            ) : null}
            <StandardDialog
                open={dirtyDialogOpen}
                onClose={() => setDirtyDialogOpen(false)}
                title={t('packages.editorHost.unsavedChangesTitle', 'Unsaved changes')}
                disablePresentationControls
                actions={
                    <>
                        {pendingNavigationHref ? (
                            <Button variant='outlined' color='error' onClick={handleConfirmLeave}>
                                {t('packages.editorHost.leavePage', 'Leave page')}
                            </Button>
                        ) : null}
                        <Button variant='contained' onClick={handleKeepEditing}>
                            {t('packages.editorHost.keepEditing', 'Keep editing')}
                        </Button>
                    </>
                }
            >
                <Typography variant='body2'>
                    {t('packages.editorHost.unsavedChangesBody', 'Save changes in the editor before leaving this page.')}
                </Typography>
            </StandardDialog>
            <StandardDialog
                open={saveConflictDialogOpen}
                onClose={() => setSaveConflictDialogOpen(false)}
                title={t('packages.editorHost.saveConflictTitle', 'Save conflict')}
                disablePresentationControls
                actions={
                    <>
                        <Button variant='outlined' onClick={() => setSaveConflictDialogOpen(false)}>
                            {t('packages.editorHost.keepEditing', 'Keep editing')}
                        </Button>
                        <Button variant='contained' onClick={handleReloadLatest}>
                            {t('packages.editorHost.reloadLatest', 'Reload latest')}
                        </Button>
                    </>
                }
            >
                <Typography variant='body2'>
                    {t(
                        'packages.editorHost.saveConflictBody',
                        'Another save changed this scene. Reload the latest stored scene, review it, and save again.'
                    )}
                </Typography>
            </StandardDialog>
        </Stack>
    )
}
