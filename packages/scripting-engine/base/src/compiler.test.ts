import { describe, expect, it } from 'vitest'
import { compileScriptSource } from './compiler'

const createInput = (sourceCode: string) => ({
    codename: 'quiz-widget',
    moduleRole: 'widget' as const,
    sourceKind: 'embedded' as const,
    sdkApiVersion: '1.0.0',
    capabilities: ['metadata.read', 'rpc.client'] as const,
    sourceCode
})

const VALID_SOURCE = `import { ExtensionScript, AtClient, AtServer } from '@universo/extension-sdk'

export default class ExampleScript extends ExtensionScript {
    @AtClient()
    async mount() {
        return { ready: true }
    }

    @AtServer()
    async submit(payload) {
        return payload
    }
}
`

const SERVER_AND_CLIENT_SOURCE = `import { ExtensionScript, AtServerAndClient } from '@universo/extension-sdk'

export default class SharedScript extends ExtensionScript {
    @AtServerAndClient()
    async ping() {
        return { ok: true }
    }
}
`

const SAFE_SERVER_ONLY_QUIZ_SOURCE = `import { ExtensionScript, AtClient, AtServer } from '@universo/extension-sdk'

const QUESTION_BANK = [
    {
        id: 'mars',
        prompt: 'Which planet is known as the Red Planet?',
        options: [
            { id: 'a', label: 'Mars' },
            { id: 'b', label: 'Venus' },
            { id: 'c', label: 'Jupiter' },
            { id: 'd', label: 'Mercury' }
        ],
        correctOptionIds: ['a'],
        explanation: 'Mars appears red because of iron oxide on its surface.'
    }
]

export default class SpaceQuizScript extends ExtensionScript {
    @AtClient()
    async mount() {
        return await this.ctx.callServerMethod('loadQuiz', [])
    }

    @AtServer()
    async loadQuiz() {
        return {
            title: 'Space Quiz',
            questions: QUESTION_BANK.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                options: question.options
            }))
        }
    }

    @AtServer()
    async submit(payload) {
        const question = QUESTION_BANK.find((entry) => entry.id === payload?.questionId)
        return {
            score: question ? 1 : 0,
            total: QUESTION_BANK.length,
            correct: true,
            explanation: question?.explanation ?? ''
        }
    }
}
`

describe('compileScriptSource', () => {
    it('compiles embedded scripts that stay within the supported SDK boundary', async () => {
        const artifact = await compileScriptSource(createInput(VALID_SOURCE))

        expect(artifact.manifest.className).toBe('ExampleScript')
        expect(artifact.manifest.methods).toEqual([
            { name: 'mount', target: 'client', eventName: null },
            { name: 'submit', target: 'server', eventName: null }
        ])
        expect(artifact.clientBundle).toContain('callServerMethod')
    })

    it('keeps AtServerAndClient methods available in both bundles', async () => {
        const artifact = await compileScriptSource(createInput(SERVER_AND_CLIENT_SOURCE))

        expect(artifact.manifest.methods).toEqual([{ name: 'ping', target: 'server_and_client', eventName: null }])
        expect(artifact.serverBundle).toContain('async ping()')
        expect(artifact.clientBundle).toContain('async ping()')
    })

    it('rejects unsupported sdkApiVersion values', async () => {
        await expect(
            compileScriptSource({
                ...createInput(VALID_SOURCE),
                sdkApiVersion: '2.0.0'
            })
        ).rejects.toThrow('Unsupported script sdkApiVersion "2.0.0". Supported versions: 1.0.0')
    })

    it('rejects unsupported static imports', async () => {
        await expect(compileScriptSource(createInput(`import { readFileSync } from 'node:fs'\n${VALID_SOURCE}`))).rejects.toThrow(
            /unsupported imports: "node:fs"/
        )
    })

    it('rejects dynamic import expressions', async () => {
        await expect(
            compileScriptSource(
                createInput(`import { ExtensionScript, AtClient } from '@universo/extension-sdk'

export default class ExampleScript extends ExtensionScript {
    @AtClient()
    async mount() {
        return await import('node:fs')
    }
}
`)
            )
        ).rejects.toThrow(/dynamic import expressions/)
    })

    it('rejects CommonJS require calls', async () => {
        await expect(
            compileScriptSource(
                createInput(`import { ExtensionScript, AtClient } from '@universo/extension-sdk'

export default class ExampleScript extends ExtensionScript {
    @AtClient()
    async mount() {
        return require('node:fs')
    }
}
`)
            )
        ).rejects.toThrow(/CommonJS require\(\) calls/)
    })

    it('rejects top-level runtime bindings shared by client and server methods', async () => {
        await expect(
            compileScriptSource(
                createInput(`import { ExtensionScript, AtClient, AtServer } from '@universo/extension-sdk'

const QUESTIONS = [
    { id: 'q1', prompt: 'Which planet is known as the Red Planet?', correctOptionIds: ['a'] }
]

export default class ExampleScript extends ExtensionScript {
    @AtClient()
    async mount() {
        return QUESTIONS.map((question) => ({ id: question.id, prompt: question.prompt }))
    }

    @AtServer()
    async submit() {
        return QUESTIONS[0]?.correctOptionIds ?? []
    }
}
`)
            )
        ).rejects.toThrow(/cannot share top-level runtime bindings/i)
    })

    it('keeps server-only quiz data out of the client bundle when the source stays within target boundaries', async () => {
        const artifact = await compileScriptSource(createInput(SAFE_SERVER_ONLY_QUIZ_SOURCE))

        expect(artifact.clientBundle).not.toContain('Red Planet')
        expect(artifact.clientBundle).not.toContain('iron oxide')
        expect(artifact.clientBundle).not.toContain('correctOptionIds')
        expect(artifact.clientBundle).toContain('callServerMethod')
    })
})
