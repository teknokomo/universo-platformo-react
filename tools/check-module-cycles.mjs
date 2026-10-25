#!/usr/bin/env node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const SOURCE_CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

const collectSourceFiles = (directory) => {
    const files = []
    for (const entry of readdirSync(directory)) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue
        const fullPath = join(directory, entry)
        const stats = statSync(fullPath)
        if (stats.isDirectory()) {
            files.push(...collectSourceFiles(fullPath))
            continue
        }
        if (stats.isFile() && SOURCE_EXTENSIONS.has(extname(entry)) && !entry.endsWith('.d.ts')) files.push(fullPath)
    }
    return files
}

const collectModuleSpecifiers = (sourceFile) => {
    const specifiers = new Set()
    const addStringLiteral = (node) => {
        if (node && ts.isStringLiteralLike(node)) specifiers.add(node.text)
    }
    const visit = (node) => {
        if (ts.isImportDeclaration(node)) {
            const clause = node.importClause
            const onlyNamedTypeImports =
                !clause?.name &&
                clause?.namedBindings &&
                ts.isNamedImports(clause.namedBindings) &&
                clause.namedBindings.elements.length > 0 &&
                clause.namedBindings.elements.every((element) => element.isTypeOnly)
            if (!clause?.isTypeOnly && !onlyNamedTypeImports) addStringLiteral(node.moduleSpecifier)
        }
        if (ts.isExportDeclaration(node)) {
            const onlyNamedTypeExports =
                node.exportClause &&
                ts.isNamedExports(node.exportClause) &&
                node.exportClause.elements.length > 0 &&
                node.exportClause.elements.every((element) => element.isTypeOnly)
            if (!node.isTypeOnly && !onlyNamedTypeExports) addStringLiteral(node.moduleSpecifier)
        }
        if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) {
            addStringLiteral(node.moduleReference.expression)
        }
        if (ts.isCallExpression(node)) {
            if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
                addStringLiteral(node.arguments[0])
            } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length > 0) {
                addStringLiteral(node.arguments[0])
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    return specifiers
}

const resolveSourceImport = (sourceFile, specifier, files) => {
    if (!specifier.startsWith('.')) return null
    const unresolved = resolve(dirname(sourceFile), specifier)
    const unresolvedExtension = extname(unresolved)
    const candidates = [unresolved]
    if (
        unresolvedExtension === '.js' ||
        unresolvedExtension === '.jsx' ||
        unresolvedExtension === '.mjs' ||
        unresolvedExtension === '.cjs'
    ) {
        const stem = unresolved.slice(0, -unresolvedExtension.length)
        candidates.push(...SOURCE_CANDIDATE_EXTENSIONS.map((extension) => `${stem}${extension}`))
    } else if (!unresolvedExtension) {
        candidates.push(...SOURCE_CANDIDATE_EXTENSIONS.map((extension) => `${unresolved}${extension}`))
        candidates.push(...SOURCE_CANDIDATE_EXTENSIONS.map((extension) => join(unresolved, `index${extension}`)))
    }
    return candidates.find((candidate) => files.has(candidate)) ?? null
}

const collectSourceGraph = (directory) => {
    const sourceFiles = collectSourceFiles(directory)
    const fileSet = new Set(sourceFiles)
    const graph = new Map()
    for (const file of sourceFiles) {
        const fileName = relative(directory, file).split(sep).join('/')
        const source = readFileSync(file, 'utf8')
        const scriptKind = extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
        const dependencies = new Set()
        for (const specifier of collectModuleSpecifiers(sourceFile)) {
            const target = resolveSourceImport(file, specifier, fileSet)
            if (!target || target === file) continue
            dependencies.add(relative(directory, target).split(sep).join('/'))
        }
        graph.set(fileName, dependencies)
    }
    return graph
}

const collectWorkspacePackageGraph = () => {
    const packageRoot = resolve(process.cwd(), 'packages')
    const manifests = new Map()
    for (const entry of readdirSync(packageRoot)) {
        const manifestPath = join(packageRoot, entry, 'package.json')
        if (!statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) continue
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        if (typeof manifest.name === 'string') manifests.set(manifest.name, manifest)
    }
    const graph = new Map([...manifests.keys()].map((name) => [name, new Set()]))
    for (const [name, manifest] of manifests) {
        for (const dependencyGroup of [manifest.dependencies, manifest.peerDependencies]) {
            for (const dependencyName of Object.keys(dependencyGroup ?? {})) {
                if (manifests.has(dependencyName)) graph.get(name).add(dependencyName)
            }
        }
    }
    return graph
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
                const cycle = visit(next)
                if (cycle) return cycle
            }
        }
        stack.pop()
        state.set(node, 'done')
        return null
    }
    for (const node of graph.keys()) {
        if (!state.has(node)) {
            const cycle = visit(node)
            if (cycle) return cycle
        }
    }
    return null
}

const selfTest = () => {
    const sourceDirectory = mkdtempSync(join(tmpdir(), 'module-cycle-self-test-'))
    try {
        writeFileSync(join(sourceDirectory, 'a.tsx'), "import { b } from './b'\nexport const a = () => b\n")
        writeFileSync(join(sourceDirectory, 'b.ts'), "import { a } from './a'\nexport const b = () => a\n")
        if (!findCycle(collectSourceGraph(sourceDirectory))) {
            console.error('[check-module-cycles] self-test failed: synthetic TSX/TS cycle was not detected')
            process.exit(2)
        }

        writeFileSync(join(sourceDirectory, 'a.tsx'), "import type { B } from './b'\nexport type A = B\n")
        writeFileSync(join(sourceDirectory, 'b.ts'), "import { a } from './a'\nexport const b = () => a\n")
        if (findCycle(collectSourceGraph(sourceDirectory))) {
            console.error('[check-module-cycles] self-test failed: a type-only import was reported as a runtime cycle')
            process.exit(2)
        }
    } finally {
        rmSync(sourceDirectory, { recursive: true, force: true })
    }

    const packageGraph = new Map([
        ['@test/a', new Set(['@test/b'])],
        ['@test/b', new Set(['@test/a'])]
    ])
    if (!findCycle(packageGraph)) {
        console.error('[check-module-cycles] self-test failed: synthetic workspace package cycle was not detected')
        process.exit(2)
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
    const directory = resolve(process.cwd(), target)
    if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
        console.error(`[check-module-cycles] not a directory: ${target}`)
        process.exit(2)
    }
    const graph = collectSourceGraph(directory)
    const edgeCount = [...graph.values()].reduce((total, dependencies) => total + dependencies.size, 0)
    totalModules += graph.size
    totalEdges += edgeCount
    const cycle = findCycle(graph)
    if (cycle) {
        console.error(`[check-module-cycles] circular source import detected in ${target}:`)
        console.error(`  ${cycle.join(' -> ')}`)
        process.exit(1)
    }
}

const packageGraph = collectWorkspacePackageGraph()
const packageEdges = [...packageGraph.values()].reduce((total, dependencies) => total + dependencies.size, 0)
const packageCycle = findCycle(packageGraph)
if (packageCycle) {
    console.error('[check-module-cycles] circular workspace package dependency detected:')
    console.error(`  ${packageCycle.join(' -> ')}`)
    process.exit(1)
}
if (totalModules === 0 || (totalEdges === 0 && packageEdges === 0)) {
    console.error('[check-module-cycles] no imports were collected; the scan targets or package manifests are wrong')
    process.exit(2)
}

console.log(
    `[check-module-cycles] OK: ${totalModules} TS/TSX modules / ${totalEdges} local imports across ${targets.length} target(s); ` +
        `${packageGraph.size} workspace packages / ${packageEdges} dependency edges have no cycles`
)
