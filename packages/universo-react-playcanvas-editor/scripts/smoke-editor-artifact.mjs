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
