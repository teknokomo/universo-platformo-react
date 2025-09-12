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

function walk(dir) {
  const files = []
  if (!fs.existsSync(dir)) return files
  const stack = [dir]
  while (stack.length > 0) {
    const currentDir = stack.pop()
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const full = path.join(currentDir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else files.push(full)
    }
  }
  return files
}

function findPairs(repoRoot, scope = 'resources') {
  const pairs = []
  const missing = []

  // 1) Local README.md ↔ README-RU.md
  const allFiles = walk(repoRoot)
  const readmes = allFiles.filter((f) => /README\.md$/i.test(f) && !/[\\\/]docs[\\\/]/i.test(f))
  for (const enFile of readmes) {
    const ruFile = path.join(path.dirname(enFile), 'README-RU.md')
    if (fs.existsSync(ruFile)) pairs.push({ en: enFile, ru: ruFile })
    else missing.push({ en: enFile, ru: ruFile })
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
      else missing.push({ en: enFile, ru: ruFile })
    }
    // RU without EN counterpart
    const ruDocs = walk(ruDocsRoot).filter((f) => /README\.md$/i.test(f))
    for (const ruFile of ruDocs) {
      const rel = path.relative(ruDocsRoot, ruFile)
      const enFile = path.join(enDocsRoot, rel)
      if (!fs.existsSync(enFile)) missing.push({ en: enFile, ru: ruFile })
    }
  }

  // Scope filtering
  if (scope === 'resources') {
    const keep = (p) =>
      /apps\/resources-(frt|srv)\/base\/README\.md$/i.test(p) ||
      /docs\/(en|ru)\/applications\/resources\/README\.md$/i.test(p)

    const fpairs = pairs.filter(({ en, ru }) => keep(en) || keep(ru))
    const fmissing = missing.filter(({ en, ru }) => (en && keep(en)) || (ru && keep(ru)))
    return { pairs: fpairs, missing: fmissing }
  }

  return { pairs, missing }
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

  const enBul = countByRegex(enL, /^[-*+]\s/)
  const ruBul = countByRegex(ruL, /^[-*+]\s/)
  if (enBul !== ruBul) errors.push(`Bullets count differs: EN=${enBul} RU=${ruBul}`)

  return errors
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..')
  const scope = process.env.I18N_SCOPE || 'resources' // 'resources' | 'all'
  const { pairs, missing } = findPairs(repoRoot, scope)
  const failures = []

  for (const pair of pairs) {
    const errs = checkPair(pair)
    if (errs.length) failures.push({ pair, errs })
  }

  // Report missing counterparts
  for (const m of missing) {
    const errs = []
    if (!fs.existsSync(m.en)) errs.push('Missing EN counterpart')
    if (!fs.existsSync(m.ru)) errs.push('Missing RU counterpart')
    failures.push({ pair: m, errs })
  }

  if (failures.length) {
    console.error('i18n-docs checks failed:')
    for (const f of failures) {
      const enP = f.pair.en ? path.relative(repoRoot, f.pair.en) : '(none)'
      const ruP = f.pair.ru ? path.relative(repoRoot, f.pair.ru) : '(none)'
      console.error(`\nEN: ${enP}\nRU: ${ruP}`)
      for (const e of f.errs) console.error(`  - ${e}`)
    }
    process.exit(1)
  }

  console.log(`i18n-docs OK. Checked ${pairs.length} pair(s). Scope=${scope}`)
}

main()
