import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Switch,
    Box,
    Typography,
    Divider,
    Alert,
    CircularProgress
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useUserSettings, type UserSettingsData } from '../../hooks/useUserSettings'
import { useHasGlobalAccess } from '@universo/store'
import { mergeDialogPaperProps, mergeDialogSx, useDialogPresentation } from './dialogPresentation'

export interface SettingsDialogProps {
    open: boolean
    onClose: () => void
}

/**
 * SettingsDialog - User settings dialog
 *
 * Shows user-configurable settings stored in profile.
 * For superuser, shows additional admin settings.
 */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('settings')
    const { settings, updateSettings, loading, error } = useUserSettings()
    // isSuperuser = user has is_superuser=true role (full RLS bypass)
    // hasAnyGlobalRole = user has any global role (metaeditor, etc.)
    // adminConfig.globalRolesEnabled = server-side flag that enables global roles functionality
    const { isSuperuser, hasAnyGlobalRole, adminConfig } = useHasGlobalAccess()

    // Local state for form
    const [localSettings, setLocalSettings] = useState<UserSettingsData>({})
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    // Sync local state with loaded settings when dialog opens
    useEffect(() => {
        if (open && !loading) {
            setLocalSettings(settings)
            setSaveError(null)
        }
    }, [open, settings, loading])

    const handleShowAllItemsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLocalSettings((prev) => ({
            ...prev,
            admin: {
                ...prev.admin,
                showAllItems: event.target.checked
            }
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveError(null)

        try {
            await updateSettings(localSettings)
            onClose()
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        // Reset local state to server state
        setLocalSettings(settings)
        setSaveError(null)
        onClose()
    }

    const isBusy = loading || saving
    const presentation = useDialogPresentation({ open, onClose: handleCancel, fallbackMaxWidth: 'sm', isBusy })
    const titleNode = presentation.titleActions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box component='span' sx={{ minWidth: 0 }}>
                {t('dialog.title', 'Settings')}
            </Box>
            {presentation.titleActions}
        </Box>
    ) : (
        t('dialog.title', 'Settings')
    )

    return (
        <Dialog
            open={open}
            onClose={presentation.dialogProps.onClose}
            maxWidth={presentation.dialogProps.maxWidth ?? 'sm'}
            fullWidth={presentation.dialogProps.fullWidth ?? true}
            disableEscapeKeyDown={presentation.dialogProps.disableEscapeKeyDown}
            PaperProps={mergeDialogPaperProps(undefined, presentation.dialogProps.PaperProps)}
        >
            <DialogTitle>{titleNode}</DialogTitle>

            <DialogContent sx={mergeDialogSx(presentation.contentSx)}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {(error || saveError) && (
                            <Alert severity='error' sx={{ mb: 2 }}>
                                {error || saveError}
                            </Alert>
                        )}

                        {/* Admin Settings - for superuser or users with global roles */}
                        {(isSuperuser || hasAnyGlobalRole) && (
                            <>
                                <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>
                                    {t('dialog.adminSection', 'Admin Settings')}
                                </Typography>

                                {/* Show warning when global roles functionality is disabled */}
                                {!adminConfig.globalRolesEnabled && (
                                    <Alert severity='warning' sx={{ mb: 2 }}>
                                        {t(
                                            'dialog.globalRolesDisabledWarning',
                                            'Global roles functionality is disabled by the system administrator. These settings are inactive.'
                                        )}
                                    </Alert>
                                )}

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localSettings.admin?.showAllItems ?? false}
                                            onChange={handleShowAllItemsChange}
                                            disabled={saving || !adminConfig.globalRolesEnabled}
                                        />
                                    }
                                    label={t('dialog.showAllItems.label', "Show other users' items")}
                                    sx={{
                                        ml: 0,
                                        mb: 2,
                                        opacity: adminConfig.globalRolesEnabled ? 1 : 0.6
                                    }}
                                />

                                <Divider sx={{ my: 2 }} />
                            </>
                        )}

                        {/* General Display Settings - for all users */}
                        <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>
                            {t('dialog.displaySection', 'Display Settings')}
                        </Typography>

                        <Typography variant='body2' color='text.secondary'>
                            {t('dialog.moreSettingsComingSoon', 'More settings coming soon...')}
                        </Typography>
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleCancel} disabled={saving}>
                    {t('common:cancel', 'Cancel')}
                </Button>
                <Button variant='contained' onClick={handleSave} disabled={loading || saving}>
                    {saving ? <CircularProgress size={20} /> : t('common:save', 'Save')}
                </Button>
            </DialogActions>
            {presentation.resizeHandle}
        </Dialog>
    )
}

export default SettingsDialog
