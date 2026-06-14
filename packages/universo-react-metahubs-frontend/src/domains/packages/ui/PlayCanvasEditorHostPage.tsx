import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography, useMediaQuery, useTheme, type AlertColor } from '@mui/material'
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
    PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
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
        case 'protocol.describe':
            return parseBridgeCommand({ ...base, type })
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

export interface PlayCanvasEditorHostPageProps {
    fullScreen?: boolean
}

export default function PlayCanvasEditorHostPage({ fullScreen = false }: PlayCanvasEditorHostPageProps) {
    const { metahubId = '', packageSlug = '' } = useParams()
    const { t, i18n } = useTranslation(['metahubs'])
    const queryClient = useQueryClient()
    const theme = useTheme()
    const isCompactEditorViewport = useMediaQuery(theme.breakpoints.down('sm'))
    const locale = normalizeLocale(i18n.language)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const backLinkRef = useRef<HTMLAnchorElement | null>(null)
    const trustedFrameSourceRef = useRef<MessageEventSource | null>(null)
    const bridgeSessionKeyRef = useRef<string | null>(null)
    const dirtyRef = useRef(false)
    const pendingHostSaveRef = useRef(false)
    const pendingBootstrapRequestIdRef = useRef<string | null>(null)
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
    const frameUrl = useMemo(() => {
        if (mode === 'developmentUrl') {
            return displayConfig?.display.developmentUrl ?? null
        }
        if (!host?.artifactUrl) {
            return null
        }
        const artifactUrl = new URL(host.artifactUrl, window.location.href)
        artifactUrl.searchParams.set('locale', locale)
        return artifactUrl.toString()
    }, [displayConfig?.display.developmentUrl, host?.artifactUrl, locale, mode])
    const frameOrigin = useMemo(() => {
        if (!frameUrl) return null
        return new URL(frameUrl, window.location.href).origin
    }, [frameUrl])
    const iframeSandbox = useMemo(() => {
        if (mode === 'developmentUrl') {
            return 'allow-scripts'
        }
        if (!frameOrigin || frameOrigin === window.location.origin) {
            return 'allow-scripts'
        }
        return 'allow-scripts allow-same-origin'
    }, [frameOrigin, mode])
    const frameBaseUrl = useMemo(() => {
        if (!frameUrl) return null
        const url = new URL(frameUrl, window.location.href)
        url.search = ''
        url.hash = ''
        url.pathname = url.pathname.replace(/[^/]*$/, '')
        return url.href
    }, [frameUrl])
    const [frameStatus, setFrameStatus] = useState<FrameStatus>('checking')
    const bridgeDescriptor = host?.playcanvasEditor?.bridge ?? null
    const bridgeEnabled = Boolean(bridgeDescriptor && mode !== 'developmentUrl')
    const selectedProjectId = host?.playcanvasEditor?.selectedProject?.project.id ?? null
    const compatibilityConfigQuery = useQuery({
        queryKey: [
            ...metahubsQueryKeys.packagesAttached(metahubId),
            'playcanvas-editor-compatibility-config',
            selectedProjectId,
            frameOrigin,
            frameBaseUrl
        ],
        queryFn: () =>
            packagesApi.getPlayCanvasEditorCompatibilityConfig(
                metahubId,
                selectedProjectId ?? '',
                frameOrigin,
                frameBaseUrl,
                PLAYCANVAS_EDITOR_FULL_BOOT_MODE
            ),
        enabled: Boolean(bridgeEnabled && selectedProjectId && frameOrigin && frameBaseUrl)
    })
    const restCompatibilityConfig =
        compatibilityConfigQuery.data?.mode === PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE ? compatibilityConfigQuery.data : null
    const fullBootCompatibilityConfig =
        compatibilityConfigQuery.data?.mode === PLAYCANVAS_EDITOR_FULL_BOOT_MODE ? compatibilityConfigQuery.data : null
    const fullBootConfigError =
        bridgeEnabled &&
        selectedProjectId &&
        mode !== 'developmentUrl' &&
        (compatibilityConfigQuery.isError || Boolean(compatibilityConfigQuery.data && !fullBootCompatibilityConfig))
    const compatibilityCsrfTokenQuery = useQuery({
        queryKey: [...metahubsQueryKeys.packagesAttached(metahubId), 'playcanvas-editor-compatibility-csrf', selectedProjectId],
        queryFn: () => packagesApi.getCsrfToken(),
        enabled: Boolean(bridgeEnabled && selectedProjectId && restCompatibilityConfig?.csrf)
    })
    const bootstrapDescriptor = useMemo(() => {
        if (!host?.playcanvasEditor || !bridgeDescriptor) {
            return null
        }
        if (bridgeEnabled && selectedProjectId && !compatibilityConfigQuery.data && !compatibilityConfigQuery.isError) {
            return null
        }
        if (fullBootConfigError) {
            return null
        }
        if (
            bridgeEnabled &&
            selectedProjectId &&
            restCompatibilityConfig?.csrf &&
            !compatibilityCsrfTokenQuery.data &&
            !compatibilityCsrfTokenQuery.isError
        ) {
            return null
        }
        return {
            schemaVersion: host.playcanvasEditor.schemaVersion,
            metahubId: host.metahubId,
            packageSlug: host.packageSlug,
            compatibilityConfig: compatibilityConfigQuery.data ?? null,
            compatibilityCsrfToken:
                restCompatibilityConfig?.csrf && compatibilityCsrfTokenQuery.data
                    ? {
                          headerName: restCompatibilityConfig.csrf.headerName,
                          token: compatibilityCsrfTokenQuery.data
                      }
                    : null,
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
    }, [
        bridgeDescriptor,
        bridgeEnabled,
        compatibilityConfigQuery.data,
        compatibilityConfigQuery.isError,
        compatibilityCsrfTokenQuery.data,
        compatibilityCsrfTokenQuery.isError,
        fullBootConfigError,
        host?.metahubId,
        host?.packageSlug,
        host?.playcanvasEditor,
        restCompatibilityConfig,
        selectedProjectId
    ])
    const postBootstrapInit = useCallback(
        (bootstrapRequestId: string) => {
            if (!bootstrapRequestId || !bootstrapDescriptor || !iframeRef.current?.contentWindow || !frameUrl) {
                pendingBootstrapRequestIdRef.current = bootstrapRequestId || pendingBootstrapRequestIdRef.current
                return false
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
            if (pendingBootstrapRequestIdRef.current === bootstrapRequestId) {
                pendingBootstrapRequestIdRef.current = null
            }
            return true
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
                    pendingBootstrapRequestIdRef.current = bootstrapRequestId
                    if (postBootstrapInit(bootstrapRequestId)) {
                        return
                    }
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
        const bootstrapRequestId = pendingBootstrapRequestIdRef.current
        if (bootstrapRequestId) {
            postBootstrapInit(bootstrapRequestId)
        }
    }, [bootstrapDescriptor, postBootstrapInit])

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
        if (!bridgeEnabled || !bridgeDescriptor || !frameUrl) {
            bridgeSessionKeyRef.current = null
            setBridgeStatus('disabled')
            setSaveStatus('idle')
            return undefined
        }
        const bridgeSessionKey = `${bridgeDescriptor.sessionId}:${bridgeDescriptor.nonce}`
        if (bridgeSessionKeyRef.current !== bridgeSessionKey) {
            bridgeSessionKeyRef.current = bridgeSessionKey
            trustedFrameSourceRef.current = null
            dirtyRef.current = false
            pendingHostSaveRef.current = false
            setDirty(false)
            setBridgeStatus('waiting')
            setSaveStatus('idle')
        }
        const expectedFrameOrigin = new URL(frameUrl, window.location.href).origin
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
                if (event.source !== iframeRef.current.contentWindow) {
                    return
                }
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
                const wasDirty = dirtyRef.current
                dirtyRef.current = data.dirty
                setDirty(data.dirty)
                if (data.dirty) {
                    setSaveStatus((current) => (current === 'conflict' ? 'idle' : current))
                }
                if (!data.dirty) {
                    const pendingHostSave = pendingHostSaveRef.current
                    pendingHostSaveRef.current = false
                    setSaveStatus((current) => (current === 'saving' || wasDirty || pendingHostSave ? 'saved' : current))
                }
            }
            if (data.type === 'bridge.saveError') {
                const status = typeof data.status === 'number' ? data.status : null
                const code = typeof data.code === 'string' ? data.code : null
                if (status === 409 || code === 'saveConflict') {
                    setSaveStatus('conflict')
                    setSaveConflictDialogOpen(true)
                } else {
                    setSaveStatus('error')
                }
                return
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
                        pendingHostSaveRef.current = false
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
                        expectedFrameOrigin
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
                        pendingHostSaveRef.current = false
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
                        expectedFrameOrigin
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

    const packagesUrl = metahubId ? `/metahub/${encodeURIComponent(metahubId)}/resources` : '#'

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
        pendingHostSaveRef.current = true
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
    const bridgeReadyForLoadedFrame = bridgeStatus === 'ready' && frameStatus === 'loaded'
    const canRequestSave = bridgeEnabled && bridgeReadyForLoadedFrame && saveStatus !== 'saving'

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
    const renderSaveState = () => {
        if (saveStatus === 'saving') return t('packages.editorHost.saveSaving', 'Saving scene...')
        if (saveStatus === 'saved') return t('packages.editorHost.saveSaved', 'Scene saved.')
        if (saveStatus === 'conflict') {
            return t('packages.editorHost.saveConflict', 'The scene changed elsewhere. Reload the latest scene before saving again.')
        }
        if (saveStatus === 'error') return t('packages.editorHost.saveFailed', 'Scene save failed.')
        if (dirty) return t('packages.editorHost.unsavedChangesCompact', 'Unsaved changes')
        if (bridgeEnabled && !bridgeReadyForLoadedFrame) return t('packages.editorHost.bridgeWaiting', 'Preparing editor...')
        return t('packages.editorHost.ready', 'Ready')
    }
    const hostStatusNotice = useMemo<{
        severity: AlertColor
        message: string
        testId?: string
    } | null>(() => {
        if (frameStatus === 'error') {
            return {
                severity: 'error',
                message: t('packages.editorHost.frameLoadError', 'The editor frame could not be loaded.')
            }
        }
        if (saveStatus === 'conflict') {
            return {
                severity: 'error',
                message: t('packages.editorHost.saveConflict', 'The scene changed elsewhere. Reload the latest scene before saving again.'),
                testId: 'playcanvas-editor-save-conflict-alert'
            }
        }
        if (saveStatus === 'error') {
            return {
                severity: 'error',
                message: t('packages.editorHost.saveFailed', 'Scene save failed.')
            }
        }
        if (isCompactEditorViewport && mode !== 'developmentUrl') {
            return {
                severity: 'warning',
                message: t(
                    'packages.editorHost.mobileUnsupported',
                    'PlayCanvas Editor is available on larger screens. Open it on a desktop or tablet to edit this project.'
                )
            }
        }
        if (fullScreen) {
            return null
        }
        if (bridgeEnabled) {
            return {
                severity: bridgeReadyForLoadedFrame ? 'success' : bridgeStatus === 'error' ? 'error' : 'info',
                message: bridgeReadyForLoadedFrame
                    ? t('packages.editorHost.bridgeReady', 'Editor bridge is ready.')
                    : bridgeStatus === 'error'
                    ? t('packages.editorHost.bridgeError', 'Editor bridge failed.')
                    : t('packages.editorHost.bridgeWaiting', 'Waiting for editor bridge...')
            }
        }
        if (displayConfig?.display.showArtifactOnlyNotice) {
            return {
                severity: frameStatus === 'loaded' && mode !== 'developmentUrl' ? 'success' : 'info',
                message:
                    frameStatus === 'loaded'
                        ? mode === 'developmentUrl'
                            ? t('packages.editorHost.developmentNotice', 'Development URL mode is active.')
                            : t('packages.editorHost.artifactReady', 'Editor artifact is ready.')
                        : t('packages.editorHost.frameLoading', 'Loading editor frame...')
            }
        }
        return null
    }, [
        bridgeEnabled,
        bridgeReadyForLoadedFrame,
        bridgeStatus,
        displayConfig?.display.showArtifactOnlyNotice,
        frameStatus,
        fullScreen,
        isCompactEditorViewport,
        mode,
        saveStatus,
        t
    ])

    const renderHeader = () => {
        const saveState = renderSaveState()
        const saveDisabledReason = !canRequestSave
            ? t('packages.editorHost.saveUnavailable', 'Save becomes available after the editor loads.')
            : undefined
        const statusColor =
            saveStatus === 'saved'
                ? 'success'
                : saveStatus === 'conflict' || saveStatus === 'error'
                ? 'error'
                : dirty
                ? 'warning'
                : 'default'
        const headerSx = fullScreen
            ? {
                  minHeight: 42,
                  px: 1,
                  py: 0.5,
                  bgcolor: '#202020',
                  color: '#f5f5f5',
                  borderBottom: '1px solid #333'
              }
            : undefined

        return (
            <Stack
                data-testid={fullScreen ? 'playcanvas-editor-fullscreen-chrome' : 'playcanvas-editor-host-chrome'}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={fullScreen ? 1 : 1.5}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    ...headerSx
                }}
            >
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    sx={{ minWidth: 0, flexShrink: 0 }}
                >
                    <Button
                        component='a'
                        href={packagesUrl}
                        ref={backLinkRef}
                        variant={fullScreen ? 'text' : 'outlined'}
                        size={fullScreen ? 'small' : 'medium'}
                        color={fullScreen ? 'inherit' : 'primary'}
                        startIcon={<ArrowBackRoundedIcon />}
                        onClick={handleBackClick}
                    >
                        {t('packages.editorHost.backToPackages', 'Back to packages')}
                    </Button>
                    <Button
                        variant={fullScreen ? 'outlined' : 'contained'}
                        size={fullScreen ? 'small' : 'medium'}
                        color={fullScreen ? 'inherit' : 'primary'}
                        startIcon={<SaveRoundedIcon />}
                        disabled={!canRequestSave}
                        onClick={handleHostSave}
                        aria-describedby={!canRequestSave ? 'playcanvas-editor-save-disabled-reason' : undefined}
                    >
                        {t('packages.editorHost.save', 'Save')}
                    </Button>
                </Stack>
                <Typography
                    variant={fullScreen ? 'body2' : 'h4'}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                        fontWeight: fullScreen ? 600 : undefined,
                        color: fullScreen ? 'inherit' : undefined
                    }}
                >
                    {displayName}
                </Typography>
                <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
                    sx={{ minWidth: 0, maxWidth: '100%', flexShrink: 1 }}
                >
                    <Chip
                        size='small'
                        color={statusColor}
                        variant={fullScreen && statusColor === 'default' ? 'outlined' : 'filled'}
                        label={saveState}
                        sx={
                            fullScreen
                                ? {
                                      color: statusColor === 'default' ? '#d8d8d8' : undefined,
                                      borderColor: statusColor === 'default' ? '#555' : undefined,
                                      maxWidth: { xs: '100%', sm: 360 },
                                      '& .MuiChip-label': {
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                      }
                                  }
                                : {
                                      maxWidth: { xs: '100%', sm: 420 },
                                      '& .MuiChip-label': {
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                      }
                                  }
                        }
                    />
                    {dirty ? (
                        <Button
                            size='small'
                            color={fullScreen ? 'inherit' : 'primary'}
                            variant='text'
                            onClick={() => setDirtyDialogOpen(true)}
                        >
                            {t('packages.editorHost.reviewDirty', 'Review')}
                        </Button>
                    ) : null}
                </Stack>
                {saveDisabledReason ? (
                    <Typography
                        id='playcanvas-editor-save-disabled-reason'
                        variant='caption'
                        sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
                    >
                        {saveDisabledReason}
                    </Typography>
                ) : null}
            </Stack>
        )
    }
    const renderState = (severity: 'info' | 'warning' | 'error' | 'success', message: string) => (
        <Stack
            spacing={2}
            sx={{
                p: fullScreen ? 2 : 3,
                width: '100%',
                maxWidth: fullScreen ? '100%' : 760,
                minWidth: 0,
                boxSizing: 'border-box',
                minHeight: fullScreen ? '100dvh' : undefined
            }}
        >
            {fullScreen ? null : renderHeader()}
            <Alert severity={severity} sx={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                {message}
            </Alert>
        </Stack>
    )

    if (hostQuery.isLoading) {
        return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ p: fullScreen ? 2 : 3 }}>
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

    if (fullBootConfigError) {
        return renderState('error', t('packages.editorHost.fullBootConfigError', 'Failed to load PlayCanvas Editor runtime config.'))
    }

    if (mode !== 'developmentUrl' && !bridgeDescriptor && !defaultProjectId) {
        return renderState(
            'warning',
            t('packages.editorHost.defaultProjectRequired', 'Select a default PlayCanvas project before opening the editor.')
        )
    }

    if (isCompactEditorViewport && mode !== 'developmentUrl' && frameStatus !== 'loaded' && !dirty) {
        return renderState(
            'warning',
            t(
                'packages.editorHost.mobileUnsupported',
                'PlayCanvas Editor is available on larger screens. Open it on a desktop or tablet to edit this project.'
            )
        )
    }

    return (
        <Stack
            data-testid={fullScreen ? 'playcanvas-editor-fullscreen-host' : 'playcanvas-editor-host'}
            sx={{
                height: fullScreen ? '100dvh' : 'calc(100vh - 96px)',
                minHeight: 0,
                p: fullScreen ? 0 : 2,
                overflow: 'hidden',
                bgcolor: fullScreen ? 'background.default' : undefined
            }}
            spacing={fullScreen ? 0 : 1.5}
        >
            {fullScreen ? null : (
                <Box
                    sx={{
                        flex: '0 0 auto',
                        px: 0,
                        py: 0,
                        zIndex: 1
                    }}
                >
                    {renderHeader()}
                </Box>
            )}
            <Stack
                spacing={fullScreen ? 1 : 1.5}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    p: fullScreen ? 0 : 0,
                    overflow: 'hidden'
                }}
            >
                {hostStatusNotice ? (
                    <Alert
                        severity={hostStatusNotice.severity}
                        data-testid={hostStatusNotice.testId ?? 'playcanvas-editor-host-status-alert'}
                    >
                        {hostStatusNotice.message}
                    </Alert>
                ) : null}
                {frameStatus !== 'checking' && frameStatus !== 'error' ? (
                    <Box
                        component='iframe'
                        ref={iframeRef}
                        data-testid='playcanvas-editor-frame'
                        title={displayName}
                        src={frameUrl}
                        sandbox={iframeSandbox}
                        referrerPolicy='no-referrer'
                        allow=''
                        tabIndex={0}
                        onLoad={() => {
                            setFrameStatus('loaded')
                            postBootstrapInitFromFrame()
                        }}
                        onError={() => setFrameStatus('error')}
                        sx={{
                            flex: '1 1 0',
                            width: '100%',
                            minHeight: 0,
                            border: fullScreen ? 0 : 1,
                            borderColor: 'divider',
                            borderRadius: fullScreen ? 0 : 1,
                            display: 'block'
                        }}
                    />
                ) : null}
            </Stack>
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
                onClose={() => {
                    setSaveConflictDialogOpen(false)
                    setSaveStatus((current) => (current === 'conflict' ? 'idle' : current))
                }}
                title={t('packages.editorHost.saveConflictTitle', 'Save conflict')}
                disablePresentationControls
                actions={
                    <>
                        <Button
                            variant='outlined'
                            onClick={() => {
                                setSaveConflictDialogOpen(false)
                                setSaveStatus((current) => (current === 'conflict' ? 'idle' : current))
                            }}
                        >
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
