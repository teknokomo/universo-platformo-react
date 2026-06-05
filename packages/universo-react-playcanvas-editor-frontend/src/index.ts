export const PLAYCANVAS_EDITOR_UPSTREAM_REPOSITORY = 'https://github.com/playcanvas/editor'
export const PLAYCANVAS_EDITOR_UPSTREAM_TAG = 'v2.22.1'
export const PLAYCANVAS_EDITOR_UPSTREAM_COMMIT = '0fcd44253ba1bba39c13d45b069265167249ecb6'
export const PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION = '2.22.1'
export const PLAYCANVAS_EDITOR_NODE_REQUIREMENT = '>=22.22.0'
export const PLAYCANVAS_EDITOR_ARTIFACT_OUTPUT_ROOT = 'dist/editor'
export const PLAYCANVAS_EDITOR_SMOKE_MODE = 'artifact-only'

export type PlayCanvasEditorSmokeMode = typeof PLAYCANVAS_EDITOR_SMOKE_MODE

export interface PlayCanvasEditorArtifactManifest {
    upstreamRepository: typeof PLAYCANVAS_EDITOR_UPSTREAM_REPOSITORY
    upstreamTag: typeof PLAYCANVAS_EDITOR_UPSTREAM_TAG
    upstreamCommit: typeof PLAYCANVAS_EDITOR_UPSTREAM_COMMIT
    upstreamPackageVersion: typeof PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION
    nodeRequirement: typeof PLAYCANVAS_EDITOR_NODE_REQUIREMENT
    outputRoot: typeof PLAYCANVAS_EDITOR_ARTIFACT_OUTPUT_ROOT
    smokeMode: PlayCanvasEditorSmokeMode
    builtAt: string
}

export const createPlayCanvasEditorArtifactManifest = (builtAt: string): PlayCanvasEditorArtifactManifest => ({
    upstreamRepository: PLAYCANVAS_EDITOR_UPSTREAM_REPOSITORY,
    upstreamTag: PLAYCANVAS_EDITOR_UPSTREAM_TAG,
    upstreamCommit: PLAYCANVAS_EDITOR_UPSTREAM_COMMIT,
    upstreamPackageVersion: PLAYCANVAS_EDITOR_UPSTREAM_PACKAGE_VERSION,
    nodeRequirement: PLAYCANVAS_EDITOR_NODE_REQUIREMENT,
    outputRoot: PLAYCANVAS_EDITOR_ARTIFACT_OUTPUT_ROOT,
    smokeMode: PLAYCANVAS_EDITOR_SMOKE_MODE,
    builtAt
})
