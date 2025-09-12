// Comments in English only
import fs from 'fs'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function normalizeLines(s) {
  return s.replace(/\r\n/g, '\n').split('\n')
}

function countByRegex(lines, re) {
  return lines.reduce((acc, l) => acc + (re.test(l) ? 1 : 0), 0)
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function findPairs(repoRoot, scope = 'resources') {
  const pairs = []

  // 1) Local README.md ↔ README-RU.md
  const allFiles = walk(repoRoot)
  const readmes = allFiles.filter((f) => /README\.md$/i.test(f))
  for (const enFile of readmes) {
    const ruFile = path.join(path.dirname(enFile), 'README-RU.md')
    if (fs.existsSync(ruFile)) pairs.push({ en: enFile, ru: ruFile })
  }

  // 2) docs/en/**/README.md ↔ docs/ru/**/README.md
  const enDocsRoot = path.join(repoRoot, 'docs', 'en')
  const ruDocsRoot = path.join(repoRoot, 'docs', 'ru')
  if (fs.existsSync(enDocsRoot) && fs.existsSync(ruDocsRoot)) {
    const enDocs = walk(enDocsRoot).filter((f) => /README\.md$/i.test(f))
    for (const enFile of enDocs) {
      const rel = path.relative(enDocsRoot, enFile)
      const ruFile = path.join(ruDocsRoot, rel)
      if (fs.existsSync(ruFile)) pairs.push({ en: enFile, ru: ruFile })
    }
  }

  // Scope filtering
  if (scope === 'resources') {
    const keep = (p) =>
      /apps\/resources-(frt|srv)\/base\/README\.md$/i.test(p) ||
      /docs\/(en|ru)\/applications\/resources\/README\.md$/i.test(p)

    return pairs.filter(({ en, ru }) => keep(en) || keep(ru))
  }

  return pairs
}

function checkPair(pair) {
  const en = fs.readFileSync(pair.en, 'utf8')
  const ru = fs.readFileSync(pair.ru, 'utf8')
  const enL = normalizeLines(en)
  const ruL = normalizeLines(ru)

  const errors = []

  if (enL.length !== ruL.length) errors.push(`Line count differs: EN=${enL.length} RU=${ruL.length}`)

  const enH = countByRegex(enL, /^#{1,6}\s/)
  const ruH = countByRegex(ruL, /^#{1,6}\s/)
  if (enH !== ruH) errors.push(`Headings count differs: EN=${enH} RU=${ruH}`)

  const enCode = countByRegex(enL, /^```/)
  const ruCode = countByRegex(ruL, /^```/)
  if (enCode !== ruCode) errors.push(`Code fences differ: EN=${enCode} RU=${ruCode}`)

  const enBul = countByRegex(enL, /^-\s/)
  const ruBul = countByRegex(ruL, /^-\s/)
  if (enBul !== ruBul) errors.push(`Bullets count differs: EN=${enBul} RU=${ruBul}`)

  return errors
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..')
  const scope = process.env.I18N_SCOPE || 'resources' // 'resources' | 'all'
  const pairs = findPairs(repoRoot, scope)
  const failures = []

  for (const pair of pairs) {
    const errs = checkPair(pair)
    if (errs.length) failures.push({ pair, errs })
  }

  if (failures.length) {
    console.error('i18n-docs checks failed:')
    for (const f of failures) {
      console.error(`\nEN: ${path.relative(repoRoot, f.pair.en)}\nRU: ${path.relative(repoRoot, f.pair.ru)}`)
      for (const e of f.errs) console.error(`  - ${e}`)
    }
    process.exit(1)
  }

  console.log(`i18n-docs OK. Checked ${pairs.length} pair(s). Scope=${scope}`)
}

main()
