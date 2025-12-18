import PropTypes from 'prop-types'
import ReactJson from 'flowise-react-json-view'
import { useSelector } from 'react-redux'

/**
 * JSONViewer component displays JSON data in a collapsible tree view.
 * Wraps flowise-react-json-view with consistent styling.
 */
export const JSONViewer = ({ data, collapsed = 2, displayDataTypes = false, enableClipboard = true }) => {
    const customization = useSelector((state) => state.customization)
    const isDarkMode = customization?.isDarkMode ?? false

    if (data === null || data === undefined) {
        return null
    }

    return (
        <ReactJson
            theme={isDarkMode ? 'ocean' : 'rjv-default'}
            style={{ padding: '8px', borderRadius: '4px' }}
            src={data}
            name={null}
            quotesOnKeys={false}
            enableClipboard={enableClipboard}
            displayDataTypes={displayDataTypes}
            collapsed={collapsed}
        />
    )
}

JSONViewer.propTypes = {
    data: PropTypes.any,
    collapsed: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    displayDataTypes: PropTypes.bool,
    enableClipboard: PropTypes.oneOfType([PropTypes.bool, PropTypes.func])
}
