import fs from 'node:fs'
import path from 'node:path'

export type Tsconfig = {
  compilerOptions?: {
    paths?: Record<string, string[]>
  }
}

function normalizeAliasKey(key: string): string {
  return key.endsWith('/*') ? key.slice(0, -2) : key
}

function normalizeTarget(target: string): string {
  return target.endsWith('/*') ? target.slice(0, -2) : target
}

export function loadTsconfigAliases(tsconfigPath: string, baseDir: string): Record<string, string> {
  const content = fs.readFileSync(tsconfigPath, 'utf-8')
  const config = JSON.parse(content) as Tsconfig
  const { paths = {} } = config.compilerOptions ?? {}

  return Object.entries(paths).reduce<Record<string, string>>((aliases, [aliasKey, targets]) => {
    if (!Array.isArray(targets) || targets.length === 0) {
      return aliases
    }
    if (aliasKey === '@/*') {
      return aliases
    }

    const normalizedKey = normalizeAliasKey(aliasKey)
    if (normalizedKey.startsWith('.')) {
      return aliases
    }
    const normalizedTarget = normalizeTarget(targets[0])
    aliases[normalizedKey] = path.resolve(baseDir, normalizedTarget)
    return aliases
  }, {})
}
