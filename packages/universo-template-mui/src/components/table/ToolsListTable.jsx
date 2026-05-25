import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { alpha, styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'
import {
    Button,
    Paper,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useTheme
} from '@mui/material'

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

export const ToolsTable = ({ data, isLoading, onSelect }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const borderColor = theme.vars?.palette.outline ?? alpha(theme.palette.text.primary, 0.08)

    return (
        <>
            <TableContainer sx={{ border: 1, borderColor, borderRadius: 2 }} component={Paper}>
                <Table sx={{ minWidth: 650 }} size='small' aria-label='a dense table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <TableRow>
                            <StyledTableCell component='th' scope='row' key='0'>
                                Name
                            </StyledTableCell>
                            <StyledTableCell key='1'>Description</StyledTableCell>
                            <StyledTableCell component='th' scope='row' key='3'>
                                &nbsp;
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
                                </StyledTableRow>
                            </>
                        ) : (
                            <>
                                {data?.map((row, index) => (
                                    <StyledTableRow key={index}>
                                        <StyledTableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }} key='0'>
                                            <div
                                                style={{
                                                    width: 35,
                                                    height: 35,
                                                    display: 'flex',
                                                    flexShrink: 0,
                                                    marginRight: 10,
                                                    borderRadius: '50%',
                                                    backgroundImage: `url(${row.iconSrc})`,
                                                    backgroundSize: 'contain',
                                                    backgroundRepeat: 'no-repeat',
                                                    backgroundPosition: 'center center'
                                                }}
                                            ></div>
                                            <Typography
                                                sx={{
                                                    display: '-webkit-box',
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <Button onClick={() => onSelect(row)} sx={{ textAlign: 'left' }}>
                                                    {row.templateName || row.name}
                                                </Button>
                                            </Typography>
                                        </StyledTableCell>
                                        <StyledTableCell key='1'>
                                            <Typography sx={{ overflowWrap: 'break-word', whiteSpace: 'pre-line' }}>
                                                {row.description || ''}
                                            </Typography>
                                        </StyledTableCell>
                                        <StyledTableCell key='3'></StyledTableCell>
                                    </StyledTableRow>
                                ))}
                            </>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    )
}

ToolsTable.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool,
    onSelect: PropTypes.func
}
