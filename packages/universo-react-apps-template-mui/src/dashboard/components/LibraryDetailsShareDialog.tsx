import { useId } from 'react'
import { type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { readLocalizedTextValue } from '@universo-react/types'

import type { RuntimeWorkspaceMembersResponse } from '../../api/workspaces'
import { StandardDialog } from '../../components/dialogs'
import { PaginationControls } from '../../components/runtime-ui'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { formatWorkspaceMemberLabel, PICKER_PAGE_SIZE, type LibraryRow, type LibraryToggleAction } from './libraryDetailsTableUtils'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import Stack from '@mui/material/Stack'

interface LibraryDetailsShareDialogProps {
    open: boolean
    dialog: { row: LibraryRow; action: LibraryToggleAction } | null
    query: UseQueryResult<RuntimeWorkspaceMembersResponse, Error>
    selectedMemberId: string
    onSelectedMemberChange: (value: string) => void
    onClose: () => void
    onSubmit: (active: boolean) => void
    pending: boolean
    mutationError: unknown
    pageOffset: number
    onPageOffsetChange: (offset: number) => void
}

/** Dialog for granting or removing a workspace member's library access. */
export default function LibraryDetailsShareDialog({
    open,
    dialog,
    query,
    selectedMemberId,
    onSelectedMemberChange,
    onClose,
    onSubmit,
    pending,
    mutationError,
    pageOffset,
    onPageOffsetChange
}: LibraryDetailsShareDialogProps) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const locale = details?.locale ?? 'en'
    const labelId = 'library-share-member-' + useId().replace(/:/g, '')
    const title =
        (dialog?.action.dialogTitle ? readLocalizedTextValue(dialog.action.dialogTitle, locale) : undefined) ??
        t('runtime.shareTitle', 'Share')
    const targetLabel =
        (dialog?.action.targetLabel ? readLocalizedTextValue(dialog.action.targetLabel, locale) : undefined) ??
        t('runtime.shareTargetLabel', 'Workspace member')
    const totalItems = query.data?.total ?? query.data?.items.length ?? 0
    const pageSize = query.data?.limit ?? PICKER_PAGE_SIZE
    const currentPage = Math.floor(pageOffset / pageSize) + 1
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

    return (
        <StandardDialog
            open={open}
            onClose={onClose}
            title={title}
            maxWidth='xs'
            isBusy={pending}
            actions={
                <>
                    <Button type='button' disabled={pending} onClick={onClose}>
                        {t('app.cancel', 'Cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='outlined'
                        disabled={pending || query.isFetching || !selectedMemberId || !dialog}
                        onClick={() => onSubmit(false)}
                    >
                        {t('runtime.unshareSubmit', 'Remove access')}
                    </Button>
                    <Button
                        type='button'
                        variant='contained'
                        startIcon={<ShareRoundedIcon fontSize='small' />}
                        disabled={pending || query.isFetching || !selectedMemberId || !dialog}
                        onClick={() => onSubmit(true)}
                    >
                        {t('runtime.shareSubmit', 'Share')}
                    </Button>
                </>
            }
        >
            <Stack spacing={1.5} sx={{ pt: 1 }}>
                {query.isFetching ? <LinearProgress /> : null}
                {query.isError ? <Alert severity='error'>{t('runtime.shareError', 'Workspace members could not be loaded.')}</Alert> : null}
                {mutationError ? (
                    <Alert severity='error'>
                        {extractRuntimeErrorMessage(mutationError, t('runtime.shareUpdateError', 'Access could not be updated.'), locale)}
                    </Alert>
                ) : null}
                <FormControl fullWidth size='small' disabled={pending || query.isFetching}>
                    <InputLabel id={labelId}>{targetLabel}</InputLabel>
                    <Select
                        labelId={labelId}
                        label={targetLabel}
                        value={selectedMemberId}
                        onChange={(event) => onSelectedMemberChange(String(event.target.value))}
                    >
                        {(query.data?.items ?? []).map((member) => (
                            <MenuItem key={member.userId} value={member.userId}>
                                {formatWorkspaceMemberLabel(member, t('runtime.shareUntitledMember', 'Workspace member'), locale)}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>
                        {query.isFetching
                            ? t('runtime.shareLoading', 'Loading workspace members...')
                            : (query.data?.items.length ?? 0) === 0
                            ? t('runtime.shareEmpty', 'No workspace members were found.')
                            : t('runtime.shareManageHelp', 'Choose a workspace member, then share or remove their access.')}
                    </FormHelperText>
                </FormControl>
                {totalPages > 1 ? (
                    <PaginationControls
                        rowsPerPageOptions={[pageSize]}
                        pagination={{
                            currentPage,
                            pageSize,
                            totalItems,
                            totalPages,
                            hasNextPage: currentPage < totalPages,
                            hasPreviousPage: currentPage > 1
                        }}
                        actions={{
                            goToPage: (page) => onPageOffsetChange((page - 1) * pageSize),
                            nextPage: () => onPageOffsetChange(Math.min((totalPages - 1) * pageSize, pageOffset + pageSize)),
                            previousPage: () => onPageOffsetChange(Math.max(0, pageOffset - pageSize)),
                            setPageSize: () => undefined,
                            setSearch: () => undefined,
                            setSort: () => undefined
                        }}
                        isLoading={query.isFetching}
                    />
                ) : null}
            </Stack>
        </StandardDialog>
    )
}
