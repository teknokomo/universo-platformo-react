import type { MatrixCell } from '../model'

export type TemplateSaveScopeKind = 'wholeStructure' | 'selectedBranch'

/** Resolve a safe, human-readable ancestor path for the selected branch root. */
export const resolveTemplateBranchPath = (cells: readonly MatrixCell[], rootCellId: string | null | undefined): string[] => {
    if (!rootCellId) return []

    const cellsById = new Map(cells.map((cell) => [cell.id, cell]))
    const root = cellsById.get(rootCellId)
    if (!root) return []

    const labels: string[] = []
    const visited = new Set<string>()
    let current: MatrixCell | undefined = root
    while (current) {
        if (visited.has(current.id)) return []
        visited.add(current.id)
        const label = current.title.trim() || `${current.rowLabel.trim()} · ${current.colLabel.trim()}`
        labels.push(label)
        if (!current.parentCellId) break
        current = cellsById.get(current.parentCellId)
        if (!current) return []
    }

    return labels.reverse()
}
