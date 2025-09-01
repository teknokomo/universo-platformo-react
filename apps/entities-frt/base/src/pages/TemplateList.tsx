import React, { useEffect, useState } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { listTemplates } from '../api/entities'

interface Template {
    id: string
    name: string
}

const TemplateList: React.FC = () => {
    const { t } = useTranslation('entities')
    const [templates, setTemplates] = useState<Template[]>([])
    const templatesApi = useApi(listTemplates)

    useEffect(() => {
        templatesApi.request()
    }, [templatesApi])

    useEffect(() => {
        if (templatesApi.data) setTemplates(templatesApi.data)
    }, [templatesApi.data])

    if (templatesApi.loading) return <Typography>{t('templates.list.loading')}</Typography>
    if (templatesApi.error) return <Typography color='error'>{t('templates.list.error')}</Typography>

    return (
        <Box>
            <Paper>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('templates.list.id')}</TableCell>
                            <TableCell>{t('templates.list.name')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {templates.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell>{t.id}</TableCell>
                                <TableCell>{t.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    )
}

export default TemplateList
