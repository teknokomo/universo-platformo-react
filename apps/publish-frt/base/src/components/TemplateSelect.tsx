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
    const { t } = useTranslation('publish')
    const allTemplates = TemplateRegistry.getTemplates()

    // Filter templates by technology if specified
    const templates = technology ? allTemplates.filter((template) => template.technology === technology) : allTemplates

    const handleTemplateChange = (event: any) => {
        onTemplateChange(event.target.value as string)
    }

    const selectedTemplateInfo = templates.find((t) => t.id === selectedTemplate)

    return (
        <FormControl fullWidth variant='outlined' margin='normal' disabled={disabled} className={className} sx={{ minWidth: 200 }}>
            <InputLabel id='template-select-label'>{t('templates.label')}</InputLabel>
            <Select
                labelId='template-select-label'
                id='template-select'
                value={selectedTemplate}
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
                                {t(template.name)}
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
                <FormHelperText>{t(selectedTemplateInfo.description)}</FormHelperText>
            )}
        </FormControl>
    )
}

export default TemplateSelect
