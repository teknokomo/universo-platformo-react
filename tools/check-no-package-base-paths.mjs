#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const ignoredPathPrefixes = ['memory-bank/', '.manager/specs/', 'tools/fixtures/', '.git/', '.local/']

const ignoredPathFragments = ['/node_modules/', '/dist/', '/build/', '/.turbo/', '/coverage/']

const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz'])

const stalePathPatterns = [
    {
        label: 'package tree base directory',
        pattern: /^[ \t│├└─-]*[├└]── base\/\s*$/gm
    },
    {
        label: 'standalone package base directory guidance',
        pattern:
            /(?:package|packages|workspace|workspaces|app|apps|repo|monorepo)[^\n\r]*\b(?:contains?|uses?|follows?|layout|director(?:y|ies)|folders?|roots?)[^\n\r`]*(?:`|(?<![A-Za-z]))base\/`?/g
    },
    {
        label: 'standalone package base directory guidance',
        pattern:
            /(?:contains?|uses?|follows?|layout|director(?:y|ies)|folders?|roots?)[^\n\r`]*(?:`|(?<![A-Za-z]))base\/`?[^\n\r]*(?:package|packages|workspace|workspaces|app|apps|repo|monorepo)/g
    },
    {
        label: 'root package base path',
        pattern: /packages\/[A-Za-z0-9._-]+\/base(?:\/|\b)/g
    },
    {
        label: 'workspace package base glob',
        pattern: /packages\/\*\/base(?:\/|\b)/g
    },
    {
        label: 'relative package base path',
        pattern: /\.\.\/(?:\.\.\/)?[A-Za-z0-9._-]+\/base(?:\/|\b)/g
    },
    {
        label: 'Windows root package base path',
        pattern: /packages\\[A-Za-z0-9._-]+\\base(?:\\|\b)/g
    },
    {
        label: 'Windows relative package base path',
        pattern: /\.\.\\(?:\.\.\\)?[A-Za-z0-9._-]+\\base(?:\\|\b)/g
    },
    {
        label: 'base src path fragment',
        pattern: /\/base\/src(?:\/|\b)/g
    },
    {
        label: 'base package manifest path fragment',
        pattern: /\/base\/package\.json\b/g
    },
    {
        label: 'base README path fragment',
        pattern: /\/base\/README(?:[-A-Z]*\.md)?\b/g
    }
]

function listTrackedFiles() {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' }).toString('utf8').split('\0').filter(Boolean)
}

function isIgnored(filePath) {
    if (ignoredPathPrefixes.some((prefix) => filePath.startsWith(prefix))) return true
    if (ignoredPathFragments.some((fragment) => filePath.includes(fragment))) return true

    const dotIndex = filePath.lastIndexOf('.')
    const extension = dotIndex >= 0 ? filePath.slice(dotIndex).toLowerCase() : ''
    return ignoredExtensions.has(extension)
}

function collectViolations(filePath, content) {
    const violations = []
    for (const { label, pattern } of stalePathPatterns) {
        pattern.lastIndex = 0
        let match = pattern.exec(content)
        while (match) {
            const lineNumber = content.slice(0, match.index).split(/\r?\n/).length
            violations.push(`${filePath}:${lineNumber}: ${label}: ${match[0]}`)
            match = pattern.exec(content)
        }
    }
    return violations
}

const violations = []

for (const filePath of listTrackedFiles()) {
    if (isIgnored(filePath) || !existsSync(filePath)) continue

    let content
    try {
        content = readFileSync(filePath, 'utf8')
    } catch {
        continue
    }

    if (content.includes('\u0000')) continue
    violations.push(...collectViolations(filePath, content))
}

if (violations.length > 0) {
    console.error('Stale packages/<name>/base paths remain after workspace flattening:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('No stale packages/<name>/base paths found.')
