import { describe, expect, it, vi } from 'vitest'

import elementActions from '../ElementActions'

describe('ElementActions', () => {
    it('shows move-up only when element is not first and calls move handler', async () => {
        const moveUpAction = elementActions.find((action) => action.id === 'move-up')
        expect(moveUpAction).toBeDefined()

        const moveElement = vi.fn().mockResolvedValue(undefined)
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
            moveElement
        } as never)

        expect(moveElement).toHaveBeenCalledWith('element-1', 'up')
    })

    it('shows move-down only when element is not last and calls move handler', async () => {
        const moveDownAction = elementActions.find((action) => action.id === 'move-down')
        expect(moveDownAction).toBeDefined()

        const moveElement = vi.fn().mockResolvedValue(undefined)
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
            moveElement
        } as never)

        expect(moveElement).toHaveBeenCalledWith('element-1', 'down')
    })
})
