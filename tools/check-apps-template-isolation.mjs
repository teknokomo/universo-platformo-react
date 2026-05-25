#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const PACKAGE_DIR = 'packages/universo-react-apps-template-mui'
const LEGACY_UNIVERSO_SCOPE = `@${'universo/'}`
const BLOCKED_PACKAGE_NAMES = [
    '@universo-react/template-mui',
    '@universo-react/admin-backend',
    '@universo-react/admin-frontend',
    '@universo-react/applications-backend',
    '@universo-react/applications-frontend',
    '@universo-react/metahubs-backend',
    '@universo-react/metahubs-frontend',
    '@universo-react/metapanel-frontend',
    '@universo-react/profile-backend',
    '@universo-react/profile-frontend',
    '@universo-react/start-backend',
    '@universo-react/start-frontend',
    LEGACY_UNIVERSO_SCOPE
]
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'])
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo'])

async function* walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue
            yield* walk(absolute)
            continue
        }
        if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            yield absolute
        }
    }
}

function lineNumberFor(content, index) {
    return content.slice(0, index).split(/\r?\n/).length
}

const packageJsonPath = path.join(ROOT, PACKAGE_DIR, 'package.json')
const violations = []

if (!existsSync(packageJsonPath)) {
    console.error(`apps-template-mui package not found at ${PACKAGE_DIR}`)
    process.exit(1)
}

const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = manifest[section] ?? {}
    for (const packageName of Object.keys(dependencies)) {
        if (BLOCKED_PACKAGE_NAMES.includes(packageName) || packageName.startsWith(LEGACY_UNIVERSO_SCOPE)) {
            violations.push(`${PACKAGE_DIR}/package.json: blocked ${section} dependency ${packageName}`)
        }
    }
}

for await (const file of walk(path.join(ROOT, PACKAGE_DIR))) {
    const relativeFile = path.relative(ROOT, file)
    if (relativeFile.endsWith('src/__tests__/packageBoundary.test.ts')) continue

    const content = await readFile(file, 'utf8')
    const extension = path.extname(relativeFile).toLowerCase()
    for (const blocked of BLOCKED_PACKAGE_NAMES) {
        let index = content.indexOf(blocked)
        while (index !== -1) {
            const lineNumber = lineNumberFor(content, index)
            const line = content.split(/\r?\n/)[lineNumber - 1] ?? ''
            const isMarkdown = extension === '.md' || extension === '.mdx'
            const isActiveMarkdownExample =
                /\b(?:import\s+.+\s+from|require\s*\(|pnpm\s+(?:add|install)|dependencies|devDependencies|peerDependencies|optionalDependencies)\b/.test(
                    line
                )

            if (!isMarkdown || isActiveMarkdownExample) {
                violations.push(`${relativeFile}:${lineNumber}: blocked apps-template import/reference ${blocked}`)
            }
            index = content.indexOf(blocked, index + blocked.length)
        }
    }
}

if (violations.length > 0) {
    console.error('apps-template-mui isolation guard failed:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('apps-template-mui isolation guard passed.')
