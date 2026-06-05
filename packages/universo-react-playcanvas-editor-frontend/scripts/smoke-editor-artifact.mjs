#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

import {
    artifactManifestPath,
    artifactRoot,
    assertBuildScriptsDoNotInstall,
    assertNoNestedPackageManifests,
    assertNodeVersion,
    assertVendorMetadata,
    bridgeBootstrapFileName,
    packageRoot,
    validateArtifactManifest
} from './lib/playcanvas-editor-artifact.mjs'

const requireFile = (relativePath) => {
    const absolutePath = path.join(artifactRoot, relativePath)
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        throw new Error(`Missing artifact file: ${relativePath}`)
    }
    return absolutePath
}

assertNodeVersion()
assertVendorMetadata()
assertBuildScriptsDoNotInstall()
assertNoNestedPackageManifests()

if (!fs.existsSync(artifactRoot) || !fs.statSync(artifactRoot).isDirectory()) {
    throw new Error('PlayCanvas Editor artifact root is missing. Run editor:build first.')
}

requireFile('index.html')
requireFile('js/editor.js')
requireFile('js/editor-empty.js')
requireFile('js/launch.js')
requireFile('css/editor.css')
requireFile('css/launch.css')

const manifest = JSON.parse(fs.readFileSync(artifactManifestPath, 'utf8'))
validateArtifactManifest(manifest)

const indexHtml = fs.readFileSync(requireFile('index.html'), 'utf8')
if (manifest.mode === 'universo-hosted') {
    const bootstrapPath = requireFile(bridgeBootstrapFileName)
    requireFile('js/playcanvas-engine.js')
    requireFile('js/playcanvas-engine.d.ts')
    if (!indexHtml.includes(bridgeBootstrapFileName) || !indexHtml.includes('./universo-bridge-bootstrap.js')) {
        throw new Error('Universo hosted artifact is missing the bridge bootstrap script')
    }
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf8')
    if (!bootstrapSource.includes('playcanvas-engine.js')) {
        throw new Error('Universo hosted artifact is missing the local engine contract URL')
    }
    if (!bootstrapSource.includes('editor.bootstrap.requestInit') || !bootstrapSource.includes('editor.bootstrap.init')) {
        throw new Error('Universo hosted artifact must wait for the platform bootstrap descriptor before loading the editor')
    }
    if (/Artifact Unavailable|artifact-only integration surface/i.test(indexHtml)) {
        throw new Error('Universo hosted artifact must not serve the artifact-only placeholder')
    }
}
if (manifest.mode === 'artifact-only' && !/Artifact Unavailable|artifact-only integration surface/i.test(indexHtml)) {
    throw new Error('Artifact-only mode must serve the safe unavailable placeholder')
}

const scannedExtensions = new Set(['.html', '.js', '.css'])
const forbidden =
    /@universo-react\/(?:template-mui|apps-template-mui|core-frontend|metahubs-frontend|applications-frontend)|packages\/universo-react-/i

const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            scan(absolute)
            continue
        }
        if (!scannedExtensions.has(path.extname(entry.name))) continue
        const content = fs.readFileSync(absolute, 'utf8')
        if (forbidden.test(content)) {
            throw new Error(`Generated artifact contains a forbidden Universo import/reference: ${path.relative(packageRoot, absolute)}`)
        }
    }
}

scan(artifactRoot)
console.log('PlayCanvas Editor artifact smoke check passed.')
