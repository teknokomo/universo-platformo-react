import { useReducer, useCallback, useMemo } from 'react'

type DialogType = 'create' | 'edit' | 'copy' | 'delete' | 'conflict'

interface DialogState<TEntity> {
    create: { open: boolean }
    edit: { open: boolean; item: TEntity | null }
    copy: { open: boolean; item: TEntity | null }
    delete: { open: boolean; item: TEntity | null }
    conflict: { open: boolean; data: unknown }
}

type DialogAction<TEntity> =
    | { type: 'OPEN_CREATE' }
    | { type: 'OPEN'; dialog: 'edit' | 'copy' | 'delete'; item: TEntity }
    | { type: 'OPEN_CONFLICT'; data: unknown }
    | { type: 'CLOSE'; dialog: DialogType }

function createInitialState<TEntity>(): DialogState<TEntity> {
    return {
        create: { open: false },
        edit: { open: false, item: null },
        copy: { open: false, item: null },
        delete: { open: false, item: null },
        conflict: { open: false, data: null }
    }
}

function dialogReducer<TEntity>(state: DialogState<TEntity>, action: DialogAction<TEntity>): DialogState<TEntity> {
    switch (action.type) {
        case 'OPEN_CREATE':
            return { ...state, create: { open: true } }
        case 'OPEN':
            return { ...state, [action.dialog]: { open: true, item: action.item } }
        case 'OPEN_CONFLICT':
            return { ...state, conflict: { open: true, data: action.data } }
        case 'CLOSE':
            return { ...state, [action.dialog]: { open: false, item: null, data: null } }
        default:
            return state
    }
}

export interface UseListDialogsReturn<TEntity> {
    dialogs: DialogState<TEntity>
    openCreate: () => void
    openEdit: (item: TEntity) => void
    openCopy: (item: TEntity) => void
    openDelete: (item: TEntity) => void
    openConflict: (data: unknown) => void
    close: (dialog: DialogType) => void
}

/**
 * Manages dialog open/close state for entity list pages.
 * Replaces 5 separate useState calls per list component with a single useReducer.
 *
 * @example
 * ```tsx
 * const { dialogs, openCreate, openEdit, openDelete, close } = useListDialogs<CatalogDisplay>()
 *
 * <Button onClick={openCreate}>Add</Button>
 * <CreateDialog open={dialogs.create.open} onClose={() => close('create')} />
 * <EditDialog open={dialogs.edit.open} item={dialogs.edit.item} onClose={() => close('edit')} />
 * <DeleteDialog open={dialogs.delete.open} item={dialogs.delete.item} onClose={() => close('delete')} />
 * ```
 */
export function useListDialogs<TEntity>(): UseListDialogsReturn<TEntity> {
    const [dialogs, dispatch] = useReducer(dialogReducer<TEntity>, undefined, createInitialState<TEntity>)

    const openCreate = useCallback(() => dispatch({ type: 'OPEN_CREATE' }), [])
    const openEdit = useCallback((item: TEntity) => dispatch({ type: 'OPEN', dialog: 'edit', item }), [])
    const openCopy = useCallback((item: TEntity) => dispatch({ type: 'OPEN', dialog: 'copy', item }), [])
    const openDelete = useCallback((item: TEntity) => dispatch({ type: 'OPEN', dialog: 'delete', item }), [])
    const openConflict = useCallback((data: unknown) => dispatch({ type: 'OPEN_CONFLICT', data }), [])
    const close = useCallback((dialog: DialogType) => dispatch({ type: 'CLOSE', dialog }), [])

    return useMemo(
        () => ({ dialogs, openCreate, openEdit, openCopy, openDelete, openConflict, close }),
        [dialogs, openCreate, openEdit, openCopy, openDelete, openConflict, close]
    )
}
