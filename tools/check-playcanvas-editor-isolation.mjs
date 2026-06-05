#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const PACKAGES_DIR = path.join(ROOT, 'packages')
const EDITOR_PACKAGE_DIR = 'packages/universo-react-playcanvas-editor-frontend'
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'])
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.tmp'])
const BLOCKED_REFERENCES = [
    '@universo-react/playcanvas-editor-frontend',
    '@playcanvas/editor',
    '@playcanvas/pcui',
    '@playcanvas/observer',
    'packages/universo-react-playcanvas-editor-frontend/vendor',
    'vendor/playcanvas-editor',
    '../universo-react-playcanvas-editor-frontend/vendor',
    '../../universo-react-playcanvas-editor-frontend/vendor'
]
const EDITOR_PACKAGE_BLOCKED_PUBLIC_REEXPORTS = [
    '@playcanvas/editor',
    '@playcanvas/pcui',
    '@playcanvas/observer',
    './vendor/',
    '../vendor/'
]
const EDITOR_PACKAGE_BLOCKED_EXPORT_PATHS = ['vendor/', 'playcanvas-editor/']
const ALLOWED_EDITOR_PACKAGE_METADATA_FILES = new Set([
    'packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json',
    'packages/universo-react-metahubs-backend/src/domains/packages/services/packageConfigValidation.ts',
    'packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts',
    'packages/universo-react-metahubs-backend/src/tests/routes/metahubsRoutes.test.ts',
    'packages/universo-react-metahubs-backend/src/tests/services/PackageSeeder.test.ts',
    'packages/universo-react-metahubs-backend/src/tests/services/PlayCanvasProjectsService.test.ts',
    'packages/universo-react-metahubs-backend/src/tests/services/packageConfigValidation.test.ts',
    'packages/universo-react-metahubs-backend/src/tests/services/playCanvasProjectsStore.test.ts',
    'packages/universo-react-metahubs-frontend/src/domains/packages/ui/MetahubPackagesTab.tsx',
    'packages/universo-react-types/src/common/packages.ts',
    'packages/universo-react-types/src/common/playcanvasProjects.ts',
    'packages/universo-react-utils/src/serialization/__tests__/publicationSnapshotHash.test.ts'
])

const toRelative = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/')

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

const lineNumberFor = (content, index) => content.slice(0, index).split(/\r?\n/).length

const isAllowedEditorPackageFile = (relativeFile) => {
    if (!relativeFile.startsWith(`${EDITOR_PACKAGE_DIR}/`)) return false
    if (relativeFile.includes('/vendor/')) return true
    if (relativeFile.includes('/tests/')) return true
    if (relativeFile.includes('/e2e/')) return true
    if (relativeFile.includes('/scripts/')) return true
    if (relativeFile.endsWith('/README.md') || relativeFile.endsWith('/README-RU.md') || relativeFile.endsWith('/NOTICE.md')) return true
    if (relativeFile.endsWith('/package.json')) return true
    return false
}

const isAllowedEditorPackageMetadataReference = (relativeFile, blocked) =>
    blocked === '@universo-react/playcanvas-editor-frontend' && ALLOWED_EDITOR_PACKAGE_METADATA_FILES.has(relativeFile)

const violations = []

if (!existsSync(PACKAGES_DIR)) {
    console.error('packages directory not found')
    process.exit(1)
}

for await (const file of walk(PACKAGES_DIR)) {
    const relativeFile = toRelative(file)
    const content = await readFile(file, 'utf8')

    if (relativeFile.startsWith(`${EDITOR_PACKAGE_DIR}/`)) {
        if (relativeFile === `${EDITOR_PACKAGE_DIR}/src/index.ts`) {
            for (const blocked of EDITOR_PACKAGE_BLOCKED_PUBLIC_REEXPORTS) {
                let index = content.indexOf(blocked)
                while (index !== -1) {
                    violations.push(
                        `${relativeFile}:${lineNumberFor(content, index)}: editor package public API must not expose ${blocked}`
                    )
                    index = content.indexOf(blocked, index + blocked.length)
                }
            }
        }
        if (relativeFile === `${EDITOR_PACKAGE_DIR}/package.json`) {
            const manifest = JSON.parse(content)
            const publicFields = [manifest.main, manifest.module, manifest.types, JSON.stringify(manifest.exports ?? {})]
                .filter(Boolean)
                .map(String)

            for (const field of publicFields) {
                for (const blocked of EDITOR_PACKAGE_BLOCKED_EXPORT_PATHS) {
                    if (field.includes(blocked)) {
                        violations.push(`${relativeFile}:1: editor package export fields must not expose ${blocked}`)
                    }
                }
            }
        }
        continue
    }

    for (const blocked of BLOCKED_REFERENCES) {
        let index = content.indexOf(blocked)
        while (index !== -1) {
            if (!isAllowedEditorPackageFile(relativeFile) && !isAllowedEditorPackageMetadataReference(relativeFile, blocked)) {
                violations.push(`${relativeFile}:${lineNumberFor(content, index)}: blocked PlayCanvas Editor boundary reference ${blocked}`)
            }
            index = content.indexOf(blocked, index + blocked.length)
        }
    }
}

if (violations.length > 0) {
    console.error('PlayCanvas Editor isolation guard failed:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('PlayCanvas Editor isolation guard passed.')
