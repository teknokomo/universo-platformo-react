import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DOCS_ROOTS = [path.join(ROOT, 'docs/en'), path.join(ROOT, 'docs/ru')]
const TARGET_FILE_PATTERN = /1c-compatible|1с-совместим/i

const forbiddenClaims = [
    /\bofficial\b/i,
    /\bcertified\b/i,
    /\bcertification\b/i,
    /\bendorsed\b/i,
    /\bpartnership\b/i,
    /\bpartner\b/i,
    /сертифицирован/i,
    /сертификац/i,
    /официальн/i,
    /партн[её]р/i,
    /одобрен/i,
    /логотип/i,
    /logo/i
]

const allowedNegations = [
    /not an official 1c product/i,
    /not an official/i,
    /not certified by 1c/i,
    /not .*certification/i,
    /not .*partnership/i,
    /does not .*copy/i,
    /не официальный продукт 1с/i,
    /не является официальным продуктом 1с/i,
    /не сертифицирован/i,
    /не сертификация/i,
    /не одобрение/i,
    /не партн[её]рство/i,
    /не копирует/i
]

async function* walkMarkdown(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        const absolute = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            yield* walkMarkdown(absolute)
            continue
        }
        if (entry.isFile() && entry.name.endsWith('.md')) {
            yield absolute
        }
    }
}

const failures = []
let checkedFiles = 0

for (const root of DOCS_ROOTS) {
    for await (const file of walkMarkdown(root)) {
        const content = await readFile(file, 'utf8')
        if (path.basename(file).toLowerCase() === 'summary.md') {
            continue
        }
        if (!TARGET_FILE_PATTERN.test(file) && !TARGET_FILE_PATTERN.test(content)) {
            continue
        }

        checkedFiles += 1
        const relative = path.relative(ROOT, file)
        const lines = content.split(/\r?\n/)
        const hasNonAffiliation =
            /not an official 1c product, certification, endorsement, or partnership/i.test(content) ||
            /not an official 1c product and is not certified by 1c/i.test(content) ||
            /не официальный продукт 1с, не сертификация, не одобрение и не партн[её]рство/i.test(content) ||
            /не является официальным продуктом 1с, сертификацией или партн[её]рством/i.test(content) ||
            /не является официальным продуктом 1с и не сертифицирован компанией 1с/i.test(content)
        const hasNoCopying =
            /does not import or copy 1c source code/i.test(content) || /не импортирует и не копирует исходный код 1с/i.test(content)

        if (!hasNonAffiliation) {
            failures.push(`${relative}: missing explicit non-affiliation wording`)
        }
        if (!hasNoCopying) {
            failures.push(`${relative}: missing explicit no-import/no-copy wording`)
        }

        lines.forEach((line, index) => {
            const normalized = line.toLowerCase()
            const isAllowed = allowedNegations.some((pattern) => pattern.test(normalized))
            if (isAllowed) {
                return
            }

            for (const pattern of forbiddenClaims) {
                if (pattern.test(line)) {
                    failures.push(`${relative}:${index + 1}: unsupported affiliation or asset claim: ${line.trim()}`)
                    break
                }
            }
        })
    }
}

if (checkedFiles === 0) {
    failures.push('No 1C-Compatible documentation files were found.')
}

if (failures.length > 0) {
    console.error('1C-Compatible clean-room documentation check failed:')
    for (const failure of failures) {
        console.error(`- ${failure}`)
    }
    process.exit(1)
}

console.log(`1C-Compatible clean-room documentation check passed for ${checkedFiles} file(s).`)
