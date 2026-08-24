#!/usr/bin/env node

// PlayCanvas Editor vendor drift guard.
//
// Compares `vendor/playcanvas-editor/` against the COMMITTED provenance
// inventory `vendor/upstream-inventory.json`, which pins one sha256 per
// file exactly as produced by `git archive <tag>` after applying the omit
// lists from `tools/playcanvas-editor-omit-paths.mjs`. This works in CI
// without any sibling upstream checkout and fails closed on ANY drift:
// missing files, extra files, content changes, or symlinks.
//
// Inventory regeneration is part of the vendor import procedure only —
// hand-editing vendored files requires regenerating the inventory in the
// same commit, which makes local edits reviewable instead of silent.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const EDITOR_PACKAGE_DIR = path.join(ROOT, 'packages/universo-react-playcanvas-editor-frontend')
const VENDOR_DIR = path.join(EDITOR_PACKAGE_DIR, 'vendor/playcanvas-editor')
const INVENTORY_PATH = path.join(EDITOR_PACKAGE_DIR, 'vendor/upstream-inventory.json')
const INDEX_FILE = path.join(EDITOR_PACKAGE_DIR, 'src/index.ts')

const SKIP_FLAG = process.env.PC_EDITOR_DRIFT_SKIP === '1'
const RUNNING_IN_CI = process.env.GITHUB_ACTIONS === 'true'

const fail = (message) => {
    console.error(`[check:playcanvas-editor-vendor-drift] FAIL: ${message}`)
    process.exit(1)
}

if (!existsSync(VENDOR_DIR)) {
    fail(`vendored tree not found at ${path.relative(ROOT, VENDOR_DIR)}`)
}
if (!existsSync(INVENTORY_PATH)) {
    fail(`provenance inventory not found at ${path.relative(ROOT, INVENTORY_PATH)}`)
}

const indexContent = readFileSync(INDEX_FILE, 'utf8')
const currentTag = indexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_TAG\s*=\s*'([^']+)'/)?.[1]
const currentCommit = indexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_COMMIT\s*=\s*'([^']+)'/)?.[1]
if (!currentTag || !currentCommit) {
    fail(`failed to parse tag/commit from ${path.relative(ROOT, INDEX_FILE)}`)
}

const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))
if (!inventory?.meta || typeof inventory?.files !== 'object') {
    fail('inventory file is malformed; expected { meta, files } shape')
}
if (inventory.meta.tag !== currentTag || inventory.meta.peeledCommit !== currentCommit) {
    fail(
        `inventory pins ${inventory.meta.tag} (${String(inventory.meta.peeledCommit).slice(0, 7)}) but src/index.ts pins ` +
            `${currentTag} (${currentCommit.slice(0, 7)}); regenerate the inventory during a vendor import`
    )
}

// Walk the vendored tree without following symlinks; every entry must be a
// regular file present in the inventory with an identical sha256.
const walkVendor = (dir, base = dir) => {
    const files = new Map()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isSymbolicLink() || statSync(full).isSymbolicLink()) {
            fail(`symlink detected inside the vendored tree: ${path.relative(base, full)}`)
        }
        if (entry.isDirectory()) {
            for (const [rel, hash] of walkVendor(full, base)) {
                files.set(rel, hash)
            }
        } else if (entry.isFile()) {
            const rel = path.relative(base, full).split(path.sep).join('/')
            files.set(rel, createHash('sha256').update(readFileSync(full)).digest('hex'))
        }
    }
    return files
}

const vendorFiles = walkVendor(VENDOR_DIR)
const expectedFiles = new Map(Object.entries(inventory.files))

const missingInVendor = [...expectedFiles.keys()].filter((p) => !vendorFiles.has(p)).sort()
const extraInVendor = [...vendorFiles.keys()].filter((p) => !expectedFiles.has(p)).sort()
const contentDrift = [...expectedFiles.keys()]
    .filter((p) => vendorFiles.has(p) && vendorFiles.get(p) !== expectedFiles.get(p))
    .sort()

if (missingInVendor.length > 0 || extraInVendor.length > 0 || contentDrift.length > 0) {
    console.error(
        `[check:playcanvas-editor-vendor-drift] Vendor drift detected against inventory ${currentTag} (${currentCommit.slice(0, 7)}):`
    )
    for (const p of missingInVendor.slice(0, 20)) console.error(`  - missing in vendor: ${p}`)
    if (missingInVendor.length > 20) console.error(`    ... and ${missingInVendor.length - 20} more`)
    for (const p of extraInVendor.slice(0, 20)) console.error(`  + extra in vendor: ${p}`)
    if (extraInVendor.length > 20) console.error(`    ... and ${extraInVendor.length - 20} more`)
    for (const p of contentDrift.slice(0, 20)) {
        console.error(`  ~ content drift: ${p} (expected ${expectedFiles.get(p).slice(0, 12)}, actual ${vendorFiles.get(p).slice(0, 12)})`)
    }
    if (contentDrift.length > 20) console.error(`    ... and ${contentDrift.length - 20} more`)
    process.exit(1)
}

if (SKIP_FLAG) {
    if (RUNNING_IN_CI) {
        fail('PC_EDITOR_DRIFT_SKIP=1 is forbidden in CI')
    }
    console.warn(
        '[check:playcanvas-editor-vendor-drift] WARNING: run marked UNVERIFIED by PC_EDITOR_DRIFT_SKIP=1 ' +
            '(inventory comparison itself still ran and passed).'
    )
}

console.log(
    `[check:playcanvas-editor-vendor-drift] Vendor tree matches inventory for ${currentTag} (${currentCommit.slice(0, 7)}); ` +
        `${vendorFiles.size} files content-compared, no drift.`
)
process.exit(0)
