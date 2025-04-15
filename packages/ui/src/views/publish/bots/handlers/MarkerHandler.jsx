// Universo Platformo | AR marker handler
import PropTypes from 'prop-types'

/**
 * Handler for forming an AR marker
 * @param {Object} props - Component properties
 * @param {string} props.children - HTML content inside the marker
 * @param {string} props.preset - Preset marker type ('hiro', 'kanji')
 * @param {string} props.type - Marker type ('pattern', 'barcode')
 * @param {string} props.patternUrl - URL to the marker pattern
 * @returns {string} Marker HTML markup
 */
const MarkerHandler = ({ children, preset = 'hiro', type, patternUrl }) => {
    let markerAttributes = ''

    if (type === 'pattern' && patternUrl) {
        markerAttributes = `type="pattern" url="${patternUrl}"`
    } else if (type === 'barcode') {
        markerAttributes = `type="barcode" value="1"`
    } else {
        markerAttributes = `preset="${preset}"`
    }

    return `
    <a-marker ${markerAttributes}>
      ${children}
    </a-marker>
  `
}

/**
 * Processes marker components from JSON data
 * @param {Object} data - Marker data from JSON
 * @param {string} childrenContent - HTML content of child elements
 * @returns {string} Marker HTML markup
 */
export const processComponent = (data, childrenContent = '') => {
    return MarkerHandler({
        children: childrenContent,
        preset: data?.preset || 'hiro',
        type: data?.type,
        patternUrl: data?.patternUrl
    })
}

MarkerHandler.propTypes = {
    children: PropTypes.string.isRequired,
    preset: PropTypes.string,
    type: PropTypes.string,
    patternUrl: PropTypes.string
}

export default MarkerHandler
