import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import * as domainsApi from '../api/domains'
import { Domain } from '../types'

interface DomainDialogProps {
    open: boolean
    onClose: () => void
    onSave: () => void
    domain?: Domain | null
    clusterId?: string
}

const DomainDialog: React.FC<DomainDialogProps> = ({ open, onClose, onSave, domain, clusterId }) => {
    const { t } = useTranslation('resources')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isLoading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { request: createDomain } = useApi(domainsApi.createDomain)
    const { request: updateDomain } = useApi(domainsApi.updateDomain)

    useEffect(() => {
        if (domain) {
            setName(domain.name)
            setDescription(domain.description || '')
        } else {
            setName('')
            setDescription('')
        }
        setError(null)
    }, [domain, open])

    const handleSave = async () => {
        if (!(name || '').trim()) {
            setError(t('domains.nameRequired', 'Name is required'))
            return
        }

        // Validate cluster context for new domains
        if (!domain && !clusterId) {
            setError(t('domains.clusterRequired', 'Cluster context is required for creating domains'))
            return
        }

        try {
            setLoading(true)
            setError(null)

            if (domain) {
                await updateDomain(domain.id, { name: (name || '').trim(), description: (description || '').trim() || undefined })
            } else {
                // Domain-cluster link is now created atomically on backend
                await createDomain({ name: (name || '').trim(), description: (description || '').trim() || undefined, clusterId: clusterId! })
            }

            onSave()
        } catch (err: any) {
            setError(err.message || t('domains.saveError', 'Failed to save domain'))
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setName('')
        setDescription('')
        setError(null)
        onClose()
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {domain ? t('domains.editDomain', 'Edit Domain') : t('domains.createDomain', 'Create Domain')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label={t('domains.name', 'Name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                        error={!!error && !(name || '').trim()}
                        helperText={error && !(name || '').trim() ? error : ''}
                    />
                    <TextField
                        label={t('domains.description', 'Description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                    />
                    {error && (name || '').trim() && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isLoading}>
                    {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                    onClick={handleSave} 
                    variant="contained" 
                    disabled={isLoading || !(name || '').trim()}
                >
                    {isLoading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default DomainDialog
