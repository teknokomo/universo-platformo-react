import { useMemo } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress, Box, Alert } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { CompactListTable } from '../table/CompactListTable'
import type { TableColumn } from '../table/FlowListTable'

/**
 * Base entity interface for the entity being deleted.
 */
export interface DeletableEntity {
    id: string
}

/**
 * Base interface for blocking entities.
 */
export interface BlockingEntity {
    id: string
}

/**
 * Labels for UI text customization.
 */
export interface BlockingEntitiesDeleteDialogLabels {
    /** Dialog title */
    title: string
    /** Confirm delete message (shown when no blockers) */
    confirmMessage: string
    /** Warning message when blockers exist */
    blockingWarning: string
    /** Hint for resolving blocking entities */
    resolutionHint: string
    /** Error message when fetching blockers fails */
    fetchError: string
    /** Cancel button text */
    cancelButton: string
    /** Delete button text */
    deleteButton: string
    /** Deleting in progress text */
    deletingButton: string
}

export interface BlockingEntitiesDeleteDialogProps<T extends DeletableEntity, B extends BlockingEntity> {
    /** Whether the dialog is open */
    open: boolean
    /** The entity to be deleted */
    entity: T | null
    /** React Query key for the blocking entities query */
    queryKey: unknown[]
    /** Function to fetch blocking entities. Return { blockingEntities: B[] } */
    fetchBlockingEntities: () => Promise<{ blockingEntities: B[] }>
    /** Callback when dialog is closed */
    onClose: () => void
    /** Callback when delete is confirmed */
    onConfirm: (entity: T) => void
    /** UI labels for customization */
    labels: BlockingEntitiesDeleteDialogLabels
    /** Columns configuration for blocking entities table */
    columns: TableColumn<B>[]
    /** Function to get the link URL for a blocking entity row (optional) */
    getBlockingEntityLink?: (entity: B) => string
    /** Whether delete operation is in progress */
    isDeleting?: boolean
    /** Maximum height for blocking entities table */
    tableMaxHeight?: number
}

/**
 * Generic dialog for confirming entity deletion with blocking entity check.
 * Shows blocking entities (if any) in a table and disables delete button.
 *
 * @example
 * ```tsx
 * <BlockingEntitiesDeleteDialog
 *   open={open}
 *   entity={hub}
 *   queryKey={['blocking', metahubId, hub.id]}
 *   fetchBlockingEntities={() => getBlockingCatalogs(metahubId, hub.id)}
 *   onClose={handleClose}
 *   onConfirm={handleDelete}
 *   labels={hubDeleteLabels}
 *   columns={blockingCatalogColumns}
 *   getBlockingEntityLink={(c) => `/metahub/${metahubId}/catalog/${c.id}`}
 * />
 * ```
 */
export const BlockingEntitiesDeleteDialog = <T extends DeletableEntity, B extends BlockingEntity>({
    open,
    entity,
    queryKey,
    fetchBlockingEntities,
    onClose,
    onConfirm,
    labels,
    columns,
    getBlockingEntityLink,
    isDeleting = false,
    tableMaxHeight = 240
}: BlockingEntitiesDeleteDialogProps<T, B>) => {
    const entityId = entity?.id ?? ''

    const blockingEntitiesQuery = useQuery({
        queryKey,
        queryFn: fetchBlockingEntities,
        enabled: open && Boolean(entityId),
        // Must update on tab refocus even when data is "fresh"
        refetchOnWindowFocus: open ? 'always' : false
    })

    const blockingEntities: B[] = useMemo(() => {
        return (blockingEntitiesQuery.data as { blockingEntities: B[] } | undefined)?.blockingEntities ?? []
    }, [blockingEntitiesQuery.data])

    const isLoading = blockingEntitiesQuery.isLoading || blockingEntitiesQuery.isFetching
    const error = blockingEntitiesQuery.isError ? labels.fetchError : null

    const handleConfirm = () => {
        if (entity && blockingEntities.length === 0) {
            onConfirm(entity)
        }
    }

    const canDelete = blockingEntities.length === 0 && !isLoading && !error

    if (!entity) return null

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                ) : blockingEntities.length > 0 ? (
                    <>
                        <Alert severity='warning' sx={{ mb: 2 }}>
                            {labels.blockingWarning}
                        </Alert>
                        <CompactListTable<B>
                            data={blockingEntities}
                            maxHeight={tableMaxHeight}
                            getRowLink={getBlockingEntityLink}
                            linkMode={getBlockingEntityLink ? 'all-cells' : undefined}
                            columns={columns}
                        />
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                            {labels.resolutionHint}
                        </Typography>
                    </>
                ) : (
                    <Typography>{labels.confirmMessage}</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isDeleting}>
                    {labels.cancelButton}
                </Button>
                <Button onClick={handleConfirm} color='error' variant='contained' disabled={!canDelete || isDeleting}>
                    {isDeleting ? labels.deletingButton : labels.deleteButton}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default BlockingEntitiesDeleteDialog
