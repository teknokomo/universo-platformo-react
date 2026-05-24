import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/* eslint-disable no-console */

const ROOT = process.cwd()
const DOCS_ROOT = path.join(ROOT, 'docs')
const IMAGE_PATTERN = /!\[[^\]]*]\((?!https?:\/\/)([^)]+)\)/g

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

const missingAssets = []

for await (const file of walkMarkdown(DOCS_ROOT)) {
    const content = await readFile(file, 'utf8')
    for (const match of content.matchAll(IMAGE_PATTERN)) {
        const rawTarget = match[1].split('#')[0].trim()
        if (!rawTarget) continue
        const resolvedTarget = path.resolve(path.dirname(file), decodeURIComponent(rawTarget))
        if (!resolvedTarget.startsWith(DOCS_ROOT)) continue
        try {
            await access(resolvedTarget)
        } catch {
            missingAssets.push(`${path.relative(ROOT, file)} -> ${rawTarget}`)
        }
    }
}

if (missingAssets.length > 0) {
    console.error('GitBook docs reference missing screenshot/image assets:')
    for (const asset of missingAssets) {
        console.error(`- ${asset}`)
    }
    process.exit(1)
}

console.log('GitBook screenshot asset check passed.')
