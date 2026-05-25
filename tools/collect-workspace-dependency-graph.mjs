#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

function readArg(name) {
    const index = process.argv.indexOf(name)
    if (index === -1) return null
    return process.argv[index + 1] ?? null
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'))
}

async function listWorkspaces() {
    const packagesDir = path.join(ROOT, 'packages')
    const entries = await readdir(packagesDir, { withFileTypes: true })
    const workspaces = []

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const packageJsonPath = path.join(packagesDir, entry.name, 'package.json')
        try {
            const manifest = await readJson(packageJsonPath)
            workspaces.push({
                directory: `packages/${entry.name}`,
                name: manifest.name,
                manifest
            })
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error
        }
    }

    return workspaces.sort((a, b) => a.name.localeCompare(b.name))
}

function collectDependencySections(manifest) {
    const sections = {}
    for (const section of DEPENDENCY_SECTIONS) {
        const entries = manifest[section] ?? {}
        sections[section] = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
    }
    return sections
}

const outFile = readArg('--out')
if (!outFile) {
    console.error('Usage: node tools/collect-workspace-dependency-graph.mjs --out <file>')
    process.exit(1)
}

const workspaces = await listWorkspaces()
const workspaceNames = new Set(workspaces.map(({ name }) => name))

const packages = workspaces.map(({ directory, name, manifest }) => {
    const dependencySections = collectDependencySections(manifest)
    const workspaceEdges = []

    for (const [section, dependencies] of Object.entries(dependencySections)) {
        for (const [dependencyName, range] of Object.entries(dependencies)) {
            if (!workspaceNames.has(dependencyName)) continue
            workspaceEdges.push({ dependencyName, range, section })
        }
    }

    workspaceEdges.sort((a, b) =>
        `${a.section}:${a.dependencyName}:${a.range}`.localeCompare(`${b.section}:${b.dependencyName}:${b.range}`)
    )

    return {
        directory,
        name,
        dependencySections,
        workspaceEdges
    }
})

const graph = {
    generatedAt: new Date().toISOString(),
    packageCount: packages.length,
    packages
}

await writeFile(path.join(ROOT, outFile), `${JSON.stringify(graph, null, 2)}\n`)
console.log(`Wrote workspace dependency graph for ${packages.length} packages to ${outFile}`)
