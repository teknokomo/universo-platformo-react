import { describe, expect, it, vi } from 'vitest'
import { compileModuleSource } from '@universo/modules-engine'
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

    it('inlines a self-contained bundle module source for the browser worker runtime', () => {
        expect(__browserModuleRuntimeTestUtils.workerSource).toContain('const console = {')
        expect(__browserModuleRuntimeTestUtils.workerSource).toContain('const globalThis = undefined;')
        expect(__browserModuleRuntimeTestUtils.workerSource).not.toContain("'const console = createSilentConsoleSource();'")
        expect(__browserModuleRuntimeTestUtils.restrictedWorkerGlobals).not.toContain('onmessage')
        expect(__browserModuleRuntimeTestUtils.restrictedWorkerGlobals).not.toContain('postMessage')
        expect(__browserModuleRuntimeTestUtils.workerExecutionTimeoutMs).toBeGreaterThan(0)
    })
})
