import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Chip, Stack, Typography, Button, CircularProgress, Alert, Tab, Tabs } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PermissionInput, UpdateRolePayload } from '@universo/types'
import { isValidLocaleCode } from '@universo/types'
import { resolveLocalizedContent, filterLocalizedContent } from '@universo/utils'

// Project imports
import { ViewHeaderMUI as ViewHeader, EmptyListState, APIEmptySVG } from '@universo/template-mui'

import apiClient from '../api/apiClient'
import { createRolesApi } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import { useAdminPermission } from '../hooks'
import { PermissionMatrix } from '../components/PermissionMatrix'
import RoleFormDialog from '../components/RoleFormDialog'
import type { RoleFormDialogSubmitData } from '../components/RoleFormDialog'

// Singleton instance of rolesApi
const rolesApi = createRolesApi(apiClient)

type RoleTab = 'permissions' | 'settings'

/**
 * Role Detail Page — view/edit an existing role.
 * Permissions tab: inline PermissionMatrix with Save button.
 * Settings tab: opens RoleFormDialog dialog (like catalog Settings).
 */
const RoleEdit = () => {
    const { roleId, instanceId } = useParams<{ roleId: string; instanceId: string }>()
    const navigate = useNavigate()
    const { t, i18n } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const canUpdateRoles = useAdminPermission('update', 'Role')

    // Current locale
    const currentLocale = i18n.language.split('-')[0] || 'en'
    const uiLocale = isValidLocaleCode(currentLocale) ? currentLocale : 'en'

    // Permissions form state (managed inline)
    const [permissions, setPermissions] = useState<PermissionInput[]>([])
    const [permsDirty, setPermsDirty] = useState(false)
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
    const [settingsDialogError, setSettingsDialogError] = useState<string | null>(null)

    // Fetch role
    const {
        data: role,
        isLoading,
        error,
        isError
    } = useQuery({
        queryKey: rolesQueryKeys.detail(roleId ?? ''),
        queryFn: () => rolesApi.getRole(roleId!),
        enabled: !!roleId && roleId !== 'new',
        // Sync permissions into local state when data arrives
        select: (data) => {
            // This runs on every refetch, but we only update local state on initial load
            return data
        }
    })

    // Sync permissions from server to local state on initial load
    const [syncedRoleId, setSyncedRoleId] = useState<string | null>(null)
    if (role && role.id !== syncedRoleId) {
        setPermissions(role.permissions)
        setPermsDirty(false)
        setSyncedRoleId(role.id)
    }

    const isSystemRole = role?.isSystem ?? false
    const roleDisplayName = role ? resolveLocalizedContent(role.name, uiLocale, role.codename) : ''
    const roleDescription = role?.description ? resolveLocalizedContent(role.description, uiLocale, '') : ''

    // Update mutation for permissions
    const updatePermsMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) => rolesApi.updateRole(id, payload),
        onSuccess: (updatedRole) => {
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.detail(updatedRole.id) })
            enqueueSnackbar(t('roles.updateSuccess', 'Role updated successfully'), { variant: 'success' })
            setPermsDirty(false)
        },
        onError: (err: Error) => {
            enqueueSnackbar(err.message || t('roles.updateError', 'Failed to update role'), { variant: 'error' })
        }
    })

    // Update mutation for settings (via dialog)
    const updateSettingsMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) => rolesApi.updateRole(id, payload),
        onSuccess: (updatedRole) => {
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.detail(updatedRole.id) })
            enqueueSnackbar(t('roles.updateSuccess', 'Role updated successfully'), { variant: 'success' })
            setSettingsDialogOpen(false)
            setSettingsDialogError(null)
        },
        onError: (err: Error) => {
            setSettingsDialogError(err.message || t('roles.updateError', 'Failed to update role'))
        }
    })

    const handlePermissionsChange = useCallback((newPerms: PermissionInput[]) => {
        setPermissions(newPerms)
        setPermsDirty(true)
    }, [])

    const handleSavePermissions = useCallback(() => {
        if (!roleId || isSystemRole || !canUpdateRoles) return
        updatePermsMutation.mutate({
            id: roleId,
            payload: { permissions }
        })
    }, [canUpdateRoles, roleId, isSystemRole, permissions, updatePermsMutation])

    const handleSettingsSubmit = useCallback(
        async (data: RoleFormDialogSubmitData) => {
            if (!roleId) return
            const filteredName = filterLocalizedContent(data.name)
            const filteredDescription = filterLocalizedContent(data.description)
            const payload: UpdateRolePayload = isSystemRole
                ? {
                      name: filteredName,
                      description: filteredDescription || undefined,
                      color: data.color
                  }
                : {
                      codename: data.codename,
                      name: filteredName,
                      description: filteredDescription || undefined,
                      color: data.color,
                      isSuperuser: data.isSuperuser
                  }
            updateSettingsMutation.mutate({ id: roleId, payload })
        },
        [roleId, isSystemRole, updateSettingsMutation]
    )

    const handleTabChange = useCallback(
        (_event: unknown, nextTab: RoleTab) => {
            if (nextTab === 'settings') {
                if (!canUpdateRoles) {
                    return
                }

                setSettingsDialogError(null)
                setSettingsDialogOpen(true)
                return
            }
            // 'permissions' tab — noop, already shown
        },
        [canUpdateRoles]
    )

    const handleBack = useCallback(() => {
        navigate(`/admin/instance/${instanceId}/roles`)
    }, [navigate, instanceId])

    const isSaving = updatePermsMutation.isPending

    // Loading state
    if (isLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('roles.loadingRole', 'Loading role...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Error state
    if (isError) {
        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <Button startIcon={<ArrowBackRoundedIcon />} onClick={handleBack}>
                    {tc('actions.back')}
                </Button>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading role'
                    title={t('roles.errorLoadingRole', 'Failed to load role')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {error instanceof Error ? error.message : t('roles.unknownError', 'Unknown error')}
                </Alert>
            </Stack>
        )
    }

    if (!role) return null

    return (
        <Stack spacing={3} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            <Stack spacing={2}>
                <ViewHeader title={roleDisplayName || t('roles.editTitle', 'Edit Role')} description={roleDescription} search={false} />

                <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
                    <Button startIcon={<ArrowBackRoundedIcon />} onClick={handleBack} size='small'>
                        {t('roles.backToList', 'Back to Roles')}
                    </Button>
                    <Chip label={`${t('roles.field.codename', 'Code Name')}: ${role.codename}`} variant='outlined' size='small' />
                    {role.isSystem && <Chip label={t('roles.badges.system', 'System role')} color='info' variant='outlined' size='small' />}
                    {role.isSuperuser && (
                        <Chip label={t('roles.badges.superuser', 'Superuser')} color='warning' variant='outlined' size='small' />
                    )}
                </Stack>

                {isSystemRole && (
                    <Alert severity='info'>
                        {t('roles.systemRoleWarning', 'This is a system role. Only description, display name, and color can be modified.')}
                    </Alert>
                )}
            </Stack>

            <Stack spacing={3}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value='permissions'
                        onChange={handleTabChange}
                        textColor='primary'
                        indicatorColor='primary'
                        sx={{
                            minHeight: 40,
                            '& .MuiTab-root': { minHeight: 40, textTransform: 'none' }
                        }}
                    >
                        <Tab value='permissions' label={t('roles.tabs.permissions', 'Permissions')} />
                        <Tab value='settings' label={t('roles.tabs.settings', 'Settings')} disabled={!canUpdateRoles} />
                    </Tabs>
                </Box>

                <PermissionMatrix
                    permissions={permissions}
                    onChange={handlePermissionsChange}
                    disabled={isSaving || isSystemRole || !canUpdateRoles}
                    showSelectAll={!isSystemRole}
                />

                {!isSystemRole && (
                    <Stack direction='row' justifyContent='flex-end'>
                        <Button
                            variant='contained'
                            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveRoundedIcon />}
                            onClick={handleSavePermissions}
                            disabled={isSaving || !permsDirty || !canUpdateRoles}
                        >
                            {t('roles.actions.savePermissions', 'Save permissions')}
                        </Button>
                    </Stack>
                )}
            </Stack>

            <RoleFormDialog
                open={settingsDialogOpen}
                title={t('roles.editTitle', 'Edit Role')}
                submitLabel={tc('actions.save', 'Save')}
                loading={updateSettingsMutation.isPending}
                error={settingsDialogError}
                initialCodename={role.codename}
                initialName={role.name}
                initialDescription={role.description ?? null}
                initialColor={role.color}
                codenameDisabled={isSystemRole}
                showIsSuperuser={!isSystemRole}
                initialIsSuperuser={role.isSuperuser}
                isSuperuserDisabled={isSystemRole || !canUpdateRoles}
                onClose={() => {
                    setSettingsDialogOpen(false)
                    setSettingsDialogError(null)
                }}
                onSubmit={async (data) => {
                    if (!canUpdateRoles) {
                        return
                    }

                    await handleSettingsSubmit(data)
                }}
            />
        </Stack>
    )
}

export default RoleEdit
