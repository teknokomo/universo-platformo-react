import { describe, expect, it } from 'vitest'
import { resolveTemplateBranchPath } from '../templateSaveScope'
import type { MatrixCell } from '../../model'

const createCell = (overrides: Partial<MatrixCell> & Pick<MatrixCell, 'id'>): MatrixCell => ({
    id: overrides.id,
    rawRowId: `row-${overrides.id}`,
    sortOrder: 0,
    parentCellId: null,
    depth: 0,
    rowKey: 'row',
    rowLabel: 'Row',
    colKey: 'column',
    colLabel: 'Column',
    title: '',
    description: '',
    materialRef: null,
    style: {
        fill: null,
        text: null,
        borderTop: '',
        borderRight: '',
        borderBottom: '',
        borderLeft: ''
    },
    ...overrides
})

describe('resolveTemplateBranchPath', () => {
    it('returns a readable root-to-cell path without exposing identifiers', () => {
        const cells = [
            createCell({ id: 'root', title: 'Root' }),
            createCell({ id: 'child', title: '', rowLabel: 'Decision', colLabel: 'Option A', parentCellId: 'root', depth: 1 })
        ]

        expect(resolveTemplateBranchPath(cells, 'child')).toEqual(['Root', 'Decision · Option A'])
    })

    it('fails closed for a missing root, missing ancestor, or cyclic hierarchy', () => {
        expect(resolveTemplateBranchPath([], 'missing')).toEqual([])
        expect(resolveTemplateBranchPath([createCell({ id: 'child', parentCellId: 'missing' })], 'child')).toEqual([])
        expect(
            resolveTemplateBranchPath(
                [createCell({ id: 'first', parentCellId: 'second' }), createCell({ id: 'second', parentCellId: 'first' })],
                'first'
            )
        ).toEqual([])
    })
})
