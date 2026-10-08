import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from './env/load-e2e-env.mjs'

export const resolvePathInsideRepository = (input: string, label: string): string => {
    const outputPath = path.resolve(repoRoot, input)
    const relativePath = path.relative(repoRoot, outputPath)

    if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        throw new Error(`${label} must resolve to a file inside the repository.`)
    }

    let currentPath = repoRoot
    for (const segment of relativePath.split(path.sep)) {
        currentPath = path.join(currentPath, segment)
        let stats: fs.Stats
        try {
            stats = fs.lstatSync(currentPath)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') break
            throw error
        }
        if (stats.isSymbolicLink()) {
            throw new Error(`${label} must not traverse symbolic links inside the repository.`)
        }
    }

    return outputPath
}

/**
 * Resolve a fixture destination and reject paths outside the repository.
 * Generators default to an ignored artifact, while explicit fixture gates pass
 * a dedicated artifact path through the corresponding environment variable.
 */
export const resolveFixtureOutputPath = (environmentKey: string, fixtureFilename: string): string => {
    const configuredPath = process.env[environmentKey]
    return resolvePathInsideRepository(
        configuredPath ?? path.join('tools', 'testing', 'e2e', '.artifacts', `generated-${fixtureFilename}`),
        environmentKey
    )
}
