import PropTypes from 'prop-types'
import React, { forwardRef } from 'react'
import { NavLink, useMatch } from 'react-router-dom'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Chip, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery } from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import config from '@/config'

// ==============================|| SIDEBAR MENU LIST ITEMS ||============================== //

const NavItem = ({ item, level, navType, onClick, onUploadFile }) => {
    const theme = useTheme()
    const matchesSM = useMediaQuery(theme.breakpoints.down('lg'))

    // Полный URL пункта меню: config.basename + item.url
    const fullPath = `${config.basename}${item.url}`

    // Определяем, совпадает ли текущий путь с полным URL (точное совпадение)
    const match = useMatch({ path: fullPath, end: true })

    // Если иконка задана – используем её, иначе маленький кружок
    const Icon = item.icon
    const itemIcon = item?.icon ? (
        <Icon stroke={1.5} size='1.3rem' />
    ) : (
        <FiberManualRecordIcon
            sx={{
                width: match ? 8 : 6,
                height: match ? 8 : 6
            }}
            fontSize={level > 0 ? 'inherit' : 'medium'}
        />
    )

    let itemTarget = '_self'
    if (item.target) {
        itemTarget = '_blank'
    }

    // Создаем ссылку с использованием NavLink и forwardRef;
    // проп end гарантирует, что ссылка активна только при точном совпадении
    const listItemProps = {
        component: forwardRef(function ListItemPropsComponent(props, ref) {
            return <NavLink ref={ref} {...props} to={fullPath} target={itemTarget} end />
        })
    }
    if (item?.external) {
        listItemProps.component = 'a'
        listItemProps.href = item.url
        listItemProps.target = itemTarget
    }
    if (item?.id === 'loadChatflow') {
        listItemProps.component = 'label'
    }

    const handleFileUpload = (e) => {
        if (!e.target.files) return

        const file = e.target.files[0]

        const reader = new FileReader()
        reader.onload = (evt) => {
            if (!evt?.target?.result) return
            onUploadFile(evt.target.result)
        }
        reader.readAsText(file)
    }

    const itemHandler = (id) => {
        if (navType === 'SETTINGS' && id !== 'loadChatflow') {
            onClick(id)
        } else {
            // Дополнительная логика, если требуется
        }
    }

    return (
        <ListItemButton
            {...listItemProps}
            disabled={item.disabled}
            sx={{
                borderRadius: `${theme.shape.borderRadius}px`,
                mb: 0.5,
                alignItems: 'flex-start',
                backgroundColor: level > 1 ? 'transparent !important' : 'inherit',
                py: level > 1 ? 1 : 1.25,
                pl: `${level * 24}px`
            }}
            // Используем значение match для определения активного состояния
            selected={Boolean(match)}
            onClick={() => itemHandler(item.id)}
        >
            {item.id === 'loadChatflow' && <input type='file' hidden accept='.json' onChange={(e) => handleFileUpload(e)} />}
            <ListItemIcon sx={{ my: 'auto', minWidth: !item?.icon ? 18 : 36 }}>{itemIcon}</ListItemIcon>
            <ListItemText
                primary={
                    <Typography variant={Boolean(match) ? 'h5' : 'body1'} color='inherit' sx={{ my: 0.5 }}>
                        {item.title}
                    </Typography>
                }
                secondary={
                    item.caption && (
                        <Typography variant='caption' sx={{ ...theme.typography.subMenuCaption, mt: -0.6 }} display='block' gutterBottom>
                            {item.caption}
                        </Typography>
                    )
                }
                sx={{ my: 'auto' }}
            />
            {item.chip && (
                <Chip
                    color={item.chip.color}
                    variant={item.chip.variant}
                    size={item.chip.size}
                    label={item.chip.label}
                    avatar={item.chip.avatar && <Avatar>{item.chip.avatar}</Avatar>}
                />
            )}
            {item.isBeta && (
                <Chip
                    sx={{
                        my: 'auto',
                        width: 'max-content',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        background: theme.palette.teal.main,
                        color: 'white'
                    }}
                    label={'BETA'}
                />
            )}
        </ListItemButton>
    )
}

NavItem.propTypes = {
    item: PropTypes.object,
    level: PropTypes.number,
    navType: PropTypes.string,
    onClick: PropTypes.func,
    onUploadFile: PropTypes.func
}

export default NavItem

