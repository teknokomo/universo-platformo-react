const getIndent = (line) => line.match(/^\s*/)?.[0].length ?? 0

const parseScalarEntry = (line) => {
    const match = line.trim().match(/^(?:'([^']+)'|"([^"]+)"|([^:]+?))\s*:\s*(?:'([^']*)'|"([^"]*)"|([^#\s]+))(?:\s+#.*)?$/)

    if (!match) return null

    const key = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    const value = match[4] ?? match[5] ?? match[6]
    if (!key || value === undefined) return null

    return [key, value]
}

export const parsePnpmWorkspaceScalarMap = (workspaceText, sectionName) => {
    const result = new Map()
    const lines = workspaceText.split(/\r?\n/)
    let inSection = false
    let sectionIndent = -1
    let entryIndent = null

    for (const line of lines) {
        if (!inSection) {
            const sectionMatch = line.match(/^(\s*)([A-Za-z0-9_-]+):\s*(?:#.*)?$/)
            if (sectionMatch?.[1].length === 0 && sectionMatch[2] === sectionName) {
                inSection = true
                sectionIndent = sectionMatch[1].length
            }
            continue
        }

        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const indent = getIndent(line)
        if (indent <= sectionIndent) break
        if (entryIndent !== null && indent !== entryIndent) continue

        const entry = parseScalarEntry(line)
        if (!entry) continue

        entryIndent ??= indent
        result.set(entry[0], entry[1])
    }

    return result
}
