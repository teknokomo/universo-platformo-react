import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Switch,
    Tab,
    Tabs,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent, filterLocalizedContent } from '@universo/utils'
import { CodenameField, LocalizedInlineField, useCodenameAutoFill } from '@universo/template-mui'
import { sanitizeCodename } from '@universo/utils/validation/codename'

import { ColorPicker } from './ColorPicker'

export interface RoleFormDialogSubmitData {
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    color: string
    copyPermissions?: boolean
    isSuperuser?: boolean
}

interface RoleFormDialogProps {
    open: boolean
    title: string
    submitLabel: string
    loading?: boolean
    error?: string | null
    initialCodename?: string
    initialName?: VersionedLocalizedContent<string> | null
    initialDescription?: VersionedLocalizedContent<string> | null
    initialColor?: string
    initialCopyPermissions?: boolean
    codenameDisabled?: boolean
    showCopyPermissions?: boolean
    showIsSuperuser?: boolean
    initialIsSuperuser?: boolean
    isSuperuserDisabled?: boolean
    onClose: () => void
    onSubmit: (data: RoleFormDialogSubmitData) => Promise<void> | void
}

const DEFAULT_COLOR = '#9e9e9e'

const createEmptyLocalizedValue = (locale: string) => createLocalizedContent(locale === 'ru' ? 'ru' : 'en', '')

const getPrimaryLocalizedValue = (value: VersionedLocalizedContent<string> | null | undefined): string => {
    const filteredValue = filterLocalizedContent(value)
    const primaryLocale = filteredValue?._primary
    const primaryEntry = primaryLocale ? filteredValue?.locales?.[primaryLocale] : null

    return typeof primaryEntry?.content === 'string' ? primaryEntry.content.trim() : ''
}

type CopyTab = 'main' | 'options'

export default function RoleFormDialog({
    open,
    title,
    submitLabel,
    loading = false,
    error = null,
    initialCodename = '',
    initialName = null,
    initialDescription = null,
    initialColor = DEFAULT_COLOR,
    initialCopyPermissions = false,
    codenameDisabled = false,
    showCopyPermissions = false,
    showIsSuperuser = false,
    initialIsSuperuser = false,
    isSuperuserDisabled = false,
    onClose,
    onSubmit
}: RoleFormDialogProps) {
    const { t, i18n } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()
    const locale = useMemo(() => i18n.language.split('-')[0] || 'en', [i18n.language])

    const [codename, setCodename] = useState(initialCodename)
    const [codenameTouched, setCodenameTouched] = useState(Boolean(initialCodename))
    const [name, setName] = useState<VersionedLocalizedContent<string> | null>(initialName ?? createEmptyLocalizedValue(locale))
    const [description, setDescription] = useState<VersionedLocalizedContent<string> | null>(initialDescription)
    const [color, setColor] = useState(initialColor)
    const [copyPermissions, setCopyPermissions] = useState(initialCopyPermissions)
    const [isSuperuser, setIsSuperuser] = useState(initialIsSuperuser)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [copyTab, setCopyTab] = useState<CopyTab>('main')

    useEffect(() => {
        if (!open) {
            return
        }

        setCodename(initialCodename)
        setCodenameTouched(Boolean(initialCodename))
        setName(initialName ?? createEmptyLocalizedValue(locale))
        setDescription(initialDescription)
        setColor(initialColor)
        setCopyPermissions(initialCopyPermissions)
        setIsSuperuser(initialIsSuperuser)
        setValidationError(null)
        setCopyTab('main')
    }, [open, initialCodename, initialName, initialDescription, initialColor, initialCopyPermissions, initialIsSuperuser, locale])

    const primaryNameValue = useMemo(() => getPrimaryLocalizedValue(name), [name])
    const nextCodename = useMemo(() => sanitizeCodename(primaryNameValue), [primaryNameValue])

    const setCodenameFieldValue = useCallback((field: 'codename' | 'codenameTouched', value: string | boolean) => {
        if (field === 'codename') {
            setCodename(String(value))
            return
        }

        setCodenameTouched(Boolean(value))
    }, [])

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue: primaryNameValue,
        setValue: setCodenameFieldValue
    })

    const validate = useCallback(() => {
        const trimmedCodename = codename.trim()

        if (!trimmedCodename) {
            setValidationError(t('roles.validation.codenameRequired', 'Code name is required'))
            return null
        }

        if (trimmedCodename.length < 2 || trimmedCodename.length > 50) {
            setValidationError(t('roles.validation.codenameLength', 'Code name must be between 2 and 50 characters'))
            return null
        }

        if (!/^[a-z][a-z0-9_-]*$/.test(trimmedCodename)) {
            setValidationError(
                t(
                    'roles.validation.codenameFormat',
                    'Code name must start with a letter, only lowercase letters, digits, underscores, or dashes'
                )
            )
            return null
        }

        const filteredName = filterLocalizedContent(name)
        const primaryLocale = filteredName?._primary
        const primaryValue = primaryLocale ? filteredName?.locales?.[primaryLocale]?.content : ''
        if (!filteredName || !String(primaryValue || '').trim()) {
            setValidationError(t('roles.validation.primaryNameRequired', 'Primary language name is required'))
            return null
        }

        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            setValidationError(t('roles.validation.colorFormat', 'Invalid color format'))
            return null
        }

        setValidationError(null)
        return {
            codename: trimmedCodename,
            name: filteredName,
            description: filterLocalizedContent(description) || undefined,
            color,
            copyPermissions: showCopyPermissions ? copyPermissions : undefined,
            isSuperuser: showIsSuperuser ? isSuperuser : undefined
        }
    }, [codename, color, copyPermissions, description, isSuperuser, name, showCopyPermissions, showIsSuperuser, t])

    const handleSubmit = useCallback(async () => {
        const payload = validate()
        if (!payload) {
            return
        }

        await onSubmit(payload)
    }, [onSubmit, validate])

    const mainFields = (
        <Stack spacing={3}>
            {(error || validationError) && (
                <Alert severity='error' onClose={() => setValidationError(null)}>
                    {validationError || error}
                </Alert>
            )}

            <LocalizedInlineField
                mode='localized'
                value={name}
                onChange={setName}
                label={t('roles.field.name', 'Name')}
                disabled={loading}
                uiLocale={i18n.language}
            />

            <LocalizedInlineField
                mode='localized'
                value={description}
                onChange={setDescription}
                label={t('roles.field.description', 'Description')}
                disabled={loading}
                uiLocale={i18n.language}
                multiline
                rows={3}
            />

            <ColorPicker
                label={t('roles.field.color', 'Color')}
                value={color}
                onChange={setColor}
                disabled={loading}
                error={Boolean(validationError && validationError === t('roles.validation.colorFormat', 'Invalid color format'))}
            />

            <Divider />

            <CodenameField
                label={t('roles.field.codename', 'Code Name')}
                value={codename}
                onChange={(value: string) => setCodename(value.trimStart())}
                touched={codenameTouched}
                onTouchedChange={setCodenameTouched}
                disabled={loading || codenameDisabled}
                helperText={t('roles.field.codenameHint', 'Lowercase alphanumeric with underscores/dashes (for example new_role)')}
                error={undefined}
                required
                localizedEnabled={false}
                localizedValue={undefined}
                onLocalizedChange={undefined}
                uiLocale={undefined}
                normalizeOnBlur={undefined}
                textFieldProps={undefined}
            />

            {showIsSuperuser && (
                <>
                    <Divider />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isSuperuser}
                                onChange={(_event, checked) => setIsSuperuser(checked)}
                                disabled={loading || isSuperuserDisabled}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant='body1'>{t('roles.field.isSuperuser', 'Superuser Access')}</Typography>
                                <Typography variant='caption' color='text.secondary'>
                                    {t('roles.field.isSuperuserHint', 'Full platform access with permission bypass - root user')}
                                </Typography>
                            </Box>
                        }
                    />
                </>
            )}
        </Stack>
    )

    const optionsTab = (
        <Stack spacing={3}>
            <FormControlLabel
                control={
                    <Checkbox checked={copyPermissions} onChange={(event) => setCopyPermissions(event.target.checked)} disabled={loading} />
                }
                label={t('roles.field.copyPermissions', 'Copy permissions from source role')}
            />
        </Stack>
    )

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth='sm' fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ mt: 1, pt: '16px !important' }}>
                {showCopyPermissions ? (
                    <>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs
                                value={copyTab}
                                onChange={(_e, v) => setCopyTab(v)}
                                textColor='primary'
                                indicatorColor='primary'
                                sx={{
                                    minHeight: 36,
                                    '& .MuiTab-root': { minHeight: 36, textTransform: 'none' }
                                }}
                            >
                                <Tab value='main' label={t('roles.copyTabs.main', 'Main')} />
                                <Tab value='options' label={t('roles.copyTabs.options', 'Options')} />
                            </Tabs>
                        </Box>
                        <Box sx={{ display: copyTab === 'main' ? 'block' : 'none' }}>{mainFields}</Box>
                        <Box sx={{ display: copyTab === 'options' ? 'block' : 'none' }}>{optionsTab}</Box>
                    </>
                ) : (
                    mainFields
                )}
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 2 }}>
                <Button onClick={onClose} disabled={loading}>
                    {tc('actions.cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant='contained'
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                    {submitLabel}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
