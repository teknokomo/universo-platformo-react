import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useApi } from '../hooks/useApi'
import * as entitiesApi from '../api/entities'
import * as metaversesApi from '../api/metaverses'
import * as sectionsApi from '../api/sections'
import { Section, Entity } from '../types'

interface EntityDialogProps {
    open: boolean
    onClose: () => void
    onSave: () => void
    metaverseId?: string
    entity?: Entity | null
    defaultSectionId?: string
}

const EntityDialog: React.FC<EntityDialogProps> = ({ open, onClose, onSave, metaverseId, entity, defaultSectionId }) => {
    const { t } = useTranslation('entities')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState<string>('')

    const { request: createEntity, loading: creating } = useApi(entitiesApi.createEntity)
    const { request: updateEntity, loading: updating } = useApi(entitiesApi.updateEntity)
    const { data: globalSectionsData, request: listSections, loading: loadingGlobalSections } = useApi(sectionsApi.listSections)
    const {
        data: metaverseSectionsData,
        request: getMetaverseSections,
        loading: loadingMetaverseSections
    } = useApi(metaversesApi.getMetaverseSections)
    const { request: assignEntityToSection } = useApi(
        sectionsApi.assignEntityToSection as unknown as (entityId: string, sectionId: string) => Promise<any>
    )

    // Use metaverse sections if in metaverse context, otherwise global sections
    const sectionsData = metaverseId ? metaverseSectionsData : globalSectionsData
    const loadingSections = metaverseId ? loadingMetaverseSections : loadingGlobalSections

    useEffect(() => {
        if (entity) {
            setName(entity.name)
            setDescription(entity.description || '')
        } else {
            setName('')
            setDescription('')
            setSelectedSectionId(defaultSectionId || '')
        }
        // Load sections when dialog opens
        if (open) {
            if (metaverseId) {
                getMetaverseSections(metaverseId).catch((e) => console.error('Failed to load metaverse sections', e))
            } else {
                listSections().catch((e) => console.error('Failed to load sections', e))
            }
        }
    }, [entity, open, listSections, getMetaverseSections, metaverseId, defaultSectionId])

    const handleSave = async () => {
        // Validate required fields
        if (!(name || '').trim()) {
            console.error('Name is required')
            return
        }
        if (!selectedSectionId) {
            console.error('Section selection is required')
            return
        }

        try {
            const savedEntity = entity
                ? await updateEntity(entity.id, { name: (name || '').trim(), description: (description || '').trim() || undefined })
                : await createEntity({
                      name: (name || '').trim(),
                      description: (description || '').trim() || undefined,
                      metaverseId: metaverseId,
                      sectionId: selectedSectionId
                  })

            if (savedEntity) {
                const resId = (savedEntity as Entity).id
                // Linking to metaverse is handled atomically by backend when metaverseId is provided on creation.
                // Section assignment is now handled atomically on backend during entity creation
                // For existing entities being edited, we still need to handle section assignment
                if (entity && selectedSectionId) {
                    try {
                        await assignEntityToSection(resId, selectedSectionId)
                    } catch (e) {
                        console.error('Failed to assign entity to section', e)
                        return // Don't close dialog if section assignment fails
                    }
                }
                onSave()
                onClose()
            }
        } catch (error) {
            console.error('Failed to save entity', error)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
            <DialogTitle>{entity ? t('entities.dialog.editTitle') : t('entities.dialog.createTitle')}</DialogTitle>
            <DialogContent>
                <TextField
                    margin='dense'
                    label={t('entities.name')}
                    type='text'
                    fullWidth
                    variant='outlined'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mb: 2 }}
                />

                <FormControl fullWidth margin='dense' sx={{ mb: 2 }} required>
                    <InputLabel id='entity-section-label'>{t('entities.dialog.section')}</InputLabel>
                    <Select
                        labelId='entity-section-label'
                        label={t('entities.dialog.section')}
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(e.target.value as string)}
                        disabled={loadingSections}
                        required
                        error={!selectedSectionId}
                    >
                        {(sectionsData as Section[] | null)?.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                                {d.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    margin='dense'
                    label={t('entities.description')}
                    type='text'
                    fullWidth
                    multiline
                    rows={4}
                    variant='outlined'
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                    onClick={handleSave}
                    variant='contained'
                    disabled={creating || updating || !(name || '').trim() || !selectedSectionId}
                >
                    {t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default EntityDialog
