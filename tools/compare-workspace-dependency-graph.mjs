#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

function readArg(name) {
    const index = process.argv.indexOf(name)
    if (index === -1) return null
    return process.argv[index + 1] ?? null
}

async function readJson(filePath) {
    return JSON.parse(await readFile(path.join(ROOT, filePath), 'utf8'))
}

function normalizeRange(range, packageNameByOldName) {
    let normalized = range
    for (const [oldName, newName] of packageNameByOldName) {
        normalized = normalized.split(oldName).join(newName)
    }
    return normalized
}

function packageKey(packageName, packageNameByOldName) {
    return packageNameByOldName.get(packageName) ?? packageName
}

function edgeKey(ownerName, edge, packageNameByOldName) {
    const owner = packageKey(ownerName, packageNameByOldName)
    const dependency = packageKey(edge.dependencyName, packageNameByOldName)
    const range = normalizeRange(edge.range, packageNameByOldName)
    return `${owner} -> ${dependency} [${edge.section}] ${range}`
}

function collectEdges(graph, packageNameByOldName) {
    const edges = []
    for (const workspace of graph.packages ?? []) {
        for (const edge of workspace.workspaceEdges ?? []) {
            edges.push(edgeKey(workspace.name, edge, packageNameByOldName))
        }
    }
    return new Set(edges)
}

function collectPackageNames(graph, packageNameByOldName) {
    return new Set((graph.packages ?? []).map(({ name }) => packageKey(name, packageNameByOldName)))
}

const ledgerFile = readArg('--ledger')
const beforeFile = readArg('--before')
const afterFile = readArg('--after')

if (!ledgerFile || !beforeFile || !afterFile) {
    console.error(
        'Usage: node tools/compare-workspace-dependency-graph.mjs --ledger <ledger.json> --before <before.json> --after <after.json>'
    )
    process.exit(1)
}

const ledger = await readJson(ledgerFile)
const before = await readJson(beforeFile)
const after = await readJson(afterFile)

const entries = Array.isArray(ledger) ? ledger : ledger.packages
const packageNameByOldName = new Map(entries.map((entry) => [entry.oldPackageName, entry.newPackageName]))

const beforePackages = collectPackageNames(before, packageNameByOldName)
const afterPackages = collectPackageNames(after, packageNameByOldName)
const beforeEdges = collectEdges(before, packageNameByOldName)
const afterEdges = collectEdges(after, packageNameByOldName)

const violations = []

for (const name of beforePackages) {
    if (!afterPackages.has(name)) violations.push(`Missing package after rename: ${name}`)
}
for (const name of afterPackages) {
    if (!beforePackages.has(name)) violations.push(`Unexpected package after rename: ${name}`)
}
for (const edge of beforeEdges) {
    if (!afterEdges.has(edge)) violations.push(`Missing dependency edge after rename: ${edge}`)
}
for (const edge of afterEdges) {
    if (!beforeEdges.has(edge)) violations.push(`Unexpected dependency edge after rename: ${edge}`)
}

if (violations.length > 0) {
    console.error('Workspace dependency graph changed during package rename:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('Workspace dependency graph matches after applying rename ledger.')
