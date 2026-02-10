import { useEffect } from 'react'
import { Box, FormControl, InputLabel, Select, MenuItem, Typography, Chip, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { getVLCString } from '../../../types'
import { useTemplates } from '../../templates/hooks'

interface TemplateSelectorProps {
    value: string | undefined
    onChange: (templateId: string | undefined) => void
    disabled?: boolean
    /** When true, auto-select the default (first system) template if value is empty */
    autoSelectDefault?: boolean
}

/**
 * Template selector dropdown for metahub creation/edit dialog.
 * Fetches templates via TanStack Query and displays them as a select input.
 */
export function TemplateSelector({ value, onChange, disabled, autoSelectDefault }: TemplateSelectorProps) {
    const { t, i18n } = useTranslation('metahubs')
    const { data: templates, isLoading, isError } = useTemplates()
    const locale = i18n.language?.split('-')[0] || 'en'

    // Auto-select default template (first system template) when no value is set
    useEffect(() => {
        if (autoSelectDefault && !value && templates && templates.length > 0) {
            const systemTemplate = templates.find((tmpl) => tmpl.isSystem)
            const defaultTemplate = systemTemplate || templates[0]
            onChange(defaultTemplate.id)
        }
    }, [autoSelectDefault, value, templates, onChange])

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                    {t('templates.loading', 'Loading templates...')}
                </Typography>
            </Box>
        )
    }

    if (isError || !templates || templates.length === 0) {
        return null // No templates available — hide selector
    }

    return (
        <FormControl fullWidth>
            <InputLabel id="template-selector-label">{t('templates.selectTemplate', 'Select template')}</InputLabel>
            <Select
                labelId="template-selector-label"
                value={value ?? ''}
                label={t('templates.selectTemplate', 'Select template')}
                onChange={(e) => onChange(e.target.value || undefined)}
                disabled={disabled}
            >
                {templates.map((tmpl) => {
                    const name = getVLCString(tmpl.name, locale) || tmpl.codename
                    const desc = tmpl.description ? getVLCString(tmpl.description, locale) : undefined
                    const versionLabel = tmpl.activeVersion?.versionLabel
                    const nameWithVersion = versionLabel ? `${name} (v.${versionLabel})` : name

                    return (
                        <MenuItem key={tmpl.id} value={tmpl.id}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="body2">{nameWithVersion}</Typography>
                                    {tmpl.isSystem && (
                                        <Chip
                                            label={t('templates.systemTemplate', 'System')}
                                            size="small"
                                            color="info"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>
                                {desc && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        noWrap
                                        sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                    >
                                        {desc}
                                    </Typography>
                                )}
                            </Box>
                        </MenuItem>
                    )
                })}
            </Select>
        </FormControl>
    )
}
