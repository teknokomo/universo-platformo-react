import React from 'react'
import { useSelector } from 'react-redux'
import { alpha, styled } from '@mui/material/styles'
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useTheme } from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import { Link } from 'react-router-dom'

import type { FlowListTableData, TableColumn } from './FlowListTable'

export type CompactListTableLinkMode = 'none' | 'all-cells' | 'columns'

export interface CompactListTableProps<T extends FlowListTableData = FlowListTableData> {
    data: T[]
    columns: TableColumn<T>[]
    getRowLink?: (row: T) => string | undefined
    linkMode?: CompactListTableLinkMode
    linkColumnIds?: string[]
    maxHeight?: number
}

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: (theme as any).vars?.palette?.outline ?? alpha(theme.palette.text.primary, 0.08),

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const shouldLinkCell = (mode: CompactListTableLinkMode, columnId: string, linkColumnIds?: string[]) => {
    if (mode === 'all-cells') return true
    if (mode === 'columns') return Array.isArray(linkColumnIds) && linkColumnIds.includes(columnId)
    return false
}

export const CompactListTable = <T extends FlowListTableData = FlowListTableData>({
    data,
    columns,
    getRowLink,
    linkMode = 'none',
    linkColumnIds,
    maxHeight = 240
}: CompactListTableProps<T>): React.ReactElement => {
    const theme = useTheme()
    const customization = useSelector((state: any) => state.customization)

    const headerBackgroundColor = customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100]

    const borderColor = (theme as any).vars?.palette?.outline ?? alpha(theme.palette.text.primary, 0.08)

    return (
        <Paper variant='outlined' sx={{ borderRadius: 1, overflow: 'hidden', borderColor }}>
            <TableContainer sx={{ maxHeight, overflowY: 'auto', backgroundColor: 'background.paper' }}>
                <Table
                    size='small'
                    stickyHeader
                    sx={{
                        tableLayout: 'fixed'
                    }}
                >
                    <TableHead
                        sx={{
                            backgroundColor: headerBackgroundColor,
                            '& .MuiTableCell-head': {
                                backgroundColor: headerBackgroundColor
                            }
                        }}
                    >
                        <TableRow>
                            {columns.map((column) => (
                                <StyledTableCell key={column.id} style={{ width: column.width || 'auto' }} align={column.align || 'left'}>
                                    {column.label}
                                </StyledTableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row, index) => {
                            const rowLink = typeof getRowLink === 'function' ? getRowLink(row) : undefined

                            return (
                                <StyledTableRow key={row.id || index}>
                                    {columns.map((column) => {
                                        const content = column.render ? column.render(row, index) : (row as any)?.[column.id]
                                        const linkThisCell = Boolean(rowLink) && shouldLinkCell(linkMode, column.id, linkColumnIds)

                                        return (
                                            <StyledTableCell key={column.id} align={column.align || 'left'}>
                                                {linkThisCell ? (
                                                    <Link to={rowLink as string} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                        <Box
                                                            sx={{
                                                                display: 'inline-flex',
                                                                maxWidth: '100%',
                                                                '&:hover': {
                                                                    textDecoration: 'underline',
                                                                    color: 'primary.main'
                                                                }
                                                            }}
                                                        >
                                                            {typeof content === 'string' || typeof content === 'number' ? (
                                                                <Typography variant='body2'>{content}</Typography>
                                                            ) : (
                                                                content
                                                            )}
                                                        </Box>
                                                    </Link>
                                                ) : (
                                                    content
                                                )}
                                            </StyledTableCell>
                                        )
                                    })}
                                </StyledTableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    )
}

export default CompactListTable
