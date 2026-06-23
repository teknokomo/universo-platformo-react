import * as pc from '@universo-react/playcanvas-engine'
import {
    applySceneFog,
    createBasicApplication,
    createLowPolySphereEntity,
    createPrimitiveEntity,
    createTranslucentStandardMaterial,
    resizeApplicationCanvas,
    resolveFollowCameraPosition,
    rotateFollowCamera,
    zoomFollowCamera,
    type Vector3Like
} from '@universo-react/playcanvas-engine'
import type { MmoommVisualLabScene } from '@universo-react/types'

const DEFAULT_VISUAL_LAB_FOG_COLOR = [0.045, 0.055, 0.08] as const
const DEFAULT_VISUAL_LAB_FOG_DENSITY = 0.014
const OVERVIEW_OBJECT_SCALE = 3
const FOCUSED_OBJECT_SCALE = 2.85
const MIN_READABLE_CORE_OPACITY = 0.34
const MIN_READABLE_GLOW_OPACITY = 0.1
const clampOpacity = (value: number, fallback: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : fallback))
const resolveReadableOpacity = (value: number, minimum: number): number => Math.min(1, Math.max(minimum, value))

const formatRange = (values: number[]): string => {
    if (values.length === 0) return ''
    const min = Math.min(...values)
    const max = Math.max(...values)
    return `${min.toFixed(2)}:${max.toFixed(2)}`
}

type VisualLabRenderable = {
    variant: string
    entity: pc.Entity & { enabled?: boolean }
    baseScale: Vector3Like
}

type VisualLabOverviewRenderable = {
    entity: pc.Entity & { enabled?: boolean }
    baseScale: Vector3Like
}

type VisualLabBounds = {
    center: Vector3Like
    radius: number
}

const resolveInitialVariantSlug = (visualLabScene: MmoommVisualLabScene): string | null =>
    visualLabScene.variants?.[0]?.slug ?? visualLabScene.objects[0]?.variant ?? null

const resolveVisualLabBounds = (objects: MmoommVisualLabScene['objects']): VisualLabBounds | null => {
    if (objects.length === 0) return null

    const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY }
    const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY }

    for (const object of objects) {
        const halfX = (object.scale.x * object.shellScale) / 2
        const halfY = (object.scale.y * object.shellScale) / 2
        const halfZ = (object.scale.z * object.shellScale) / 2
        min.x = Math.min(min.x, object.position.x - halfX)
        min.y = Math.min(min.y, object.position.y - halfY)
        min.z = Math.min(min.z, object.position.z - halfZ)
        max.x = Math.max(max.x, object.position.x + halfX)
        max.y = Math.max(max.y, object.position.y + halfY)
        max.z = Math.max(max.z, object.position.z + halfZ)
    }

    const center = {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        z: (min.z + max.z) / 2
    }
    const spanX = max.x - min.x
    const spanY = max.y - min.y
    const spanZ = max.z - min.z
    return {
        center,
        radius: Math.max(8, Math.sqrt(spanX * spanX + spanY * spanY + spanZ * spanZ) / 2)
    }
}

export interface VisualLinkupLabRuntimeMountOptions {
    canvas: HTMLCanvasElement
    container: HTMLDivElement
    visualLabScene: MmoommVisualLabScene
    requiresRuntimeModule: boolean
}

export const mountVisualLinkupLabRuntime = ({
    canvas,
    container,
    visualLabScene,
    requiresRuntimeModule
}: VisualLinkupLabRuntimeMountOptions): (() => void) => {
    let disposed = false
    container.style.backgroundColor = '#030303'
    canvas.style.backgroundColor = '#030303'
    const ownedMaterials: Array<{ destroy?: () => void }> = []
    const app = createBasicApplication(canvas)
    app.scene.ambientLight = new pc.Color(0.42, 0.44, 0.52)
    const fog = visualLabScene.sceneFog
    const runtimeFogDensity = Math.min(Math.max(fog?.density ?? DEFAULT_VISUAL_LAB_FOG_DENSITY, 0.0025), DEFAULT_VISUAL_LAB_FOG_DENSITY)
    applySceneFog(app.scene, {
        type: fog?.type ?? 'exp2',
        color: new pc.Color(...(fog?.color ?? DEFAULT_VISUAL_LAB_FOG_COLOR)),
        density: runtimeFogDensity
    })

    const light = new pc.Entity('visual-lab-main-light')
    light.addComponent('light', { type: 'directional', intensity: 4.6 })
    light.setEulerAngles(45, 45, 0)
    app.root.addChild(light)

    const camera = new pc.Entity('visual-lab-camera')
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.012, 0.012, 0.012),
        nearClip: 0.1,
        farClip: 520,
        fov: 58
    })
    app.root.addChild(camera)

    const coreOpacityValues: number[] = []
    const glowOpacityValues: number[] = []
    const renderables: VisualLabRenderable[] = []
    const overviewRenderables: VisualLabOverviewRenderable[] = []

    for (const object of visualLabScene.objects) {
        const coreOpacity = resolveReadableOpacity(
            clampOpacity(object.material?.core?.opacity ?? object.coreOpacity, object.coreOpacity),
            MIN_READABLE_CORE_OPACITY
        )
        const glowOpacity = resolveReadableOpacity(
            clampOpacity(object.material?.glow?.opacity ?? object.glowOpacity, object.glowOpacity),
            MIN_READABLE_GLOW_OPACITY
        )
        coreOpacityValues.push(coreOpacity)
        glowOpacityValues.push(glowOpacity)
        const coreMaterial = createTranslucentStandardMaterial({
            color: new pc.Color(1, 1, 1),
            emissive: new pc.Color(0.9, 0.92, 1),
            emissiveIntensity: 4.4,
            opacity: coreOpacity
        })
        ownedMaterials.push(coreMaterial)
        const lowPolyBands = typeof object.lowPolyBands === 'number' ? object.lowPolyBands : undefined
        const shouldUseLowPolySphere = object.primitive === 'sphere' && Number.isFinite(lowPolyBands)
        const core = shouldUseLowPolySphere
            ? createLowPolySphereEntity(app, {
                  name: object.name,
                  position: object.position,
                  scale: object.scale,
                  material: coreMaterial,
                  latitudeBands: lowPolyBands,
                  longitudeBands: lowPolyBands
              })
            : createPrimitiveEntity({
                  name: object.name,
                  primitive: object.primitive,
                  position: object.position,
                  scale: object.scale,
                  material: coreMaterial
              })
        app.root.addChild(core)
        renderables.push({ variant: object.variant, entity: core, baseScale: object.scale })

        const glowScale: Vector3Like = {
            x: object.scale.x * object.shellScale,
            y: object.scale.y * object.shellScale,
            z: object.scale.z * object.shellScale
        }
        const glowMaterial = createTranslucentStandardMaterial({
            color: new pc.Color(object.glowColor.r, object.glowColor.g, object.glowColor.b),
            emissive: new pc.Color(object.glowColor.r, object.glowColor.g, object.glowColor.b),
            emissiveIntensity: 14,
            opacity: glowOpacity,
            additive: true
        })
        ownedMaterials.push(glowMaterial)
        const glow = shouldUseLowPolySphere
            ? createLowPolySphereEntity(app, {
                  name: `${object.name} Glow Shell`,
                  position: object.position,
                  scale: glowScale,
                  material: glowMaterial,
                  latitudeBands: lowPolyBands,
                  longitudeBands: lowPolyBands
              })
            : createPrimitiveEntity({
                  name: `${object.name} Glow Shell`,
                  primitive: object.primitive,
                  position: object.position,
                  scale: glowScale,
                  material: glowMaterial
              })
        app.root.addChild(glow)
        renderables.push({ variant: object.variant, entity: glow, baseScale: glowScale })
    }

    const variantMarkers = visualLabScene.variants ?? []
    const markerColumns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, variantMarkers.length))))
    const markerSpacing = 1.75
    const markerOriginX = -((Math.min(markerColumns, variantMarkers.length) - 1) * markerSpacing) / 2
    const markerOriginY = 3.2
    variantMarkers.forEach((variant, index) => {
        const sampleObject = visualLabScene.objects.find((object) => object.variant === variant.slug) ?? visualLabScene.objects[index]
        if (!sampleObject) return
        const column = index % markerColumns
        const row = Math.floor(index / markerColumns)
        const markerScale = { x: 1.25, y: 0.42, z: 1.25 }
        const markerMaterial = createTranslucentStandardMaterial({
            color: new pc.Color(sampleObject.glowColor.r, sampleObject.glowColor.g, sampleObject.glowColor.b),
            emissive: new pc.Color(sampleObject.glowColor.r, sampleObject.glowColor.g, sampleObject.glowColor.b),
            emissiveIntensity: 9,
            opacity: 0.86,
            additive: true
        })
        ownedMaterials.push(markerMaterial)
        const marker = createPrimitiveEntity({
            name: `Visual Lab ${variant.index} Overview Marker`,
            primitive: index % 2 === 0 ? 'box' : 'sphere',
            position: {
                x: markerOriginX + column * markerSpacing,
                y: markerOriginY - row * markerSpacing * 0.72,
                z: -0.85
            },
            scale: markerScale,
            material: markerMaterial
        })
        app.root.addChild(marker)
        overviewRenderables.push({ entity: marker, baseScale: markerScale })
    })

    const observer = new ResizeObserver(([entry]) => {
        if (disposed) return
        resizeApplicationCanvas(app, entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(container)

    const labCameraState = {
        yaw: -0.2,
        pitch: 0.28,
        distance: 18,
        minDistance: 6,
        maxDistance: 260
    }
    const labTarget = { x: 0, y: 0, z: 0 }
    let focusedCameraDistance = labCameraState.distance
    let focusedCameraPitch = labCameraState.pitch
    const focusOverview = () => {
        const bounds = resolveVisualLabBounds(visualLabScene.objects)
        if (!bounds) return
        for (const item of renderables) {
            item.entity.enabled = true
            item.entity.setLocalScale(
                item.baseScale.x * OVERVIEW_OBJECT_SCALE,
                item.baseScale.y * OVERVIEW_OBJECT_SCALE,
                item.baseScale.z * OVERVIEW_OBJECT_SCALE
            )
        }
        for (const item of overviewRenderables) {
            item.entity.enabled = true
            item.entity.setLocalScale(item.baseScale.x, item.baseScale.y, item.baseScale.z)
        }
        labTarget.x = bounds.center.x
        labTarget.y = bounds.center.y
        labTarget.z = bounds.center.z
        focusedCameraDistance = Math.min(180, Math.max(18, bounds.radius * 2))
        focusedCameraPitch = 0.2
        labCameraState.distance = focusedCameraDistance
        labCameraState.pitch = focusedCameraPitch
        canvas.dataset.visualLabSelectedVariant = resolveInitialVariantSlug(visualLabScene) ?? 'overview'
        canvas.dataset.visualLabVisibleObjectCount = String(visualLabScene.objects.length)
    }
    const focusVariant = (slug: string) => {
        const visibleObjects = visualLabScene.objects.filter((object) => object.variant === slug)
        const focusedObjects = visibleObjects.length > 0 ? visibleObjects : visualLabScene.objects
        const bounds = resolveVisualLabBounds(focusedObjects)
        if (!bounds) return
        for (const item of renderables) {
            const isVisible = visibleObjects.length === 0 || item.variant === slug
            const focusScale = isVisible && visibleObjects.length > 0 ? FOCUSED_OBJECT_SCALE : 1
            item.entity.enabled = isVisible
            item.entity.setLocalScale(item.baseScale.x * focusScale, item.baseScale.y * focusScale, item.baseScale.z * focusScale)
        }
        for (const item of overviewRenderables) {
            item.entity.enabled = false
        }
        labTarget.x = bounds.center.x
        labTarget.y = bounds.center.y
        labTarget.z = bounds.center.z
        focusedCameraDistance = Math.min(64, Math.max(22, bounds.radius * FOCUSED_OBJECT_SCALE * 1.65))
        focusedCameraPitch = 0.22
        labCameraState.distance = focusedCameraDistance
        labCameraState.pitch = focusedCameraPitch
        canvas.dataset.visualLabSelectedVariant = slug
        canvas.dataset.visualLabVisibleObjectCount = String(visibleObjects.length)
    }
    const updateLabCamera = () => {
        const position = resolveFollowCameraPosition({ target: labTarget, ...labCameraState })
        camera.setPosition(position.x, position.y, position.z)
        camera.lookAt(labTarget.x, labTarget.y, labTarget.z)
        canvas.dataset.cameraDistance = labCameraState.distance.toFixed(2)
        canvas.dataset.cameraYaw = labCameraState.yaw.toFixed(4)
        canvas.dataset.cameraPitch = labCameraState.pitch.toFixed(4)
    }
    const handleCameraControl = (event: Event) => {
        const detail = (event as CustomEvent<string>).detail
        if (detail === 'zoomIn') {
            labCameraState.distance = zoomFollowCamera(labCameraState.distance, -12, labCameraState.minDistance, labCameraState.maxDistance)
        } else if (detail === 'zoomOut') {
            labCameraState.distance = zoomFollowCamera(labCameraState.distance, 12, labCameraState.minDistance, labCameraState.maxDistance)
        } else if (detail === 'rotateLeft') {
            labCameraState.yaw = rotateFollowCamera(labCameraState.yaw, labCameraState.pitch, -0.25, 0).yaw
        } else if (detail === 'rotateRight') {
            labCameraState.yaw = rotateFollowCamera(labCameraState.yaw, labCameraState.pitch, 0.25, 0).yaw
        } else if (detail === 'reset') {
            labCameraState.yaw = -0.2
            labCameraState.pitch = focusedCameraPitch
            labCameraState.distance = focusedCameraDistance
        }
        updateLabCamera()
    }
    const handleVariantFocus = (event: Event) => {
        const slug = (event as CustomEvent<string>).detail
        if (!slug) return
        focusVariant(slug)
        updateLabCamera()
    }
    const handleCameraDrag = (event: Event) => {
        const detail = (event as CustomEvent<{ deltaX?: number; deltaY?: number }>).detail ?? {}
        const next = rotateFollowCamera(
            labCameraState.yaw,
            labCameraState.pitch,
            (detail.deltaX ?? 0) * 0.005,
            -(detail.deltaY ?? 0) * 0.005
        )
        labCameraState.yaw = next.yaw
        labCameraState.pitch = next.pitch
        updateLabCamera()
    }
    const handleNativeWheel = (event: WheelEvent) => {
        const scrollX = window.scrollX
        const scrollY = window.scrollY
        event.preventDefault()
        event.stopPropagation()
        canvas.focus({ preventScroll: true })
        labCameraState.distance = zoomFollowCamera(
            labCameraState.distance,
            event.deltaY < 0 ? -12 : 12,
            labCameraState.minDistance,
            labCameraState.maxDistance
        )
        updateLabCamera()
        if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
            window.scrollTo(scrollX, scrollY)
        }
    }

    canvas.addEventListener('playcanvas-camera-control', handleCameraControl)
    canvas.addEventListener('playcanvas-camera-drag', handleCameraDrag)
    canvas.addEventListener('playcanvas-visual-lab-focus-variant', handleVariantFocus)
    container.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true })
    focusOverview()
    updateLabCamera()
    app.start()
    canvas.dataset.runtimeSceneMode = 'visual_lab'
    canvas.dataset.visualLabObjectCount = String(visualLabScene.objects.length)
    canvas.dataset.visualLabVariantCount = String(visualLabScene.variantCount ?? '')
    canvas.dataset.visualLabCoreOpacityRange = formatRange(coreOpacityValues)
    canvas.dataset.visualLabGlowOpacityRange = formatRange(glowOpacityValues)
    canvas.dataset.runtimeModuleExecuted = requiresRuntimeModule ? 'true' : 'not_required'

    return () => {
        disposed = true
        observer.disconnect()
        canvas.removeEventListener('playcanvas-camera-control', handleCameraControl)
        canvas.removeEventListener('playcanvas-camera-drag', handleCameraDrag)
        canvas.removeEventListener('playcanvas-visual-lab-focus-variant', handleVariantFocus)
        container.removeEventListener('wheel', handleNativeWheel, { capture: true })
        for (const material of ownedMaterials) {
            material.destroy?.()
        }
        app.destroy()
    }
}
