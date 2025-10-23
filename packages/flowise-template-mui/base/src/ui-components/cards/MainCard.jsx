import PropTypes from 'prop-types'
import { forwardRef } from 'react'

// material-ui
import { Card, CardContent, CardHeader, Divider, Typography } from '@mui/material'

// constant
const headerSX = {
    '& .MuiCardHeader-action': { mr: 0 }
}

// ==============================|| CUSTOM MAIN CARD ||============================== //

const MainCard = forwardRef(function MainCard(
    {
        boxShadow,
        children,
        content = true,
        contentClass = '',
        contentSX = {
            px: 2,
            py: 0
        },
        darkTitle,
        border = true,
        disableContentPadding = false,
        disableHeader = false,
        secondary,
        shadow,
        sx = {},
        title,
        ...others
    },
    ref
) {
    const otherProps = { ...others, border: border === false ? undefined : border }
    return (
        <Card
            ref={ref}
            {...otherProps}
            sx={{
                background: 'transparent',
                boxShadow: shadow === false ? 'none' : undefined,
                border: border === false ? 'none' : undefined,
                ':hover': {
                    boxShadow: boxShadow ? shadow || '0 2px 14px 0 rgb(32 40 45 / 8%)' : 'inherit'
                },
                maxWidth: disableHeader ? '100%' : '1280px',
                mx: disableHeader ? undefined : 'auto',
                ...sx
            }}
        >
            {/* card header and action */}
            {!disableHeader && !darkTitle && title && <CardHeader sx={headerSX} title={title} action={secondary} />}
            {!disableHeader && darkTitle && title && (
                <CardHeader sx={headerSX} title={<Typography variant='h3'>{title}</Typography>} action={secondary} />
            )}

            {/* content & header divider */}
            {!disableHeader && title && <Divider />}

            {/* card content */}
            {content && (
                <CardContent sx={disableContentPadding ? { px: 0, py: 0, ...contentSX } : contentSX} className={contentClass}>
                    {children}
                </CardContent>
            )}
            {!content && children}
        </Card>
    )
})

MainCard.propTypes = {
    border: PropTypes.bool,
    boxShadow: PropTypes.bool,
    children: PropTypes.node,
    content: PropTypes.bool,
    contentClass: PropTypes.string,
    contentSX: PropTypes.object,
    darkTitle: PropTypes.bool,
    disableContentPadding: PropTypes.bool,
    disableHeader: PropTypes.bool,
    secondary: PropTypes.oneOfType([PropTypes.node, PropTypes.string, PropTypes.object]),
    shadow: PropTypes.string,
    sx: PropTypes.object,
    title: PropTypes.oneOfType([PropTypes.node, PropTypes.string, PropTypes.object])
}

export default MainCard
