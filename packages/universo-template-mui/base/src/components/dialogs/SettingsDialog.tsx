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
import { useHasGlobalAccess } from '@flowise/store'

export interface SettingsDialogProps {
    open: boolean
    onClose: () => void
}

/**
 * SettingsDialog - User settings dialog
 *
 * Shows user-configurable settings stored in profile.
 * For superadmin/supermoderator, shows additional admin settings.
 */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('settings')
    const { settings, updateSettings, loading, error } = useUserSettings()
    // hasGlobalAccess = user has superadmin/supermoderator role (shows admin settings section)
    // adminConfig.globalAdminEnabled = server-side flag that enables super user privileges
    const { hasGlobalAccess, adminConfig } = useHasGlobalAccess()

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

    return (
        <Dialog open={open} onClose={handleCancel} maxWidth='sm' fullWidth>
            <DialogTitle>{t('dialog.title', 'Settings')}</DialogTitle>

            <DialogContent>
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

                        {/* Admin Settings - only for superadmin/supermoderator */}
                        {hasGlobalAccess && (
                            <>
                                <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>
                                    {t('dialog.adminSection', 'Admin Settings')}
                                </Typography>

                                {/* Show warning when global admin privileges are disabled */}
                                {!adminConfig.globalAdminEnabled && (
                                    <Alert severity='info' sx={{ mb: 2 }}>
                                        {t(
                                            'dialog.globalAdminDisabledWarning',
                                            'Super user privileges are disabled by the system administrator. These settings are inactive.'
                                        )}
                                    </Alert>
                                )}

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localSettings.admin?.showAllItems ?? false}
                                            onChange={handleShowAllItemsChange}
                                            disabled={saving || !adminConfig.globalAdminEnabled}
                                        />
                                    }
                                    label={t('dialog.showAllItems.label', "Show other users' items")}
                                    sx={{
                                        ml: 0,
                                        mb: 2,
                                        opacity: adminConfig.globalAdminEnabled ? 1 : 0.6
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
        </Dialog>
    )
}

export default SettingsDialog
