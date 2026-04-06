import { performance } from 'node:perf_hooks'
import { writeFile } from 'node:fs/promises'
import { IsolatedVmScriptRuntimeHost, assertIsolatedVmRuntimeAvailable } from '../dist/index.js'

const warmupIterations = Number.parseInt(process.env.SCRIPT_BENCH_WARMUP ?? '10', 10)
const benchmarkIterations = Number.parseInt(process.env.SCRIPT_BENCH_ITERATIONS ?? '100', 10)
const outputPath = process.env.SCRIPT_BENCHMARK_OUTPUT_PATH

if (!Number.isFinite(warmupIterations) || warmupIterations < 0) {
    throw new Error('SCRIPT_BENCH_WARMUP must be a non-negative integer')
}

if (!Number.isFinite(benchmarkIterations) || benchmarkIterations <= 0) {
    throw new Error('SCRIPT_BENCH_ITERATIONS must be a positive integer')
}

const benchmarkBundle = [
    "'use strict';",
    'module.exports = class BenchmarkQuizWidget {',
    '  async mount(locale) {',
    '    return { locale, title: locale === \"ru\" ? \"Космическая викторина\" : \"Space Quiz\", questions: 10 };',
    '  }',
    '  async submit(payload) {',
    '    const answerCount = Array.isArray(payload?.answerIds) ? payload.answerIds.length : 0;',
    '    return { correct: answerCount > 0, answerCount };',
    '  }',
    '};'
].join('\n')

const measureExecution = async (host, index) => {
    const startedAt = performance.now()
    const result = await host.execute({
        bundle: benchmarkBundle,
        methodName: index % 2 === 0 ? 'mount' : 'submit',
        args:
            index % 2 === 0
                ? [index % 3 === 0 ? 'ru' : 'en']
                : [{ answerIds: index % 4 === 0 ? ['a', 'b'] : ['a'] }],
        context: {},
        timeoutMs: 1_000
    })
    const endedAt = performance.now()

    if (!result || typeof result !== 'object') {
        throw new Error('Benchmark execution returned an unexpected result shape')
    }

    return endedAt - startedAt
}

const summarize = (samples) => {
    const ordered = [...samples].sort((left, right) => left - right)
    const sum = ordered.reduce((total, value) => total + value, 0)
    const percentile95Index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * 0.95) - 1))

    return {
        minMs: Number(ordered[0].toFixed(3)),
        maxMs: Number(ordered[ordered.length - 1].toFixed(3)),
        meanMs: Number((sum / ordered.length).toFixed(3)),
        p95Ms: Number(ordered[percentile95Index].toFixed(3))
    }
}

await assertIsolatedVmRuntimeAvailable()

const coldHost = new IsolatedVmScriptRuntimeHost()
const coldStartStartedAt = performance.now()
await coldHost.execute({
    bundle: benchmarkBundle,
    methodName: 'mount',
    args: ['en'],
    context: {},
    timeoutMs: 1_000
})
const coldStartMs = Number((performance.now() - coldStartStartedAt).toFixed(3))

const warmHost = new IsolatedVmScriptRuntimeHost()

for (let index = 0; index < warmupIterations; index += 1) {
    await measureExecution(warmHost, index)
}

const warmSamples = []
for (let index = 0; index < benchmarkIterations; index += 1) {
    warmSamples.push(await measureExecution(warmHost, index + warmupIterations))
}

const result = {
    measuredAt: new Date().toISOString(),
    nodeVersion: process.version,
    warmupIterations,
    benchmarkIterations,
    coldStartMs,
    ...summarize(warmSamples)
}

if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)