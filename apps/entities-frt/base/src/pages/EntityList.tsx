import React, { useState } from 'react'
import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, MenuItem } from '@mui/material'

interface Entity {
  id: string
  name: string
  template: string
  status: string
}

const templates = ['Template A', 'Template B']
const statuses = ['Active', 'Archived']

const entities: Entity[] = [
  { id: '1', name: 'Entity One', template: 'Template A', status: 'Active' },
  { id: '2', name: 'Entity Two', template: 'Template B', status: 'Archived' }
]

const EntityList: React.FC = () => {
  const [search, setSearch] = useState('')
  const [template, setTemplate] = useState('')
  const [status, setStatus] = useState('')

  const filtered = entities.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.id.includes(search)
    const matchTemplate = template ? e.template === template : true
    const matchStatus = status ? e.status === status : true
    return matchSearch && matchTemplate && matchStatus
  })

  return (
    <Box display='flex' flexDirection='column' gap={2}>
      <Box display='flex' gap={2}>
        <TextField label='Search' value={search} onChange={(e) => setSearch(e.target.value)} />
        <TextField select label='Template' value={template} onChange={(e) => setTemplate(e.target.value)}>
          <MenuItem value=''>All</MenuItem>
          {templates.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label='Status' value={status} onChange={(e) => setStatus(e.target.value)}>
          <MenuItem value=''>All</MenuItem>
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
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Template</TableCell>
              <TableCell>Status</TableCell>
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
