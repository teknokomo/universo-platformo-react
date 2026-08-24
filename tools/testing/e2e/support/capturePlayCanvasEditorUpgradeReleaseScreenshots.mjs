#!/usr/bin/env node
// Captures the PlayCanvas Editor upgrade RELEASE-evidence screenshot bundle
// (packages registry + published-app runtime states) at a fixed 1920x1080
// viewport for both EN and RU locales.
//
// Companion to capturePlayCanvasEditorUpgradeScreenshots.mjs (which owns the
// editor-workspace trio). This runner:
//   1. Runs ONLY the generators spec
//      (tools/testing/e2e/specs/generators/playcanvas-editor-upgrade-release-screenshots.spec.ts,
//      grep "playcanvas editor upgrade release screenshots") through the
//      documented e2e suite runner, so servers/auth/storage state follow the
//      standard local-Supabase flow.
//   2. Reads the per-capture evidence file written by the spec.
//   3. Merges sha256 + dimensions entries for every captured release asset into
//      tools/docs/playcanvas-editor-upgrade-screenshot-provenance.json while
//      preserving the editor-workspace trio entries untouched (editor RU stays
//      pending).
//
// Requires the e2e environment prepared beforehand:
//   pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase
//   UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..')
const provenanceRelative = 'tools/docs/playcanvas-editor-upgrade-screenshot-provenance.json'
const evidenceRelative = 'tools/testing/e2e/.artifacts/playcanvas-editor-upgrade-release-evidence.json'
const releaseGeneratorRelative = 'tools/testing/e2e/specs/generators/playcanvas-editor-upgrade-release-screenshots.spec.ts'
const suiteRunnerRelative = 'tools/testing/e2e/run-playwright-suite.mjs'
const grepPattern = 'playcanvas editor upgrade release screenshots'

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const readPngDimensions = (buffer) => {
    if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
        throw new Error('not a valid PNG file')
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const fail = (message) => {
    console.error(`PlayCanvas Editor upgrade release screenshot capture failed: ${message}`)
    process.exit(1)
}

console.log(`Running PlayCanvas Editor upgrade release evidence capture pass (grep "${grepPattern}") ...`)
const run = spawnSync(process.execPath, [path.join(repoRoot, suiteRunnerRelative), '--project', 'generators', '--grep', grepPattern], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
})
if (run.error) throw run.error
if (run.status !== 0) {
    fail(`playwright generators pass exited with code ${run.status}`)
}

const evidencePath = path.join(repoRoot, evidenceRelative)
if (!existsSync(evidencePath)) {
    fail(`capture evidence file is missing: ${evidenceRelative}. The generator spec must write it on every run.`)
}
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
if (!Array.isArray(evidence.captures) || evidence.captures.length === 0) {
    fail('capture evidence contains no captures.')
}

const provenancePath = path.join(repoRoot, provenanceRelative)
if (!existsSync(provenancePath)) {
    fail(
        `provenance manifest is missing: ${provenanceRelative}. Run "pnpm docs:playcanvas-editor-upgrade:screenshots" first so the editor-workspace trio exists.`
    )
}
const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'))

const isReleasePath = (entryPath) => typeof entryPath === 'string' && entryPath.includes('/playcanvas-editor-upgrade/release/')

provenance.captures = (provenance.captures ?? []).filter((entry) => !isReleasePath(entry.path))
provenance.assets = (provenance.assets ?? []).filter((entry) => !isReleasePath(entry.path))

const releaseCaptures = []
const releaseAssets = []
for (const capture of evidence.captures.filter((entry) => entry.status !== 'skipped')) {
    if (!isReleasePath(capture.path)) {
        fail(`capture evidence path escapes the release asset directory: ${String(capture.path)}`)
    }
    const filePath = path.join(repoRoot, capture.path)
    const buffer = readFileSync(filePath)
    let dimensions
    try {
        dimensions = readPngDimensions(buffer)
    } catch (error) {
        fail(`${capture.path}: ${error.message}`)
    }
    if (dimensions.width !== 1920 || dimensions.height !== 1080) {
        fail(`${capture.path}: dimensions ${dimensions.width}x${dimensions.height} do not match the fixed 1920x1080 viewport`)
    }

    releaseCaptures.push({
        id: capture.id,
        locale: capture.locale,
        status: 'captured',
        path: capture.path,
        captureType: 'release-evidence',
        route: capture.route ?? 'published app / metahub resources route',
        viewport: { name: 'release-desktop', width: dimensions.width, height: dimensions.height }
    })
    releaseAssets.push({
        locale: capture.locale,
        path: capture.path,
        sha256: sha256(buffer),
        dimensions: { width: dimensions.width, height: dimensions.height }
    })
}

const releaseCaptureFilenames = {
    'packages-registry': 'packages-registry.png',
    'canvas-runtime': 'canvas-runtime.png',
    'canvas-webgl2-unavailable': 'canvas-webgl2-unavailable.png',
    'canvas-loading-skeleton': 'canvas-loading-skeleton.png'
}

for (const skipped of evidence.captures.filter((capture) => capture.status === 'skipped')) {
    const filename = releaseCaptureFilenames[skipped.id]
    if (!filename) {
        fail(`unknown skipped capture id in evidence: ${String(skipped.id)}`)
    }
    releaseCaptures.push({
        id: skipped.id,
        locale: skipped.locale,
        status: 'pending',
        path: `docs/${skipped.locale}/.gitbook/assets/playcanvas-editor-upgrade/release/${filename}`,
        captureType: 'release-evidence',
        route: `skipped after repeated attempts (${skipped.note ?? 'flaky'})`,
        viewport: { name: 'release-desktop', width: 1920, height: 1080 }
    })
}

provenance.captures.push(...releaseCaptures)
provenance.assets.push(...releaseAssets)

provenance.release = {
    runner: 'tools/testing/e2e/support/capturePlayCanvasEditorUpgradeReleaseScreenshots.mjs',
    generator: releaseGeneratorRelative,
    generatorSha256: sha256(readFileSync(path.join(repoRoot, releaseGeneratorRelative))),
    generatedAt: new Date().toISOString(),
    viewport: { name: 'release-desktop', width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    notes: [
        'Release-evidence assets are captured from the real booted platform (metahub packages registry, published MMOOMM application runtime) through the generators Playwright project at a fixed 1920x1080 desktop viewport with deviceScaleFactor 1.',
        'EN and RU are both captured honestly: the app UI is switched per locale through browser language preferences before each capture pass, so RU frames show genuinely localized chrome.',
        'The WebGL2-unavailable frames use a fresh browser context whose HTMLCanvasElement.prototype.getContext returns null for "webgl2", so the widget renders its localized terminal alert.',
        'Skipped captures are recorded as pending entries without files on disk; the drift checker fails if a file appears at such a path.'
    ]
}

provenance.generatedAt = new Date().toISOString()

writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 4)}\n`)

console.log(
    `Captured ${releaseAssets.length} release assets across EN/RU into docs/{en,ru}/.gitbook/assets/playcanvas-editor-upgrade/release/.`
)
console.log(`Provenance manifest updated at ${provenanceRelative} (editor trio entries preserved).`)
