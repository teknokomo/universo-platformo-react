import { readFile, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

const supportedLanguagesPath = require.resolve('@universo/i18n/supported-languages.json')
const publicIndexPath = resolve(__dirname, '../public/index.html')
const placeholder = '__SUPPORTED_LANGS__'
const assignmentRegex = /const supportedLanguages = [^;]+;/

const loadSupportedLanguages = async () => {
    const raw = await readFile(supportedLanguagesPath, 'utf-8')
    return JSON.parse(raw)
}

const syncPublicIndex = async (supportedLanguages) => {
    const html = await readFile(publicIndexPath, 'utf-8')
    const serialized = JSON.stringify(supportedLanguages)
    let updated = html

    if (updated.includes(placeholder)) {
        updated = updated.replace(placeholder, serialized)
    }

    if (assignmentRegex.test(updated)) {
        updated = updated.replace(assignmentRegex, `const supportedLanguages = ${serialized};`)
    }
    if (updated !== html) {
        await writeFile(publicIndexPath, updated)
    }
}

const run = async () => {
    const supportedLanguages = await loadSupportedLanguages()
    await syncPublicIndex(supportedLanguages)
}

run().catch((error) => {
    console.error('[sync-supported-langs] Failed:', error)
    process.exitCode = 1
})
