import { describe, expect, it, vi } from 'vitest'
import { compileModuleSource } from '@universo-react/modules-engine'
import { __browserModuleRuntimeTestUtils, executeClientModuleMethod } from '../browserModuleRuntime'

const SAMPLE_BUNDLE = `
class SampleWidget {
  async mount(payload) {
    return {
      applicationId: this.ctx.applicationId,
      payload
    };
  }

  async submit(value) {
    return this.ctx.callServerMethod('submit', [value]);
  }
}

module.exports = SampleWidget;
`

const RESTRICTED_GLOBALS_BUNDLE = `
class RestrictedGlobalsWidget {
  async mount() {
    return {
      globalThisType: typeof globalThis,
      selfType: typeof self,
      fetchType: typeof fetch,
      webSocketType: typeof WebSocket,
      functionType: typeof Function,
      processType: typeof process,
      bufferType: typeof Buffer
    };
  }
}

module.exports = RestrictedGlobalsWidget;
`

const COMPILED_WIDGET_SOURCE = `const AtClient = () => () => undefined
const AtServer = () => () => undefined

class ExtensionModule {}

const buildQuizDefinition = (localeInput) => {
  const locale = typeof localeInput === 'string' && localeInput.toLowerCase().startsWith('ru') ? 'ru' : 'en'
  return {
    title: locale === 'ru' ? 'Космическая викторина' : 'Space Quiz',
    submitLabel: locale === 'ru' ? 'Проверить ответ' : 'Check answer',
    questions: [
      {
        id: 'q1',
        prompt: locale === 'ru' ? 'Какую планету называют Красной планетой?' : 'Which planet is known as the Red Planet?',
        options: [
          { id: 'a', label: locale === 'ru' ? 'Венера' : 'Venus' },
          { id: 'b', label: locale === 'ru' ? 'Марс' : 'Mars' }
        ],
        correctOptionIds: ['b']
      }
    ]
  }
}

export default class SpaceQuizWidget extends ExtensionModule {
  @AtClient()
  async mount(locale = 'en') {
    return this.ctx.callServerMethod('getQuiz', [{ locale }])
  }

  @AtServer()
  async getQuiz(payload) {
    const quiz = buildQuizDefinition(payload?.locale)
    return {
      title: quiz.title,
      submitLabel: quiz.submitLabel,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options
      }))
    }
  }
}
`

const COMPILED_SHAPE_WRAPPER_REQUIRE_BUNDLE = `var import_colyseus_client = require("@universo-react/colyseus-client");
var import_playcanvas_engine = require("@universo-react/playcanvas-engine");

class FlightWidget {
  async mount() {
    const stationBounds = createAabbFromCenterAndSize({ x: 72, y: 0, z: -48 }, { x: 48, y: 16, z: 16 })
    return {
      moveToPoint: (0, import_colyseus_client.createMoveToPointIntent)({ x: 72, y: 0, z: -48 }, 1),
      moveToObject: (0, import_colyseus_client.createMoveToObjectIntent)('station', 2),
      stop: (0, import_colyseus_client.createStopIntent)(3),
      interpolated: (0, import_colyseus_client.lerpVector3)({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 0.5),
      keyedInterpolated: (0, import_colyseus_client.interpolateKeyedSnapshotVector3)(
        new Map([['ship-1', { receivedAt: 0, state: { position: { x: 0, y: 0, z: 0 } } }]]),
        new Map([['ship-1', { receivedAt: 100, state: { position: { x: 20, y: 0, z: 0 } } }]]),
        'ship-1',
        50,
        (state) => state.position
      ),
      pendingPredictions: (0, import_colyseus_client.dropAcknowledgedPredictions)([{ seq: 1 }, { seq: 2 }, { seq: 3 }], 2),
      doubleClick: (0, import_colyseus_client.isDoubleClickActivation)({ lastClickAt: 100, currentClickAt: 200 }),
      cameraPosition: (0, import_playcanvas_engine.resolveFollowCameraPosition)({
        target: { x: 0, y: 0, z: 0 },
        yaw: 0,
        pitch: 0,
        distance: 100,
        minDistance: 10,
        maxDistance: 30
      }),
      zoomedDistance: (0, import_playcanvas_engine.zoomFollowCamera)(20, -15, 10, 30),
      rotatedPitch: (0, import_playcanvas_engine.rotateFollowCamera)(0, 0, 1, 10).pitch,
      stationBounds,
      insideStation: (0, import_playcanvas_engine.isPointInsideAabb)({ x: 72, y: 0, z: -48 }, stationBounds)
    }
  }
}

const { createAabbFromCenterAndSize } = import_playcanvas_engine
module.exports = FlightWidget
`

const LEGACY_MOVEMENT_HELPERS_REQUIRE_BUNDLE = `var import_colyseus_client = require("@universo-react/colyseus-client");

class LegacyFlightWidget {
  async mount() {
    return {
      first: (0, import_colyseus_client.createMoveToPointIntent)({ x: 10, y: 0, z: 0 }),
      second: (0, import_colyseus_client.createMoveToObjectIntent)('station'),
      explicit: (0, import_colyseus_client.createStopIntent)(7),
      next: (0, import_colyseus_client.createMoveToPointIntent)({ x: 20, y: 0, z: 0 }),
      invalidZero: (0, import_colyseus_client.createStopIntent)(0),
      invalidNegative: (0, import_colyseus_client.createStopIntent)(-1)
    }
  }
}

module.exports = LegacyFlightWidget
`

describe('browserModuleRuntime', () => {
    it('executes a client bundle method with the provided context', async () => {
        vi.stubGlobal('window', undefined)
        vi.stubGlobal('document', undefined)

        try {
            const result = await executeClientModuleMethod({
                bundle: SAMPLE_BUNDLE,
                methodName: 'mount',
                args: [{ test: true }],
                context: {
                    applicationId: 'app-1',
                    callServerMethod: vi.fn()
                }
            })

            expect(result).toEqual({
                applicationId: 'app-1',
                payload: { test: true }
            })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('allows client methods to proxy runtime server calls through the context bridge', async () => {
        const callServerMethod = vi.fn().mockResolvedValue({ score: 2, total: 2 })

        vi.stubGlobal('window', undefined)
        vi.stubGlobal('document', undefined)

        try {
            const result = await executeClientModuleMethod({
                bundle: SAMPLE_BUNDLE,
                methodName: 'submit',
                args: [{ answers: { q1: ['a'] } }],
                context: {
                    applicationId: 'app-1',
                    callServerMethod
                }
            })

            expect(callServerMethod).toHaveBeenCalledWith('submit', [{ answers: { q1: ['a'] } }])
            expect(result).toEqual({ score: 2, total: 2 })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('shadows restricted globals inside client bundle execution', async () => {
        vi.stubGlobal('window', undefined)
        vi.stubGlobal('document', undefined)

        try {
            const result = await executeClientModuleMethod({
                bundle: RESTRICTED_GLOBALS_BUNDLE,
                methodName: 'mount',
                args: [],
                context: {
                    applicationId: 'app-1',
                    callServerMethod: vi.fn()
                }
            })

            expect(result).toEqual({
                globalThisType: 'undefined',
                selfType: 'undefined',
                fetchType: 'undefined',
                webSocketType: 'undefined',
                functionType: 'undefined',
                processType: 'undefined',
                bufferType: 'undefined'
            })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('fails closed in browser runtimes that do not support Worker execution', async () => {
        vi.stubGlobal('window', {})
        vi.stubGlobal('document', {})

        try {
            await expect(
                executeClientModuleMethod({
                    bundle: SAMPLE_BUNDLE,
                    methodName: 'mount',
                    args: [],
                    context: {
                        applicationId: 'app-1',
                        callServerMethod: vi.fn()
                    }
                })
            ).rejects.toThrow('Client module execution requires a Worker-capable browser runtime')
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('fails closed when a browser worker stalls without producing a result', async () => {
        vi.useFakeTimers()

        const terminate = vi.fn()

        class HangingWorker {
            onmessage: ((event: MessageEvent) => void) | null = null
            onerror: ((event: ErrorEvent) => void) | null = null

            postMessage = vi.fn()
            terminate = terminate
        }

        vi.stubGlobal('window', {})
        vi.stubGlobal('document', {})
        vi.stubGlobal('Worker', HangingWorker as unknown as typeof Worker)

        try {
            const execution = executeClientModuleMethod({
                bundle: SAMPLE_BUNDLE,
                methodName: 'mount',
                args: [],
                context: {
                    applicationId: 'app-1',
                    callServerMethod: vi.fn()
                }
            })
            const assertion = expect(execution).rejects.toThrow(
                `Client module worker execution timed out after ${__browserModuleRuntimeTestUtils.workerExecutionTimeoutMs}ms`
            )

            await vi.advanceTimersByTimeAsync(__browserModuleRuntimeTestUtils.workerExecutionTimeoutMs + 1)

            await assertion
            expect(terminate).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
            vi.unstubAllGlobals()
        }
    })

    it('executes a compiled widget client bundle and proxies mount() to the server runtime', async () => {
        vi.stubGlobal('window', undefined)
        vi.stubGlobal('document', undefined)

        try {
            const artifact = await compileModuleSource({
                codename: 'quiz-widget',
                moduleRole: 'widget',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                capabilities: ['rpc.client'],
                sourceCode: COMPILED_WIDGET_SOURCE
            })

            const callServerMethod = vi.fn().mockResolvedValue({
                title: 'Космическая викторина',
                submitLabel: 'Проверить ответ',
                questions: [
                    {
                        id: 'q1',
                        prompt: 'Какую планету называют Красной планетой?',
                        options: [
                            { id: 'a', label: 'Венера' },
                            { id: 'b', label: 'Марс' }
                        ]
                    }
                ]
            })

            const result = await executeClientModuleMethod({
                bundle: artifact.clientBundle,
                methodName: 'mount',
                args: ['ru'],
                context: {
                    applicationId: 'app-1',
                    callServerMethod
                }
            })

            expect(callServerMethod).toHaveBeenCalledWith('getQuiz', [{ locale: 'ru' }])
            expect(result).toEqual({
                title: 'Космическая викторина',
                submitLabel: 'Проверить ответ',
                questions: [
                    {
                        id: 'q1',
                        prompt: 'Какую планету называют Красной планетой?',
                        options: [
                            { id: 'a', label: 'Венера' },
                            { id: 'b', label: 'Марс' }
                        ]
                    }
                ]
            })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('executes compiled client bundles that import generic foundation wrapper helpers', async () => {
        vi.stubGlobal('window', undefined)
        vi.stubGlobal('document', undefined)

        try {
            const result = await executeClientModuleMethod({
                bundle: COMPILED_SHAPE_WRAPPER_REQUIRE_BUNDLE,
                methodName: 'mount',
                args: [],
                context: {
                    applicationId: 'app-1',
                    callServerMethod: vi.fn()
                }
            })

            expect(result).toEqual({
                moveToPoint: { type: 'move_to_point', target: { x: 72, y: 0, z: -48 }, seq: 1 },
                moveToObject: { type: 'move_to_object', objectId: 'station', seq: 2 },
                stop: { type: 'stop', seq: 3 },
                interpolated: { x: 5, y: 0, z: 0 },
                keyedInterpolated: { x: 10, y: 0, z: 0 },
                pendingPredictions: [{ seq: 3 }],
                doubleClick: true,
                cameraPosition: { x: 0, y: 0, z: 30 },
                zoomedDistance: 10,
                rotatedPitch: Math.PI / 3,
                stationBounds: {
                    center: { x: 72, y: 0, z: -48 },
                    halfExtents: { x: 24, y: 8, z: 8 }
                },
                insideStation: true
            })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('keeps legacy imported movement helpers authoritative by assigning non-zero monotonic sequences', async () => {
        vi.stubGlobal('window', undefined)
        vi.stubGlobal('document', undefined)

        try {
            const result = await executeClientModuleMethod({
                bundle: LEGACY_MOVEMENT_HELPERS_REQUIRE_BUNDLE,
                methodName: 'mount',
                args: [],
                context: {
                    applicationId: 'app-1',
                    callServerMethod: vi.fn()
                }
            })

            expect(result).toEqual({
                first: { type: 'move_to_point', target: { x: 10, y: 0, z: 0 }, seq: 1 },
                second: { type: 'move_to_object', objectId: 'station', seq: 2 },
                explicit: { type: 'stop', seq: 7 },
                next: { type: 'move_to_point', target: { x: 20, y: 0, z: 0 }, seq: 8 },
                invalidZero: { type: 'stop', seq: 9 },
                invalidNegative: { type: 'stop', seq: 10 }
            })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('inlines a self-contained bundle module source for the browser worker runtime', () => {
        expect(__browserModuleRuntimeTestUtils.workerSource).toContain('const console = {')
        expect(__browserModuleRuntimeTestUtils.workerSource).toContain('const require = (packageName) => {')
        expect(__browserModuleRuntimeTestUtils.requireSource).toContain('@universo-react/colyseus-client')
        expect(__browserModuleRuntimeTestUtils.requireSource).toContain('@universo-react/playcanvas-engine')
        expect(__browserModuleRuntimeTestUtils.workerSource).toContain('const globalThis = undefined;')
        expect(__browserModuleRuntimeTestUtils.workerSource).not.toContain("'const console = createSilentConsoleSource();'")
        expect(__browserModuleRuntimeTestUtils.restrictedWorkerGlobals).not.toContain('onmessage')
        expect(__browserModuleRuntimeTestUtils.restrictedWorkerGlobals).not.toContain('postMessage')
        expect(__browserModuleRuntimeTestUtils.workerExecutionTimeoutMs).toBeGreaterThan(0)
    })
})
