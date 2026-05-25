import { useState, useCallback, useRef, type ChangeEvent } from 'react'
import { Button, Alert, Typography, CircularProgress, Stack, Box } from '@mui/material'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useTranslation } from 'react-i18next'
import { SNAPSHOT_BUNDLE_CONSTRAINTS } from '@universo/types'
import { StandardDialog } from '@universo/template-mui'

const hiddenInputSx = {
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap' as const,
    width: 1
}

interface ImportSnapshotDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: (file: File) => Promise<void> | void
    isLoading?: boolean
    error?: string | null
    title?: string
    confirmLabel?: string
}

export function ImportSnapshotDialog({ open, onClose, onConfirm, isLoading, error, title, confirmLabel }: ImportSnapshotDialogProps) {
    const { t } = useTranslation('metahubs')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [localError, setLocalError] = useState<string | null>(null)

    const handleFileSelect = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return
            setLocalError(null)
            if (file.size > SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
                setLocalError(t('export.fileSizeError', { maxMB: 50 }))
                return
            }
            if (!file.name.endsWith('.json')) {
                setLocalError(t('export.invalidFormat'))
                return
            }
            setSelectedFile(file)
        },
        [t]
    )

    const handleConfirm = useCallback(async () => {
        if (!selectedFile) return
        await onConfirm(selectedFile)
    }, [selectedFile, onConfirm])

    const handleClose = useCallback(() => {
        if (isLoading) return
        setSelectedFile(null)
        setLocalError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        onClose()
    }, [isLoading, onClose])

    return (
        <StandardDialog
            open={open}
            onClose={handleClose}
            title={title ?? t('export.importSnapshot')}
            dialogContentProps={{ sx: { px: 3, py: 2.5, overflowY: 'visible' } }}
            dialogActionsProps={{ sx: { px: 3, py: 2, justifyContent: 'flex-end', gap: 1 } }}
            actions={
                <>
                    <Button onClick={handleClose} disabled={isLoading}>
                        {t('common:cancel', 'Cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant='contained'
                        disabled={!selectedFile || isLoading}
                        startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                    >
                        {confirmLabel ?? t('export.importSnapshot')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2}>
                <Typography variant='body2' color='text.secondary'>
                    {t('export.fileSelectLabel')}
                </Typography>

                <Stack direction='row' spacing={1.5} alignItems='center' sx={{ flexWrap: 'wrap' }}>
                    <Button component='label' variant='outlined' startIcon={<UploadFileRoundedIcon />} disabled={isLoading}>
                        {t('export.chooseFile')}
                        <Box
                            ref={fileInputRef}
                            component='input'
                            type='file'
                            accept='.json'
                            onChange={handleFileSelect}
                            disabled={isLoading}
                            sx={hiddenInputSx}
                        />
                    </Button>

                    <Typography variant='body2' color={selectedFile ? 'text.primary' : 'text.secondary'}>
                        {selectedFile?.name ?? t('export.noFileSelected')}
                    </Typography>
                </Stack>

                {(localError || error) && <Alert severity='error'>{localError ?? error}</Alert>}
            </Stack>
        </StandardDialog>
    )
}
