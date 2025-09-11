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
import * as clustersApi from '../api/clusters'
import { Cluster } from '../types'

interface ClusterDialogProps {
    open: boolean
    onClose: () => void
    onSave: () => void
    cluster?: Cluster | null
}

const ClusterDialog: React.FC<ClusterDialogProps> = ({ open, onClose, onSave, cluster }) => {
    const { t } = useTranslation('resources')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isLoading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { request: createCluster } = useApi(clustersApi.createCluster)
    const { request: updateCluster } = useApi(clustersApi.updateCluster)

    useEffect(() => {
        if (cluster) {
            setName(cluster.name)
            setDescription(cluster.description || '')
        } else {
            setName('')
            setDescription('')
        }
        setError(null)
    }, [cluster, open])

    const handleSave = async () => {
        if (!(name || '').trim()) {
            setError(t('clusters.nameRequired', 'Name is required'))
            return
        }

        try {
            setLoading(true)
            setError(null)

            if (cluster) {
                await updateCluster(cluster.id, { name: (name || '').trim(), description: (description || '').trim() || undefined })
            } else {
                await createCluster({ name: (name || '').trim(), description: (description || '').trim() || undefined })
            }

            onSave()
        } catch (err: any) {
            setError(err.message || t('clusters.saveError', 'Failed to save cluster'))
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
                {cluster ? t('clusters.editCluster', 'Edit Cluster') : t('clusters.createCluster', 'Create Cluster')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label={t('clusters.name', 'Name')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                        error={!!error && !(name || '').trim()}
                        helperText={error && !(name || '').trim() ? error : ''}
                    />
                    <TextField
                        label={t('clusters.description', 'Description')}
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

export default ClusterDialog
