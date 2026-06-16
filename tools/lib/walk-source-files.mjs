// Shared source-file walker for `tools/check-*.mjs` governance scripts.
//
// Replaces four near-identical copies of the same async/sync directory
// walker. Bug fixes (add `.git` to IGNORED_DIRS, fix Windows separator
// handling, swap to Node 22's native `fs.glob`) become a one-file
// change.
//
// Usage:
//   import { walkSourceFiles, defaultIgnoredDirs, defaultSourceExtensions } from './lib/walk-source-files.mjs'
//   for await (const file of walkSourceFiles(root, { ignoredDirs: defaultIgnoredDirs })) { ... }
//
// The walker is async to match the existing implementation in
// `check-playcanvas-editor-isolation.mjs`. The sync variant in
// `check-catalog-versions.mjs` and `check-playcanvas-editor-vendor-drift.mjs`
// can be migrated in a follow-up.

import { readdir } from 'node:fs/promises'
import path from 'node:path'

export const defaultIgnoredDirs = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.tmp'])

export const defaultSourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'])

/**
 * Recursively yield absolute paths of source files under `dir`.
 *
 * @param {string} dir - Absolute root directory.
 * @param {object} [options]
 * @param {Set<string>} [options.ignoredDirs] - Directory names to skip.
 * @param {Set<string>} [options.sourceExtensions] - File extensions to yield.
 * @returns {AsyncGenerator<string>}
 */
export async function* walkSourceFiles(dir, { ignoredDirs = defaultIgnoredDirs, sourceExtensions = defaultSourceExtensions } = {}) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) continue
            yield* walkSourceFiles(absolute, { ignoredDirs, sourceExtensions })
            continue
        }
        if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) {
            yield absolute
        }
    }
}
