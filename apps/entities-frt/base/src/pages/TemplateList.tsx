import React from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'

interface Template {
  id: string
  name: string
}

const templates: Template[] = [
  { id: 't1', name: 'Template A' },
  { id: 't2', name: 'Template B' }
]

const TemplateList: React.FC = () => {
  return (
    <Box>
      <Paper>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
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
