// Drift checker for the PlayCanvas Editor upgrade screenshot bundle.
//
// Modeled on tools/docs/check-interpretation-network-screenshot-drift.mjs, but
// self-contained: instead of comparing against a git baseline it recomputes
// sha256 hashes of every captured asset against
// tools/docs/playcanvas-editor-upgrade-screenshot-provenance.json and fails on
// any mismatch, missing file, stale generator hash, or unexpected file. Exit 0
// means the on-disk evidence still matches the recorded provenance.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '..', '..')
const provenancePath = path.join(repoRoot, 'tools', 'docs', 'playcanvas-editor-upgrade-screenshot-provenance.json')
const assetDirs = ['docs/en/.gitbook/assets/playcanvas-editor-upgrade', 'docs/ru/.gitbook/assets/playcanvas-editor-upgrade']

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const readPngDimensions = (buffer) => {
    if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
        throw new Error('not a valid PNG file')
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

if (!existsSync(provenancePath)) {
    console.error(
        `PlayCanvas Editor upgrade screenshot drift check failed: provenance manifest is missing: ${path.relative(
            repoRoot,
            provenancePath
        )}`
    )
    process.exit(1)
}

const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'))
const errors = []

const generatorPath = path.join(repoRoot, provenance.generator)
if (!existsSync(generatorPath)) {
    errors.push(`generator source is missing: ${provenance.generator}`)
} else if (sha256(readFileSync(generatorPath)) !== provenance.generatorSha256) {
    errors.push(
        `generator ${provenance.generator} changed since the manifest was generated; rerun docs:playcanvas-editor-upgrade:screenshots`
    )
}

const assetsByPath = new Map()
for (const asset of provenance.assets ?? []) {
    if (assetsByPath.has(asset.path)) {
        errors.push(`duplicate manifest asset entry: ${asset.path}`)
        continue
    }
    assetsByPath.set(asset.path, asset)

    const filePath = path.join(repoRoot, asset.path)
    if (!existsSync(filePath)) {
        errors.push(`asset file is missing: ${asset.path}`)
        continue
    }
    const buffer = readFileSync(filePath)
    if (sha256(buffer) !== asset.sha256) {
        errors.push(`asset hash mismatch for ${asset.path}: manifest ${asset.sha256}, disk ${sha256(buffer)}`)
    }
    try {
        const dimensions = readPngDimensions(buffer)
        if (dimensions.width !== asset.dimensions?.width || dimensions.height !== asset.dimensions?.height) {
            errors.push(
                `asset dimensions mismatch for ${asset.path}: manifest ${asset.dimensions?.width}x${asset.dimensions?.height}, disk ${dimensions.width}x${dimensions.height}`
            )
        }
    } catch (error) {
        errors.push(`asset ${asset.path}: ${error.message}`)
    }
}

const capturedPaths = new Set()
const pendingPaths = new Set()
for (const capture of provenance.captures ?? []) {
    if (capture.status === 'captured') {
        capturedPaths.add(capture.path)
        if (!assetsByPath.has(capture.path)) {
            errors.push(`captured entry has no manifest asset: ${capture.path}`)
        }
        continue
    }
    if (capture.status === 'pending') {
        pendingPaths.add(capture.path)
        if (assetsByPath.has(capture.path) || existsSync(path.join(repoRoot, capture.path))) {
            errors.push(`pending capture has a file on disk; capture it or keep the manifest pending: ${capture.path}`)
        }
        continue
    }
    errors.push(`unknown capture status "${capture.status}" for ${capture.path ?? capture.id}`)
}

for (const assetPath of assetsByPath.keys()) {
    if (!capturedPaths.has(assetPath)) {
        errors.push(`manifest asset has no captured entry: ${assetPath}`)
    }
}

for (const dirRelative of assetDirs) {
    const dir = path.join(repoRoot, dirRelative)
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith('.png')) continue
        const fileRelative = `${dirRelative}/${entry}`
        if (!assetsByPath.has(fileRelative) && !pendingPaths.has(fileRelative)) {
            errors.push(`unexpected asset file not covered by the manifest: ${fileRelative}`)
        }
    }
}

if (errors.length > 0) {
    console.error('PlayCanvas Editor upgrade screenshot drift check failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
}

console.log('PlayCanvas Editor upgrade screenshot drift check passed.')
