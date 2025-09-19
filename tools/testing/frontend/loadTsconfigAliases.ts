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
  let config: Tsconfig
  try {
    const content = fs.readFileSync(tsconfigPath, 'utf-8')
    config = JSON.parse(content) as Tsconfig
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load tsconfig aliases from ${tsconfigPath}: ${message}`, {
      cause: error instanceof Error ? error : undefined,
    })
  }
  const { paths = {} } = config.compilerOptions ?? {}

  return Object.entries(paths).reduce<Record<string, string>>((aliases, [aliasKey, targets]) => {
    if (!Array.isArray(targets) || targets.length === 0) {
      return aliases
    }
    if (aliasKey === '@/*') {
      return aliases
    }

    const normalizedKey = normalizeAliasKey(aliasKey)
    if (normalizedKey.startsWith('.') || normalizedKey === '' || normalizedKey === '*') {
      return aliases
    }
    const normalizedTargets = targets
      .map((target) => normalizeTarget(target))
      .map((target) => path.resolve(baseDir, target))

    const resolvedTarget = normalizedTargets.find((candidate) => fs.existsSync(candidate)) ?? normalizedTargets[0]
    if (!resolvedTarget) {
      return aliases
    }

    aliases[normalizedKey] = resolvedTarget
    return aliases
  }, {})
}
