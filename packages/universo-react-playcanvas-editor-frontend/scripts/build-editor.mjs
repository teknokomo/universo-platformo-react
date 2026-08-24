#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import {
    artifactManifestPath,
    artifactRoot,
    assertBuildScriptsDoNotInstall,
    assertNoNestedPackageManifests,
    assertNodeVersion,
    assertRootLockfileHash,
    assertVendorMetadata,
    createArtifactManifest,
    injectBridgeBootstrap,
    makeExternalTempDir,
    packageRoot,
    patchUniversoHostedArtifact,
    readRootLockfileHash,
    resolveArtifactMode,
    upstreamManifestPath,
    vendorSourceRoot,
    writeBridgeBootstrap,
    writeUniversoHostedEngineContract,
    writeUniversoHostedShell,
    writeSafeUnavailablePage
} from './lib/playcanvas-editor-artifact.mjs'

const run = (command, args, options) => {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'production'
        },
        ...options
    })
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
    }
}

assertNodeVersion()
assertVendorMetadata()
assertBuildScriptsDoNotInstall()
assertNoNestedPackageManifests()

const packageNodeModules = path.join(packageRoot, 'node_modules')
if (!fs.existsSync(packageNodeModules)) {
    throw new Error('PlayCanvas Editor package dependencies are missing. Install workspace dependencies from the repository root first.')
}

const tempRoot = makeExternalTempDir()
const initialLockfileHash = readRootLockfileHash()
const artifactMode = resolveArtifactMode()

try {
    fs.cpSync(vendorSourceRoot, tempRoot, { recursive: true })
    fs.copyFileSync(upstreamManifestPath, path.join(tempRoot, 'package.json'))
    fs.symlinkSync(packageNodeModules, path.join(tempRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')

    // Browser font generation is intentionally unsupported in Universo builds (capability
    // decision: hidden / fail-closed). The upstream font worker imports @playcanvas/font-tools,
    // which is not vendored; its staged copy is rewritten to import a stub whose runtime calls
    // throw, so the bundle still builds and any accidental invocation fails closed instead of
    // silently misbehaving. Worker modules are bundled by the upstream esbuild plugin, which
    // does not consult Vite aliases — hence the staged source rewrite.
    const fontWorkerStubPath = path.join(tempRoot, 'src', 'workers', 'universo-font-tools.stub.js')
    fs.writeFileSync(
        fontWorkerStubPath,
        [
            "const unsupported = () => {",
            "    throw new Error('Font generation is not supported in this Universo Editor build')",
            '}',
            '',
            'export const GLYPH_SIZE = 0',
            'export const PXRANGE = 0',
            'export const generateFont = unsupported',
            'export const createMsdfgenGlyphSource = unsupported',
            'export const createCanvasImageBackend = unsupported',
            ''
        ].join('\n')
    )
    const fontWorkerPath = path.join(tempRoot, 'src', 'workers', 'font-generate.worker.ts')
    if (fs.existsSync(fontWorkerPath)) {
        const originalWorkerSource = fs.readFileSync(fontWorkerPath, 'utf8')
        let patchedWorkerSource = originalWorkerSource
            .replaceAll("'@playcanvas/font-tools/glyph-source-msdfgen'", "'./universo-font-tools.stub.js'")
            .replaceAll("'@playcanvas/font-tools/image-backend-canvas'", "'./universo-font-tools.stub.js'")
            .replaceAll("'@playcanvas/font-tools'", "'./universo-font-tools.stub.js'")
        if (patchedWorkerSource === originalWorkerSource || patchedWorkerSource.includes('@playcanvas/font-tools')) {
            throw new Error('Font generation worker imports were not fully rewritten; revisit the font stub step')
        }
        fs.writeFileSync(fontWorkerPath, patchedWorkerSource)
    }

    const viteBin = path.join(packageNodeModules, 'vite', 'bin', 'vite.js')
    run(process.execPath, [viteBin, 'build', '--config', 'vite.config.mjs'], { cwd: tempRoot })

    fs.rmSync(artifactRoot, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(artifactRoot), { recursive: true })
    fs.cpSync(path.join(tempRoot, 'dist'), artifactRoot, { recursive: true })
    if (artifactMode === 'artifact-only') {
        writeSafeUnavailablePage(artifactRoot)
    } else {
        writeBridgeBootstrap(artifactRoot)
        writeUniversoHostedEngineContract(artifactRoot)
        writeUniversoHostedShell(artifactRoot, { mode: artifactMode })
        injectBridgeBootstrap(artifactRoot)
    }
    patchUniversoHostedArtifact(artifactRoot)
    fs.writeFileSync(artifactManifestPath, `${JSON.stringify(createArtifactManifest(undefined, artifactMode), null, 4)}\n`)
} finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    assertRootLockfileHash(initialLockfileHash)
}

assertNoNestedPackageManifests()
console.log(`PlayCanvas Editor artifact (${artifactMode}) written to ${path.relative(packageRoot, artifactRoot)}`)
