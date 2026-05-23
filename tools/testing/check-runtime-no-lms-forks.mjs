/* eslint-disable no-console */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const SCANNED_DIRS = ['packages/apps-template-mui/src', 'packages/applications-frontend/base/src', 'packages/applications-backend/base/src']

const LMS_BRANCH_PATTERNS = [
    /template\s*={2,3}\s*['"`]lms['"`]/,
    /['"`]lms['"`]\s*={2,3}\s*template/,
    /template\s*!={1,2}\s*['"`]lms['"`]/,
    /['"`]lms['"`]\s*!={1,2}\s*template/,
    /template\s*\.?\s*(?:toLowerCase\s*\(\s*\))?\s*={2,3}\s*['"`]lms['"`]/,
    /case\s+['"`]lms['"`]\s*:/
]

const LMS_ONLY_UI_PATTERNS = [
    {
        label: 'LMS-specific widget key',
        pattern: /\bwidgetKey\s*[:=]\s*['"`](?:lms|Lms|LMS|learningContent|LearningContent)[\w.-]*['"`]/
    },
    {
        label: 'LMS-specific widget switch case',
        pattern: /case\s+['"`](?:lms|Lms|LMS|learningContent|LearningContent)[\w.-]*['"`]\s*:/
    },
    {
        label: 'LMS-specific runtime component',
        pattern:
            /\b(?:function|class|const|let|var)\s+(?:Lms|LMS|LearningContent)\w*(?:Widget|Table|Grid|Cards?|View|Panel|Renderer|Builder|Player|Dialog)\b/
    },
    {
        label: 'LMS-specific runtime component export',
        pattern:
            /\bexport\s+(?:default\s+)?(?:function|class|const)\s+(?:Lms|LMS|LearningContent)\w*(?:Widget|Table|Grid|Cards?|View|Panel|Renderer|Builder|Player|Dialog)\b/
    }
]

const LMS_ONLY_UI_FILE_PATTERN =
    /(?:^|[/\\])(?:Lms|LMS|LearningContent)[\w.-]*(?:Widget|Table|Grid|Cards?|View|Panel|Renderer|Builder|Player|Dialog)\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

async function* walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', 'coverage', '.turbo'].includes(entry.name)) continue
            yield* walk(absolute)
            continue
        }
        if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            yield absolute
        }
    }
}

const violations = []

for (const relativeDir of SCANNED_DIRS) {
    const absoluteDir = path.join(ROOT, relativeDir)
    for await (const file of walk(absoluteDir)) {
        const relativeFile = path.relative(ROOT, file)
        if (LMS_ONLY_UI_FILE_PATTERN.test(relativeFile)) {
            violations.push(`${relativeFile}: LMS-specific runtime UI file name`)
        }

        const content = await readFile(file, 'utf8')
        const lines = content.split(/\r?\n/)
        lines.forEach((line, index) => {
            if (LMS_BRANCH_PATTERNS.some((pattern) => pattern.test(line))) {
                violations.push(`${relativeFile}:${index + 1}: ${line.trim()}`)
            }
            const matchedUiPattern = LMS_ONLY_UI_PATTERNS.find(({ pattern }) => pattern.test(line))
            if (matchedUiPattern) {
                violations.push(`${relativeFile}:${index + 1}: ${matchedUiPattern.label}: ${line.trim()}`)
            }
        })
    }
}

if (violations.length > 0) {
    console.error('Runtime LMS-only fork guard failed. Use generic runtime primitives instead:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('Runtime LMS-only fork guard passed.')
