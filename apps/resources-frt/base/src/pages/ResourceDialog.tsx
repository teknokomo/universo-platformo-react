import React, { useEffect, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import ResourceConfigTree, { ResourceNode } from '../components/ResourceConfigTree'
import { createResource, listCategories, listStates, listStorageTypes } from '../api/resources'
import { Category, State, StorageType } from '../types'
import { getApiErrorMessage } from '../api/utils'

interface ResourceDialogProps {
    open: boolean
    onClose: () => void
}

const ResourceDialog: React.FC<ResourceDialogProps> = ({ open, onClose }) => {
    const { t, i18n } = useTranslation('resources')
    const [titleEn, setTitleEn] = useState('')
    const [titleRu, setTitleRu] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [stateId, setStateId] = useState('')
    const [storageTypeId, setStorageTypeId] = useState('')
    const [descriptionEn, setDescriptionEn] = useState('')
    const [descriptionRu, setDescriptionRu] = useState('')
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
        const fieldsToValidate = { titleEn, titleRu, categoryId, stateId, storageTypeId }
        const errs = Object.entries(fieldsToValidate).reduce((acc, [key, value]) => {
            if (!value) acc[key] = true
            return acc
        }, {} as Record<string, boolean>)
        setErrors(errs)
        if (Object.keys(errs).length > 0) return

        const serialize = (list: ResourceNode[]): any[] => list.map((n) => ({ id: n.resourceId, children: serialize(n.children) }))
        await createApi.request({
            titleEn,
            titleRu,
            categoryId,
            stateId,
            storageTypeId,
            descriptionEn,
            descriptionRu,
            tree: serialize(nodes)
        })
        if (!createApi.error) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {createApi.error && <Alert severity='error'>{getApiErrorMessage(createApi.error)}</Alert>}
                {categoriesApi.error && <Alert severity='error'>{t('dialog.categoriesError')}</Alert>}
                {statesApi.error && <Alert severity='error'>{t('dialog.statesError')}</Alert>}
                {storageTypesApi.error && <Alert severity='error'>{t('dialog.storageTypesError')}</Alert>}
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
                            {i18n.language === 'ru' ? c.titleRu : c.titleEn}
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
                    label={t('dialog.descriptionEn')}
                    fullWidth
                    multiline
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                />
                <TextField
                    label={t('dialog.descriptionRu')}
                    fullWidth
                    multiline
                    value={descriptionRu}
                    onChange={(e) => setDescriptionRu(e.target.value)}
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
