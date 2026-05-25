import { describe, expect, it, vi } from 'vitest'

import recordActions from '../RecordActions'

describe('RecordActions', () => {
    it('shows move-up only when element is not first and calls move handler', async () => {
        const moveUpAction = recordActions.find((action) => action.id === 'move-up')
        expect(moveUpAction).toBeDefined()

        const moveRecord = vi.fn().mockResolvedValue(undefined)
        const visibleForFirst = moveUpAction?.visible?.({
            entity: { id: 'element-1' },
            orderMap: new Map([['element-1', 0]])
        } as never)
        const visibleForMiddle = moveUpAction?.visible?.({
            entity: { id: 'element-1' },
            orderMap: new Map([['element-1', 1]])
        } as never)

        expect(visibleForFirst).toBe(false)
        expect(visibleForMiddle).toBe(true)

        await moveUpAction?.onSelect?.({
            entity: { id: 'element-1' },
            moveElement: moveRecord
        } as never)

        expect(moveRecord).toHaveBeenCalledWith('element-1', 'up')
    })

    it('shows move-down only when element is not last and calls move handler', async () => {
        const moveDownAction = recordActions.find((action) => action.id === 'move-down')
        expect(moveDownAction).toBeDefined()

        const moveRecord = vi.fn().mockResolvedValue(undefined)
        const visibleForLast = moveDownAction?.visible?.({
            entity: { id: 'element-1' },
            orderMap: new Map([['element-1', 2]]),
            totalCount: 3
        } as never)
        const visibleForMiddle = moveDownAction?.visible?.({
            entity: { id: 'element-1' },
            orderMap: new Map([['element-1', 1]]),
            totalCount: 3
        } as never)

        expect(visibleForLast).toBe(false)
        expect(visibleForMiddle).toBe(true)

        await moveDownAction?.onSelect?.({
            entity: { id: 'element-1' },
            moveElement: moveRecord
        } as never)

        expect(moveRecord).toHaveBeenCalledWith('element-1', 'down')
    })
})
