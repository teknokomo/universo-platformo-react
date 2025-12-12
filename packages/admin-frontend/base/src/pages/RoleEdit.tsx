import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, TextField, Button, CircularProgress, Alert, FormControlLabel, Switch, Grid, Divider } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PermissionInput, CreateRolePayload, UpdateRolePayload, VersionedLocalizedContent, SupportedLocale } from '@universo/types'
import { isSupportedLocale } from '@universo/types'
import { createVlc, resolveVlcContent } from '@universo/utils'

// Project imports
import {
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    EmptyListState,
    APIEmptySVG,
    LocalizedFieldEditor
} from '@universo/template-mui'

import apiClient from '../api/apiClient'
import { createRolesApi } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import { useIsSuperadmin } from '../hooks'
import { ColorPicker } from '../components/ColorPicker'
import { PermissionMatrix } from '../components/PermissionMatrix'

// Singleton instance of rolesApi
const rolesApi = createRolesApi(apiClient)

/**
 * Default empty form state with initial locale
 */
const getDefaultFormState = (currentLocale: string) => {
    const locale = isSupportedLocale(currentLocale) ? currentLocale : 'en'
    return {
        codename: '',
        description: createVlc(locale, ''),
        name: createVlc(locale, ''),
        color: '#9e9e9e',
        isSuperuser: false,
        permissions: [] as PermissionInput[]
    }
}

/**
 * Role Edit/Create Page
 * Edit existing role or create a new one
 */
const RoleEdit = () => {
    const { roleId, instanceId } = useParams<{ roleId: string; instanceId: string }>()
    const isNew = roleId === 'new'
    const navigate = useNavigate()
    const { t, i18n } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const isSuperadmin = useIsSuperadmin()

    // Get current locale (en or ru)
    const currentLocale = i18n.language.split('-')[0] || 'en'

    // Form state
    const [formState, setFormState] = useState(getDefaultFormState(currentLocale))
    const [isDirty, setIsDirty] = useState(false)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

    // Fetch role for editing (skip for new roles)
    const {
        data: role,
        isLoading,
        error,
        isError
    } = useQuery({
        queryKey: rolesQueryKeys.detail(isNew ? '' : roleId ?? ''),
        queryFn: async () => {
            // Double-check: never fetch if creating new role
            if (isNew || !roleId || roleId === 'new') {
                return null
            }
            return rolesApi.getRole(roleId)
        },
        enabled: !isNew && !!roleId && roleId !== 'new'
    })

    // Populate form when role is loaded
    useEffect(() => {
        if (role && !isNew) {
            setFormState({
                codename: role.codename,
                description: role.description
                    ? typeof role.description === 'string'
                        ? createVlc('en', role.description) // Use 'en' for legacy string migration
                        : role.description
                    : createVlc('en', ''),
                name: role.name,
                color: role.color,
                isSuperuser: role.isSuperuser,
                permissions: role.permissions
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, isNew])

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (payload: CreateRolePayload) => rolesApi.createRole(payload),
        onSuccess: (createdRole) => {
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
            // Invalidate assignable roles cache
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
            // Invalidate the new role's detail query so it loads after navigation
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.detail(createdRole.id) })
            enqueueSnackbar(t('roles.createSuccess', 'Role created successfully'), {
                variant: 'success'
            })
            navigate(`/admin/instance/${instanceId}/roles/${createdRole.id}`)
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('roles.createError', 'Failed to create role'), {
                variant: 'error'
            })
        }
    })

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) => rolesApi.updateRole(id, payload),
        onSuccess: (updatedRole) => {
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
            // Invalidate assignable roles cache in case canAccessAdmin changed
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
            // Invalidate this role's detail query to refetch fresh data
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.detail(updatedRole.id) })
            enqueueSnackbar(t('roles.updateSuccess', 'Role updated successfully'), {
                variant: 'success'
            })
            setIsDirty(false)
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('roles.updateError', 'Failed to update role'), {
                variant: 'error'
            })
        }
    })

    const isSaving = createMutation.isPending || updateMutation.isPending
    const isSystemRole = !isNew && role?.isSystem

    // Form handlers
    const handleChange = useCallback(
        (field: keyof typeof formState) => (event: React.ChangeEvent<HTMLInputElement>) => {
            const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
            setFormState((prev) => ({ ...prev, [field]: value }))
            setIsDirty(true)
            // Clear validation error for this field
            setValidationErrors((prev) => {
                const next = { ...prev }
                delete next[field]
                return next
            })
        },
        []
    )

    const handleColorChange = useCallback((color: string) => {
        setFormState((prev) => ({ ...prev, color }))
        setIsDirty(true)
    }, [])

    const handleNameChange = useCallback((name: VersionedLocalizedContent<string> | null) => {
        setFormState((prev) => ({ ...prev, name }))
        setIsDirty(true)
        // Clear validation error for name
        setValidationErrors((prev) => {
            const next = { ...prev }
            delete next.name
            return next
        })
    }, [])

    const handlePermissionsChange = useCallback((permissions: PermissionInput[]) => {
        setFormState((prev) => ({ ...prev, permissions }))
        setIsDirty(true)
    }, [])

    const handleSwitchChange = useCallback((_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        setFormState((prev) => ({ ...prev, isSuperuser: checked }))
        setIsDirty(true)
    }, [])

    // Validation
    const validate = useCallback((): boolean => {
        const errors: Record<string, string> = {}

        if (!formState.codename.trim()) {
            errors.codename = t('roles.validation.codenameRequired', 'Unique identifier is required')
        } else if (!/^[a-z0-9_-]+$/.test(formState.codename)) {
            errors.codename = t(
                'roles.validation.codenameFormat',
                'Unique identifier must be lowercase alphanumeric with underscores or dashes'
            )
        }

        if (!formState.name) {
            errors.name = t('roles.validation.nameRequired', 'Name is required')
        } else {
            const primaryLocale = formState.name._primary
            const primaryEntry = formState.name.locales[primaryLocale]
            if (!primaryEntry || !primaryEntry.content.trim()) {
                errors.name = t('roles.validation.primaryNameRequired', 'Primary language name is required')
            }
        }

        if (!formState.color || !/^#[0-9A-Fa-f]{6}$/.test(formState.color)) {
            errors.color = t('roles.validation.colorFormat', 'Invalid color format')
        }

        if (formState.permissions.length === 0) {
            errors.permissions = t('roles.validation.permissionsRequired', 'At least one permission is required')
        }

        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }, [formState, t])

    // Submit handler
    const handleSubmit = useCallback(async () => {
        // Skip permission validation for system roles (they can't be changed)
        if (!isSystemRole && !validate()) return
        // For system roles, only validate editable fields
        if (isSystemRole) {
            const errors: Record<string, string> = {}
            if (!formState.name) {
                errors.name = t('roles.validation.nameRequired', 'Name is required')
            } else {
                const primaryLocale = formState.name._primary
                const primaryEntry = formState.name.locales[primaryLocale]
                if (!primaryEntry || !primaryEntry.content.trim()) {
                    errors.name = t('roles.validation.primaryNameRequired', 'Primary language name is required')
                }
            }
            if (!formState.color || !/^#[0-9A-Fa-f]{6}$/.test(formState.color)) {
                errors.color = t('roles.validation.colorFormat', 'Invalid color format')
            }
            setValidationErrors(errors)
            if (Object.keys(errors).length > 0) return
        }

        // For system roles, only send allowed fields (description, name, color)
        // Do NOT send name, isSuperuser, or permissions
        const payload = isSystemRole
            ? {
                  description: formState.description || undefined,
                  name: formState.name,
                  color: formState.color
              }
            : {
                  codename: formState.codename,
                  description: formState.description || undefined,
                  name: formState.name,
                  color: formState.color,
                  isSuperuser: formState.isSuperuser,
                  permissions: formState.permissions
              }

        if (isNew) {
            createMutation.mutate(payload as CreateRolePayload)
        } else if (roleId) {
            updateMutation.mutate({ id: roleId, payload })
        }
    }, [formState, validate, isNew, isSystemRole, roleId, createMutation, updateMutation, t])

    const handleBack = useCallback(() => {
        navigate(`/admin/instance/${instanceId}/roles`)
    }, [navigate, instanceId])

    // Loading state
    if (!isNew && isLoading) {
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
    if (!isNew && isError) {
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

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={isNew ? t('roles.createTitle', 'Create New Role') : t('roles.editTitle', 'Edit Role')}
                    description={
                        isNew
                            ? t('roles.createDescription', 'Define a new role with permissions')
                            : t('roles.editDescription', { name: role ? resolveVlcContent(role.name, isSupportedLocale(currentLocale) ? currentLocale : 'en', role.codename) : '' })
                    }
                    search={false}
                />
            </Box>

            {/* Back button */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <Button startIcon={<ArrowBackRoundedIcon />} onClick={handleBack} size='small'>
                    {t('roles.backToList', 'Back to Roles')}
                </Button>
            </Box>

            {/* System role warning */}
            {isSystemRole && (
                <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                    <Alert severity='info'>
                        {t('roles.systemRoleWarning', 'This is a system role. Only description, display name, and color can be modified.')}
                    </Alert>
                </Box>
            )}

            {/* Form */}
            <MainCard sx={{ mx: { xs: 1.5, md: 2 } }}>
                <Stack spacing={3}>
                    {/* Basic Info */}
                    <Typography variant='h6'>{t('roles.section.basicInfo', 'Basic Information')}</Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label={t('roles.field.name', 'Unique Identifier') + ' *'}
                                value={formState.codename}
                                onChange={handleChange('codename')}
                                disabled={isSaving || isSystemRole}
                                error={!!validationErrors.codename}
                                helperText={
                                    validationErrors.codename ||
                                    t('roles.field.nameHint', 'Lowercase alphanumeric with underscores/dashes (e.g., new_role)')
                                }
                                required
                                placeholder='new_role'
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <ColorPicker
                                label={t('roles.field.color', 'Color')}
                                value={formState.color}
                                onChange={handleColorChange}
                                disabled={isSaving}
                                error={!!validationErrors.color}
                                helperText={validationErrors.color}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <LocalizedFieldEditor
                                value={formState.name}
                                onChange={handleNameChange}
                                label={t('roles.field.name', 'Name')}
                                disabled={isSaving}
                                error={!!validationErrors.name}
                                helperText={validationErrors.name}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <LocalizedFieldEditor
                                value={formState.description}
                                onChange={(value) => {
                                    setFormState((prev) => ({ ...prev, description: value }))
                                    setIsDirty(true)
                                }}
                                label={t('roles.field.description', 'Description')}
                                disabled={isSaving}
                                multiline
                                rows={2}
                            />
                        </Grid>
                    </Grid>

                    <Divider />

                    {/* Access Settings */}
                    <Typography variant='h6'>{t('roles.section.accessSettings', 'Access Settings')}</Typography>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={isSystemRole ? true : formState.isSuperuser}
                                onChange={handleSwitchChange}
                                disabled={isSaving || isSystemRole}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant='body1'>{t('roles.field.isSuperuser', 'Superuser Access')}</Typography>
                                <Typography variant='caption' color='text.secondary'>
                                    {t(
                                        'roles.field.isSuperuserHint',
                                        'Full platform access with permission bypass - root user. System roles have this enabled permanently'
                                    )}
                                </Typography>
                            </Box>
                        }
                    />

                    <Alert severity='info' sx={{ mt: 2 }}>
                        <Typography variant='body2'>
                            {t(
                                'roles.field.adminAccessInfo',
                                'Admin panel access is automatically granted when users have permissions for roles, instances, or users subjects (with read or wildcard action).'
                            )}
                        </Typography>
                    </Alert>

                    <Divider />

                    {/* Permissions */}
                    <Typography variant='h6'>{t('roles.section.permissions', 'Permissions')}</Typography>

                    {validationErrors.permissions && <Alert severity='error'>{validationErrors.permissions}</Alert>}

                    <PermissionMatrix
                        permissions={formState.permissions}
                        onChange={handlePermissionsChange}
                        disabled={isSaving || isSystemRole}
                        showSelectAll={true}
                    />

                    <Divider />

                    {/* Actions */}
                    <Stack direction='row' spacing={2} justifyContent='flex-end'>
                        <Button variant='outlined' onClick={handleBack} disabled={isSaving}>
                            {tc('actions.cancel')}
                        </Button>
                        <Button
                            variant='contained'
                            startIcon={isSaving ? <CircularProgress size={16} /> : <SaveRoundedIcon />}
                            onClick={handleSubmit}
                            disabled={isSaving || (!isNew && !isDirty) || !isSuperadmin}
                        >
                            {isNew ? t('roles.create', 'Create Role') : tc('actions.save')}
                        </Button>
                    </Stack>
                </Stack>
            </MainCard>
        </Stack>
    )
}

export default RoleEdit
