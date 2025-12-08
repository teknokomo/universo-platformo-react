import { useCallback, useMemo } from 'react'
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Typography,
    Paper,
    Tooltip,
    FormControlLabel,
    Switch,
    Chip
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { PERMISSION_MODULES, PERMISSION_ACTIONS, type PermissionModule, type PermissionAction, type PermissionInput } from '@universo/types'

interface PermissionMatrixProps {
    permissions: PermissionInput[]
    onChange: (permissions: PermissionInput[]) => void
    disabled?: boolean
    /**
     * If true, shows a "Select All" toggle that sets all permissions
     */
    showSelectAll?: boolean
}

/**
 * Helper to check if a permission exists for a module/action
 */
function hasPermission(permissions: PermissionInput[], module: PermissionModule, action: PermissionAction): boolean {
    return permissions.some((p) => (p.module === module || p.module === '*') && (p.action === action || p.action === '*'))
}

/**
 * Helper to check if all permissions are set (*)
 */
function hasAllPermissions(permissions: PermissionInput[]): boolean {
    return permissions.some((p) => p.module === '*' && p.action === '*')
}

/**
 * Helper to check if a module has all actions
 */
function hasAllActionsForModule(permissions: PermissionInput[], module: PermissionModule): boolean {
    return permissions.some((p) => (p.module === module || p.module === '*') && p.action === '*')
}

/**
 * Helper to check if an action is set for all modules
 */
function hasActionForAllModules(permissions: PermissionInput[], action: PermissionAction): boolean {
    return permissions.some((p) => p.module === '*' && (p.action === action || p.action === '*'))
}

/**
 * Permission Matrix component for editing role permissions
 * Displays modules as rows and actions as columns
 */
export function PermissionMatrix({ permissions, onChange, disabled = false, showSelectAll = true }: PermissionMatrixProps) {
    const { t } = useTranslation('admin')

    const allSelected = useMemo(() => hasAllPermissions(permissions), [permissions])

    /**
     * Toggle a single permission
     */
    const togglePermission = useCallback(
        (module: PermissionModule, action: PermissionAction) => {
            if (disabled) return

            const exists = permissions.some((p) => p.module === module && p.action === action)

            if (exists) {
                // Remove the permission
                const newPermissions = permissions.filter((p) => !(p.module === module && p.action === action))
                onChange(newPermissions)
            } else {
                // Add the permission
                const newPermissions = [...permissions.filter((p) => !(p.module === module && p.action === action)), { module, action }]
                onChange(newPermissions)
            }
        },
        [permissions, onChange, disabled]
    )

    /**
     * Toggle all actions for a module
     */
    const toggleModuleAll = useCallback(
        (module: PermissionModule) => {
            if (disabled) return

            const hasAll = hasAllActionsForModule(permissions, module)

            if (hasAll) {
                // Remove all permissions for this module
                const newPermissions = permissions.filter((p) => p.module !== module && !(p.module === '*' && p.action === '*'))
                // If we had *, we need to add back all other modules
                if (permissions.some((p) => p.module === '*')) {
                    PERMISSION_MODULES.filter((m) => m !== module).forEach((m) => {
                        if (!newPermissions.some((p) => p.module === m && p.action === '*')) {
                            newPermissions.push({ module: m, action: '*' })
                        }
                    })
                }
                onChange(newPermissions)
            } else {
                // Set all actions for this module (using *)
                const newPermissions = permissions.filter((p) => p.module !== module)
                newPermissions.push({ module, action: '*' })
                onChange(newPermissions)
            }
        },
        [permissions, onChange, disabled]
    )

    /**
     * Toggle an action for all modules
     */
    const toggleActionAll = useCallback(
        (action: PermissionAction) => {
            if (disabled) return

            const hasAll = hasActionForAllModules(permissions, action)

            if (hasAll) {
                // Remove this action for all modules
                const newPermissions = permissions.filter((p) => p.action !== action && p.action !== '*')
                // If we had action=*, add back other actions for each module
                if (permissions.some((p) => p.action === '*')) {
                    PERMISSION_MODULES.forEach((m) => {
                        PERMISSION_ACTIONS.filter((a) => a !== action).forEach((a) => {
                            if (!newPermissions.some((p) => p.module === m && p.action === a)) {
                                newPermissions.push({ module: m, action: a })
                            }
                        })
                    })
                }
                onChange(newPermissions)
            } else {
                // Set this action for all modules
                const newPermissions = permissions.filter((p) => p.action !== action)
                newPermissions.push({ module: '*', action })
                onChange(newPermissions)
            }
        },
        [permissions, onChange, disabled]
    )

    /**
     * Toggle all permissions
     */
    const toggleAll = useCallback(() => {
        if (disabled) return

        if (allSelected) {
            onChange([])
        } else {
            onChange([{ module: '*', action: '*' }])
        }
    }, [allSelected, onChange, disabled])

    /**
     * Get label for module
     */
    const getModuleLabel = (module: PermissionModule): string => {
        return t(`roles.permissions.modules.${module}`, { defaultValue: module })
    }

    /**
     * Get label for action
     */
    const getActionLabel = (action: PermissionAction): string => {
        return t(`roles.permissions.actions.${action}`, { defaultValue: action })
    }

    return (
        <Box>
            {showSelectAll && (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControlLabel
                        control={<Switch checked={allSelected} onChange={toggleAll} disabled={disabled} color='primary' />}
                        label={
                            <Typography variant='body2' fontWeight='medium'>
                                {t('roles.permissions.selectAll', 'Grant all permissions')}
                            </Typography>
                        }
                    />
                    {allSelected && <Chip label={t('roles.permissions.fullAccess', 'Full Access')} color='warning' size='small' />}
                </Box>
            )}

            <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>{t('roles.permissions.module', 'Module')}</TableCell>
                            {PERMISSION_ACTIONS.map((action) => (
                                <TableCell key={action} align='center' sx={{ fontWeight: 'bold', minWidth: 80 }}>
                                    <Tooltip title={t('roles.permissions.toggleColumnHint', 'Click to toggle all')}>
                                        <Box
                                            onClick={() => toggleActionAll(action)}
                                            sx={{
                                                cursor: disabled ? 'default' : 'pointer',
                                                '&:hover': {
                                                    color: disabled ? 'inherit' : 'primary.main'
                                                }
                                            }}
                                        >
                                            {getActionLabel(action)}
                                        </Box>
                                    </Tooltip>
                                </TableCell>
                            ))}
                            <TableCell align='center' sx={{ fontWeight: 'bold', minWidth: 80 }}>
                                <Tooltip title={t('roles.permissions.allActionsHint', 'All actions for module')}>
                                    <span>*</span>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {PERMISSION_MODULES.map((module) => {
                            const moduleHasAll = hasAllActionsForModule(permissions, module)

                            return (
                                <TableRow
                                    key={module}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <Tooltip title={t(`roles.permissions.modules.${module}Desc`, '')}>
                                            <Typography variant='body2'>{getModuleLabel(module)}</Typography>
                                        </Tooltip>
                                    </TableCell>
                                    {PERMISSION_ACTIONS.map((action) => {
                                        const checked = allSelected || moduleHasAll || hasPermission(permissions, module, action)

                                        return (
                                            <TableCell key={action} align='center'>
                                                <Checkbox
                                                    checked={checked}
                                                    onChange={() => togglePermission(module, action)}
                                                    disabled={disabled || allSelected || moduleHasAll}
                                                    size='small'
                                                />
                                            </TableCell>
                                        )
                                    })}
                                    <TableCell align='center'>
                                        <Checkbox
                                            checked={allSelected || moduleHasAll}
                                            onChange={() => toggleModuleAll(module)}
                                            disabled={disabled || allSelected}
                                            size='small'
                                            color='secondary'
                                        />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
                {t('roles.permissions.hint', 'Check individual cells or use row/column headers for bulk selection. "*" means all actions.')}
            </Typography>
        </Box>
    )
}

export default PermissionMatrix
