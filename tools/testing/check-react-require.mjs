#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repositoryRoot = process.cwd()
const distRoots = [
    'packages/universo-react-template-mui/dist',
    'packages/universo-react-apps-template-mui/dist',
    'packages/universo-react-core-frontend/build'
]

const reactRequirePattern = /\brequire\s*\(\s*['"]react(?:\/[^'"]*)?['"]\s*\)/

async function collectMjsFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await collectMjsFiles(fullPath)))
            continue
        }
        if (entry.isFile() && entry.name.endsWith('.mjs')) {
            files.push(fullPath)
        }
    }

    return files
}

const checkedFiles = []
const violations = []

for (const relativeRoot of distRoots) {
    const absoluteRoot = path.join(repositoryRoot, relativeRoot)
    if (!existsSync(absoluteRoot)) {
        continue
    }

    const files = await collectMjsFiles(absoluteRoot)
    for (const file of files) {
        checkedFiles.push(file)
        const content = await readFile(file, 'utf8')
        const match = content.match(reactRequirePattern)
        if (match) {
            violations.push({
                file: path.relative(repositoryRoot, file),
                token: match[0]
            })
        }
    }
}

if (violations.length > 0) {
    console.error('React CommonJS require calls were found in ESM bundle outputs:')
    for (const violation of violations) {
        console.error(`- ${violation.file}: ${violation.token}`)
    }
    process.exit(1)
}

if (checkedFiles.length === 0) {
    console.warn('No ESM bundle outputs were found for React require validation.')
} else {
    console.info(`React ESM bundle check passed for ${checkedFiles.length} files.`)
}
