const encodeLockPart = (value: string): string => `${value.length}:${value}`

/**
 * Lock every PlayCanvas mutation for a metahub. Snapshot restore uses the same
 * key so a committed restore and external-file cleanup cannot overlap with a
 * project authoring write, even when they run on different workers.
 */
export const buildPlayCanvasMetahubLifecycleLockKey = (metahubId: string): string =>
    `playcanvas:metahub-lifecycle:${encodeLockPart(metahubId)}`

/**
 * Lock one project's lifecycle inside the metahub lock. Keeping a stable lock
 * ordering (metahub first, project second) prevents restore/write deadlocks.
 */
export const buildPlayCanvasProjectLifecycleLockKey = (metahubId: string, projectId: string): string =>
    `playcanvas:project-lifecycle:${encodeLockPart(metahubId)}:${encodeLockPart(projectId)}`
