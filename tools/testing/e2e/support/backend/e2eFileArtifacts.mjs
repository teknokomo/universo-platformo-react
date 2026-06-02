import fs from 'fs/promises'
import path from 'path'
import { loadE2eEnvironment, repoRoot } from '../env/load-e2e-env.mjs'

const defaultE2eModuleSourceRoot = path.resolve(repoRoot, 'storage-e2e')

const isPathInside = (candidatePath, parentPath) => {
    const relative = path.relative(parentPath, candidatePath)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function resolveE2eModuleSourceRoot() {
    const env = loadE2eEnvironment()
    if (env.envTarget !== 'e2e') {
        return null
    }

    const configured = process.env.UPL_MODULE_SOURCE_ROOT?.trim()
    const resolved = path.resolve(configured && configured.length > 0 ? configured : defaultE2eModuleSourceRoot)

    if (!isPathInside(resolved, defaultE2eModuleSourceRoot)) {
        return null
    }

    return defaultE2eModuleSourceRoot
}

export async function e2eModuleSourceRootExists() {
    const root = resolveE2eModuleSourceRoot()
    if (!root) {
        return false
    }

    try {
        await fs.access(root)
        return true
    } catch {
        return false
    }
}

export async function cleanupE2eFileArtifacts({ dryRun = false } = {}) {
    const moduleSourceRoot = resolveE2eModuleSourceRoot()
    if (!moduleSourceRoot) {
        return {
            moduleSourceRoot: null,
            moduleSourceRootDeleted: false,
            moduleSourceRootSkipped: true
        }
    }

    const exists = await e2eModuleSourceRootExists()
    if (!exists || dryRun) {
        return {
            moduleSourceRoot,
            moduleSourceRootDeleted: false,
            moduleSourceRootSkipped: dryRun,
            moduleSourceRootExists: exists
        }
    }

    await fs.rm(moduleSourceRoot, { recursive: true, force: true })
    return {
        moduleSourceRoot,
        moduleSourceRootDeleted: true,
        moduleSourceRootSkipped: false,
        moduleSourceRootExists: true
    }
}
