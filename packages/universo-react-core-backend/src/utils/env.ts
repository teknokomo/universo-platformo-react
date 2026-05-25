import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

const backendRootDir = path.resolve(__dirname, '..', '..')

let loadedEnvPath: string | null = null

export function getBackendRootDir(): string {
    return backendRootDir
}

function resolveExplicitEnvPath(explicitPath: string): string {
    return path.isAbsolute(explicitPath) ? explicitPath : path.join(backendRootDir, explicitPath)
}

function buildCandidateEnvPaths(target: string | undefined): string[] {
    const normalizedTarget = target?.trim()

    if (normalizedTarget === 'e2e') {
        return ['.env.e2e.local', '.env.e2e', '.env']
    }

    if (normalizedTarget === 'test') {
        return ['.env.test.local', '.env.test', '.env']
    }

    return ['.env']
}

function resolveBackendEnvPath(): string {
    const explicitPath = process.env.UNIVERSO_ENV_FILE?.trim()
    if (explicitPath) {
        return resolveExplicitEnvPath(explicitPath)
    }

    const candidates = buildCandidateEnvPaths(process.env.UNIVERSO_ENV_TARGET)
    const resolvedCandidate = candidates
        .map((candidatePath) => path.join(backendRootDir, candidatePath))
        .find((candidatePath) => fs.existsSync(candidatePath))

    return resolvedCandidate ?? path.join(backendRootDir, '.env')
}

export function loadBackendEnv(): string {
    if (loadedEnvPath) {
        return loadedEnvPath
    }

    const envPath = resolveBackendEnvPath()
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false })
    }

    loadedEnvPath = envPath
    return envPath
}
