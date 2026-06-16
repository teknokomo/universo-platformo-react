#!/usr/bin/env node

// PlayCanvas Editor vendor drift guard.
//
// Compares `vendor/playcanvas-editor/` against the pinned upstream tag
// (peeled commit), ignoring documented omissions and CRLF/LF differences.
//
// Developer-local by design: the script reads `PC_EDITOR_UPSTREAM_DIR`
// (default `~/dev/pc-editor-v2.24.2`), a sibling worktree OUTSIDE
// `packages/**` to satisfy `assertBuildScriptsDoNotInstall`'s
// `git clone/fetch/pull/submodule update` blocklist. When that directory
// is absent (e.g. in CI), the script exits 0 with a one-line
// informational log so the rest of the chain can continue.
//
// Discipline:
//   1. The `PC_EDITOR_UPSTREAM_DIR` worktree must be a clean
//      `git clone --depth 1 --branch v2.24.2` (or `--branch <tag>` for
//      the current tag).
//   2. The script does NOT invoke `git clone/fetch/pull/submodule
//      update` from inside `packages/**` — `git archive` is allowed by
//      the existing blocklist regex.

import { existsSync } from 'node:fs'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'

import { PLAYCANVAS_EDITOR_OMIT_DIRS, PLAYCANVAS_EDITOR_OMIT_FILES } from './playcanvas-editor-omit-paths.mjs'

const ROOT = process.cwd()
const EDITOR_PACKAGE_DIR = path.join(ROOT, 'packages/universo-react-playcanvas-editor-frontend')
const VENDOR_DIR = path.join(EDITOR_PACKAGE_DIR, 'vendor/playcanvas-editor')
const INDEX_FILE = path.join(EDITOR_PACKAGE_DIR, 'src/index.ts')

const UPSTREAM_DIR = process.env.PC_EDITOR_UPSTREAM_DIR || path.join(homedir(), 'dev/pc-editor-v2.24.2')

// Omit lists imported from `tools/playcanvas-editor-omit-paths.mjs` —
// the single source of truth shared with the snapshot script's inline
// `rm` block in `memory-bank/plan/playcanvas-editor-upstream-*-update-plan-*.md`.
const OMIT_DIRS = new Set(PLAYCANVAS_EDITOR_OMIT_DIRS)
const OMIT_FILES = new Set(PLAYCANVAS_EDITOR_OMIT_FILES)

// Read the current tag/commit from src/index.ts.
const indexContent = readFileSync(INDEX_FILE, 'utf8')
const currentTag = indexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_TAG\s*=\s*'([^']+)'/)?.[1]
const currentCommit = indexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_COMMIT\s*=\s*'([^']+)'/)?.[1]

if (!currentTag || !currentCommit) {
    console.error(`[check:playcanvas-editor-vendor-drift] Failed to parse tag/commit from ${path.relative(ROOT, INDEX_FILE)}.`)
    process.exit(1)
}

// CI / first-time developer path: no sibling worktree, no-op gracefully.
if (!existsSync(UPSTREAM_DIR)) {
    console.log(
        `[check:playcanvas-editor-vendor-drift] PC_EDITOR_UPSTREAM_DIR not found at ${UPSTREAM_DIR}; skipping developer-local check.`
    )
    process.exit(0)
}

const git = (args) => spawnSync('git', args, { cwd: UPSTREAM_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// Confirm the worktree is at the pinned commit.
const headResult = git(['rev-parse', 'HEAD'])
if (headResult.status !== 0) {
    console.error(`[check:playcanvas-editor-vendor-drift] Failed to read HEAD in ${UPSTREAM_DIR}.`)
    process.exit(1)
}
const headSha = headResult.stdout.trim()
if (headSha !== currentCommit) {
    console.error(
        `[check:playcanvas-editor-vendor-drift] Upstream HEAD ${headSha} does not match pinned commit ${currentCommit}. ` +
            `Refresh the worktree (cd ${UPSTREAM_DIR} && git fetch && git checkout ${currentTag}).`
    )
    process.exit(1)
}

const tempRoot = mkdtempSync(path.join(tmpdir(), 'pc-editor-vendor-stage-'))
// The `git archive` tarball has the upstream root at its top level
// (LICENSE, src/, sass/, etc.), so we extract into a dedicated
// subdirectory to keep the comparison path explicit and avoid any
// pollution from the temp root itself. Use the `tar --strip-components`
// flag to keep the upstream's root files inside `tempUpstream/`.
const tempUpstream = path.join(tempRoot, 'upstream')
mkdirSync(tempUpstream, { recursive: true })

try {
    // `git archive` is allowed by `assertBuildScriptsDoNotInstall`'s
    // blocklist (which only matches clone/fetch/pull/submodule update).
    const archiveResult = git(['archive', currentTag, '-o', path.join(tempRoot, 'upstream.tar')])
    if (archiveResult.status !== 0) {
        console.error(`[check:playcanvas-editor-vendor-drift] git archive failed:\n${archiveResult.stderr}`)
        process.exit(1)
    }

    const extractResult = spawnSync('tar', ['-xf', path.join(tempRoot, 'upstream.tar'), '-C', tempUpstream], {
        encoding: 'utf8'
    })
    if (extractResult.status !== 0) {
        console.error(`[check:playcanvas-editor-vendor-drift] tar extract failed: ${extractResult.stderr}`)
        process.exit(1)
    }

    // Apply local omissions to the staged upstream snapshot. The two
    // lists (OMIT_DIRS, OMIT_FILES) are matched by exact name — no
    // glob, because the existing `assertBuildScriptsDoNotInstall`
    // blocklist does not allow a glob dependency inside `packages/`.
    for (const entry of readdirSync(tempUpstream, { withFileTypes: true })) {
        if (OMIT_DIRS.has(entry.name) || OMIT_FILES.has(entry.name)) {
            rmSync(path.join(tempUpstream, entry.name), { recursive: true, force: true })
        }
    }

    // Walk both trees, building sorted path lists (excluding
    // textural/CRLF noise: we only compare file presence + sizes
    // + sha256 for small files). For deep diff, downstream tools can
    // run `diff -r staging vendor/playcanvas-editor/`.
    const walk = (dir, base = dir) => {
        const out = []
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                out.push(...walk(full, base))
            } else if (entry.isFile()) {
                out.push(path.relative(base, full))
            }
        }
        return out
    }

    const upstreamFiles = walk(tempUpstream).sort()
    const vendorFiles = walk(VENDOR_DIR).sort()

    const upstreamSet = new Set(upstreamFiles)
    const vendorSet = new Set(vendorFiles)

    const missingInVendor = upstreamFiles.filter((p) => !vendorSet.has(p))
    const extraInVendor = vendorFiles.filter((p) => !upstreamSet.has(p))

    // Content drift: for every path present in both trees, hash the
    // bytes and compare. A filename-only check would miss the most
    // common drift case (someone edits a vendored file without
    // adding/removing a file) — exactly the regression we want to
    // catch before `test:e2e:agent` continues.
    const crypto = await import('node:crypto')
    const hashFile = (file) => {
        const buf = readFileSync(file)
        return crypto.createHash('sha256').update(buf).digest('hex')
    }
    const contentDrift = []
    for (const rel of upstreamFiles) {
        if (!vendorSet.has(rel)) continue
        const upstreamHash = hashFile(path.join(tempUpstream, rel))
        const vendorHash = hashFile(path.join(VENDOR_DIR, rel))
        if (upstreamHash !== vendorHash) {
            contentDrift.push({ rel, upstreamHash, vendorHash })
        }
    }

    if (missingInVendor.length === 0 && extraInVendor.length === 0 && contentDrift.length === 0) {
        console.log(
            `[check:playcanvas-editor-vendor-drift] Vendor tree matches upstream ${currentTag} (${currentCommit.substring(0, 7)}); ` +
                `${upstreamFiles.length} files content-compared, no drift.`
        )
        process.exit(0)
    }

    console.error(
        `[check:playcanvas-editor-vendor-drift] Vendor drift detected against upstream ${currentTag} (${currentCommit.substring(0, 7)}):`
    )
    if (missingInVendor.length > 0) {
        console.error(`  Missing in vendor (${missingInVendor.length}):`)
        for (const p of missingInVendor.slice(0, 20)) console.error(`    - ${p}`)
        if (missingInVendor.length > 20) console.error(`    ... and ${missingInVendor.length - 20} more`)
    }
    if (extraInVendor.length > 0) {
        console.error(`  Extra in vendor (${extraInVendor.length}):`)
        for (const p of extraInVendor.slice(0, 20)) console.error(`    + ${p}`)
        if (extraInVendor.length > 20) console.error(`    ... and ${extraInVendor.length - 20} more`)
    }
    if (contentDrift.length > 0) {
        console.error(`  Content drift (${contentDrift.length} — vendored file hashes do not match upstream):`)
        for (const d of contentDrift.slice(0, 20)) {
            console.error(`    ~ ${d.rel}  (upstream ${d.upstreamHash.slice(0, 12)}, vendor ${d.vendorHash.slice(0, 12)})`)
        }
        if (contentDrift.length > 20) console.error(`    ... and ${contentDrift.length - 20} more`)
    }
    console.error('')
    console.error('  Run `pnpm --filter @universo-react/playcanvas-editor-frontend editor:build` after re-vendoring to refresh dist/.')
    process.exit(1)
} finally {
    rmSync(tempRoot, { recursive: true, force: true })
}
