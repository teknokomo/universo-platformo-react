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
import {
    PERMISSION_SUBJECTS,
    PERMISSION_ACTIONS,
    type PermissionSubject,
    type PermissionAction,
    type PermissionInput
} from '@universo/types'

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
 * Helper to check if a permission exists for a subject/action
 */
function hasPermission(permissions: PermissionInput[], subject: PermissionSubject, action: PermissionAction): boolean {
    return permissions.some((p) => (p.subject === subject || p.subject === '*') && (p.action === action || p.action === '*'))
}

/**
 * Helper to check if all permissions are set (*)
 */
function hasAllPermissions(permissions: PermissionInput[]): boolean {
    return permissions.some((p) => p.subject === '*' && p.action === '*')
}

/**
 * Helper to check if a subject has all actions
 */
function hasAllActionsForSubject(permissions: PermissionInput[], subject: PermissionSubject): boolean {
    return permissions.some((p) => (p.subject === subject || p.subject === '*') && p.action === '*')
}

/**
 * Helper to check if an action is set for all subjects
 */
function hasActionForAllSubjects(permissions: PermissionInput[], action: PermissionAction): boolean {
    return permissions.some((p) => p.subject === '*' && (p.action === action || p.action === '*'))
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
        (subject: PermissionSubject, action: PermissionAction) => {
            if (disabled) return

            const exists = permissions.some((p) => p.subject === subject && p.action === action)

            if (exists) {
                // Remove the permission
                const newPermissions = permissions.filter((p) => !(p.subject === subject && p.action === action))
                onChange(newPermissions)
            } else {
                // Add the permission
                const newPermissions = [...permissions.filter((p) => !(p.subject === subject && p.action === action)), { subject, action }]
                onChange(newPermissions)
            }
        },
        [permissions, onChange, disabled]
    )

    /**
     * Toggle all actions for a subject
     */
    const toggleSubjectAll = useCallback(
        (subject: PermissionSubject) => {
            if (disabled) return

            const hasAll = hasAllActionsForSubject(permissions, subject)

            if (hasAll) {
                // Remove all permissions for this subject
                const newPermissions = permissions.filter((p) => p.subject !== subject && !(p.subject === '*' && p.action === '*'))
                // If we had *, we need to add back all other subjects
                if (permissions.some((p) => p.subject === '*')) {
                    PERMISSION_SUBJECTS.filter((s) => s !== subject).forEach((s) => {
                        if (!newPermissions.some((p) => p.subject === s && p.action === '*')) {
                            newPermissions.push({ subject: s, action: '*' })
                        }
                    })
                }
                onChange(newPermissions)
            } else {
                // Set all actions for this subject (using *)
                const newPermissions = permissions.filter((p) => p.subject !== subject)
                newPermissions.push({ subject, action: '*' })
                onChange(newPermissions)
            }
        },
        [permissions, onChange, disabled]
    )

    /**
     * Toggle an action for all subjects
     */
    const toggleActionAll = useCallback(
        (action: PermissionAction) => {
            if (disabled) return

            const hasAll = hasActionForAllSubjects(permissions, action)

            if (hasAll) {
                // Remove this action for all subjects
                const newPermissions = permissions.filter((p) => p.action !== action && p.action !== '*')
                // If we had action=*, add back other actions for each subject
                if (permissions.some((p) => p.action === '*')) {
                    PERMISSION_SUBJECTS.forEach((s) => {
                        PERMISSION_ACTIONS.filter((a) => a !== action).forEach((a) => {
                            if (!newPermissions.some((p) => p.subject === s && p.action === a)) {
                                newPermissions.push({ subject: s, action: a })
                            }
                        })
                    })
                }
                onChange(newPermissions)
            } else {
                // Set this action for all subjects
                const newPermissions = permissions.filter((p) => p.action !== action)
                newPermissions.push({ subject: '*', action })
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
            onChange([{ subject: '*', action: '*' }])
        }
    }, [allSelected, onChange, disabled])

    /**
     * Get label for subject
     */
    const getSubjectLabel = (subject: PermissionSubject): string => {
        return t(`roles.permissions.subjects.${subject}`, { defaultValue: subject })
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
                            <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>{t('roles.permissions.subject', 'Subject')}</TableCell>
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
                                <Tooltip title={t('roles.permissions.allActionsHint', 'All actions for subject')}>
                                    <span>*</span>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {PERMISSION_SUBJECTS.map((subject) => {
                            const subjectHasAll = hasAllActionsForSubject(permissions, subject)

                            return (
                                <TableRow
                                    key={subject}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'action.hover'
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <Tooltip title={t(`roles.permissions.subjects.${subject}Desc`, '')}>
                                            <Typography variant='body2'>{getSubjectLabel(subject)}</Typography>
                                        </Tooltip>
                                    </TableCell>
                                    {PERMISSION_ACTIONS.map((action) => {
                                        const checked = allSelected || subjectHasAll || hasPermission(permissions, subject, action)

                                        return (
                                            <TableCell key={action} align='center'>
                                                <Checkbox
                                                    checked={checked}
                                                    onChange={() => togglePermission(subject, action)}
                                                    disabled={disabled || allSelected || subjectHasAll}
                                                    size='small'
                                                />
                                            </TableCell>
                                        )
                                    })}
                                    <TableCell align='center'>
                                        <Checkbox
                                            checked={allSelected || subjectHasAll}
                                            onChange={() => toggleSubjectAll(subject)}
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
