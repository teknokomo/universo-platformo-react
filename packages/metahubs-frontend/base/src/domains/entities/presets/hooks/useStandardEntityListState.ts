import { useState, useCallback } from 'react'
import { useConfirm, useListDialogs } from '@universo/template-mui'
import { useViewPreference } from '../../../../hooks/useViewPreference'

/**
 * Combines common list state hooks used across all standard entity list components:
 * - Dialog management (create/edit/copy/delete/conflict)
 * - View preference (card/table toggle with localStorage persistence)
 * - Imperative confirm dialog
 * - Blocking-delete dialog state
 */
export function useStandardEntityListState<TEntity>(storageKey: string) {
    const listDialogs = useListDialogs<TEntity>()
    const [view, setView] = useViewPreference(storageKey)
    const { confirm } = useConfirm()

    const [blockingDeleteDialogState, setBlockingDeleteDialogState] = useState<{
        open: boolean
        entity: TEntity | null
    }>({ open: false, entity: null })

    const openBlockingDelete = useCallback((entity: TEntity) => {
        setBlockingDeleteDialogState({ open: true, entity })
    }, [])

    const closeBlockingDelete = useCallback(() => {
        setBlockingDeleteDialogState({ open: false, entity: null })
    }, [])

    return {
        ...listDialogs,
        view,
        setView,
        confirm,
        blockingDeleteDialogState,
        openBlockingDelete,
        closeBlockingDelete
    }
}

/**
 * Factory for the standard `copyEntity` callback used by all standard entity list components.
 * Eliminates duplicated copy dispatch pattern across TreeEntityList, LinkedCollectionList,
 * ValueGroupList, and OptionListList.
 */
export function createEntityCopyCallback<TPayload extends Record<string, unknown>>(options: {
    metahubId: string | undefined
    mutation: { mutate: (params: Record<string, unknown>) => void }
    entityIdKey: string
    kindKey: string | undefined
}): (id: string, payload: TPayload) => Promise<void> {
    return (id: string, payload: TPayload) => {
        if (!options.metahubId) return Promise.resolve()
        options.mutation.mutate({
            metahubId: options.metahubId,
            [options.entityIdKey]: id,
            kindKey: options.kindKey,
            data: payload
        })
        return Promise.resolve()
    }
}
