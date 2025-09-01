import React, { useEffect, useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import TreeView from '@mui/lab/TreeView'
import TreeItem from '@mui/lab/TreeItem'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import useApi from 'flowise-ui/src/hooks/useApi'
import { getResource, listRevisions, getResourceTree } from '../api/resources'
import { Resource, Revision, TreeNode, UseApi } from '../types'

const ResourceDetail: React.FC = () => {
    const { t, i18n } = useTranslation('resources')
    const { id } = useParams<{ id: string }>()
    const [tab, setTab] = useState(0)
    const useTypedApi = useApi as UseApi
    const resourceApi = useTypedApi<Resource>(getResource)
    const revisionsApi = useTypedApi<Revision[]>(listRevisions)
    const treeApi = useTypedApi<TreeNode>(getResourceTree)

    useEffect(() => {
        if (id) {
            resourceApi.request(id)
            revisionsApi.request(id)
            treeApi.request(id)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const getName = (obj: { titleEn: string; titleRu: string }) => (i18n.language === 'ru' ? obj.titleRu : obj.titleEn)

    const renderTree = (node: TreeNode): React.ReactNode => (
        <TreeItem key={node.resource.id} nodeId={node.resource.id} label={getName(node.resource)}>
            {node.children?.map((c) => renderTree(c.child))}
        </TreeItem>
    )

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
                    {resourceApi.data && <Typography variant='body1'>{getName(resourceApi.data)}</Typography>}
                </>
            )}
            {tab === 1 && (
                <>
                    {revisionsApi.loading && <Typography>{t('revisions.loading')}</Typography>}
                    {revisionsApi.error && <Typography color='error'>{t('revisions.error')}</Typography>}
                    {revisionsApi.data && (
                        <Box>
                            {revisionsApi.data.map((rev) => (
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
