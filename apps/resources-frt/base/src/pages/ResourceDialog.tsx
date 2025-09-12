import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useApi } from '../hooks/useApi'
import * as resourcesApi from '../api/resources'
import * as clustersApi from '../api/clusters'
import * as domainsApi from '../api/domains'
import { Domain, Resource } from '../types'

interface ResourceDialogProps {
    open: boolean
    onClose: () => void
    onSave: () => void
    clusterId?: string
    resource?: Resource | null
    defaultDomainId?: string
}

const ResourceDialog: React.FC<ResourceDialogProps> = ({ open, onClose, onSave, clusterId, resource, defaultDomainId }) => {
    const { t } = useTranslation('resources')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [selectedDomainId, setSelectedDomainId] = useState<string>('')

    const { request: createResource, loading: creating } = useApi(resourcesApi.createResource)
    const { request: updateResource, loading: updating } = useApi(resourcesApi.updateResource)
    const { data: globalDomainsData, request: listDomains, loading: loadingGlobalDomains } = useApi(domainsApi.listDomains)
    const { data: clusterDomainsData, request: getClusterDomains, loading: loadingClusterDomains } = useApi(clustersApi.getClusterDomains)
    const { request: assignResourceToDomain } = useApi(domainsApi.assignResourceToDomain as unknown as (resourceId: string, domainId: string) => Promise<any>)

    // Use cluster domains if in cluster context, otherwise global domains
    const domainsData = clusterId ? clusterDomainsData : globalDomainsData
    const loadingDomains = clusterId ? loadingClusterDomains : loadingGlobalDomains

    useEffect(() => {
        if (resource) {
            setName(resource.name)
            setDescription(resource.description || '')
        } else {
            setName('')
            setDescription('')
            setSelectedDomainId(defaultDomainId || '')
        }
        // Load domains when dialog opens
        if (open) {
            if (clusterId) {
                getClusterDomains(clusterId).catch((e) => console.error('Failed to load cluster domains', e))
            } else {
                listDomains().catch((e) => console.error('Failed to load domains', e))
            }
        }
    }, [resource, open, listDomains, getClusterDomains, clusterId, defaultDomainId])

    const handleSave = async () => {
        // Validate required fields
        if (!(name || '').trim()) {
            console.error('Name is required')
            return
        }
        if (!selectedDomainId) {
            console.error('Domain selection is required')
            return
        }

        try {
            const savedResource = resource
                ? await updateResource(resource.id, { name: (name || '').trim(), description: (description || '').trim() || undefined })
                : await createResource({ name: (name || '').trim(), description: (description || '').trim() || undefined, clusterId: clusterId, domainId: selectedDomainId })

            if (savedResource) {
                const resId = (savedResource as Resource).id
                // Linking to cluster is handled atomically by backend when clusterId is provided on creation.
                // Domain assignment is now handled atomically on backend during resource creation
                // For existing resources being edited, we still need to handle domain assignment
                if (resource && selectedDomainId) {
                    try {
                        await assignResourceToDomain(resId, selectedDomainId)
                    } catch (e) {
                        console.error('Failed to assign resource to domain', e)
                        return // Don't close dialog if domain assignment fails
                    }
                }
                onSave()
                onClose()
            }
        } catch (error) {
            console.error('Failed to save resource', error)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
            <DialogTitle>{resource ? t('resources.dialog.editTitle') : t('resources.dialog.createTitle')}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin='dense'
                    label={t('resources.name')}
                    type='text'
                    fullWidth
                    variant='outlined'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mb: 2 }}
                />

                <FormControl fullWidth margin='dense' sx={{ mb: 2 }} required>
                    <InputLabel id='resource-domain-label'>{t('resources.dialog.domain')}</InputLabel>
                    <Select
                        labelId='resource-domain-label'
                        label={t('resources.dialog.domain')}
                        value={selectedDomainId}
                        onChange={(e) => setSelectedDomainId(e.target.value as string)}
                        disabled={loadingDomains}
                        required
                        error={!selectedDomainId}
                    >
                        {(domainsData as Domain[] | null)?.map((d) => (
                            <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    margin='dense'
                    label={t('resources.description')}
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
                <Button onClick={handleSave} variant='contained' disabled={creating || updating || !(name || '').trim() || !selectedDomainId}>
                    {t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ResourceDialog
