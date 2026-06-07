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
    fs.writeFileSync(artifactManifestPath, `${JSON.stringify(createArtifactManifest(undefined, artifactMode), null, 4)}\n`)
} finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    assertRootLockfileHash(initialLockfileHash)
}

assertNoNestedPackageManifests()
console.log(`PlayCanvas Editor artifact (${artifactMode}) written to ${path.relative(packageRoot, artifactRoot)}`)
