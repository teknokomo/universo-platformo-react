import React, { useState, useEffect } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, MenuItem, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { listEntities, listTemplates } from '../api/entities'

interface Entity {
    id: string
    name: string
    template: string
    status: string
}

const statuses = ['Active', 'Archived']

const EntityList: React.FC = () => {
    const { t } = useTranslation('entities')
    const [search, setSearch] = useState('')
    const [template, setTemplate] = useState('')
    const [status, setStatus] = useState('')
    const [entities, setEntities] = useState<Entity[]>([])
    const [templates, setTemplates] = useState<string[]>([])

    const entitiesApi = useApi(listEntities)
    const templatesApi = useApi(listTemplates)

    useEffect(() => {
        entitiesApi.request()
        templatesApi.request()
    }, [entitiesApi, templatesApi])

    useEffect(() => {
        if (entitiesApi.data) setEntities(entitiesApi.data)
    }, [entitiesApi.data])

    useEffect(() => {
        if (templatesApi.data) setTemplates((templatesApi.data as any).map((t: any) => t.name))
    }, [templatesApi.data])

    const filtered = entities.filter((e) => {
        const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.id.includes(search)
        const matchTemplate = template ? e.template === template : true
        const matchStatus = status ? e.status === status : true
        return matchSearch && matchTemplate && matchStatus
    })

    if (entitiesApi.loading) return <Typography>{t('list.loading')}</Typography>
    if (entitiesApi.error) return <Typography color='error'>{t('list.error')}</Typography>

    return (
        <Box display='flex' flexDirection='column' gap={2}>
            <Box display='flex' gap={2}>
                <TextField label={t('list.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
                <TextField select label={t('list.template')} value={template} onChange={(e) => setTemplate(e.target.value)}>
                    <MenuItem value=''>{t('list.all')}</MenuItem>
                    {templates.map((tName) => (
                        <MenuItem key={tName} value={tName}>
                            {tName}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField select label={t('list.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
                    <MenuItem value=''>{t('list.all')}</MenuItem>
                    {statuses.map((s) => (
                        <MenuItem key={s} value={s}>
                            {s}
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
                                <TableCell>{e.name}</TableCell>
                                <TableCell>{e.template}</TableCell>
                                <TableCell>{e.status}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    )
}

export default EntityList
