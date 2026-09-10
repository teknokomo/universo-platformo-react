import { EffectiveLayoutError } from './effectiveLayoutContract'

export interface CanonicalLayoutSelectionCandidate {
    id: string
    scopeEntityId: string | null
    isActive: boolean
    isDefault: boolean
}

export type CanonicalLayoutSelection<T extends CanonicalLayoutSelectionCandidate> = {
    layout: T
    scope: 'global' | 'entity'
}

const selectDefaultLayout = <T extends CanonicalLayoutSelectionCandidate>(rows: readonly T[]): T | null => {
    const defaults = rows.filter((row) => row.isActive && row.isDefault)
    if (defaults.length > 1) {
        throw new EffectiveLayoutError('LAYOUT_DEFAULT_INVALID')
    }
    return defaults[0] ?? null
}

/**
 * Select the single effective layout for a target. Scoped defaults always win
 * over the global default; duplicate active defaults fail closed.
 */
export const selectCanonicalLayoutCandidate = <T extends CanonicalLayoutSelectionCandidate>(
    layouts: readonly T[],
    entityId: string | null
): CanonicalLayoutSelection<T> | null => {
    const globalLayout = selectDefaultLayout(layouts.filter((layout) => layout.scopeEntityId === null))
    if (entityId) {
        const scopedLayout = selectDefaultLayout(layouts.filter((layout) => layout.scopeEntityId === entityId))
        if (scopedLayout) return { layout: scopedLayout, scope: 'entity' }
    }
    return globalLayout ? { layout: globalLayout, scope: 'global' } : null
}
