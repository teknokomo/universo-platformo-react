#!/usr/bin/env node
// Frontend chunk budget reporter (plan step P1.6).
//
// Reads a Vite build assets directory, summarizes the JavaScript payload and
// compares it against a recorded baseline JSON:
//
//   node tools/testing/e2e/support/reportFrontendChunkBudget.mjs
//   node tools/testing/e2e/support/reportFrontendChunkBudget.mjs --dir <assets-dir> --out <baseline.json>
//   node tools/testing/e2e/support/reportFrontendChunkBudget.mjs --budget tools/testing/e2e/.artifacts/frontend-chunk-baseline.json
//
// Report shape:
// {
//   totalJsBytes: number,
//   jsFiles: number,
//   mainChunk: { file, bytes, gzipBytes, brotliBytes },
//   engineChunk: { file, bytes, detected }
// }
//
// The main chunk is the largest /^index-.*\.js$/ asset. The engine chunk is the
// largest JS asset whose content includes both 'MeshInstance' and 'GraphicsDevice'
// (PlayCanvas engine markers). With --budget the report is compared to the baseline
// file and the process exits 1 when totalJsBytes or main gzipBytes regresses by
// more than 5%.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const DEFAULT_ASSETS_DIR = path.resolve('packages/universo-react-core-frontend/build/assets')
const DEFAULT_BASELINE_PATH = 'tools/testing/e2e/.artifacts/frontend-chunk-baseline.json'
const REGRESSION_THRESHOLD = 0.05

const parseArgs = (argv) => {
    const options = { dir: DEFAULT_ASSETS_DIR, budget: null, out: null }
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]
        if (arg === '--dir') {
            options.dir = argv[(index += 1)]
        } else if (arg === '--budget') {
            options.budget = argv[(index += 1)]
        } else if (arg === '--out') {
            options.out = argv[(index += 1)]
        } else if (arg === '--help' || arg === '-h') {
            options.help = true
        } else {
            throw new Error(`Unknown argument: ${arg}`)
        }
    }
    return options
}

const formatBytes = (value) => `${(value / 1024).toFixed(1)} KiB`

const collectJsAssets = (assetsDir) =>
    fs
        .readdirSync(assetsDir)
        .filter((entry) => entry.endsWith('.js'))
        .map((fileName) => {
            const filePath = path.join(assetsDir, fileName)
            const content = fs.readFileSync(filePath)
            const stats = fs.statSync(filePath)
            return {
                fileName,
                bytes: stats.size,
                content,
                gzipBytes: gzipSync(content).length,
                brotliBytes: brotliCompressSync(content).length,
                isEngineCandidate: content.includes('MeshInstance') && content.includes('GraphicsDevice')
            }
        })

const buildReport = (assets) => {
    const indexChunks = assets.filter((asset) => /^index-.*\.js$/.test(asset.fileName))
    if (indexChunks.length === 0) {
        throw new Error('No /index-*.js/ main chunks found in the assets directory')
    }
    const mainChunk = indexChunks.reduce((largest, candidate) => (candidate.bytes > largest.bytes ? candidate : largest))
    const engineCandidates = assets.filter((asset) => asset.isEngineCandidate)
    const engineChunk = engineCandidates.length
        ? engineCandidates.reduce((largest, candidate) => (candidate.bytes > largest.bytes ? candidate : largest))
        : null
    return {
        totalJsBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
        jsFiles: assets.length,
        mainChunk: {
            file: mainChunk.fileName,
            bytes: mainChunk.bytes,
            gzipBytes: mainChunk.gzipBytes,
            brotliBytes: mainChunk.brotliBytes
        },
        engineChunk: {
            file: engineChunk?.fileName ?? null,
            bytes: engineChunk?.bytes ?? 0,
            detected: engineChunk !== null
        }
    }
}

const regressionRatio = (current, baseline) => (current - baseline) / baseline

const compareWithBudget = (report, baseline) => {
    const checks = [
        { label: 'totalJsBytes', current: report.totalJsBytes, baseline: baseline.totalJsBytes },
        { label: 'mainChunk.gzipBytes', current: report.mainChunk.gzipBytes, baseline: baseline.mainChunk?.gzipBytes ?? 0 }
    ]
    let failed = false
    for (const check of checks) {
        if (!Number.isFinite(check.baseline) || check.baseline <= 0) {
            console.log(`[chunk-budget] ${check.label}: baseline missing or invalid (${check.baseline}), check skipped`)
            continue
        }
        const ratio = regressionRatio(check.current, check.baseline)
        const status = ratio > REGRESSION_THRESHOLD ? 'REGRESSION' : 'ok'
        if (ratio > REGRESSION_THRESHOLD) failed = true
        console.log(
            `[chunk-budget] ${check.label}: ${formatBytes(check.current)} vs baseline ${formatBytes(check.baseline)} ` +
                `(${(ratio * 100).toFixed(2)}%) -> ${status}`
        )
    }
    return failed
}

const main = () => {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
        console.log('Usage: node reportFrontendChunkBudget.mjs [--dir <assets-dir>] [--budget <baseline.json>] [--out <report.json>]')
        return 0
    }
    if (!fs.existsSync(options.dir)) {
        console.error(`[chunk-budget] Build assets directory not found: ${options.dir}. Run the frontend build first.`)
        return 1
    }
    const report = buildReport(collectJsAssets(options.dir))
    const reportText = JSON.stringify(report, null, 4)
    console.log(reportText)
    if (options.out) {
        fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true })
        fs.writeFileSync(options.out, `${reportText}\n`)
        console.log(`[chunk-budget] Report written to ${options.out}`)
    }
    if (options.budget) {
        if (!fs.existsSync(options.budget)) {
            console.error(`[chunk-budget] Baseline file not found: ${options.budget}`)
            return 1
        }
        const baseline = JSON.parse(fs.readFileSync(options.budget, 'utf8'))
        const failed = compareWithBudget(report, baseline)
        if (failed) {
            console.error(`[chunk-budget] Chunk budget regression above ${(REGRESSION_THRESHOLD * 100).toFixed(0)}%`)
            return 1
        }
    }
    return 0
}

process.exitCode = main()
