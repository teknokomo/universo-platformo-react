#!/usr/bin/env node
// Captures the PlayCanvas Editor v2.30.4 upgrade docs screenshot bundle.
//
// Mirrors the Interpretation Network GitBook screenshot provenance convention:
//   1. Verifies the prebuilt editor artifact exists (never builds anything).
//   2. Runs ONLY the screenshot-enabled pass of the standalone artifact spec
//      (e2e/editor-artifact.spec.ts, test grep "captures docs evidence")
//      across the desktop / tablet / mobile projects.
//   3. Rewrites tools/docs/playcanvas-editor-upgrade-screenshot-provenance.json
//      with sha256 + dimensions for every captured asset.
//
// Locale handling: the upstream v2.30.4 editor chrome is English-only; the
// `?locale=ru` query only localizes the host shell fallback page. Russian
// variants therefore stay "pending" until a localized host flow exists, and
// the manifest records that status honestly instead of copying EN pixels.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..')
const packageDir = path.join(repoRoot, 'packages', 'universo-react-playcanvas-editor-frontend')
const specRelative = 'packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts'
const provenanceRelative = 'tools/docs/playcanvas-editor-upgrade-screenshot-provenance.json'
const captureId = 'editor-workspace'
const captureTestGrep = 'captures docs evidence'
const expectedUpstreamTag = 'v2.30.4'

const VIEWPORTS = [
    { project: 'desktop', name: 'desktop-1920', width: 1920, height: 1080 },
    { project: 'tablet', name: 'tablet-768', width: 768, height: 1024 },
    { project: 'mobile', name: 'mobile-390', width: 390, height: 844 }
]

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const readPngDimensions = (buffer) => {
    if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
        throw new Error('not a valid PNG file')
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const fail = (message) => {
    console.error(`PlayCanvas Editor upgrade screenshot capture failed: ${message}`)
    process.exit(1)
}

const artifactRoot = path.join(packageDir, 'dist', 'editor')
const artifactIndex = path.join(artifactRoot, 'index.html')
const artifactManifestPath = path.join(artifactRoot, 'universo-artifact-manifest.json')
if (!existsSync(artifactIndex) || !existsSync(artifactManifestPath)) {
    fail(
        `built editor artifact not found at ${artifactRoot}. Run "pnpm --filter @universo-react/playcanvas-editor-frontend editor:build" first (this script never builds).`
    )
}
const artifactManifest = JSON.parse(readFileSync(artifactManifestPath, 'utf8'))
if (artifactManifest.upstreamTag !== expectedUpstreamTag) {
    fail(`artifact upstreamTag is ${artifactManifest.upstreamTag}, expected ${expectedUpstreamTag}. Rebuild the editor artifact.`)
}

const assetDirRelative = 'docs/en/.gitbook/assets/playcanvas-editor-upgrade'
const assetDir = path.join(repoRoot, assetDirRelative)
mkdirSync(assetDir, { recursive: true })

for (const entry of readdirSync(assetDir)) {
    if (entry.startsWith(`${captureId}-`) && entry.endsWith('.png')) {
        rmSync(path.join(assetDir, entry))
    }
}

const require = createRequire(import.meta.url)
let playwrightCli
for (const base of [packageDir, repoRoot]) {
    try {
        const packageJsonPath = require.resolve('playwright/package.json', { paths: [base] })
        const candidate = path.join(path.dirname(packageJsonPath), 'cli.js')
        if (existsSync(candidate)) {
            playwrightCli = candidate
            break
        }
    } catch {}
}
if (!playwrightCli) fail('playwright CLI not found. Run "pnpm install" and "pnpm playwright:install" first.')

const captureEnv = {
    ...process.env,
    PLAYCANVAS_EDITOR_SCREENSHOT_DIR: assetDir,
    PLAYCANVAS_EDITOR_SCREENSHOT_LOCALE: 'en'
}

console.log('Running PlayCanvas Editor docs evidence capture pass (EN) ...')
const run = spawnSync(
    process.execPath,
    [playwrightCli, 'test', '--config', path.join(packageDir, 'playwright.artifact.config.ts'), '--grep', captureTestGrep],
    {
        cwd: packageDir,
        env: captureEnv,
        stdio: 'inherit'
    }
)
if (run.error) throw run.error
if (run.status !== 0) {
    fail(`playwright capture pass exited with code ${run.status}`)
}

const specBuffer = readFileSync(path.join(repoRoot, specRelative))
const captures = []
const assets = []

for (const viewport of VIEWPORTS) {
    const fileRelative = `${assetDirRelative}/${captureId}-${viewport.project}.png`
    const filePath = path.join(repoRoot, fileRelative)
    if (!existsSync(filePath)) fail(`expected capture missing: ${fileRelative}`)
    const buffer = readFileSync(filePath)
    let dimensions
    try {
        dimensions = readPngDimensions(buffer)
    } catch (error) {
        fail(`${fileRelative}: ${error.message}`)
    }
    if (dimensions.width !== viewport.width || dimensions.height !== viewport.height) {
        fail(
            `${fileRelative}: dimensions ${dimensions.width}x${dimensions.height} do not match viewport ${viewport.width}x${viewport.height}`
        )
    }
    captures.push({
        id: captureId,
        locale: 'en',
        status: 'captured',
        path: fileRelative,
        captureType: 'booted-workspace',
        route: 'sandboxed host iframe -> /?locale=en (standalone artifact serve)',
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height }
    })
    assets.push({
        locale: 'en',
        path: fileRelative,
        sha256: sha256(buffer),
        dimensions: { width: dimensions.width, height: dimensions.height }
    })
}

for (const viewport of VIEWPORTS) {
    captures.push({
        id: captureId,
        locale: 'ru',
        status: 'pending',
        path: `docs/ru/.gitbook/assets/playcanvas-editor-upgrade/${captureId}-${viewport.project}.png`,
        captureType: 'booted-workspace',
        route: 'sandboxed host iframe -> /?locale=ru (pending localized host flow)',
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height }
    })
}

const provenance = {
    version: 1,
    featureId: 'playcanvas-editor-upgrade',
    generator: specRelative,
    generatorSha256: sha256(specBuffer),
    runner: 'tools/testing/e2e/support/capturePlayCanvasEditorUpgradeScreenshots.mjs',
    generatedAt: new Date().toISOString(),
    artifact: {
        upstreamRepository: artifactManifest.upstreamRepository,
        upstreamTag: artifactManifest.upstreamTag,
        upstreamCommit: artifactManifest.upstreamCommit,
        upstreamPackageVersion: artifactManifest.upstreamPackageVersion
    },
    localeStatus: {
        en: 'captured',
        ru: 'pending'
    },
    notes: [
        'EN assets are captured from the real booted v2.30.4 hosted editor (bridge protocol universo-bridge-minimal) across the desktop/tablet/mobile Playwright projects.',
        'RU variants are pending: the upstream PlayCanvas Editor v2.30.4 chrome is English-only and the ?locale=ru query localizes only the Universo host shell fallback page, so no honest RU editor screenshots can be produced until a localized host flow exists. Byte-identical copies of EN assets under docs/ru are forbidden by convention.',
        'The standalone artifact serve has no realtime scene backend, so the scene tree stays empty and the viewport renders no scene; the transient realtime reconnect banner is suppressed during capture through the artifact own event contract plus overlay removal. Hosted platform flows run against the realtime server where neither artifact appears.',
        'Pending captures intentionally have no files on disk; the drift checker fails if a file appears at a pending path without regenerating this manifest.'
    ],
    viewportMatrix: [
        {
            id: captureId,
            locale: 'en',
            viewports: VIEWPORTS.map((viewport) => ({ name: viewport.name, width: viewport.width, height: viewport.height }))
        },
        {
            id: captureId,
            locale: 'ru',
            status: 'pending',
            viewports: VIEWPORTS.map((viewport) => ({ name: viewport.name, width: viewport.width, height: viewport.height }))
        }
    ],
    captures,
    assets
}

const provenancePath = path.join(repoRoot, provenanceRelative)
writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 4)}\n`)

console.log(`Captured ${assets.length} EN assets into ${assetDirRelative}.`)
console.log(`Provenance manifest written to ${provenanceRelative}.`)
console.log('RU variants recorded as pending (see manifest notes).')
