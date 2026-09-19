#!/usr/bin/env node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'

const IMPORT_PATTERN = /(?:from\s+|import\s*\()\s*'(\.[^']+)'/g

const collectModules = (dir) => {
    const files = readdirSync(dir)
        .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
        .filter((entry) => statSync(join(dir, entry)).isFile())
    const modules = new Map()
    for (const entry of files) {
        const name = entry.slice(0, -3)
        const source = readFileSync(join(dir, entry), 'utf8')
        const deps = new Set()
        for (const match of source.matchAll(IMPORT_PATTERN)) {
            const specifier = match[1]
            const target = resolve(dir, specifier)
            const targetEntry = target.endsWith('.ts') ? target : `${target}.ts`
            if (!statSync(targetEntry, { throwIfNoEntry: false })?.isFile()) continue
            const targetName = relative(dir, targetEntry).split(sep).join('/').replace(/\.ts$/, '')
            if (!targetName.startsWith('..') && targetName !== name) deps.add(targetName)
        }
        modules.set(name, deps)
    }
    return modules
}

const findCycle = (graph) => {
    const state = new Map()
    const stack = []
    const visit = (node) => {
        state.set(node, 'visiting')
        stack.push(node)
        for (const next of graph.get(node) ?? []) {
            const nextState = state.get(next)
            if (nextState === 'visiting') return [...stack.slice(stack.indexOf(next)), next]
            if (!nextState) {
                const found = visit(next)
                if (found) return found
            }
        }
        stack.pop()
        state.set(node, 'done')
        return null
    }
    for (const node of graph.keys()) {
        if (!state.has(node)) {
            const found = visit(node)
            if (found) return found
        }
    }
    return null
}

const selfTest = () => {
    const dir = mkdtempSync(join(tmpdir(), 'module-cycles-'))
    try {
        writeFileSync(join(dir, 'a.ts'), "import { b } from './b'\nexport const a = () => b\n")
        writeFileSync(join(dir, 'b.ts'), "import { a } from './a'\nexport const b = () => a\n")
        const graph = collectModules(dir)
        if (!findCycle(graph)) {
            console.error('[check-module-cycles] self-test failed: synthetic collector cycle was not detected')
            process.exit(2)
        }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

selfTest()

const targets = process.argv.slice(2)
if (targets.length === 0) {
    console.error('Usage: node tools/check-module-cycles.mjs <directory> [directory...]')
    process.exit(2)
}

let totalModules = 0
let totalEdges = 0
for (const target of targets) {
    const dir = resolve(process.cwd(), target)
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
        console.error(`[check-module-cycles] not a directory: ${target}`)
        process.exit(2)
    }
    const graph = collectModules(dir)
    const edges = [...graph.values()].reduce((sum, deps) => sum + deps.size, 0)
    totalModules += graph.size
    totalEdges += edges
    const cycle = findCycle(graph)
    if (cycle) {
        console.error(`[check-module-cycles] circular import detected in ${target}:`)
        console.error(`  ${cycle.join(' -> ')}`)
        process.exit(1)
    }
}

if (totalModules === 0 || totalEdges === 0) {
    console.error('[check-module-cycles] no relative-import edges were collected; the scan target is wrong or empty')
    process.exit(2)
}

console.log(
    `[check-module-cycles] OK: ${totalModules} modules / ${totalEdges} relative imports across ${targets.length} target(s) have no cycles`
)
