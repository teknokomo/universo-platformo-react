import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { formatDate } from '@flowise/template-mui/hooks/formatDate'
import { alpha, styled } from '@mui/material/styles'
import {
    Box,
    Chip,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
    useTheme
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import { FlowListMenu } from '@flowise/template-mui'
import i18n from '@universo/i18n'
import { Link } from 'react-router-dom'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.vars?.palette.outline ?? alpha(theme.palette.text.primary, 0.08),

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const getLocalStorageKeyName = (name, isAgentCanvas) => {
    if (isAgentCanvas) {
        return `agentcanvas_${name}`
    }

    return `canvaslist_${name}`
}

export const FlowListTable = ({
    data,
    images,
    isLoading,
    filterFunction,
    updateFlowsApi,
    setError,
    isAgentCanvas,
    isUnikTable,
    renderActions,
    getRowLink,
    customColumns,
    i18nNamespace = 'flowList'
}) => {
    const { t } = useTranslation(i18nNamespace, { i18n })
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const localStorageKeyOrder = getLocalStorageKeyName('order', isAgentCanvas)
    const localStorageKeyOrderBy = getLocalStorageKeyName('orderBy', isAgentCanvas)

    const [order, setOrder] = useState(localStorage.getItem(localStorageKeyOrder) || 'desc')
    const [orderBy, setOrderBy] = useState(localStorage.getItem(localStorageKeyOrderBy) || 'updatedDate')

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const resolveUpdatedDate = (item) => item?.updatedDate || item?.updated_at || item?.updatedAt || item?.updatedOn

    const sortedData = data
        ? [...data].sort((a, b) => {
              if (orderBy === 'name') {
                  return order === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')
              }
              if (orderBy === 'updatedDate') {
                  const dateA = resolveUpdatedDate(a)
                  const dateB = resolveUpdatedDate(b)
                  const parsedA = dateA ? new Date(dateA).getTime() : 0
                  const parsedB = dateB ? new Date(dateB).getTime() : 0
                  return order === 'asc' ? parsedA - parsedB : parsedB - parsedA
              }
              return 0
          })
        : []

    const buildEntityLink = (row) => {
        if (typeof getRowLink === 'function') {
            return getRowLink(row)
        }

        if (isUnikTable) {
            return `/unik/${row.id}`
        }

        return `/${isAgentCanvas ? 'agentcanvas' : 'canvas'}/${row.id}`
    }

    const borderColor = theme.vars?.palette.outline ?? alpha(theme.palette.text.primary, 0.08)

    const activeFilter = typeof filterFunction === 'function' ? filterFunction : () => true

    const columnsToRender = !isUnikTable && Array.isArray(customColumns) && customColumns.length > 0 ? customColumns : null

    return (
        <>
            <TableContainer sx={{ border: 1, borderColor, borderRadius: 1 }} component={Paper}>
                <Table sx={{ minWidth: 900 }} size='small' aria-label='a dense table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <TableRow>
                            <StyledTableCell component='th' scope='row' style={{ width: '20%' }} key='0'>
                                <TableSortLabel active={orderBy === 'name'} direction={order} onClick={() => handleRequestSort('name')}>
                                    {t('table.columns.name')}
                                </TableSortLabel>
                            </StyledTableCell>
                            {isUnikTable ? (
                                <StyledTableCell style={{ width: '55%' }} key='1'>
                                    {t('table.columns.spaces')}
                                </StyledTableCell>
                            ) : columnsToRender ? (
                                columnsToRender.map((column) => (
                                    <StyledTableCell
                                        key={column.id}
                                        style={{ width: column.width || '25%' }}
                                        align={column.align || 'left'}
                                    >
                                        {column.label}
                                    </StyledTableCell>
                                ))
                            ) : (
                                <>
                                    <StyledTableCell style={{ width: '25%' }} key='1'>
                                        {t('table.columns.category')}
                                    </StyledTableCell>
                                    <StyledTableCell style={{ width: '30%' }} key='2'>
                                        {t('table.columns.nodes')}
                                    </StyledTableCell>
                                </>
                            )}
                            <StyledTableCell style={{ width: '14%' }} key='3'>
                                <TableSortLabel
                                    active={orderBy === 'updatedDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('updatedDate')}
                                >
                                    {t('table.columns.lastModified')}
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell style={{ width: '10%' }} key='4'>
                                {t('table.columns.actions')}
                            </StyledTableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <>
                                <StyledTableRow>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                                <StyledTableRow>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                            </>
                        ) : (
                            <>
                                {(sortedData || []).filter(activeFilter).map((row, index) => {
                                    const linkTarget = buildEntityLink(row)
                                    const displayName = row.templateName || row.name
                                    const normalizedUpdatedDate = resolveUpdatedDate(row)

                                    return (
                                        <StyledTableRow key={index}>
                                            <StyledTableCell key='0'>
                                                <Typography
                                                    sx={{
                                                        fontSize: 14,
                                                        fontWeight: 500,
                                                        wordBreak: 'break-word',
                                                        overflowWrap: 'break-word'
                                                    }}
                                                >
                                                    {linkTarget ? (
                                                        <Link to={linkTarget} style={{ color: '#2196f3', textDecoration: 'none' }}>
                                                            {displayName}
                                                        </Link>
                                                    ) : (
                                                        displayName
                                                    )}
                                                </Typography>
                                            </StyledTableCell>
                                            {isUnikTable ? (
                                                <StyledTableCell key='1'>
                                                    <Typography sx={{ fontSize: 14 }}>
                                                        {row.spacesCount != null ? row.spacesCount : 0}
                                                    </Typography>
                                                </StyledTableCell>
                                            ) : columnsToRender ? (
                                                columnsToRender.map((column) => (
                                                    <StyledTableCell key={column.id} align={column.align || 'left'}>
                                                        {column.render ? column.render(row, index) : null}
                                                    </StyledTableCell>
                                                ))
                                            ) : (
                                                <>
                                                    <StyledTableCell key='1'>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'row',
                                                                flexWrap: 'wrap',
                                                                marginTop: 5
                                                            }}
                                                        >
                                                            &nbsp;
                                                            {row.category &&
                                                                row.category
                                                                    .split(';')
                                                                    .map((tag, tagIndex) => (
                                                                        <Chip
                                                                            key={tagIndex}
                                                                            label={tag}
                                                                            style={{ marginRight: 5, marginBottom: 5 }}
                                                                        />
                                                                    ))}
                                                        </div>
                                                    </StyledTableCell>
                                                    <StyledTableCell key='2'>
                                                        {images[row.id] && (
                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'start',
                                                                    gap: 1
                                                                }}
                                                            >
                                                                {images[row.id]
                                                                    .slice(0, images[row.id].length > 5 ? 5 : images[row.id].length)
                                                                    .map((img) => (
                                                                        <Box
                                                                            key={img}
                                                                            sx={{
                                                                                width: 30,
                                                                                height: 30,
                                                                                borderRadius: '50%',
                                                                                backgroundColor: customization.isDarkMode
                                                                                    ? theme.palette.common.white
                                                                                    : theme.palette.grey[300] + 75
                                                                            }}
                                                                        >
                                                                            <img
                                                                                style={{
                                                                                    width: '100%',
                                                                                    height: '100%',
                                                                                    padding: 5,
                                                                                    objectFit: 'contain'
                                                                                }}
                                                                                alt=''
                                                                                src={img}
                                                                            />
                                                                        </Box>
                                                                    ))}
                                                                {images[row.id].length > 5 && (
                                                                    <Typography
                                                                        sx={{
                                                                            alignItems: 'center',
                                                                            display: 'flex',
                                                                            fontSize: '.9rem',
                                                                            fontWeight: 200
                                                                        }}
                                                                    >
                                                                        {t('table.more', { count: images[row.id].length - 5 })}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        )}
                                                    </StyledTableCell>
                                                </>
                                            )}
                                            <StyledTableCell key='3'>{formatDate(normalizedUpdatedDate, 'full')}</StyledTableCell>
                                            <StyledTableCell key='4'>
                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    spacing={1}
                                                    justifyContent='center'
                                                    alignItems='center'
                                                >
                                                    {renderActions ? (
                                                        renderActions(row)
                                                    ) : (
                                                        <FlowListMenu
                                                            isAgentCanvas={isAgentCanvas}
                                                            canvas={row}
                                                            setError={setError}
                                                            updateFlowsApi={updateFlowsApi}
                                                        />
                                                    )}
                                                </Stack>
                                            </StyledTableCell>
                                        </StyledTableRow>
                                    )
                                })}
                            </>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    )
}

FlowListTable.propTypes = {
    data: PropTypes.array,
    images: PropTypes.object,
    isLoading: PropTypes.bool,
    filterFunction: PropTypes.func,
    updateFlowsApi: PropTypes.object,
    setError: PropTypes.func,
    isAgentCanvas: PropTypes.bool,
    isUnikTable: PropTypes.bool,
    renderActions: PropTypes.func,
    getRowLink: PropTypes.func,
    customColumns: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            label: PropTypes.node,
            width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            align: PropTypes.oneOf(['inherit', 'left', 'center', 'right', 'justify']),
            render: PropTypes.func
        })
    ),
    i18nNamespace: PropTypes.string
}
