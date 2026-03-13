import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const PACKAGE_JSON_BASENAMES = new Set(['package.json'])
const PRIORITIZED_DEPENDENCIES = new Set([
    'typescript',
    'vitest',
    '@tanstack/react-query',
    'eslint',
    'react',
    'react-dom',
    'react-i18next',
    'axios',
    'tsdown'
])
const CHECKED_SECTIONS = ['dependencies', 'devDependencies']
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.turbo'])

const walkPackageJsonFiles = (dirPath, result = []) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (IGNORED_DIRS.has(entry.name)) {
            continue
        }

        const entryPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
            walkPackageJsonFiles(entryPath, result)
            continue
        }

        if (PACKAGE_JSON_BASENAMES.has(entry.name)) {
            result.push(entryPath)
        }
    }

    return result
}

const relativePath = (filePath) => path.relative(ROOT_DIR, filePath) || filePath

const issues = []
const packageJsonFiles = [path.join(ROOT_DIR, 'package.json'), ...walkPackageJsonFiles(path.join(ROOT_DIR, 'packages'))]

for (const filePath of packageJsonFiles) {
    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    for (const sectionName of CHECKED_SECTIONS) {
        const section = manifest[sectionName]

        if (!section || typeof section !== 'object') {
            continue
        }

        for (const dependencyName of PRIORITIZED_DEPENDENCIES) {
            const version = section[dependencyName]

            if (typeof version !== 'string') {
                continue
            }

            if (version === 'catalog:' || version === 'workspace:*') {
                continue
            }

            issues.push({
                filePath: relativePath(filePath),
                sectionName,
                dependencyName,
                version
            })
        }
    }
}

if (issues.length === 0) {
    process.stdout.write('catalog-version-check: ok\n')
    process.exit(0)
}

process.stderr.write('catalog-version-check: found prioritized dependencies that must use catalog:\\n')

for (const issue of issues) {
    process.stderr.write(`- ${issue.filePath} :: ${issue.sectionName} :: ${issue.dependencyName} = ${issue.version}\n`)
}

process.exit(1)
