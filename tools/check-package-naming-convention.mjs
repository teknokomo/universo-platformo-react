#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const IGNORED_PATH_FRAGMENTS = ['/node_modules/', '/dist/', '/build/', '/.turbo/', '/coverage/']
const IGNORED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz'])
const CURRENT_REFERENCE_EXACT_FILES = new Set([
    'AGENTS.md',
    'README.md',
    'README-RU.md',
    'package.json',
    'pnpm-lock.yaml',
    'memory-bank/activeContext.md',
    'memory-bank/progress.md',
    'memory-bank/systemPatterns.md',
    'memory-bank/tasks.md',
    'memory-bank/techContext.md'
])
const CURRENT_REFERENCE_PREFIXES = ['.agents/', '.gemini/', '.github/', '.kiro/', '.qoder/', 'docs/', 'packages/', 'tools/']
const ACTIVE_REFERENCE_FORBIDDEN_TOKENS = [
    {
        token: '@universo-react/universo-react-',
        reason: 'double-prefixed @universo-react package reference'
    },
    {
        token: 'packages/universo-react-universo-react-',
        reason: 'double-prefixed universo-react package path'
    },
    {
        token: 'packages/publish-frontend',
        reason: 'removed legacy package path in active guidance'
    },
    {
        token: 'packages/publish-backend',
        reason: 'removed legacy package path in active guidance'
    },
    {
        token: 'packages/updl',
        reason: 'removed legacy package path in active guidance'
    },
    {
        token: 'packages/space-builder-frontend',
        reason: 'removed legacy package path in active guidance'
    },
    {
        token: 'pnpm build --filter publish-frontend',
        reason: 'legacy package filter example in active guidance'
    },
    {
        token: 'pnpm --filter publish-frontend',
        reason: 'legacy package filter example in active guidance'
    },
    {
        token: 'packages/<name>/package.json',
        reason: 'generic package layout text should use packages/universo-react-<name>/package.json'
    }
]

function readArg(name) {
    const index = process.argv.indexOf(name)
    if (index === -1) return null
    return process.argv[index + 1] ?? null
}

function readJson(filePath) {
    return JSON.parse(readFileSync(path.join(ROOT, filePath), 'utf8'))
}

function listTrackedFilesFromStdin() {
    const input = readFileSync(0, 'utf8')
    return input.split('\0').filter(Boolean)
}

function listTrackedFilesFromGit() {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' }).toString('utf8').split('\0').filter(Boolean)
}

function isProbablyBinaryOrIgnored(filePath) {
    if (IGNORED_PATH_FRAGMENTS.some((fragment) => filePath.includes(fragment))) return true
    const extension = path.extname(filePath).toLowerCase()
    return IGNORED_EXTENSIONS.has(extension)
}

function isCurrentReferenceFile(filePath) {
    if (filePath === 'tools/check-package-naming-convention.mjs') return false
    return CURRENT_REFERENCE_EXACT_FILES.has(filePath) || CURRENT_REFERENCE_PREFIXES.some((prefix) => filePath.startsWith(prefix))
}

function lineNumberFor(content, index) {
    return content.slice(0, index).split(/\r?\n/).length
}

function collectMatches(content, token) {
    const matches = []
    let index = content.indexOf(token)
    while (index !== -1) {
        matches.push(index)
        index = content.indexOf(token, index + token.length)
    }
    return matches
}

function createAllowlist(filePath) {
    if (!filePath) return new Map()
    const data = readJson(filePath)
    const entries = []

    for (const [category, files] of Object.entries(data)) {
        if (!['rollout_audit_artifacts', 'historical_memory_bank', 'generated_regenerated'].includes(category)) {
            throw new Error(`Unknown legacy reference allowlist category: ${category}`)
        }
        if (!Array.isArray(files)) {
            throw new Error(`Allowlist category must be an array: ${category}`)
        }
        for (const file of files) {
            if (file.includes('*')) {
                throw new Error(`Allowlist entries must be exact file paths, not globs: ${file}`)
            }
            entries.push([file, category])
        }
    }

    return new Map(entries)
}

async function listWorkspaceManifests() {
    const packagesDir = path.join(ROOT, 'packages')
    const entries = await readdir(packagesDir, { withFileTypes: true })
    const manifests = []
    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const manifestPath = path.join(packagesDir, entry.name, 'package.json')
        if (!existsSync(manifestPath)) continue
        manifests.push({
            directoryName: entry.name,
            relativePath: `packages/${entry.name}/package.json`,
            manifest: JSON.parse(await readFile(manifestPath, 'utf8'))
        })
    }
    return manifests
}

const ledgerFile = readArg('--from-ledger')
const allowlistFile = readArg('--allowlist')
const useStdin = process.argv.includes('--stdin0')

if (!ledgerFile) {
    console.error(
        'Usage: git ls-files -z | node tools/check-package-naming-convention.mjs --from-ledger <ledger.json> --allowlist <allowlist.json> --stdin0'
    )
    process.exit(1)
}

const ledger = readJson(ledgerFile)
const ledgerEntries = Array.isArray(ledger) ? ledger : ledger.packages
const oldTokens = []

for (const entry of ledgerEntries) {
    oldTokens.push(entry.oldPackageName, `${entry.oldDirectory}/`, entry.oldDirectory)
}

const allowlist = createAllowlist(allowlistFile)
const violations = []

for (const { directoryName, relativePath, manifest } of await listWorkspaceManifests()) {
    if (!directoryName.startsWith('universo-react-')) {
        violations.push(`${relativePath}: workspace directory must start with universo-react-`)
    }
    if (!manifest.name?.startsWith('@universo-react/')) {
        violations.push(`${relativePath}: workspace package name must start with @universo-react/`)
    }
}

const trackedFiles = useStdin ? listTrackedFilesFromStdin() : listTrackedFilesFromGit()

for (const filePath of trackedFiles) {
    if (!existsSync(filePath) || isProbablyBinaryOrIgnored(filePath)) continue

    let content
    try {
        content = readFileSync(filePath, 'utf8')
    } catch {
        continue
    }
    if (content.includes('\u0000')) continue

    const category = allowlist.get(filePath)
    for (const token of oldTokens) {
        for (const index of collectMatches(content, token)) {
            if (category) continue
            violations.push(`${filePath}:${lineNumberFor(content, index)}: legacy package reference: ${token}`)
        }
    }
    if (isCurrentReferenceFile(filePath) && !category) {
        for (const { token, reason } of ACTIVE_REFERENCE_FORBIDDEN_TOKENS) {
            for (const index of collectMatches(content, token)) {
                violations.push(`${filePath}:${lineNumberFor(content, index)}: ${reason}: ${token}`)
            }
        }
    }
}

if (violations.length > 0) {
    console.error('Package naming convention guard failed:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('Package naming convention guard passed.')
