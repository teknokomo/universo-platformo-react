import React, { useState } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import TreeView from '@mui/lab/TreeView'
import TreeItem from '@mui/lab/TreeItem'

interface Category {
    id: string
    name: string
    children?: Category[]
}

interface Resource {
    id: string
    name: string
    category: string
}

const categories: Category[] = [
    {
        id: 'cat1',
        name: 'Category 1',
        children: [{ id: 'cat1-1', name: 'Child 1' }]
    }
]

const resources: Resource[] = [
    { id: '1', name: 'Resource One', category: 'cat1' },
    { id: '2', name: 'Resource Two', category: 'cat1-1' }
]

const ResourceList: React.FC = () => {
    const [selected, setSelected] = useState<string | null>(null)

    const handleSelect = (_: React.SyntheticEvent, nodeId: string) => {
        setSelected(nodeId)
    }

    const renderTree = (node: Category) => (
        <TreeItem key={node.id} nodeId={node.id} label={node.name}>
            {Array.isArray(node.children) ? node.children.map((c) => renderTree(c)) : null}
        </TreeItem>
    )

    const filtered = selected ? resources.filter((r) => r.category === selected) : resources

    return (
        <Box display='flex' gap={2}>
            <TreeView selected={selected} onNodeSelect={handleSelect}>
                {categories.map((c) => renderTree(c))}
            </TreeView>
            <Paper sx={{ flex: 1 }}>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Name</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>{r.id}</TableCell>
                                <TableCell>{r.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    )
}

export default ResourceList
