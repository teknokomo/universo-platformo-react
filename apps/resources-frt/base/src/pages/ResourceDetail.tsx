import React, { useEffect, useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import TreeView from '@mui/lab/TreeView'
import TreeItem from '@mui/lab/TreeItem'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import useApi from 'flowise-ui/src/hooks/useApi'
import { getResource, listRevisions, getResourceTree } from '../api/resources'

const ResourceDetail: React.FC = () => {
    const { t, i18n } = useTranslation('resources')
    const { id } = useParams<{ id: string }>()
    const [tab, setTab] = useState(0)
    const resourceApi = useApi(getResource)
    const revisionsApi = useApi(listRevisions)
    const treeApi = useApi(getResourceTree)

    useEffect(() => {
        if (id) {
            resourceApi.request(id)
            revisionsApi.request(id)
            treeApi.request(id)
        }
    }, [id, resourceApi, revisionsApi, treeApi])

    const getName = (obj: { titleEn: string; titleRu: string }) => (i18n.language === 'ru' ? obj.titleRu : obj.titleEn)

    const renderTree = (node: any): React.ReactNode => {
        if (!node) return null
        return (
            <TreeItem key={node.resource.id} nodeId={node.resource.id} label={getName(node.resource)}>
                {node.children?.map((c: any) => renderTree(c.child))}
            </TreeItem>
        )
    }

    return (
        <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label={t('detail.info')} />
                <Tab label={t('detail.revisions')} />
                <Tab label={t('detail.children')} />
            </Tabs>
            {tab === 0 && (
                <>
                    {resourceApi.loading && <Typography>{t('detail.loading')}</Typography>}
                    {resourceApi.error && <Typography color='error'>{t('detail.error')}</Typography>}
                    {resourceApi.data && <Typography variant='body1'>{getName(resourceApi.data as any)}</Typography>}
                </>
            )}
            {tab === 1 && (
                <>
                    {revisionsApi.loading && <Typography>{t('revisions.loading')}</Typography>}
                    {revisionsApi.error && <Typography color='error'>{t('revisions.error')}</Typography>}
                    {revisionsApi.data && (
                        <Box>
                            {(revisionsApi.data as any[]).map((rev) => (
                                <Typography key={rev.id}>{rev.version}</Typography>
                            ))}
                        </Box>
                    )}
                </>
            )}
            {tab === 2 && (
                <>
                    {treeApi.loading && <Typography>{t('children.loading')}</Typography>}
                    {treeApi.error && <Typography color='error'>{t('children.error')}</Typography>}
                    {treeApi.data && <TreeView>{renderTree(treeApi.data)}</TreeView>}
                </>
            )}
        </Box>
    )
}

export default ResourceDetail
