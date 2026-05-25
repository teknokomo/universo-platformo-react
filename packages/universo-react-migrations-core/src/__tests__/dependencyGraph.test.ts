import { validateDependencyGraph } from '../dependencyGraph'

describe('validateDependencyGraph', () => {
    it('returns deterministic topological ordering', () => {
        const result = validateDependencyGraph([
            { logicalKey: 'c', dependencies: ['b'] },
            { logicalKey: 'a', dependencies: [] },
            { logicalKey: 'b', dependencies: ['a'] }
        ])

        expect(result).toEqual({
            ok: true,
            orderedKeys: ['a', 'b', 'c'],
            issues: []
        })
    })

    it('rejects unknown dependencies', () => {
        const result = validateDependencyGraph([{ logicalKey: 'b', dependencies: ['missing'] }])

        expect(result.ok).toBe(false)
        expect(result.issues).toContain('Dependency graph node b depends on unknown key missing')
    })

    it('rejects dependency cycles', () => {
        const result = validateDependencyGraph([
            { logicalKey: 'a', dependencies: ['b'] },
            { logicalKey: 'b', dependencies: ['a'] }
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContain('Dependency graph contains a cycle or unresolved dependency chain: a, b')
    })
})
