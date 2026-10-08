/** Preserve sibling order while scheduling parents before their children. */
export const orderApplicationWidgetGraph = <T>(
    items: readonly T[],
    placement: (item: T) => { id: string; layoutId: string; parentWidgetId: string | null }
): T[] => {
    const byId = new Map<string, T>()
    for (const item of items) {
        const { id } = placement(item)
        if (byId.has(id)) throw new Error('[SchemaSync] Widget graph contains duplicate identities')
        byId.set(id, item)
    }
    const ordered: T[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (item: T): void => {
        const node = placement(item)
        if (visited.has(node.id)) return
        if (visiting.has(node.id)) throw new Error('[SchemaSync] Widget graph contains a cycle')
        visiting.add(node.id)
        if (node.parentWidgetId !== null) {
            const parent = byId.get(node.parentWidgetId)
            if (!parent || placement(parent).layoutId !== node.layoutId) {
                throw new Error('[SchemaSync] Widget graph parent is missing or belongs to another layout')
            }
            visit(parent)
        }
        visiting.delete(node.id)
        visited.add(node.id)
        ordered.push(item)
    }
    for (const item of items) visit(item)
    return ordered
}
