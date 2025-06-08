import PropTypes from 'prop-types'
import { forwardRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Chip, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery } from '@mui/material'

// project imports
import { MENU_OPEN, SET_MENU } from '@/store/actions'
import config from '@/config'

// assets
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

// ==============================|| SIDEBAR MENU LIST ITEMS ||============================== //

const NavItem = ({ item, level, navType, onClick, onUploadFile }) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const { t } = useTranslation('menu')
    const customization = useSelector((state) => state.customization)
    const matchesSM = useMediaQuery(theme.breakpoints.down('lg'))
    const location = useLocation()

    const Icon = item.icon
    const itemIcon = item?.icon ? (
        <Icon stroke={1.5} size='1.3rem' />
    ) : (
        <FiberManualRecordIcon
            sx={{
                width: customization.isOpen.findIndex((id) => id === item?.id) > -1 ? 8 : 6,
                height: customization.isOpen.findIndex((id) => id === item?.id) > -1 ? 8 : 6
            }}
            fontSize={level > 0 ? 'inherit' : 'medium'}
        />
    )

    let itemTarget = '_self'
    if (item.target) {
        itemTarget = '_blank'
    }

    let listItemProps = {
        component: forwardRef(function ListItemPropsComponent(props, ref) {
            return <NavLink ref={ref} {...props} to={`${config.basename}${item.url}`} target={itemTarget} />
        })
    }
    if (item?.external) {
        listItemProps = { component: 'a', href: item.url, target: itemTarget }
    }
    if (item?.id === 'loadChatflow') {
        listItemProps.component = 'label'
    }

    const handleFileUpload = (e) => {
        if (!e.target.files) return

        const file = e.target.files[0]

        const reader = new FileReader()
        reader.onload = (evt) => {
            if (!evt?.target?.result) {
                return
            }
            const { result } = evt.target
            onUploadFile(result)
        }
        reader.readAsText(file)
    }

    const itemHandler = (id) => {
        if (navType === 'SETTINGS' && id !== 'loadChatflow') {
            onClick(id)
        } else {
            dispatch({ type: MENU_OPEN, id })
            if (matchesSM) dispatch({ type: SET_MENU, opened: false })
        }
    }

    // Get translated title from key depending on menu item ID
    const getTranslatedTitle = (id, title) => {
        // First check if the title is already a localization key
        if (title && title.startsWith('menu.')) {
            return t(title)
        }
        
        // If not, try to find a match for ID in the menu
        const menuKeys = {
            'unik-dashboard': 'menu.dashboard',
            'chatflows': 'menu.chatflows',
            'agentflows': 'menu.agentflows',
            'assistants': 'menu.assistants',
            'tools': 'menu.tools',
            'credentials': 'menu.credentials',
            'variables': 'menu.variables',
            'apikey': 'menu.apiKeys',
            'document-stores': 'menu.documentStores',
            'templates': 'menu.templates',
            'uniks': 'menu.uniks',
            'docs': 'menu.docs',
            'profile': 'menu.profile'
        }
        
        return menuKeys[id] ? t(menuKeys[id]) : title
    }

    // active menu item on page load
    useEffect(() => {
        if (navType === 'MENU') {
            // Check if the current path is the Unik dashboard
            const isUnikDashboard = /^\/uniks\/[^\/]+$/.test(location.pathname)

            // If this is a Unique dashboard and the current menu item is dashboard, activate it
            if (isUnikDashboard && item.id === 'dashboard') {
                dispatch({ type: MENU_OPEN, id: item.id })
                return
            }

            // Check if the current path contains the menu item's URL
            // For chatflows type items, check for /chatflows in the path
            if (item.url && location.pathname.includes(item.url)) {
                dispatch({ type: MENU_OPEN, id: item.id })
                return
            }

            // Standard check by ID
            const currentIndex = location.pathname
                .toString()
                .split('/')
                .findIndex((id) => id === item.id)
            if (currentIndex > -1) {
                dispatch({ type: MENU_OPEN, id: item.id })
            }

            // Fallback option for the root page
            if (!location.pathname.toString().split('/')[1]) {
                itemHandler('chatflows')
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navType, location.pathname, item.id, item.url])

    return (
        <ListItemButton
            {...listItemProps}
            disabled={item.disabled}
            sx={{
                borderRadius: `${customization.borderRadius}px`,
                mb: 0.5,
                alignItems: 'flex-start',
                backgroundColor: level > 1 ? 'transparent !important' : 'inherit',
                py: level > 1 ? 1 : 1.25,
                pl: `${level * 24}px`
            }}
            selected={customization.isOpen.findIndex((id) => id === item.id) > -1}
            onClick={() => itemHandler(item.id)}
        >
            {item.id === 'loadChatflow' && <input type='file' hidden accept='.json' onChange={(e) => handleFileUpload(e)} />}
            <ListItemIcon sx={{ my: 'auto', minWidth: !item?.icon ? 18 : 36 }}>{itemIcon}</ListItemIcon>
            <ListItemText
                primary={
                    <Typography
                        variant={customization.isOpen.findIndex((id) => id === item.id) > -1 ? 'h5' : 'body1'}
                        color='inherit'
                        sx={{ my: 0.5 }}
                    >
                        {getTranslatedTitle(item.id, item.title)}
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
