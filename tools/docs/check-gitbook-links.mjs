import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DOCS_ROOT = path.join(ROOT, 'docs')
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g

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

for await (const file of walkMarkdown(DOCS_ROOT)) {
    const content = await readFile(file, 'utf8')
    for (const match of content.matchAll(MARKDOWN_LINK_PATTERN)) {
        const rawTarget = match[1].split('#')[0].trim()
        if (!rawTarget || rawTarget.startsWith('<') || rawTarget.startsWith('app://')) continue
        const resolvedTarget = path.resolve(path.dirname(file), decodeURIComponent(rawTarget))
        if (!resolvedTarget.startsWith(DOCS_ROOT)) continue
        try {
            await access(resolvedTarget)
        } catch {
            failures.push(`${path.relative(ROOT, file)} -> ${rawTarget}`)
        }
    }
}

if (failures.length > 0) {
    console.error('GitBook docs contain broken local links:')
    for (const failure of failures) {
        console.error(`- ${failure}`)
    }
    process.exit(1)
}

console.log('GitBook local link check passed.')
