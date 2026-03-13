import type { DependencyGraphNode, DependencyGraphValidationResult } from './types'

const pushUniqueIssue = (issues: string[], message: string): void => {
    if (!issues.includes(message)) {
        issues.push(message)
    }
}

export const validateDependencyGraph = (nodes: readonly DependencyGraphNode[]): DependencyGraphValidationResult => {
    const issues: string[] = []
    const orderedKeys: string[] = []
    const adjacency = new Map<string, string[]>()
    const indegree = new Map<string, number>()

    for (const node of nodes) {
        if (!node.logicalKey.trim()) {
            pushUniqueIssue(issues, 'Dependency graph node logicalKey must not be empty')
            continue
        }

        if (adjacency.has(node.logicalKey)) {
            pushUniqueIssue(issues, `Duplicate dependency graph node: ${node.logicalKey}`)
            continue
        }

        adjacency.set(node.logicalKey, [])
        indegree.set(node.logicalKey, 0)
    }

    for (const node of nodes) {
        if (!adjacency.has(node.logicalKey)) continue

        const seenDependencies = new Set<string>()
        for (const dependency of node.dependencies) {
            if (!dependency.trim()) {
                pushUniqueIssue(issues, `Dependency graph node ${node.logicalKey} contains an empty dependency`)
                continue
            }

            if (seenDependencies.has(dependency)) {
                pushUniqueIssue(issues, `Dependency graph node ${node.logicalKey} contains duplicate dependency ${dependency}`)
                continue
            }
            seenDependencies.add(dependency)

            if (!adjacency.has(dependency)) {
                pushUniqueIssue(issues, `Dependency graph node ${node.logicalKey} depends on unknown key ${dependency}`)
                continue
            }

            adjacency.get(dependency)?.push(node.logicalKey)
            indegree.set(node.logicalKey, (indegree.get(node.logicalKey) ?? 0) + 1)
        }
    }

    const ready = Array.from(indegree.entries())
        .filter(([, degree]) => degree === 0)
        .map(([logicalKey]) => logicalKey)
        .sort((left, right) => left.localeCompare(right))

    while (ready.length > 0) {
        const logicalKey = ready.shift()
        if (!logicalKey) continue

        orderedKeys.push(logicalKey)
        const outgoing = (adjacency.get(logicalKey) ?? []).slice().sort((left, right) => left.localeCompare(right))
        for (const nextKey of outgoing) {
            const nextDegree = (indegree.get(nextKey) ?? 0) - 1
            indegree.set(nextKey, nextDegree)
            if (nextDegree === 0) {
                ready.push(nextKey)
                ready.sort((left, right) => left.localeCompare(right))
            }
        }
    }

    if (orderedKeys.length !== adjacency.size) {
        const unresolved = Array.from(indegree.entries())
            .filter(([, degree]) => degree > 0)
            .map(([logicalKey]) => logicalKey)
            .sort((left, right) => left.localeCompare(right))

        if (unresolved.length > 0) {
            pushUniqueIssue(issues, `Dependency graph contains a cycle or unresolved dependency chain: ${unresolved.join(', ')}`)
        }
    }

    return {
        ok: issues.length === 0,
        orderedKeys,
        issues
    }
}
