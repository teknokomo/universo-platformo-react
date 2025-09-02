import React, { useState, useEffect } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, MenuItem, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { listEntities, listTemplates, listStatuses } from '../api/entities'
import { Entity, Template, Status, UseApi } from '../types'

const EntityList: React.FC = () => {
    const { t } = useTranslation('entities')
    const [search, setSearch] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [statusId, setStatusId] = useState('')
    const [entities, setEntities] = useState<Entity[]>([])
    const [templates, setTemplates] = useState<Template[]>([])
    const [statuses, setStatuses] = useState<Status[]>([])

    const useTypedApi = useApi as UseApi
    const entitiesApi = useTypedApi<Entity[]>(listEntities)
    const templatesApi = useTypedApi<Template[]>(listTemplates)
    const statusesApi = useTypedApi<Status[]>(listStatuses)

    useEffect(() => {
        entitiesApi.request()
        templatesApi.request()
        statusesApi.request()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (entitiesApi.data) setEntities(entitiesApi.data)
    }, [entitiesApi.data])

    useEffect(() => {
        if (templatesApi.data) setTemplates(templatesApi.data)
    }, [templatesApi.data])

    useEffect(() => {
        if (statusesApi.data) setStatuses(statusesApi.data)
    }, [statusesApi.data])

    const filtered = entities.filter((e) => {
        const matchSearch =
            e.titleEn.toLowerCase().includes(search.toLowerCase()) ||
            e.titleRu.toLowerCase().includes(search.toLowerCase()) ||
            e.id.includes(search)
        const matchTemplate = templateId ? e.templateId === templateId : true
        const matchStatus = statusId ? e.statusId === statusId : true
        return matchSearch && matchTemplate && matchStatus
    })

    if (entitiesApi.loading) return <Typography>{t('list.loading')}</Typography>
    if (entitiesApi.error) return <Typography color='error'>{t('list.error')}</Typography>

    return (
        <Box display='flex' flexDirection='column' gap={2}>
            <Box display='flex' gap={2}>
                <TextField label={t('list.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
                <TextField select label={t('list.template')} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <MenuItem value=''>{t('list.all')}</MenuItem>
                    {templates.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                            {t.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField select label={t('list.status')} value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                    <MenuItem value=''>{t('list.all')}</MenuItem>
                    {statuses.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                            {s.name}
                        </MenuItem>
                    ))}
                </TextField>
            </Box>
            <Paper>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('list.id')}</TableCell>
                            <TableCell>{t('list.name')}</TableCell>
                            <TableCell>{t('list.template')}</TableCell>
                            <TableCell>{t('list.status')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((e) => (
                            <TableRow key={e.id}>
                                <TableCell>{e.id}</TableCell>
                                <TableCell>{e.titleEn}</TableCell>
                                <TableCell>{templates.find((t) => t.id === e.templateId)?.name}</TableCell>
                                <TableCell>{statuses.find((s) => s.id === e.statusId)?.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    )
}

export default EntityList
