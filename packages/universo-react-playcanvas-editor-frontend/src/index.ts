export const PLAYCANVAS_EDITOR_UPSTREAM_REPOSITORY = 'https://github.com/playcanvas/editor'
export const PLAYCANVAS_EDITOR_UPSTREAM_TAG = 'v2.23.4'
export const PLAYCANVAS_EDITOR_UPSTREAM_COMMIT = 'c4916f4973963341984499f2d919f8bfd38e417c'
export const PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION = '2.23.4'
export const PLAYCANVAS_EDITOR_NODE_REQUIREMENT = '>=22.22.0'
export const PLAYCANVAS_EDITOR_ARTIFACT_OUTPUT_ROOT = 'dist/editor'
export const PLAYCANVAS_EDITOR_SMOKE_MODE = 'universo-full-upstream-ui'

export const createPlayCanvasEditorArtifactManifest = (builtAt) => ({
    upstreamRepository: PLAYCANVAS_EDITOR_UPSTREAM_REPOSITORY,
    upstreamTag: PLAYCANVAS_EDITOR_UPSTREAM_TAG,
    upstreamCommit: PLAYCANVAS_EDITOR_UPSTREAM_COMMIT,
    upstreamPackageVersion: PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION,
    nodeRequirement: PLAYCANVAS_EDITOR_NODE_REQUIREMENT,
    outputRoot: PLAYCANVAS_EDITOR_ARTIFACT_OUTPUT_ROOT,
    smokeMode: PLAYCANVAS_EDITOR_SMOKE_MODE,
    builtAt
})
