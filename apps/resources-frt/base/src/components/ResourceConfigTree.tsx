import React, { useState } from 'react'
import { Box, Button, TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ResourceNode {
    id: string
    children: ResourceNode[]
}

const ResourceConfigTree: React.FC = () => {
    const { t } = useTranslation('resources')
    const [nodes, setNodes] = useState<ResourceNode[]>([])

    const addNode = (parent?: ResourceNode) => {
        const newNode: ResourceNode = { id: '', children: [] }
        if (!parent) {
            setNodes([...nodes, newNode])
        } else {
            parent.children.push(newNode)
            setNodes([...nodes])
        }
    }

    const removeNode = (list: ResourceNode[], index: number) => {
        list.splice(index, 1)
        setNodes([...nodes])
    }

    const renderNodes = (list: ResourceNode[]) =>
        list.map((node, idx) => (
            <Box key={idx} ml={2} mt={1}>
                <Box display='flex' gap={1}>
                    <TextField
                        size='small'
                        placeholder={t('config.resourceId')}
                        value={node.id}
                        onChange={(e) => {
                            node.id = e.target.value
                            setNodes([...nodes])
                        }}
                    />
                    <Button onClick={() => addNode(node)}>+</Button>
                    <Button onClick={() => removeNode(list, idx)}>-</Button>
                </Box>
                {node.children.length > 0 && renderNodes(node.children)}
            </Box>
        ))

    return (
        <Box>
            {renderNodes(nodes)}
            <Button onClick={() => addNode()} sx={{ mt: 1 }}>
                {t('config.addRoot')}
            </Button>
        </Box>
    )
}

export default ResourceConfigTree
