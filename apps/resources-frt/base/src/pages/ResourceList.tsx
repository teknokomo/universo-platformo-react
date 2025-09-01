import React, { useEffect, useState } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import TreeView from '@mui/lab/TreeView'
import TreeItem from '@mui/lab/TreeItem'
import { useTranslation } from 'react-i18next'
import useApi from 'flowise-ui/src/hooks/useApi'
import { listCategories, listResources } from '../api/resources'

interface Category {
    id: string
    titleEn: string
    titleRu: string
    parentCategory?: { id: string }
    children?: Category[]
}

interface Resource {
    id: string
    titleEn: string
    titleRu: string
    category?: { id: string }
}

const buildTree = (cats: Category[]): Category[] => {
    const map: Record<string, Category> = {}
    cats.forEach((c) => (map[c.id] = { ...c, children: [] }))
    const roots: Category[] = []
    cats.forEach((c) => {
        if (c.parentCategory && map[c.parentCategory.id]) {
            map[c.parentCategory.id].children!.push(map[c.id])
        } else {
            roots.push(map[c.id])
        }
    })
    return roots
}

const ResourceList: React.FC = () => {
    const { t, i18n } = useTranslation('resources')
    const [selected, setSelected] = useState<string | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [resources, setResources] = useState<Resource[]>([])
    const categoriesApi = useApi(listCategories)
    const resourcesApi = useApi(listResources)

    useEffect(() => {
        categoriesApi.request()
        resourcesApi.request()
    }, [categoriesApi, resourcesApi])

    useEffect(() => {
        if (categoriesApi.data) setCategories(buildTree(categoriesApi.data as any))
    }, [categoriesApi.data])

    useEffect(() => {
        if (resourcesApi.data) setResources(resourcesApi.data as any)
    }, [resourcesApi.data])

    const getName = (obj: { titleEn: string; titleRu: string }) => (i18n.language === 'ru' ? obj.titleRu : obj.titleEn)

    const renderTree = (node: Category): React.ReactNode => (
        <TreeItem key={node.id} nodeId={node.id} label={getName(node)}>
            {node.children?.map((c) => renderTree(c))}
        </TreeItem>
    )

    const filtered = selected ? resources.filter((r) => r.category?.id === selected) : resources

    if (categoriesApi.loading || resourcesApi.loading) return <Typography>{t('list.loading')}</Typography>
    if (categoriesApi.error || resourcesApi.error) return <Typography color='error'>{t('list.error')}</Typography>

    return (
        <Box display='flex' gap={2}>
            <TreeView selected={selected} onNodeSelect={(_: React.SyntheticEvent, nodeId: string) => setSelected(nodeId)}>
                {categories.map((c) => renderTree(c))}
            </TreeView>
            <Paper sx={{ flex: 1 }}>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('list.id')}</TableCell>
                            <TableCell>{t('list.name')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>{r.id}</TableCell>
                                <TableCell>{getName(r)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    )
}

export default ResourceList
