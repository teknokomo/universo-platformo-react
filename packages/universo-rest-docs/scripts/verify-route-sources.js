#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const { routeSources, repoRoot } = require('./generate-openapi-source')

const metahubsRouterPath = path.join(repoRoot, 'packages/metahubs-backend/base/src/domains/router.ts')
const routerDir = path.dirname(metahubsRouterPath)

const normalizeRepoPath = (absolutePath) => path.relative(repoRoot, absolutePath).replace(/\\/g, '/')

const resolveImportTarget = (importPath) => {
    const absolutePath = path.resolve(routerDir, `${importPath}.ts`)
    return normalizeRepoPath(absolutePath)
}

const extractImportedRouteFactories = (fileContent) => {
    const imports = new Map()
    const importRegex = /^import\s+\{\s*([^}]+)\s*\}\s+from\s+'([^']+)'/gm
    let match = importRegex.exec(fileContent)

    while (match) {
        const importedNames = match[1]
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        for (const importedName of importedNames) {
            imports.set(importedName, resolveImportTarget(match[2]))
        }
        match = importRegex.exec(fileContent)
    }

    return imports
}

const extractMountedRouteFiles = (fileContent, importedRouteFactories) => {
    const mountedFiles = new Set()
    const routeUseRegex = /router\.use\(\s*'\/'\s*,\s*(create[A-Za-z0-9]+Routes)\(/g
    let match = routeUseRegex.exec(fileContent)

    while (match) {
        const importedName = match[1]
        const filePath = importedRouteFactories.get(importedName)
        if (filePath) {
            mountedFiles.add(filePath)
        }
        match = routeUseRegex.exec(fileContent)
    }

    return mountedFiles
}

const fileContent = fs.readFileSync(metahubsRouterPath, 'utf8')
const importedRouteFactories = extractImportedRouteFactories(fileContent)
const mountedRouteFiles = extractMountedRouteFiles(fileContent, importedRouteFactories)
const documentedRouteFiles = new Set(
    routeSources
        .map((source) => source.file)
        .filter((filePath) => filePath.startsWith('packages/metahubs-backend/base/src/domains/'))
)

const missingInDocs = Array.from(mountedRouteFiles).filter((filePath) => !documentedRouteFiles.has(filePath)).sort()
const staleInDocs = Array.from(documentedRouteFiles).filter((filePath) => !mountedRouteFiles.has(filePath)).sort()

if (missingInDocs.length > 0 || staleInDocs.length > 0) {
    const lines = ['[verify-route-sources] Metahubs OpenAPI routeSources are out of sync with packages/metahubs-backend/base/src/domains/router.ts']

    if (missingInDocs.length > 0) {
        lines.push('Missing mounted route files in routeSources:')
        for (const filePath of missingInDocs) {
            lines.push(`- ${filePath}`)
        }
    }

    if (staleInDocs.length > 0) {
        lines.push('Stale route files still documented but no longer mounted:')
        for (const filePath of staleInDocs) {
            lines.push(`- ${filePath}`)
        }
    }

    console.error(lines.join('\n'))
    process.exit(1)
}

console.log('[verify-route-sources] Metahubs routeSources match the mounted router contract.')
