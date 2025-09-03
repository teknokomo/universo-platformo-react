import React, { useEffect, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import ResourceConfigTree, { ResourceNode } from '../components/ResourceConfigTree'
import { createResource, listCategories, listStates, listStorageTypes } from '../api/resources'
import { Category, State, StorageType } from '../types'

interface ResourceDialogProps {
    open: boolean
    onClose: () => void
}

const ResourceDialog: React.FC<ResourceDialogProps> = ({ open, onClose }) => {
    const { t } = useTranslation('resources')
    const [titleEn, setTitleEn] = useState('')
    const [titleRu, setTitleRu] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [stateId, setStateId] = useState('')
    const [storageTypeId, setStorageTypeId] = useState('')
    const [description, setDescription] = useState('')
    const [nodes, setNodes] = useState<ResourceNode[]>([])
    const [errors, setErrors] = useState<Record<string, boolean>>({})

    const createApi = useApi(createResource)
    const categoriesApi = useApi(listCategories)
    const statesApi = useApi(listStates)
    const storageTypesApi = useApi(listStorageTypes)

    useEffect(() => {
        if (open) {
            categoriesApi.request()
            statesApi.request()
            storageTypesApi.request()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const handleSave = async () => {
        const errs: Record<string, boolean> = {}
        if (!titleEn) errs.titleEn = true
        if (!titleRu) errs.titleRu = true
        if (!categoryId) errs.categoryId = true
        if (!stateId) errs.stateId = true
        if (!storageTypeId) errs.storageTypeId = true
        setErrors(errs)
        if (Object.keys(errs).length > 0) return

        const serialize = (list: ResourceNode[]): any[] => list.map((n) => ({ id: n.resourceId, children: serialize(n.children) }))
        await createApi.request({
            titleEn,
            titleRu,
            categoryId,
            stateId,
            storageTypeId,
            descriptionEn: description,
            descriptionRu: description,
            tree: serialize(nodes)
        })
        if (!createApi.error) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {createApi.error && (
                    <Alert severity='error'>{String((createApi.error as any)?.response?.data?.error || createApi.error)}</Alert>
                )}
                <TextField
                    label={t('dialog.titleEn')}
                    fullWidth
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    error={!!errors.titleEn}
                    helperText={errors.titleEn && t('dialog.required')}
                />
                <TextField
                    label={t('dialog.titleRu')}
                    fullWidth
                    value={titleRu}
                    onChange={(e) => setTitleRu(e.target.value)}
                    error={!!errors.titleRu}
                    helperText={errors.titleRu && t('dialog.required')}
                />
                <TextField
                    select
                    label={t('dialog.category')}
                    fullWidth
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    error={!!errors.categoryId}
                    helperText={errors.categoryId && t('dialog.required')}
                >
                    {(categoriesApi.data as Category[] | null)?.map((c: Category) => (
                        <MenuItem key={c.id} value={c.id}>
                            {c.titleEn}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label={t('dialog.state')}
                    fullWidth
                    value={stateId}
                    onChange={(e) => setStateId(e.target.value)}
                    error={!!errors.stateId}
                    helperText={errors.stateId && t('dialog.required')}
                >
                    {(statesApi.data as State[] | null)?.map((s: State) => (
                        <MenuItem key={s.id} value={s.id}>
                            {s.label}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    label={t('dialog.storageType')}
                    fullWidth
                    value={storageTypeId}
                    onChange={(e) => setStorageTypeId(e.target.value)}
                    error={!!errors.storageTypeId}
                    helperText={errors.storageTypeId && t('dialog.required')}
                >
                    {(storageTypesApi.data as StorageType[] | null)?.map((s: StorageType) => (
                        <MenuItem key={s.id} value={s.id}>
                            {s.label}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    label={t('dialog.description')}
                    fullWidth
                    multiline
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <ResourceConfigTree nodes={nodes} onChange={setNodes} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('dialog.cancel')}</Button>
                <Button variant='contained' onClick={handleSave} disabled={createApi.loading}>
                    {t('dialog.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ResourceDialog
