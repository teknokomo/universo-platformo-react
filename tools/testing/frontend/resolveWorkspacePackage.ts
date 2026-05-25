import fs from 'node:fs'
import path from 'node:path'

function findWorkspaceRoot(startDir: string): string {
    for (let currentDir = path.resolve(startDir); currentDir.length > 0; currentDir = path.dirname(currentDir)) {
        if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
            return currentDir
        }

        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) {
            throw new Error(`Could not find pnpm-workspace.yaml above ${startDir}`)
        }
    }
}

function readPackageName(packageJsonPath: string): string | undefined {
    try {
        const content = fs.readFileSync(packageJsonPath, 'utf8')
        const manifest = JSON.parse(content) as { name?: unknown }
        return typeof manifest.name === 'string' ? manifest.name : undefined
    } catch {
        return undefined
    }
}

export function resolveWorkspacePackageRoot(packageName: string, startDir: string): string {
    const workspaceRoot = findWorkspaceRoot(startDir)
    const packagesDir = path.join(workspaceRoot, 'packages')
    const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())

    for (const packageDir of packageDirs) {
        const packageRoot = path.join(packagesDir, packageDir.name)
        const manifestPath = path.join(packageRoot, 'package.json')
        if (readPackageName(manifestPath) === packageName) {
            return packageRoot
        }
    }

    throw new Error(`Could not resolve workspace package ${packageName}`)
}

export function resolveWorkspacePackagePath(packageName: string, startDir: string, ...segments: string[]): string {
    return path.join(resolveWorkspacePackageRoot(packageName, startDir), ...segments)
}
