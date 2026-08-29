import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { promisify } from 'node:util'
import { repoRoot } from './env/load-e2e-env.mjs'

const execFile = promisify(execFileCallback)

type EditorAssetLike = {
    get?: (path: string) => unknown
    json?: () => Record<string, unknown>
}

export type MmoommEditorScriptAssetEvidence = {
    expectedName: string
    registryNames: string[]
    registryScriptNames: string[]
    registryReady: boolean
    panelText: string
    panelNames: string[]
    panelVisibleNames: string[]
    panelLoading: boolean
    panelReady: boolean
}

export type MmoommRuntimeParityTraceSample = {
    elapsedMs: number
    scriptsLoaded: string | null
    ship: { x: number; y: number; z: number } | null
    shipScreen: { x: number; y: number } | null
    camera: { distance: number; yaw: number; pitch: number } | null
    guardClearance: { ship: number; camera: number } | null
}

export type MmoommRuntimeParityTrace = {
    version: 1
    source: 'published-script-assets' | 'pre-extraction-widget'
    capturedAt: string
    samples: MmoommRuntimeParityTraceSample[]
}

export type MmoommRuntimeBaselineArtifact = {
    version: 1
    source: 'pre-extraction-widget'
    commit: string
    widgetPath: string
    sourceSha256: string
    generatedAt: string
    sampling: {
        intervalMs: typeof MMOOMM_RUNTIME_BASELINE_INTERVAL_MS
        durationMs: typeof MMOOMM_RUNTIME_BASELINE_DURATION_MS
        samples: typeof MMOOMM_RUNTIME_BASELINE_SAMPLES
    }
    trace: MmoommRuntimeParityTrace
}

export const MMOOMM_RUNTIME_BASELINE_ARTIFACT_PATH = path.resolve(
    repoRoot,
    'tools',
    'fixtures',
    'mmoomm-runtime-pre-extraction-baseline.json'
)

export const MMOOMM_RUNTIME_BASELINE_INTERVAL_MS = 100
export const MMOOMM_RUNTIME_BASELINE_DURATION_MS = 5_000
export const MMOOMM_RUNTIME_BASELINE_SAMPLES = MMOOMM_RUNTIME_BASELINE_DURATION_MS / MMOOMM_RUNTIME_BASELINE_INTERVAL_MS + 1

const readEditorScriptAssetEvidence = async (page: Page, expectedNames: readonly string[]): Promise<MmoommEditorScriptAssetEvidence[]> => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate((_, names) => {
        const normalize = (value: unknown): string =>
            String(value ?? '')
                .replace(/[^a-z0-9]/gi, '')
                .toLowerCase()
        const readAssetValue = (asset: EditorAssetLike, path: string): unknown => {
            if (typeof asset.get === 'function') {
                return asset.get(path)
            }
            const json = typeof asset.json === 'function' ? asset.json() : {}
            return path.split('.').reduce<unknown>((current, part) => {
                if (!current || typeof current !== 'object') return undefined
                return (current as Record<string, unknown>)[part]
            }, json)
        }
        const observerArray = (value: unknown): EditorAssetLike[] => {
            if (Array.isArray(value)) return value as EditorAssetLike[]
            if (!value || typeof value !== 'object') return []
            const candidate = value as { array?: () => unknown[]; data?: unknown }
            if (typeof candidate.array === 'function') {
                try {
                    const items = candidate.array()
                    return Array.isArray(items) ? (items as EditorAssetLike[]) : []
                } catch {
                    return []
                }
            }
            return Array.isArray(candidate.data) ? (candidate.data as EditorAssetLike[]) : []
        }
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const assets = observerArray(editor?.call?.('assets:list') ?? editor?.call?.('assets:raw'))
        const panelText = document.querySelector('#layout-assets')?.textContent ?? ''
        const panelElements = Array.from(
            document.querySelectorAll<HTMLElement>(
                '#layout-assets .pcui-asset-grid-view-item, #layout-assets .pcui-table-row, #layout-assets tbody tr'
            )
        )
        const isVisible = (element: HTMLElement): boolean => {
            const style = window.getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                Number.parseFloat(style.opacity || '1') > 0 &&
                rect.width > 0 &&
                rect.height > 0
            )
        }
        const readPanelElementNames = (element: HTMLElement): string[] => {
            const values = [
                element.textContent?.trim() ?? '',
                element.getAttribute('title') ?? '',
                element.getAttribute('aria-label') ?? '',
                element.getAttribute('data-name') ?? '',
                element.getAttribute('data-id') ?? ''
            ]
            for (const labelledElement of Array.from(
                element.querySelectorAll<HTMLElement>('[title], [aria-label], [data-name], [data-id]')
            )) {
                values.push(
                    labelledElement.getAttribute('title') ?? '',
                    labelledElement.getAttribute('aria-label') ?? '',
                    labelledElement.getAttribute('data-name') ?? '',
                    labelledElement.getAttribute('data-id') ?? ''
                )
            }
            return values.map((value) => value.trim()).filter(Boolean)
        }
        const panelNames = panelElements.flatMap(readPanelElementNames)
        const visiblePanelElements = panelElements.filter(isVisible)
        const panelVisibleNames = visiblePanelElements.flatMap(readPanelElementNames)
        const panelLoading = Array.from(
            document.querySelectorAll<HTMLElement>(
                '#layout-assets .pcui-progress, #layout-assets .pcui-spinner, #layout-assets [aria-busy="true"]'
            )
        ).some(isVisible)
        const scriptAssets = assets.filter((asset) => readAssetValue(asset, 'type') === 'script')
        const registryNames = scriptAssets
            .flatMap((asset) => [readAssetValue(asset, 'name'), readAssetValue(asset, 'file.filename')])
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        const registryScriptNames = scriptAssets.flatMap((asset) => {
            const scripts = readAssetValue(asset, 'data.scripts')
            return scripts && typeof scripts === 'object' && !Array.isArray(scripts) ? Object.keys(scripts) : []
        })
        const normalizedRegistry = new Set([...registryNames, ...registryScriptNames].map(normalize))
        const normalizedVisiblePanel = panelVisibleNames.map(normalize)
        return names.map((expectedName) => ({
            expectedName,
            registryNames,
            registryScriptNames,
            registryReady: normalizedRegistry.has(normalize(expectedName)),
            panelText,
            panelNames,
            panelVisibleNames,
            panelLoading,
            panelReady: !panelLoading && normalizedVisiblePanel.some((value) => value.includes(normalize(expectedName)))
        }))
    }, expectedNames)
}

/**
 * Proves that script assets mirrored from the compatibility API are both
 * available in the real upstream Editor asset registry and rendered by the
 * user-facing assets panel. The registry check also verifies that ESM parsing
 * populated `data.scripts`, not only that a filename happened to be shown.
 */
export const expectMmoommScriptAssetsVisibleInEditor = async (
    page: Page,
    expectedNames: readonly string[],
    label = 'MMOOMM Editor script assets'
): Promise<MmoommEditorScriptAssetEvidence[]> => {
    const assetsPanel = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]').locator('#layout-assets')
    await expect(assetsPanel, `${label} assets panel must be visible`).toBeVisible()
    await expect
        .poll(
            async () => {
                const currentEvidence = await readEditorScriptAssetEvidence(page, expectedNames)
                return currentEvidence.map(({ expectedName, registryReady, panelReady }) => ({ expectedName, registryReady, panelReady }))
            },
            {
                timeout: 45_000,
                message: `${label} must expose parsed scripts in the registry and assets panel`
            }
        )
        .toEqual(
            expectedNames.map((expectedName) =>
                expect.objectContaining({
                    expectedName,
                    registryReady: true,
                    panelReady: true
                })
            )
        )
    return readEditorScriptAssetEvidence(page, expectedNames)
}

export const expectPlayCanvasEditorFrameNoHorizontalOverflow = async (page: Page, label = 'PlayCanvas Editor frame') => {
    const frame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const diagnostics = await frame.locator('body').evaluate(() => {
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)
        const viewportWidth = Math.max(document.documentElement.clientWidth, document.body?.clientWidth ?? 0)
        const rootOverflowX = window.getComputedStyle(document.documentElement).overflowX
        const bodyOverflowX = window.getComputedStyle(document.body).overflowX
        const canExposeRootOverflow = [rootOverflowX, bodyOverflowX].some(
            (value) => value === 'visible' || value === 'auto' || value === 'scroll'
        )
        const overflowingElements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .map((element) => {
                const rect = element.getBoundingClientRect()
                const computed = window.getComputedStyle(element)
                return {
                    tag: element.tagName.toLowerCase(),
                    id: element.id || null,
                    className: typeof element.className === 'string' ? element.className.slice(0, 120) : null,
                    right: Math.round(rect.right),
                    width: Math.round(rect.width),
                    scrollWidth: element.scrollWidth,
                    clientWidth: element.clientWidth,
                    overflowX: computed.overflowX,
                    canExposeOverflow: computed.overflowX === 'visible' || computed.overflowX === 'auto' || computed.overflowX === 'scroll'
                }
            })
            .filter((entry) => entry.right > viewportWidth + 1 || (entry.canExposeOverflow && entry.scrollWidth > entry.clientWidth + 1))
            .slice(0, 5)
        const visibleRightOverflow = overflowingElements.reduce((maximum, entry) => Math.max(maximum, entry.right - viewportWidth), 0)
        return {
            documentWidth,
            viewportWidth,
            rootOverflowX,
            bodyOverflowX,
            overflowPx: Math.max(0, canExposeRootOverflow ? documentWidth - viewportWidth : visibleRightOverflow),
            overflowingElements
        }
    })
    expect(
        diagnostics.overflowPx,
        `${label} must not create horizontal frame overflow. Diagnostics: ${JSON.stringify(diagnostics)}`
    ).toBeLessThanOrEqual(1)
}

export const captureMmoommRuntimeParityTrace = async (
    page: Page,
    canvas: Locator,
    options: { samples?: number; intervalMs?: number } = {}
): Promise<MmoommRuntimeParityTrace> => {
    void page
    const samples = Math.max(2, options.samples ?? 12)
    const intervalMs = Math.max(16, options.intervalMs ?? 100)
    const traceSamples = await canvas.evaluate(
        (element, sampling) =>
            new Promise<MmoommRuntimeParityTraceSample[]>((resolve) => {
                const startedAt = performance.now()
                const read = (key: string): number | null => {
                    const value = Number((element as HTMLCanvasElement).dataset[key])
                    return Number.isFinite(value) ? value : null
                }
                const readSample = (): MmoommRuntimeParityTraceSample => {
                    const shipValues = [read('shipX'), read('shipY'), read('shipZ')]
                    const screenValues = [read('shipScreenX'), read('shipScreenY')]
                    const cameraValues = [read('cameraDistance'), read('cameraYaw'), read('cameraPitch')]
                    const guardValues = [read('shipGuardClearance'), read('cameraGuardClearance')]
                    return {
                        elapsedMs: Math.round(performance.now() - startedAt),
                        scriptsLoaded: (element as HTMLCanvasElement).dataset.scriptsLoaded ?? null,
                        ship: shipValues.every((value) => value !== null)
                            ? { x: shipValues[0] as number, y: shipValues[1] as number, z: shipValues[2] as number }
                            : null,
                        shipScreen: screenValues.every((value) => value !== null)
                            ? { x: screenValues[0] as number, y: screenValues[1] as number }
                            : null,
                        camera: cameraValues.every((value) => value !== null)
                            ? { distance: cameraValues[0] as number, yaw: cameraValues[1] as number, pitch: cameraValues[2] as number }
                            : null,
                        guardClearance: guardValues.every((value) => value !== null)
                            ? { ship: guardValues[0] as number, camera: guardValues[1] as number }
                            : null
                    }
                }
                const collected: MmoommRuntimeParityTraceSample[] = [readSample()]
                if (sampling.samples <= 1) {
                    resolve(collected)
                    return
                }
                const timer = window.setInterval(() => {
                    collected.push(readSample())
                    if (collected.length >= sampling.samples) {
                        window.clearInterval(timer)
                        resolve(collected)
                    }
                }, sampling.intervalMs)
            }),
        { samples, intervalMs }
    )
    return {
        version: 1,
        source: 'published-script-assets',
        capturedAt: new Date().toISOString(),
        samples: traceSamples
    }
}

/**
 * Loads the immutable pre-extraction runtime trace used by the parity gate.
 * The artifact is intentionally checked at runtime so a missing, malformed,
 * or accidentally regenerated baseline fails closed instead of weakening the
 * comparison to a current-versus-current replay.
 */
export const loadMmoommRuntimeBaselineArtifact = async (): Promise<MmoommRuntimeBaselineArtifact> => {
    const raw = await fs.readFile(MMOOMM_RUNTIME_BASELINE_ARTIFACT_PATH, 'utf8')
    let parsed: unknown
    try {
        parsed = JSON.parse(raw) as unknown
    } catch (error) {
        throw new Error(`MMOOMM runtime baseline artifact is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('MMOOMM runtime baseline artifact must be an object')
    }
    const artifact = parsed as Partial<MmoommRuntimeBaselineArtifact>
    if (
        artifact.version !== 1 ||
        artifact.source !== 'pre-extraction-widget' ||
        typeof artifact.commit !== 'string' ||
        !/^[0-9a-f]{40}$/i.test(artifact.commit)
    ) {
        throw new Error('MMOOMM runtime baseline artifact has an invalid version, source, or commit')
    }
    if (typeof artifact.widgetPath !== 'string' || !artifact.widgetPath.endsWith('PlayCanvasCanvasWidget.tsx')) {
        throw new Error('MMOOMM runtime baseline artifact must identify the pre-extraction widget source')
    }
    if (!/^[a-f0-9]{64}$/i.test(String(artifact.sourceSha256 ?? ''))) {
        throw new Error('MMOOMM runtime baseline artifact must contain a SHA-256 digest for the source snapshot')
    }
    const resolvedWidgetPath = path.resolve(repoRoot, artifact.widgetPath)
    const relativeWidgetPath = path.relative(repoRoot, resolvedWidgetPath)
    if (!relativeWidgetPath || relativeWidgetPath.startsWith('..') || path.isAbsolute(relativeWidgetPath)) {
        throw new Error('MMOOMM runtime baseline artifact widgetPath must stay inside the repository')
    }
    let sourceSnapshot: Buffer
    try {
        const result = await execFile('git', ['show', `${artifact.commit}:${relativeWidgetPath}`], {
            cwd: repoRoot,
            encoding: 'buffer',
            maxBuffer: 8 * 1024 * 1024
        })
        sourceSnapshot = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout)
    } catch (error) {
        throw new Error(
            `MMOOMM runtime baseline source snapshot could not be read from git: ${error instanceof Error ? error.message : String(error)}`
        )
    }
    const sourceSha256 = createHash('sha256').update(sourceSnapshot).digest('hex')
    if (sourceSha256 !== String(artifact.sourceSha256).toLowerCase()) {
        throw new Error(
            `MMOOMM runtime baseline source digest mismatch: expected ${artifact.sourceSha256}, got ${sourceSha256} for ${artifact.commit}:${relativeWidgetPath}`
        )
    }
    if (typeof artifact.generatedAt !== 'string' || Number.isNaN(Date.parse(artifact.generatedAt))) {
        throw new Error('MMOOMM runtime baseline artifact must contain a valid generation timestamp')
    }
    const sampling = artifact.sampling
    if (
        !sampling ||
        sampling.intervalMs !== MMOOMM_RUNTIME_BASELINE_INTERVAL_MS ||
        sampling.durationMs !== MMOOMM_RUNTIME_BASELINE_DURATION_MS ||
        sampling.samples !== MMOOMM_RUNTIME_BASELINE_SAMPLES
    ) {
        throw new Error('MMOOMM runtime baseline artifact sampling contract is invalid')
    }
    const trace = artifact.trace
    if (!trace || trace.version !== 1 || trace.source !== 'pre-extraction-widget' || typeof trace.capturedAt !== 'string') {
        throw new Error('MMOOMM runtime baseline artifact trace contract is invalid')
    }
    if (!Array.isArray(trace.samples) || trace.samples.length !== MMOOMM_RUNTIME_BASELINE_SAMPLES) {
        throw new Error(
            `MMOOMM runtime baseline artifact must contain exactly ${MMOOMM_RUNTIME_BASELINE_SAMPLES} samples, got ${
                Array.isArray(trace.samples) ? trace.samples.length : 0
            }`
        )
    }
    expectMmoommRuntimeParityTrace(trace, 'MMOOMM pre-extraction runtime baseline', 'pre-extraction-widget')
    expectMmoommTraceShowsDynamicScenario(trace, 'MMOOMM pre-extraction runtime baseline')
    return artifact as MmoommRuntimeBaselineArtifact
}

/**
 * Captures the fixed five-second, 10 Hz trace used by the extraction parity
 * gate. Keeping the sampling contract here prevents individual E2E specs from
 * silently changing the baseline cadence.
 */
export const captureMmoommRuntimeBaselineTrace = (page: Page, canvas: Locator) =>
    captureMmoommRuntimeParityTrace(page, canvas, {
        samples: MMOOMM_RUNTIME_BASELINE_SAMPLES,
        intervalMs: MMOOMM_RUNTIME_BASELINE_INTERVAL_MS
    })

export type MmoommRuntimeParityTolerance = {
    screenPixels?: number
    worldUnits?: number
    cameraDistance?: number
    cameraYaw?: number
    cameraPitch?: number
    guardClearance?: number
    elapsedMs?: number
    sampleIntervalMs?: number
    /** Maximum bounded start-time skew compensated during trace comparison. */
    maxAlignmentMs?: number
}

const shortestAngleDistance = (left: number, right: number): number => {
    const fullTurn = Math.PI * 2
    const delta = Math.abs(left - right) % fullTurn
    return Math.min(delta, fullTurn - delta)
}

/**
 * Compares two fixed-cadence traces without relying on screenshots. This is
 * intentionally strict about sample count and marker availability so a
 * missing script marker cannot be mistaken for a successful parity run.
 */
export const expectMmoommRuntimeTraceWithinTolerance = (
    baseline: MmoommRuntimeParityTrace,
    candidate: MmoommRuntimeParityTrace,
    options: MmoommRuntimeParityTolerance = {},
    label = 'MMOOMM runtime extraction parity'
) => {
    const screenPixels = options.screenPixels ?? 1
    const worldUnits = options.worldUnits ?? 0.5
    const cameraDistance = options.cameraDistance ?? 0.5
    const cameraYaw = options.cameraYaw ?? 0.02
    const cameraPitch = options.cameraPitch ?? 0.02
    const guardClearance = options.guardClearance ?? 0.5
    const elapsedMs = options.elapsedMs ?? 40
    const sampleIntervalMs = options.sampleIntervalMs ?? MMOOMM_RUNTIME_BASELINE_INTERVAL_MS
    // The server-authoritative tick may acknowledge a click several frames
    // after the browser starts sampling. A one-second ceiling keeps that
    // bounded transport jitter explicit without accepting a stalled or
    // divergent path. The spatial trajectory and cadence checks remain strict.
    const maxAlignmentMs = options.maxAlignmentMs ?? 1_000

    expect(candidate.samples.length, `${label} must preserve the baseline sample count`).toBe(baseline.samples.length)
    assertTraceCadence(baseline, sampleIntervalMs, elapsedMs, `${label} baseline`)
    assertTraceCadence(candidate, sampleIntervalMs, elapsedMs, `${label} candidate`)
    const sampleCount = Math.min(baseline.samples.length, candidate.samples.length)
    let lastMatchedBaselineElapsed = Number.NEGATIVE_INFINITY
    let previousActualShip: { x: number; y: number; z: number } | null = null
    let previousExpectedShip: { x: number; y: number; z: number } | null = null
    for (let index = 0; index < sampleCount; index += 1) {
        const actual = candidate.samples[index]
        expect(Number.isFinite(actual?.elapsedMs), `${label} candidate sample ${index} must expose finite elapsed time`).toBe(true)
        expect(actual?.elapsedMs, `${label} candidate sample ${index} elapsed time must be non-negative`).toBeGreaterThanOrEqual(0)
        expect(actual?.ship, `${label} candidate sample ${index} must expose ship telemetry`).not.toBeNull()
        expect(actual?.shipScreen, `${label} candidate sample ${index} must expose screen telemetry`).not.toBeNull()
        expect(actual?.camera, `${label} candidate sample ${index} must expose camera telemetry`).not.toBeNull()
        expect(actual?.guardClearance, `${label} candidate sample ${index} must expose guard telemetry`).not.toBeNull()
        if (!actual?.ship || !actual.shipScreen || !actual.camera || !actual.guardClearance) {
            continue
        }
        const matched = findClosestTraceSampleByPosition(baseline, actual.ship, lastMatchedBaselineElapsed)
        expect(matched, `${label} sample ${index} must map onto the monotonic baseline trajectory`).not.toBeNull()
        if (!matched) continue
        lastMatchedBaselineElapsed = matched.elapsedMs
        const alignedExpected = matched.sample

        // Once both traces have reached the same stationary endpoint, their
        // browser sampling clocks no longer describe a meaningful movement
        // delay. Keep timestamp alignment strict while either trajectory is
        // moving, but do not fail a settled tail merely because one runtime
        // stopped a few timer ticks later than the other.
        const candidateSettled = previousActualShip !== null && distanceBetween(previousActualShip, actual.ship) <= 0.05
        const baselineSettled =
            previousExpectedShip !== null &&
            alignedExpected.ship !== null &&
            distanceBetween(previousExpectedShip, alignedExpected.ship) <= 0.05
        if (!candidateSettled || !baselineSettled) {
            expect(
                Math.abs(matched.elapsedMs - actual.elapsedMs),
                `${label} sample ${index} trajectory timestamp skew must stay within ${maxAlignmentMs}ms (matched ${Math.round(
                    matched.elapsedMs
                )}ms)`
            ).toBeLessThanOrEqual(maxAlignmentMs)
        }

        expect(
            distanceBetween(alignedExpected.ship, actual.ship),
            `${label} sample ${index} ship position must stay within ${worldUnits} world units`
        ).toBeLessThanOrEqual(worldUnits)
        expect(
            Math.abs(alignedExpected.shipScreen.x - actual.shipScreen.x),
            `${label} sample ${index} screen X must stay within ${screenPixels} pixels`
        ).toBeLessThanOrEqual(screenPixels)
        expect(
            Math.abs(alignedExpected.shipScreen.y - actual.shipScreen.y),
            `${label} sample ${index} screen Y must stay within ${screenPixels} pixels`
        ).toBeLessThanOrEqual(screenPixels)
        expect(
            Math.abs(alignedExpected.camera.distance - actual.camera.distance),
            `${label} sample ${index} camera distance must stay within ${cameraDistance}`
        ).toBeLessThanOrEqual(cameraDistance)
        expect(
            shortestAngleDistance(alignedExpected.camera.yaw, actual.camera.yaw),
            `${label} sample ${index} camera yaw must stay within ${cameraYaw} radians`
        ).toBeLessThanOrEqual(cameraYaw)
        expect(
            Math.abs(alignedExpected.camera.pitch - actual.camera.pitch),
            `${label} sample ${index} camera pitch must stay within ${cameraPitch} radians`
        ).toBeLessThanOrEqual(cameraPitch)
        expect(
            Math.abs(alignedExpected.guardClearance.ship - actual.guardClearance.ship),
            `${label} sample ${index} ship guard clearance must stay within ${guardClearance}`
        ).toBeLessThanOrEqual(guardClearance)
        expect(
            Math.abs(alignedExpected.guardClearance.camera - actual.guardClearance.camera),
            `${label} sample ${index} camera guard clearance must stay within ${guardClearance}`
        ).toBeLessThanOrEqual(guardClearance)

        previousActualShip = actual.ship
        previousExpectedShip = alignedExpected.ship
    }
}

const distanceBetween = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)

const interpolateNumber = (left: number, right: number, ratio: number): number => left + (right - left) * ratio

const interpolateAngle = (left: number, right: number, ratio: number): number => {
    const fullTurn = Math.PI * 2
    const shortestDelta = ((((right - left + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI
    return left + shortestDelta * ratio
}

const interpolateVector = <T extends { x: number; y: number; z: number }>(left: T | null, right: T | null, ratio: number): T | null => {
    if (!left || !right) return null
    return {
        x: interpolateNumber(left.x, right.x, ratio),
        y: interpolateNumber(left.y, right.y, ratio),
        z: interpolateNumber(left.z, right.z, ratio)
    } as T
}

const interpolateScreen = (
    left: { x: number; y: number } | null,
    right: { x: number; y: number } | null,
    ratio: number
): { x: number; y: number } | null => {
    if (!left || !right) return null
    return { x: interpolateNumber(left.x, right.x, ratio), y: interpolateNumber(left.y, right.y, ratio) }
}

const interpolateCamera = (
    left: { distance: number; yaw: number; pitch: number } | null,
    right: { distance: number; yaw: number; pitch: number } | null,
    ratio: number
): { distance: number; yaw: number; pitch: number } | null => {
    if (!left || !right) return null
    return {
        distance: interpolateNumber(left.distance, right.distance, ratio),
        yaw: interpolateAngle(left.yaw, right.yaw, ratio),
        pitch: interpolateNumber(left.pitch, right.pitch, ratio)
    }
}

const interpolateClearance = (
    left: { ship: number; camera: number } | null,
    right: { ship: number; camera: number } | null,
    ratio: number
): { ship: number; camera: number } | null => {
    if (!left || !right) return null
    return {
        ship: interpolateNumber(left.ship, right.ship, ratio),
        camera: interpolateNumber(left.camera, right.camera, ratio)
    }
}

const sampleAtElapsed = (trace: MmoommRuntimeParityTrace, elapsedMs: number): MmoommRuntimeParityTraceSample => {
    const first = trace.samples[0]
    const last = trace.samples[trace.samples.length - 1]
    if (!first || !last) {
        throw new Error('Cannot interpolate an empty runtime trace')
    }
    if (elapsedMs <= first.elapsedMs) return first
    if (elapsedMs >= last.elapsedMs) return last

    let rightIndex = trace.samples.findIndex((sample) => sample.elapsedMs >= elapsedMs)
    if (rightIndex <= 0) rightIndex = 1
    const right = trace.samples[rightIndex]
    const left = trace.samples[rightIndex - 1]
    const span = Math.max(1, right.elapsedMs - left.elapsedMs)
    const ratio = Math.min(1, Math.max(0, (elapsedMs - left.elapsedMs) / span))
    return {
        elapsedMs,
        scriptsLoaded: left.scriptsLoaded === right.scriptsLoaded ? left.scriptsLoaded : right.scriptsLoaded,
        ship: interpolateVector(left.ship, right.ship, ratio),
        shipScreen: interpolateScreen(left.shipScreen, right.shipScreen, ratio),
        camera: interpolateCamera(left.camera, right.camera, ratio),
        guardClearance: interpolateClearance(left.guardClearance, right.guardClearance, ratio)
    }
}

const assertTraceCadence = (trace: MmoommRuntimeParityTrace, sampleIntervalMs: number, elapsedMs: number, label: string) => {
    // Browser timers are best-effort under a loaded WebGL tab. Keep a bounded
    // allowance while still rejecting stalled traces and sub-frame bursts.
    const cadenceToleranceMs = Math.max(elapsedMs, 75)
    expect(trace.samples.length, `${label} must contain samples before cadence validation`).toBeGreaterThan(1)
    expect(trace.samples[0]?.elapsedMs, `${label} first sample elapsed time must be non-negative`).toBeGreaterThanOrEqual(0)
    for (let index = 1; index < trace.samples.length; index += 1) {
        const previous = trace.samples[index - 1]
        const current = trace.samples[index]
        const interval = current.elapsedMs - previous.elapsedMs
        expect(current.elapsedMs, `${label} sample elapsed times must be strictly increasing`).toBeGreaterThan(previous.elapsedMs)
        expect(interval, `${label} sample ${index} must respect the ${sampleIntervalMs}ms sampling cadence`).toBeGreaterThanOrEqual(
            Math.max(1, sampleIntervalMs - cadenceToleranceMs)
        )
        expect(interval, `${label} sample ${index} must respect the sampling cadence`).toBeLessThanOrEqual(
            sampleIntervalMs + cadenceToleranceMs
        )
    }
}

type ClosestTraceSample = {
    sample: MmoommRuntimeParityTraceSample
    elapsedMs: number
    distance: number
}

const findClosestTraceSampleByPosition = (
    baseline: MmoommRuntimeParityTrace,
    candidatePosition: { x: number; y: number; z: number },
    minimumElapsedMs: number
): ClosestTraceSample | null => {
    const lowerBound = Number.isFinite(minimumElapsedMs) ? minimumElapsedMs : Number.NEGATIVE_INFINITY
    let closest: ClosestTraceSample | null = null
    for (let index = 0; index < baseline.samples.length - 1; index += 1) {
        const left = baseline.samples[index]
        const right = baseline.samples[index + 1]
        if (!left.ship || !right.ship || right.elapsedMs < lowerBound) continue
        const segment = {
            x: right.ship.x - left.ship.x,
            y: right.ship.y - left.ship.y,
            z: right.ship.z - left.ship.z
        }
        const lengthSquared = segment.x * segment.x + segment.y * segment.y + segment.z * segment.z
        const projectedRatio =
            lengthSquared > 0
                ? ((candidatePosition.x - left.ship.x) * segment.x +
                      (candidatePosition.y - left.ship.y) * segment.y +
                      (candidatePosition.z - left.ship.z) * segment.z) /
                  lengthSquared
                : 0
        const ratio = Math.min(1, Math.max(0, projectedRatio))
        const projectedElapsed = left.elapsedMs + (right.elapsedMs - left.elapsedMs) * ratio
        const elapsedMs = Math.max(lowerBound, projectedElapsed)
        const sample = sampleAtElapsed(baseline, elapsedMs)
        if (!sample.ship) continue
        const distance = distanceBetween(sample.ship, candidatePosition)
        if (!closest || distance < closest.distance) {
            closest = { sample, elapsedMs: sample.elapsedMs, distance }
        }
    }
    return closest
}

/**
 * Runtime parity is expressed as invariants instead of brittle pixel or
 * frame-time snapshots: all published scripts must load before the app runs,
 * movement/camera telemetry must stay finite, and collision guards must never
 * report penetration. The attached trace remains useful for diagnosing drift.
 */
export const expectMmoommRuntimeParityTrace = (
    trace: MmoommRuntimeParityTrace,
    label = 'MMOOMM runtime parity',
    expectedSource: MmoommRuntimeParityTrace['source'] = 'published-script-assets'
) => {
    expect(Array.isArray(trace.samples), `${label} samples must be an array`).toBe(true)
    if (!Array.isArray(trace.samples)) return
    expect(trace.version, `${label} trace version`).toBe(1)
    expect(trace.source, `${label} trace source`).toBe(expectedSource)
    expect(Number.isNaN(Date.parse(trace.capturedAt)), `${label} trace timestamp must be valid`).toBe(false)
    expect(trace.samples.length, `${label} must contain multiple samples`).toBeGreaterThanOrEqual(2)
    trace.samples.forEach((sample, index) => {
        expect(Number.isFinite(sample.elapsedMs), `${label} sample ${index} elapsed time must be finite`).toBe(true)
        expect(sample.elapsedMs, `${label} sample ${index} elapsed time must be non-negative`).toBeGreaterThanOrEqual(0)
        if (index > 0) {
            expect(sample.elapsedMs, `${label} sample elapsed times must be strictly increasing`).toBeGreaterThan(
                trace.samples[index - 1]?.elapsedMs ?? -1
            )
        }
        if (expectedSource === 'published-script-assets') {
            expect(sample.scriptsLoaded, `${label} scripts must be loaded before runtime sampling`).toBe('true')
        } else {
            // The pre-extraction widget predates the published script-assets
            // loader and does not emit a scriptsLoaded marker at all. Accepting
            // the published value here would allow a current runtime trace to
            // be relabelled as historical baseline data.
            expect(sample.scriptsLoaded, `${label} pre-extraction trace must not contain a published loader marker`).toBeNull()
        }
        expect(sample.ship, `${label} ship telemetry must be finite`).not.toBeNull()
        expect(sample.shipScreen, `${label} ship projection telemetry must be finite`).not.toBeNull()
        expect(sample.camera, `${label} camera telemetry must be finite`).not.toBeNull()
        expect(sample.guardClearance, `${label} collision guard telemetry must be finite`).not.toBeNull()
        if (!sample.ship || !sample.shipScreen || !sample.camera || !sample.guardClearance) return
        expect(
            [sample.ship.x, sample.ship.y, sample.ship.z].every((value) => Number.isFinite(value)),
            `${label} ship coordinates must be finite`
        ).toBe(true)
        expect(
            [sample.shipScreen.x, sample.shipScreen.y].every((value) => Number.isFinite(value)),
            `${label} ship projection coordinates must be finite`
        ).toBe(true)
        expect(Number.isFinite(sample.camera.distance), `${label} camera distance must be finite`).toBe(true)
        expect(Number.isFinite(sample.camera.yaw), `${label} camera yaw must be finite`).toBe(true)
        expect(Number.isFinite(sample.camera.pitch), `${label} camera pitch must be finite`).toBe(true)
        expect(Number.isFinite(sample.guardClearance.ship), `${label} ship guard clearance must be finite`).toBe(true)
        expect(Number.isFinite(sample.guardClearance.camera), `${label} camera guard clearance must be finite`).toBe(true)
        expect(sample.camera.distance, `${label} camera distance must stay in the configured range`).toBeGreaterThanOrEqual(18)
        expect(sample.camera.distance, `${label} camera distance must stay in the configured range`).toBeLessThanOrEqual(220)
        expect(sample.camera.pitch, `${label} camera pitch must stay within the supported range`).toBeGreaterThan(-Math.PI / 2)
        expect(sample.camera.pitch, `${label} camera pitch must stay within the supported range`).toBeLessThan(Math.PI / 2)
        expect(sample.guardClearance.ship, `${label} ship must stay outside guarded geometry`).toBeGreaterThanOrEqual(0)
        expect(sample.guardClearance.camera, `${label} camera must stay outside guarded geometry`).toBeGreaterThanOrEqual(0)
    })
}

export const expectMmoommTraceShowsMovement = (trace: MmoommRuntimeParityTrace, label = 'MMOOMM runtime movement') => {
    const first = trace.samples[0]?.ship
    const last = trace.samples.at(-1)?.ship
    expect(first, `${label} first sample must expose ship position`).not.toBeNull()
    expect(last, `${label} last sample must expose ship position`).not.toBeNull()
    if (!first || !last) return

    // Compare samples captured after the user intent itself. Comparing the
    // final point with a prior trace can pass when both runs merely happened
    // to end at different spawn/tick positions, or fail after a valid replay
    // has already reached its target. Scan all adjacent samples so a valid
    // movement that later returns to its starting pose is still observable.
    const moved = trace.samples.slice(1).some((sample, index) => {
        const previous = trace.samples[index]?.ship
        return previous && sample.ship ? distanceBetween(previous, sample.ship) > 0.1 : false
    })
    expect(moved, `${label} must move the local ship after a published-script control intent`).toBe(true)
}

export const expectMmoommTraceShowsCameraChange = (
    before: MmoommRuntimeParityTrace,
    after: MmoommRuntimeParityTrace,
    label = 'MMOOMM runtime camera interaction'
) => {
    const initial = before.samples.at(-1)?.camera
    expect(initial, `${label} baseline must expose camera telemetry`).not.toBeNull()
    expect(after.samples.length, `${label} interaction trace must contain samples`).toBeGreaterThan(0)
    const cameraSamples = after.samples
        .map((sample) => sample.camera)
        .filter((camera): camera is NonNullable<typeof camera> => camera !== null)
    expect(cameraSamples.length, `${label} interaction trace must expose camera telemetry`).toBe(after.samples.length)
    if (!initial || cameraSamples.length === 0) return
    const maxChange = cameraSamples.reduce((maximum, changed) => {
        const distanceDelta = Math.abs(initial.distance - changed.distance)
        const yawDelta = shortestAngleDistance(initial.yaw, changed.yaw)
        const pitchDelta = Math.abs(initial.pitch - changed.pitch)
        return Math.max(maximum, distanceDelta, yawDelta, pitchDelta)
    }, 0)
    expect(maxChange, `${label} must record a camera change after user-facing camera controls`).toBeGreaterThan(0.01)
}

export const expectMmoommTraceShowsDynamicScenario = (trace: MmoommRuntimeParityTrace, label = 'MMOOMM runtime dynamic scenario') => {
    const first = trace.samples[0]
    const last = trace.samples.at(-1)
    expect(first?.ship, `${label} first sample must expose ship telemetry`).not.toBeNull()
    expect(last?.ship, `${label} last sample must expose ship telemetry`).not.toBeNull()
    expect(first?.camera, `${label} first sample must expose camera telemetry`).not.toBeNull()
    expect(last?.camera, `${label} last sample must expose camera telemetry`).not.toBeNull()
    if (!first?.ship || !last?.ship || !first.camera || !last.camera) return

    // Look across the complete trace instead of comparing only its endpoints:
    // a scenario that moves and then returns to its starting pose is still
    // non-idle, while an endpoint-only oracle would incorrectly accept it as
    // constant. Missing intermediate telemetry remains a hard failure through
    // expectMmoommRuntimeParityTrace before this helper is called.
    let shipMoved = false
    let cameraChanged = false
    for (let index = 1; index < trace.samples.length; index += 1) {
        const previous = trace.samples[index - 1]
        const current = trace.samples[index]
        if (!previous?.ship || !current?.ship || !previous.camera || !current.camera) continue
        shipMoved ||= distanceBetween(previous.ship, current.ship) > 0.1
        cameraChanged ||=
            Math.abs(previous.camera.distance - current.camera.distance) > 0.01 ||
            shortestAngleDistance(previous.camera.yaw, current.camera.yaw) > 0.01 ||
            Math.abs(previous.camera.pitch - current.camera.pitch) > 0.01
        if (shipMoved || cameraChanged) break
    }
    expect(shipMoved || cameraChanged, `${label} must contain real movement or camera interaction`).toBe(true)
}
