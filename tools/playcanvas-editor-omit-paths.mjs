// PlayCanvas Editor vendor omit paths — single source of truth.
//
// Two lists because OMIT requires different strategies: directories are
// removed by entry name; files are matched by exact filename. No glob —
// `fs.existsSync` and `fs.rmSync` do not expand patterns, and adding a
// glob dependency for two entries is not worth the cost.
//
// Both `tools/check-playcanvas-editor-vendor-drift.mjs` and the snapshot
// script's inline `rm` block (during the IMPLEMENT phase) import from
// here. When a new variant lands upstream (e.g. `Dockerfile.dev`),
// add the exact entry here and the drift guard + snapshot procedure
// will pick it up automatically.

export const PLAYCANVAS_EDITOR_OMIT_DIRS = Object.freeze(['test', 'test-suite', '.github'])

export const PLAYCANVAS_EDITOR_OMIT_FILES = Object.freeze([
    'package.json',
    'package-lock.json',
    'Dockerfile',
    'docker-compose.yml',
    'renovate.json',
    '.env.template',
    '.mocharc.json',
    '.nvmrc',
    '.stylelintrc.json'
])
