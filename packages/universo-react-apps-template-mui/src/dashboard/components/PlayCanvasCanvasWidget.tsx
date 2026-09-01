import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import RotateLeftRoundedIcon from '@mui/icons-material/RotateLeftRounded'
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded'
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded'
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded'
import {
    normalizeMmoommRuntimeMetadata,
    playcanvasCanvasWidgetConfigSchema,
    readLocalizedTextValue,
    type MmoommVisualLabScene
} from '@universo-react/types'
import { fetchRuntimePlayCanvasManifests } from '../../api/api'
import { useDashboardDetails } from '../DashboardDetailsContext'
import {
    isFiniteVector3,
    isRealtimeMovementEnabled,
    usePlayCanvasCanvasRuntime,
    type PlayCanvasControlCanvas,
    type RealtimeStatus,
    type SceneObjectConfig
} from './playcanvasCanvasWidgetRuntime'
import { executeClientModuleMethod } from '../runtime/browserModuleRuntime'
import { createClientModuleContext, isClientModuleMethodTarget, useRuntimeWidgetClientModule } from './runtimeWidgetHelpers'

interface RuntimeModuleMountModel {
    scene?: {
        objects?: SceneObjectConfig[]
        controlledObjectId?: string
        targetObjectId?: string
    }
    visualLab?: MmoommVisualLabScene
}

interface PlayCanvasCanvasWidgetProps {
    widgetId?: string
    config?: Record<string, unknown>
}

const DEFAULT_SCENE_OBJECTS: SceneObjectConfig[] = [
    { id: 'controlled', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 }, selectable: true },
    { id: 'target', position: { x: 72, y: 0, z: -48 }, scale: { x: 48, y: 16, z: 16 }, selectable: true, guard: true }
]

const VISUAL_LAB_FAMILY_TRANSLATION_KEYS: Record<string, string> = {
    softWhiteLinkup: 'softWhiteLinkup',
    typeGlow: 'typeGlow',
    lowPolyRetrowave: 'lowPolyRetrowave',
    channelDegradation: 'channelDegradation'
}

const VISUAL_LAB_FAMILY_FALLBACK_LABELS: Record<string, string> = {
    softWhiteLinkup: 'Soft white linkup',
    typeGlow: 'Type glow',
    lowPolyRetrowave: 'Low-poly retrowave',
    channelDegradation: 'Channel degradation',
    unknown: 'Visual style'
}

const normalizeSceneObject = (value: unknown): SceneObjectConfig | null => {
    if (!value || typeof value !== 'object') {
        return null
    }
    const candidate = value as Partial<SceneObjectConfig>
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
        return null
    }
    if (!isFiniteVector3(candidate.position) || !isFiniteVector3(candidate.scale)) {
        return null
    }
    return {
        id: candidate.id.trim().slice(0, 128),
        role: candidate.role === 'camera' ? 'camera' : 'mesh',
        position: { x: candidate.position.x, y: candidate.position.y, z: candidate.position.z },
        scale: { x: candidate.scale.x, y: candidate.scale.y, z: candidate.scale.z },
        selectable: candidate.selectable === true,
        guard: candidate.guard === true
    }
}

const normalizeRuntimeModuleMountModel = (value: unknown): RuntimeModuleMountModel => {
    if (!value || typeof value !== 'object') {
        return {}
    }
    const scene = (value as { scene?: unknown }).scene
    if (!scene || typeof scene !== 'object') {
        return {}
    }
    const sceneRecord = scene as { objects?: unknown; controlledObjectId?: unknown; targetObjectId?: unknown }
    const objects = Array.isArray(sceneRecord.objects)
        ? sceneRecord.objects
              .map(normalizeSceneObject)
              .filter((object): object is SceneObjectConfig => Boolean(object))
              .slice(0, 64)
        : undefined
    return {
        scene: {
            objects: objects?.length ? objects : undefined,
            controlledObjectId:
                typeof sceneRecord.controlledObjectId === 'string' ? sceneRecord.controlledObjectId.slice(0, 128) : undefined,
            targetObjectId: typeof sceneRecord.targetObjectId === 'string' ? sceneRecord.targetObjectId.slice(0, 128) : undefined
        }
    }
}

const normalizePublishedManifestSceneModel = (value: unknown): RuntimeModuleMountModel => {
    if (!value || typeof value !== 'object') {
        return {}
    }
    const metadata = (value as { metadata?: unknown }).metadata
    const mmoomm = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as { mmoomm?: unknown }).mmoomm : null
    const normalizedMmoomm = normalizeMmoommRuntimeMetadata(mmoomm)
    return { ...normalizeRuntimeModuleMountModel({ scene: normalizedMmoomm?.scene }), visualLab: normalizedMmoomm?.visualLab }
}

const resolveRuntimeAccessMode = (configuredMode: 'member' | 'public' | undefined): 'member' | 'public' => {
    if (configuredMode) {
        return configuredMode
    }
    if (typeof window !== 'undefined' && /^\/public\/a\//.test(window.location.pathname)) {
        return 'public'
    }
    return 'member'
}

export default function PlayCanvasCanvasWidget({ widgetId, config }: PlayCanvasCanvasWidgetProps) {
    const { t, i18n } = useTranslation('apps')
    const details = useDashboardDetails()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const dragRef = useRef<{ x: number; y: number } | null>(null)
    const capturedPointerIdRef = useRef<number | null>(null)
    const draggedRef = useRef(false)
    const [error, setError] = useState<string | null>(null)
    const [ready, setReady] = useState(false)
    const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
    const [measuredCanvasHeight, setMeasuredCanvasHeight] = useState<number | null>(null)
    const [participantSummary, setParticipantSummary] = useState({ total: 0, remote: 0 })
    const [localShipAssigned, setLocalShipAssigned] = useState(false)
    const [selectedVisualLabVariant, setSelectedVisualLabVariant] = useState<string | null>(null)
    const [visualLabVariantFocusRequested, setVisualLabVariantFocusRequested] = useState(false)
    const loadFailedMessageRef = useRef(t('playcanvasCanvas.loadFailed', 'The 3D scene could not be loaded.'))
    loadFailedMessageRef.current = t('playcanvasCanvas.loadFailed', 'The 3D scene could not be loaded.')
    const scriptLoadFailedMessageRef = useRef(t('playcanvasCanvas.scriptLoadFailed', 'Published script assets failed to load'))
    scriptLoadFailedMessageRef.current = t('playcanvasCanvas.scriptLoadFailed', 'Published script assets failed to load')
    const webglUnavailableMessageRef = useRef(
        t('playcanvasCanvas.webglUnavailable', '3D rendering is not available on this device or browser.')
    )
    webglUnavailableMessageRef.current = t('playcanvasCanvas.webglUnavailable', '3D rendering is not available on this device or browser.')

    const parsed = useMemo(() => playcanvasCanvasWidgetConfigSchema.safeParse(config ?? {}), [config])
    const widgetConfig = parsed.success ? parsed.data : undefined
    const moduleCodename = typeof widgetConfig?.moduleCodename === 'string' ? widgetConfig.moduleCodename : null
    const mountMethodName = widgetConfig?.mountMethodName?.trim() || 'mount'
    const queryKeyPrefix = Array.isArray(details?.runtimeQueryKeyPrefix) ? details.runtimeQueryKeyPrefix.join(':') : 'runtime'
    const applicationId = details?.applicationId
    const objectCollectionId = details?.objectCollectionId
    const currentWorkspaceId = details?.currentWorkspaceId ?? null
    const runtimeAccessMode = resolveRuntimeAccessMode(details?.runtimeAccessMode)
    const canControlScene = runtimeAccessMode === 'member' && details?.permissions?.editContent === true
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'

    const runtimeClientModule = useRuntimeWidgetClientModule({
        queryKeyPrefix,
        apiBaseUrl,
        applicationId,
        objectCollectionId,
        moduleCodename,
        attachedToKind: widgetConfig?.attachedToKind ?? 'metahub'
    })

    const selectedModule = runtimeClientModule.selectedModule
    const clientBundle = runtimeClientModule.clientBundle
    const runtimeModuleHasMountMethod = selectedModule
        ? selectedModule.manifest.methods.some(
              (method) => method.name === mountMethodName && isClientModuleMethodTarget(method.target) && !method.eventName
          )
        : !moduleCodename
    const runtimeModuleMountQuery = useQuery({
        queryKey: [queryKeyPrefix, 'playcanvas-module-mount', applicationId, selectedModule?.id, mountMethodName, i18n.language],
        enabled: Boolean(applicationId && selectedModule && clientBundle && runtimeModuleHasMountMethod),
        queryFn: async () => {
            if (!applicationId || !selectedModule || !clientBundle) {
                return null
            }
            return await executeClientModuleMethod({
                bundle: clientBundle,
                methodName: mountMethodName,
                args: [{ locale: i18n.language, scene: widgetConfig?.scene ?? null }],
                context: createClientModuleContext({ apiBaseUrl, applicationId, module: selectedModule })
            })
        }
    })
    const runtimeModuleMount = useMemo(() => normalizeRuntimeModuleMountModel(runtimeModuleMountQuery.data), [runtimeModuleMountQuery.data])
    const runtimeManifestBinding = widgetConfig?.runtimeManifest
    const runtimeManifestQuery = useQuery({
        queryKey: [
            queryKeyPrefix,
            'playcanvas-runtime-manifests',
            applicationId,
            runtimeManifestBinding?.projectId,
            runtimeManifestBinding?.sceneId ?? null,
            runtimeManifestBinding?.checksum
        ],
        enabled: Boolean(applicationId && runtimeManifestBinding),
        queryFn: async () => {
            if (!applicationId) {
                return null
            }
            const response = await fetchRuntimePlayCanvasManifests({ apiBaseUrl, applicationId })
            return (
                response.manifests.find(
                    (manifest) =>
                        manifest.projectId === runtimeManifestBinding?.projectId &&
                        (manifest.sceneId ?? null) === (runtimeManifestBinding.sceneId ?? null) &&
                        manifest.checksum === runtimeManifestBinding.checksum
                ) ?? null
            )
        }
    })
    const publishedManifestScene = useMemo(
        () => normalizePublishedManifestSceneModel(runtimeManifestQuery.data),
        [runtimeManifestQuery.data]
    )
    const publishedManifestScripts = useMemo(() => runtimeManifestQuery.data?.scripts ?? [], [runtimeManifestQuery.data])
    const visualLabScene = publishedManifestScene.visualLab
    const isVisualLabScene = Boolean(visualLabScene?.objects.length)
    const visualLabVariants = useMemo(() => visualLabScene?.variants ?? [], [visualLabScene?.variants])
    const visualLabVariantSlugs = useMemo(() => visualLabVariants.map((variant) => variant.slug), [visualLabVariants])
    const visualLabVariantSignature = visualLabVariantSlugs.join('|')
    const selectedVisualLabVariantInfo =
        visualLabVariants.find((variant) => variant.slug === selectedVisualLabVariant) ?? visualLabVariants[0]
    const resolveVisualLabFamilyLabel = (family: string): string => {
        const normalizedFamily = family.trim()
        const translationKey = VISUAL_LAB_FAMILY_TRANSLATION_KEYS[normalizedFamily] ?? 'unknown'
        return t(`playcanvasCanvas.visualLab.families.${translationKey}`, {
            defaultValue: VISUAL_LAB_FAMILY_FALLBACK_LABELS[translationKey] ?? VISUAL_LAB_FAMILY_FALLBACK_LABELS.unknown
        })
    }
    const selectedVisualLabFamilyLabel = selectedVisualLabVariantInfo
        ? resolveVisualLabFamilyLabel(selectedVisualLabVariantInfo.family)
        : null
    const runtimeManifestFailClosed = runtimeManifestBinding?.failClosed !== false
    const title = readLocalizedTextValue(widgetConfig?.title, details?.locale ?? 'en') ?? t('playcanvasCanvas.title', '3D scene')
    const sceneObjects = useMemo<SceneObjectConfig[]>(
        () =>
            (publishedManifestScene.scene?.objects?.length
                ? publishedManifestScene.scene.objects
                : runtimeManifestBinding && runtimeManifestFailClosed
                ? []
                : runtimeModuleMount.scene?.objects?.length
                ? runtimeModuleMount.scene.objects
                : widgetConfig?.scene?.objects?.length
                ? widgetConfig.scene.objects
                : DEFAULT_SCENE_OBJECTS) as SceneObjectConfig[],
        [
            publishedManifestScene.scene?.objects,
            runtimeManifestBinding,
            runtimeManifestFailClosed,
            runtimeModuleMount.scene?.objects,
            widgetConfig?.scene?.objects
        ]
    )
    const publishedSceneHasObjects = Boolean(publishedManifestScene.scene?.objects?.length)
    const configuredControlledObjectId = publishedSceneHasObjects
        ? publishedManifestScene.scene?.controlledObjectId
        : runtimeModuleMount.scene?.controlledObjectId ?? widgetConfig?.scene?.controlledObjectId
    const controlledObjectId =
        configuredControlledObjectId && sceneObjects.some((item) => item.id === configuredControlledObjectId)
            ? configuredControlledObjectId
            : sceneObjects[0]?.id ?? 'controlled'
    const configuredTargetObjectId = publishedSceneHasObjects
        ? publishedManifestScene.scene?.targetObjectId
        : runtimeModuleMount.scene?.targetObjectId ?? widgetConfig?.scene?.targetObjectId
    const targetObjectId =
        configuredTargetObjectId && sceneObjects.some((item) => item.id === configuredTargetObjectId && item.id !== controlledObjectId)
            ? configuredTargetObjectId
            : sceneObjects.find((item) => item.id !== controlledObjectId)?.id
    const manifestBindingLoading = Boolean(runtimeManifestBinding && runtimeManifestQuery.isLoading)
    const manifestBindingError = Boolean(runtimeManifestBinding && runtimeManifestQuery.isError)
    const manifestBindingMissing = Boolean(
        runtimeManifestBinding && !manifestBindingLoading && !manifestBindingError && !runtimeManifestQuery.data
    )
    const manifestBindingSceneMissing = Boolean(
        runtimeManifestBinding && runtimeManifestQuery.data && !publishedManifestScene.scene?.objects?.length && !isVisualLabScene
    )
    const manifestBindingReady =
        !runtimeManifestBinding ||
        !runtimeManifestFailClosed ||
        (!manifestBindingLoading && !manifestBindingError && !manifestBindingMissing && !manifestBindingSceneMissing)
    const minHeight = widgetConfig?.minHeight ?? 560
    const heightMode = widgetConfig?.heightMode ?? 'fitViewport'
    const canvasHeight =
        heightMode === 'fitViewport'
            ? measuredCanvasHeight ?? {
                  xs: `clamp(320px, calc(100dvh - 220px), 1200px)`,
                  md: `clamp(${minHeight}px, calc(100dvh - 180px), 1200px)`
              }
            : minHeight
    const runtimeModuleDiscoveryPending = Boolean(applicationId && runtimeClientModule.modulesQuery.isLoading)
    const requiresRuntimeModule = Boolean(applicationId && (moduleCodename || selectedModule || runtimeModuleDiscoveryPending))
    const runtimeModuleLoading =
        requiresRuntimeModule &&
        (runtimeClientModule.modulesQuery.isLoading ||
            runtimeClientModule.clientBundleQuery.isLoading ||
            (runtimeModuleHasMountMethod && runtimeModuleMountQuery.isLoading))
    const runtimeModuleError =
        requiresRuntimeModule &&
        (runtimeClientModule.modulesQuery.isError || runtimeClientModule.clientBundleQuery.isError || runtimeModuleMountQuery.isError)
    const runtimeModuleMissing =
        requiresRuntimeModule &&
        !runtimeModuleLoading &&
        !runtimeModuleError &&
        (!selectedModule || !clientBundle || !runtimeModuleHasMountMethod)
    const runtimeModuleReady =
        isVisualLabScene ||
        !requiresRuntimeModule ||
        (!runtimeModuleLoading && !runtimeModuleError && !runtimeModuleMissing && runtimeModuleMountQuery.isSuccess)
    const sceneReady = runtimeModuleReady && manifestBindingReady

    useEffect(() => {
        if (!isVisualLabScene || visualLabVariantSlugs.length === 0) {
            setSelectedVisualLabVariant(null)
            setVisualLabVariantFocusRequested(false)
            return
        }
        setVisualLabVariantFocusRequested(false)
        setSelectedVisualLabVariant((current) => (current && visualLabVariantSlugs.includes(current) ? current : visualLabVariantSlugs[0]))
    }, [isVisualLabScene, visualLabVariantSignature, visualLabVariantSlugs])

    useEffect(() => {
        if (!isVisualLabScene || !ready || !selectedVisualLabVariant || !visualLabVariantFocusRequested) {
            return
        }
        const canvas = canvasRef.current
        if (!canvas) {
            return
        }
        const event = new CustomEvent('playcanvas-visual-lab-focus-variant', { detail: selectedVisualLabVariant })
        canvas.dispatchEvent(event)
    }, [isVisualLabScene, ready, selectedVisualLabVariant, visualLabVariantFocusRequested])

    useEffect(() => {
        if (widgetConfig?.heightMode !== 'fitViewport' || !sceneReady) {
            setMeasuredCanvasHeight(null)
            return undefined
        }

        const updateMeasuredHeight = () => {
            const container = containerRef.current
            if (!container) {
                return
            }
            const rect = container.getBoundingClientRect()
            const viewportHeight = Math.min(
                window.visualViewport?.height ?? window.innerHeight,
                document.documentElement.clientHeight || window.innerHeight
            )
            const viewportWidth = Math.min(
                window.visualViewport?.width ?? window.innerWidth,
                document.documentElement.clientWidth || window.innerWidth
            )
            const bottomGap = viewportWidth < 600 ? 19 : 23
            const availableHeight = Math.max(1, viewportHeight - rect.top - bottomGap)
            const nextHeight = Math.floor(Math.min(1200, availableHeight))
            setMeasuredCanvasHeight((current) => (current === nextHeight ? current : nextHeight))
        }

        updateMeasuredHeight()
        window.addEventListener('resize', updateMeasuredHeight)
        window.visualViewport?.addEventListener('resize', updateMeasuredHeight)
        const observer = new ResizeObserver(updateMeasuredHeight)
        const container = containerRef.current
        if (container) {
            observer.observe(container)
        }
        return () => {
            window.removeEventListener('resize', updateMeasuredHeight)
            window.visualViewport?.removeEventListener('resize', updateMeasuredHeight)
            observer.disconnect()
        }
    }, [
        canControlScene,
        error,
        localShipAssigned,
        minHeight,
        participantSummary.total,
        ready,
        realtimeStatus,
        sceneReady,
        widgetConfig?.heightMode
    ])

    usePlayCanvasCanvasRuntime({
        sceneReady,
        canvasRef,
        containerRef,
        applicationId,
        apiBaseUrl,
        canControlScene,
        currentWorkspaceId,
        objectCollectionId,
        moduleCodename,
        runtimeAccessMode,
        widgetId,
        sceneObjects,
        controlledObjectId,
        targetObjectId,
        visualLabScene,
        requiresRuntimeModule,
        publishedManifestScripts,
        selectedModuleCodename: selectedModule?.codename,
        sceneConfig: widgetConfig?.scene
            ? { intentDistance: widgetConfig.scene.intentDistance, cruiseSpeed: widgetConfig.scene.cruiseSpeed }
            : undefined,
        cameraConfig: widgetConfig?.camera,
        loadFailedMessageRef,
        scriptLoadFailedMessageRef,
        webglUnavailableMessageRef,
        setError,
        setReady,
        setRealtimeStatus,
        setParticipantSummary,
        setLocalShipAssigned
    })

    const movementControlsEnabled =
        ready && !isVisualLabScene && localShipAssigned && isRealtimeMovementEnabled(realtimeStatus, canControlScene)

    const moveToConfiguredTarget = () => {
        if (!movementControlsEnabled) {
            return
        }
        const target = sceneObjects.find((item) => item.id === targetObjectId)
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        if (target && canvas?.__playcanvasMoveToTarget) {
            canvas.__playcanvasMoveToTarget(target.position, target.id)
        }
    }

    const stop = () => {
        if (!movementControlsEnabled) {
            return
        }
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        canvas?.__playcanvasMoveToTarget?.(null)
    }

    const updateCamera = (kind: 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight' | 'reset') => {
        const canvas = canvasRef.current
        if (!canvas) return
        const event = new CustomEvent('playcanvas-camera-control', { detail: kind })
        canvas.dispatchEvent(event)
    }

    const focusVisualLabVariant = (slug: string) => {
        setVisualLabVariantFocusRequested(true)
        setSelectedVisualLabVariant(slug)
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.focus({ preventScroll: true })
    }

    const releaseCapturedPointer = (canvas: HTMLCanvasElement | null) => {
        const pointerId = capturedPointerIdRef.current
        if (canvas && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
            canvas.releasePointerCapture(pointerId)
        }
        if (canvas) {
            canvas.dataset.pointerCaptured = 'false'
        }
        capturedPointerIdRef.current = null
    }

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        capturedPointerIdRef.current = event.pointerId
        event.currentTarget.dataset.pointerCaptured = 'true'
        draggedRef.current = false
        dragRef.current = { x: event.clientX, y: event.clientY }
    }

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!dragRef.current || event.buttons !== 1) return
        const deltaX = event.clientX - dragRef.current.x
        const deltaY = event.clientY - dragRef.current.y
        if (Math.abs(deltaX) + Math.abs(deltaY) > 2) {
            draggedRef.current = true
        }
        dragRef.current = { x: event.clientX, y: event.clientY }
        const canvas = canvasRef.current
        if (!canvas) return
        const cameraControl = new CustomEvent('playcanvas-camera-drag', { detail: { deltaX, deltaY } })
        canvas.dispatchEvent(cameraControl)
    }

    const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        releaseCapturedPointer(event.currentTarget)
        dragRef.current = null
    }

    const handlePointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        releaseCapturedPointer(event.currentTarget)
        dragRef.current = null
    }

    const handleCanvasClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
        if (draggedRef.current) {
            return
        }
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        const picked = canvas?.__playcanvasPickAt?.(event.clientX, event.clientY, false)
        if (picked?.objectId) {
            canvas?.__playcanvasMoveToTarget?.(picked.point, picked.objectId)
        }
    }

    const handleCanvasDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
        if (draggedRef.current) {
            return
        }
        const canvas = canvasRef.current as PlayCanvasControlCanvas | null
        const picked = canvas?.__playcanvasPickAt?.(event.clientX, event.clientY, true)
        if (picked && !picked.objectId) {
            canvas?.__playcanvasMoveToTarget?.(picked.point)
        }
    }

    const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            moveToConfiguredTarget()
        } else if (event.key === 'Escape') {
            event.preventDefault()
            releaseCapturedPointer(event.currentTarget)
            dragRef.current = null
            stop()
        } else if (event.key === '+' || event.key === '=') {
            event.preventDefault()
            updateCamera('zoomIn')
        } else if (event.key === '-' || event.key === '_') {
            event.preventDefault()
            updateCamera('zoomOut')
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            updateCamera('rotateLeft')
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            updateCamera('rotateRight')
        }
    }

    if (!parsed.success) {
        return <Alert severity='warning'>{t('playcanvasCanvas.invalidConfig', 'The 3D scene configuration is invalid.')}</Alert>
    }
    const runtimeModuleAlert = isVisualLabScene
        ? null
        : runtimeModuleLoading
        ? { severity: 'info' as const, message: t('playcanvasCanvas.moduleLoading', 'Loading 3D runtime module...') }
        : runtimeModuleError
        ? {
              severity: 'error' as const,
              message: t('playcanvasCanvas.moduleLoadFailed', 'The 3D runtime module could not be loaded.')
          }
        : runtimeModuleMissing
        ? {
              severity: 'warning' as const,
              message: t('playcanvasCanvas.moduleUnavailable', 'The 3D runtime module is unavailable.')
          }
        : null
    const manifestBindingAlert = manifestBindingLoading
        ? { severity: 'info' as const, message: t('playcanvasCanvas.manifestLoading', 'Loading published 3D scene...') }
        : manifestBindingError
        ? {
              severity: 'error' as const,
              message: t('playcanvasCanvas.manifestLoadFailed', 'The published 3D scene could not be loaded.')
          }
        : manifestBindingMissing
        ? {
              severity: 'warning' as const,
              message: t('playcanvasCanvas.manifestUnavailable', 'The published 3D scene is unavailable.')
          }
        : manifestBindingSceneMissing
        ? {
              severity: 'warning' as const,
              message: t('playcanvasCanvas.manifestSceneUnavailable', 'The published 3D scene does not contain a runtime scene.')
          }
        : null
    const realtimeAlert =
        realtimeStatus === 'unauthorized'
            ? {
                  severity: 'error' as const,
                  message: t('playcanvasCanvas.realtime.unauthorizedDescription', 'Realtime control is not available for your account.')
              }
            : realtimeStatus === 'room_full'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.roomFullDescription', 'Realtime room is full. Try again later.')
              }
            : realtimeStatus === 'version_mismatch'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.versionMismatchDescription', 'Realtime version mismatch. Reload the application.')
              }
            : realtimeStatus === 'unavailable' && !isVisualLabScene
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.unavailableDescription', 'Realtime control is unavailable for this application.')
              }
            : realtimeStatus === 'reconnecting'
            ? {
                  severity: 'info' as const,
                  message: t('playcanvasCanvas.realtime.reconnectingDescription', 'Realtime control is reconnecting.')
              }
            : realtimeStatus === 'restored'
            ? {
                  severity: 'success' as const,
                  message: t('playcanvasCanvas.realtime.restoredDescription', 'Realtime control was restored.')
              }
            : realtimeStatus === 'failed_reconnect'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.failedReconnectDescription', 'Realtime control could not reconnect.')
              }
            : realtimeStatus === 'disconnected'
            ? {
                  severity: 'warning' as const,
                  message: t('playcanvasCanvas.realtime.disconnectedDescription', 'Realtime control is not connected.')
              }
            : null
    const runtimeStatusLabel = isVisualLabScene
        ? t('playcanvasCanvas.visualLab.staticMode', 'Static visual lab')
        : t(`playcanvasCanvas.realtime.${realtimeStatus}`, realtimeStatus)
    const runtimeStatusTestId = isVisualLabScene ? 'playcanvas-runtime-mode-status' : 'playcanvas-realtime-status'
    const showViewOnlyState = (realtimeStatus === 'connected' || realtimeStatus === 'restored') && (!canControlScene || !localShipAssigned)

    return (
        <Box data-testid='playcanvas-canvas-widget' sx={{ width: '100%', minWidth: 0 }}>
            <Stack direction='row' spacing={1} sx={{ mb: 1, minWidth: 0, flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
                <Typography variant='h6' sx={{ flex: 1, minWidth: 0 }}>
                    {title}
                </Typography>
                <Typography variant='caption' color='text.secondary' data-testid={runtimeStatusTestId} sx={{ minWidth: 0 }}>
                    {runtimeStatusLabel}
                </Typography>
                {participantSummary.total > 0 ? (
                    <Typography variant='caption' color='text.secondary' data-testid='playcanvas-participants-status' sx={{ minWidth: 0 }}>
                        {canControlScene
                            ? t('playcanvasCanvas.participantsStatus', {
                                  defaultValue: `Ships: ${participantSummary.total} (you + ${participantSummary.remote} remote)`,
                                  total: participantSummary.total,
                                  remote: participantSummary.remote
                              })
                            : t('playcanvasCanvas.participantsViewOnlyStatus', {
                                  defaultValue: `Ships: ${participantSummary.total} (view only)`,
                                  total: participantSummary.total
                              })}
                    </Typography>
                ) : null}
                {showViewOnlyState ? (
                    <Typography variant='caption' color='text.secondary' data-testid='playcanvas-control-mode' sx={{ minWidth: 0 }}>
                        {t('playcanvasCanvas.viewOnly', 'View only')}
                    </Typography>
                ) : null}
                <Tooltip title={t('playcanvasCanvas.moveToTarget', 'Move to target')}>
                    <span>
                        <IconButton
                            aria-label={t('playcanvasCanvas.moveToTarget', 'Move to target')}
                            onClick={moveToConfiguredTarget}
                            disabled={!movementControlsEnabled}
                            size='small'
                        >
                            <MyLocationRoundedIcon fontSize='small' />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.stop', 'Stop')}>
                    <span>
                        <IconButton
                            aria-label={t('playcanvasCanvas.stop', 'Stop')}
                            onClick={stop}
                            disabled={!movementControlsEnabled}
                            size='small'
                        >
                            <PauseRoundedIcon fontSize='small' />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.resetCamera', 'Reset camera')}>
                    <IconButton
                        aria-label={t('playcanvasCanvas.resetCamera', 'Reset camera')}
                        onClick={() => updateCamera('reset')}
                        size='small'
                    >
                        <CenterFocusStrongRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.zoomIn', 'Zoom in')}>
                    <IconButton aria-label={t('playcanvasCanvas.zoomIn', 'Zoom in')} onClick={() => updateCamera('zoomIn')} size='small'>
                        <ZoomInRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.zoomOut', 'Zoom out')}>
                    <IconButton aria-label={t('playcanvasCanvas.zoomOut', 'Zoom out')} onClick={() => updateCamera('zoomOut')} size='small'>
                        <ZoomOutRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.rotateLeft', 'Rotate left')}>
                    <IconButton
                        aria-label={t('playcanvasCanvas.rotateLeft', 'Rotate left')}
                        onClick={() => updateCamera('rotateLeft')}
                        size='small'
                    >
                        <RotateLeftRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
                <Tooltip title={t('playcanvasCanvas.rotateRight', 'Rotate right')}>
                    <IconButton
                        aria-label={t('playcanvasCanvas.rotateRight', 'Rotate right')}
                        onClick={() => updateCamera('rotateRight')}
                        size='small'
                    >
                        <RotateRightRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            </Stack>
            {runtimeModuleAlert ? <Alert severity={runtimeModuleAlert.severity}>{runtimeModuleAlert.message}</Alert> : null}
            {manifestBindingAlert ? <Alert severity={manifestBindingAlert.severity}>{manifestBindingAlert.message}</Alert> : null}
            {error ? <Alert severity='error'>{error}</Alert> : null}
            {!ready && !error && !runtimeModuleAlert && !manifestBindingAlert ? (
                <Alert severity='info'>{t('playcanvasCanvas.loading', 'Loading 3D scene...')}</Alert>
            ) : null}
            {ready && realtimeAlert && !error ? <Alert severity={realtimeAlert.severity}>{realtimeAlert.message}</Alert> : null}
            {isVisualLabScene && visualLabVariants.length > 0 ? (
                <Box
                    data-testid='playcanvas-visual-lab-legend'
                    sx={{
                        mb: 1,
                        p: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.default',
                        minWidth: 0,
                        '@media (max-width: 900px), (max-height: 700px)': {
                            maxHeight: 104,
                            overflowY: 'auto'
                        }
                    }}
                >
                    <Stack
                        direction='row'
                        spacing={1}
                        sx={{
                            mb: 1,
                            minWidth: 0,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            rowGap: 0.5,
                            '@media (max-width: 900px), (max-height: 700px)': {
                                mb: 0.5
                            }
                        }}
                    >
                        <Typography variant='subtitle2' sx={{ minWidth: 0 }}>
                            {t('playcanvasCanvas.visualLab.variants', 'Visual variants')}
                        </Typography>
                        {selectedVisualLabVariantInfo ? (
                            <Typography
                                variant='caption'
                                color='text.secondary'
                                data-testid='playcanvas-visual-lab-selected'
                                sx={{ minWidth: 0 }}
                            >
                                {t('playcanvasCanvas.visualLab.selectedVariant', {
                                    defaultValue: `Selected: ${selectedVisualLabVariantInfo.index}. ${selectedVisualLabVariantInfo.title} · ${selectedVisualLabFamilyLabel}`,
                                    index: selectedVisualLabVariantInfo.index,
                                    title: selectedVisualLabVariantInfo.title,
                                    family: selectedVisualLabFamilyLabel
                                })}
                            </Typography>
                        ) : null}
                    </Stack>
                    <Stack
                        direction='row'
                        spacing={0.75}
                        useFlexGap
                        sx={{
                            flexWrap: 'wrap',
                            minWidth: 0,
                            '@media (max-width: 900px), (max-height: 700px)': {
                                flexWrap: 'nowrap',
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                pb: 0.5
                            }
                        }}
                    >
                        {visualLabVariants.map((variant) => {
                            const selected = variant.slug === selectedVisualLabVariant
                            return (
                                <Box
                                    key={variant.slug}
                                    component='button'
                                    type='button'
                                    data-testid={`playcanvas-visual-lab-variant-${variant.slug}`}
                                    data-visual-lab-family={variant.family}
                                    aria-pressed={selected}
                                    onClick={() => focusVisualLabVariant(variant.slug)}
                                    sx={{
                                        appearance: 'none',
                                        border: 1,
                                        borderColor: selected ? 'primary.main' : 'divider',
                                        borderRadius: 1,
                                        bgcolor: selected ? 'action.selected' : 'background.paper',
                                        color: 'text.primary',
                                        cursor: 'pointer',
                                        font: 'inherit',
                                        px: 1,
                                        py: 0.5,
                                        minWidth: 0,
                                        maxWidth: { xs: '100%', sm: 220 },
                                        '@media (max-width: 900px), (max-height: 700px)': {
                                            flex: '0 0 auto',
                                            maxWidth: 180,
                                            py: 0.375
                                        },
                                        textAlign: 'left',
                                        '&:focus-visible': {
                                            outline: '2px solid',
                                            outlineColor: 'primary.main',
                                            outlineOffset: 2
                                        }
                                    }}
                                >
                                    <Typography component='span' variant='caption' sx={{ display: 'block', fontWeight: 600 }}>
                                        {variant.index}. {variant.title}
                                    </Typography>
                                    <Typography component='span' variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                                        {resolveVisualLabFamilyLabel(variant.family)}
                                    </Typography>
                                </Box>
                            )
                        })}
                    </Stack>
                </Box>
            ) : null}
            {sceneReady ? (
                <Box ref={containerRef} sx={{ width: '100%', minWidth: 0, height: canvasHeight, bgcolor: '#020611', overflow: 'hidden' }}>
                    <canvas
                        ref={canvasRef}
                        data-testid='playcanvas-canvas'
                        aria-label={t('playcanvasCanvas.canvasLabel', 'Interactive 3D flight scene')}
                        tabIndex={0}
                        onClick={handleCanvasClick}
                        onDoubleClick={handleCanvasDoubleClick}
                        onKeyDown={handleCanvasKeyDown}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onPointerLeave={handlePointerCancel}
                        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', backgroundColor: '#020611' }}
                    />
                </Box>
            ) : null}
        </Box>
    )
}
