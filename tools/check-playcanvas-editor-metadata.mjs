#!/usr/bin/env node

// PlayCanvas Editor metadata consistency guard.
//
// Fails if any active file in the repository still references the
// *previous* upstream PlayCanvas Editor tag, version, or commit. The
// current pinned values are read from
// `packages/universo-react/playcanvas-editor-frontend/src/index.ts`
// (the single source of truth). The previous-version literals are
// derived by decrementing the package minor (e.g. 2.24.2 -> 2.23.4).
//
// Discipline: the next agent must update the constants in
// `src/index.ts` AND re-record the previous literals in the
// `PREVIOUS_*` constants below in the same commit.
//
// Allowed historical mentions:
//   - memory-bank/         (records)
//   - vendor/playcanvas-editor/** (upstream source)
//   - dist/, build/, node_modules/, .turbo/, .tmp/, coverage/  (generated / deps)

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { walkSourceFiles } from './lib/walk-source-files.mjs'

const ROOT = process.cwd()
const EDITOR_PACKAGE_DIR = 'packages/universo-react-playcanvas-editor-frontend'
const INDEX_FILE = path.join(ROOT, EDITOR_PACKAGE_DIR, 'src/index.ts')

const ACTIVE_SCAN_DIRS = [
    'packages',
    'docs/en/platform',
    'docs/ru/platform',
    '.agents/skills/playcanvas-editor-api-realtime',
    '.agents/skills/playcanvas-editor-assets',
    '.agents/skills/playcanvas-editor-authoring',
    '.agents/skills/playcanvas-editor-interface',
    '.agents/skills/playcanvas-editor-scenes',
    '.agents/skills/playcanvas-editor-scripting',
    '.agents/skills/playcanvas-editor-settings',
    '.agents/skills/playcanvas-editor-universo-compat',
    '.agents/skills/playcanvas-editor-version-control',
    'tools',
    'scripts'
]

// `walkSourceFiles` defaults are extended with `.yml`, `.yaml`,
// `.scss` (PlayCanvas Editor SASS / OpenAPI YAML live in the scanned
// trees). The shared `tools/lib/walk-source-files.mjs` keeps the
// baseline list; this script opts into the extra extensions.
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx', '.yml', '.yaml', '.scss'])

// Paths that are explicitly allowed to retain historical version mentions.
const ALLOWED_PATH_PREFIXES = [
    `${EDITOR_PACKAGE_DIR}/vendor/`,
    'memory-bank/',
    // The metadata guard itself records the previous version literals.
    'tools/check-playcanvas-editor-metadata.mjs',
    // The vendor-drift guard also references the previous tag.
    'tools/check-playcanvas-editor-vendor-drift.mjs',
    // The previous-version sentinel intentionally contains the prior
    // version (e.g. "2.23.4") so the next bump can read it as the
    // single source of truth.
    'tools/playcanvas-editor-previous-version.txt',
    // UPSTREAM.md has a historical "Update from v2.23.4 -> v2.24.2" section
    // that intentionally records the previous tag.
    `${EDITOR_PACKAGE_DIR}/vendor/UPSTREAM.md`
]

// Read the current upstream tag/version/commit from src/index.ts.
const currentIndexContent = await readFile(INDEX_FILE, 'utf8')
const currentTag = currentIndexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_TAG\s*=\s*'([^']+)'/)?.[1]
const currentVersion = currentIndexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION\s*=\s*'([^']+)'/)?.[1]
const currentCommit = currentIndexContent.match(/PLAYCANVAS_EDITOR_UPSTREAM_COMMIT\s*=\s*'([^']+)'/)?.[1]

if (!currentTag || !currentVersion || !currentCommit) {
    console.error(
        `[check:playcanvas-editor-metadata] Failed to parse tag/version/commit from ${path.relative(ROOT, INDEX_FILE)}.\n` +
            '  Expected: PLAYCANVAS_EDITOR_UPSTREAM_TAG, PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION, PLAYCANVAS_EDITOR_UPSTREAM_COMMIT.\n' +
            '  Update src/index.ts first.'
    )
    process.exit(1)
}

// Read the previous-version sentinel. The file is updated by the
// upstream-bump commit (the snapshot step rewrites the previous tag
// along with the current one in `src/index.ts`). This is the single
// source of truth for the previous version: no hand-edited second
// string in this script, no fragile auto-derivation, no git log
// dependency at runtime.
const PREVIOUS_VERSION_SENTINEL = path.join(ROOT, 'tools/playcanvas-editor-previous-version.txt')
let PREVIOUS_VERSION
try {
    PREVIOUS_VERSION = (await readFile(PREVIOUS_VERSION_SENTINEL, 'utf8')).trim()
} catch (err) {
    if (err.code === 'ENOENT') {
        console.error(
            `[check:playcanvas-editor-metadata] Previous-version sentinel not found at ${path.relative(
                ROOT,
                PREVIOUS_VERSION_SENTINEL
            )}.\n` +
                '  Create it by writing the prior upstream version (e.g. "2.23.4" on the first v2.24.2 bump).\n' +
                '  This sentinel is updated by every upstream-bump commit in lockstep with src/index.ts.'
        )
        process.exit(1)
    }
    throw err
}
if (!/^\d+\.\d+\.\d+$/.test(PREVIOUS_VERSION)) {
    console.error(
        `[check:playcanvas-editor-metadata] Sentinel at ${path.relative(
            ROOT,
            PREVIOUS_VERSION_SENTINEL
        )} contains "${PREVIOUS_VERSION}", which is not a semver X.Y.Z. ` +
            'Fix the sentinel to the previous upstream version (e.g. "2.23.4").'
    )
    process.exit(1)
}
const PREVIOUS_TAG = `v${PREVIOUS_VERSION}`

// The commit SHA is not enumerable, so we only check version + tag literals.
const FORBIDDEN_LITERALS = [PREVIOUS_VERSION, PREVIOUS_TAG]

const toRelative = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/')

const isAllowed = (relativePath) => ALLOWED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))

const lineNumberFor = (content, index) => content.slice(0, index).split(/\r?\n/).length

const violations = []

for (const scanDir of ACTIVE_SCAN_DIRS) {
    const absoluteScanDir = path.join(ROOT, scanDir)
    try {
        for await (const file of walkSourceFiles(absoluteScanDir, { sourceExtensions: SCAN_EXTENSIONS })) {
            const relativeFile = toRelative(file)
            if (isAllowed(relativeFile)) continue
            const content = await readFile(file, 'utf8')
            for (const literal of FORBIDDEN_LITERALS) {
                let index = content.indexOf(literal)
                while (index !== -1) {
                    violations.push(
                        `${relativeFile}:${lineNumberFor(
                            content,
                            index
                        )}: stale PlayCanvas Editor version literal "${literal}" (current is ${currentTag} / ${currentVersion})`
                    )
                    index = content.indexOf(literal, index + literal.length)
                }
            }
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            // Optional scan dir (e.g. .agents/skills/* may not exist if skills are renamed).
            continue
        }
        throw err
    }
}

if (violations.length > 0) {
    console.error('[check:playcanvas-editor-metadata] PlayCanvas Editor metadata drift guard FAILED:')
    console.error(`  current: ${currentTag} / ${currentVersion} / ${currentCommit}`)
    console.error(`  looking for stale: ${FORBIDDEN_LITERALS.join(', ')}`)
    console.error('')
    for (const violation of violations) {
        console.error(`  - ${violation}`)
    }
    process.exit(1)
}

console.log(
    `[check:playcanvas-editor-metadata] PlayCanvas Editor metadata guard passed (current: ${currentTag} / ${currentVersion} / ${currentCommit.substring(
        0,
        7
    )}).`
)
