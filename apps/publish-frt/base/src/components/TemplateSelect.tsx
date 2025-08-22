// Universo Platformo | Template Select Component
// Material-UI component for selecting export templates

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FormControl, InputLabel, Select, MenuItem, FormHelperText, Box, Chip } from '@mui/material'
import { TemplateRegistry, type TemplateInfo } from '../builders'

interface TemplateSelectProps {
    selectedTemplate: string
    onTemplateChange: (templateId: string) => void
    disabled?: boolean
    className?: string
    technology?: string
}

export const TemplateSelect: React.FC<TemplateSelectProps> = ({
    selectedTemplate,
    onTemplateChange,
    disabled = false,
    className = '',
    technology
}) => {
    const allTemplates = TemplateRegistry.getTemplates()

    // Filter templates by technology if specified
    const templates = technology ? allTemplates.filter((template) => template.technology === technology) : allTemplates

    // Get all required i18n namespaces from templates
    const requiredNamespaces = React.useMemo(() => {
        const namespaces = new Set(['publish'])
        templates.forEach(t => {
            if (t.i18nNamespace) {
                namespaces.add(t.i18nNamespace)
            }
        })
        return Array.from(namespaces)
    }, [templates])

    const { t } = useTranslation(requiredNamespaces)

    // Resolve translation key with optional namespace prefix stripping
    const resolveT = (key: string, ns?: string) => {
        if (ns && key?.startsWith(ns + '.')) {
            const localKey = key.slice(ns.length + 1)
            return t(localKey, { ns })
        }
        return t(key)
    }

    // Auto-select first template if none selected and templates are available
    React.useEffect(() => {
        if (!selectedTemplate && templates.length > 0) {
            onTemplateChange(templates[0].id)
        }
    }, [selectedTemplate, templates, onTemplateChange])

    const handleTemplateChange = (event: any) => {
        onTemplateChange(event.target.value as string)
    }

    // Use first template as fallback if selectedTemplate is empty
    const effectiveSelectedTemplate = selectedTemplate || (templates.length > 0 ? templates[0].id : '')
    const selectedTemplateInfo = templates.find((t) => t.id === effectiveSelectedTemplate)

    return (
        <FormControl fullWidth variant='outlined' margin='normal' disabled={disabled} className={className} sx={{ minWidth: 200 }}>
            <InputLabel id='template-select-label'>{t('templates.label')}</InputLabel>
            <Select
                labelId='template-select-label'
                id='template-select'
                value={effectiveSelectedTemplate}
                label={t('templates.label')}
                onChange={handleTemplateChange}
                disabled={disabled}
            >
                {templates.length === 0 ? (
                    <MenuItem disabled>{t('templates.noTemplatesFound')}</MenuItem>
                ) : (
                    templates.map((template: TemplateInfo) => (
                        <MenuItem key={template.id} value={template.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {resolveT(template.name as unknown as string, (template as any).i18nNamespace)}
                                <Chip
                                    label={t('templates.version', { version: template.version })}
                                    size='small'
                                    variant='outlined'
                                    sx={{ height: 20 }}
                                />
                            </Box>
                        </MenuItem>
                    ))
                )}
            </Select>
            {/* Template description */}
            {selectedTemplateInfo && selectedTemplateInfo.description && (
                <FormHelperText>
                    {resolveT(selectedTemplateInfo.description as unknown as string, (selectedTemplateInfo as any).i18nNamespace)}
                </FormHelperText>
            )}
        </FormControl>
    )
}

export default TemplateSelect
