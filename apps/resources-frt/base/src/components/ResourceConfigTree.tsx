import React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Box, Button, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ResourceNode {
    key: string
    resourceId: string
    children: ResourceNode[]
}

interface ResourceConfigTreeProps {
    nodes: ResourceNode[]
    onChange: (nodes: ResourceNode[]) => void
}

const createNode = (): ResourceNode => ({ key: uuidv4(), resourceId: '', children: [] })

const addNode = (list: ResourceNode[], parentKey?: string): ResourceNode[] => {
    if (!parentKey) return [...list, createNode()]
    return list.map((node) =>
        node.key === parentKey
            ? { ...node, children: [...node.children, createNode()] }
            : { ...node, children: addNode(node.children, parentKey) }
    )
}

const removeNode = (list: ResourceNode[], key: string): ResourceNode[] =>
    list.filter((n) => n.key !== key).map((n) => ({ ...n, children: removeNode(n.children, key) }))

const updateNodeId = (list: ResourceNode[], key: string, value: string): ResourceNode[] =>
    list.map((n) => (n.key === key ? { ...n, resourceId: value } : { ...n, children: updateNodeId(n.children, key, value) }))

const ResourceConfigTree: React.FC<ResourceConfigTreeProps> = ({ nodes, onChange }) => {
    const { t } = useTranslation('resources')

    const renderNodes = (list: ResourceNode[]) =>
        list.map((node) => (
            <Box key={node.key} ml={2} mt={1}>
                <Box display='flex' gap={1}>
                    <TextField
                        size='small'
                        placeholder={t('config.resourceId')}
                        value={node.resourceId}
                        onChange={(e) => onChange(updateNodeId(nodes, node.key, e.target.value))}
                    />
                    <Button onClick={() => onChange(addNode(nodes, node.key))}>+</Button>
                    <Button onClick={() => onChange(removeNode(nodes, node.key))}>-</Button>
                </Box>
                {node.children.length > 0 && renderNodes(node.children)}
            </Box>
        ))

    return (
        <Box>
            {renderNodes(nodes)}
            <Button onClick={() => onChange(addNode(nodes))} sx={{ mt: 1 }}>
                {t('config.addRoot')}
            </Button>
        </Box>
    )
}

export default ResourceConfigTree
