import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import type { DraftBinding } from '../marketingWidgetBindingDialogModel'
import { useMarketingWidgetBindingRecordCopy } from '../useMarketingWidgetBindingRecordCopy'

const mocks = vi.hoisted(() => ({ findRecordBySemanticKey: vi.fn() }))

vi.mock('../marketingWidgetBindingRecordLookup', () => ({ findRecordBySemanticKey: mocks.findRecordBySemanticKey }))

type HookParams = Parameters<typeof useMarketingWidgetBindingRecordCopy>[0]

const contentSlot = {
    key: 'content',
    selectorKinds: ['semantic-key'],
    requirements: { components: [{ componentCodename: 'ImageKey', field: 'ImageKey', semanticKey: true }] }
} as WidgetBindingSlotDefinition

const sourceSelection: DraftBinding = {
    sourceKey: 'MarketingPageImage',
    sourceName: 'Marketing images',
    selectorKind: 'semantic-key',
    semanticKey: 'image-source',
    selectionLabel: 'Source image'
}
const originalBindings = { content: sourceSelection }

const createParams = (overrides: Partial<HookParams> = {}): HookParams => ({
    metahubId: 'metahub-1',
    shouldCloneRecord: true,
    slots: [contentSlot],
    sourceEntity: { id: 'image-entity-1' },
    treeEntityId: 'object-tree-1',
    ...overrides
})

describe('useMarketingWidgetBindingRecordCopy', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mocks.findRecordBySemanticKey.mockResolvedValue({ id: 'source-record', data: { ImageKey: 'image-source' } })
    })

    it('resolves a semantic copy intent for the server transaction without creating a client-side copy', async () => {
        const { result } = renderHook(() => useMarketingWidgetBindingRecordCopy(createParams()))

        const copyResult = await result.current(originalBindings)
        expect(copyResult).toEqual({
            selections: originalBindings,
            recordCopy: {
                entityId: 'image-entity-1',
                recordId: 'source-record',
                sourceKey: 'MarketingPageImage',
                sourceSemanticKey: 'image-source',
                slot: 'content'
            }
        })
        expect(mocks.findRecordBySemanticKey).toHaveBeenCalledWith(
            'metahub-1',
            'object-tree-1',
            'image-entity-1',
            'ImageKey',
            'image-source'
        )
    })

    it('does not resolve a copy intent when cloning is not required', async () => {
        const { result } = renderHook(() => useMarketingWidgetBindingRecordCopy(createParams({ shouldCloneRecord: false })))

        await expect(result.current(originalBindings)).resolves.toEqual({ selections: originalBindings })
        expect(mocks.findRecordBySemanticKey).not.toHaveBeenCalled()
    })

    it('fails closed when the duplicate has no resolvable semantic record source', async () => {
        const { result } = renderHook(() => useMarketingWidgetBindingRecordCopy(createParams({ sourceEntity: null, treeEntityId: null })))

        await expect(result.current(originalBindings)).rejects.toThrow('MARKETING_WIDGET_CLONE_SOURCE_UNAVAILABLE')
        expect(mocks.findRecordBySemanticKey).not.toHaveBeenCalled()
    })
})
