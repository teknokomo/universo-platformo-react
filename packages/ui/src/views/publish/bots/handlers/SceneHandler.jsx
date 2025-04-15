// Universo Platformo | AR scene handler
import PropTypes from 'prop-types'

/**
 * Handler for forming an AR scene
 * @param {Object} props - Component properties
 * @param {string} props.children - HTML content inside the scene
 * @param {string} props.detectionMode - Detection mode ('mono', 'color', etc.)
 * @param {boolean} props.debugMode - Enable debug mode
 * @returns {string} HTML markup for the AR scene
 */
const SceneHandler = ({ children, detectionMode = 'mono', debugMode = false }) => {
    return `
    <a-scene embedded arjs>
      ${children}
    </a-scene>
  `
}

/**
 * Processes scene components from JSON data
 * @param {Object} data - Scene data from JSON
 * @param {string} childrenContent - HTML content of child elements
 * @returns {string} HTML markup for the scene
 */
export const processComponent = (data, childrenContent = '') => {
    return SceneHandler({
        children: childrenContent,
        detectionMode: data?.detectionMode || 'mono',
        debugMode: data?.debugMode || false
    })
}

SceneHandler.propTypes = {
    children: PropTypes.string.isRequired,
    detectionMode: PropTypes.string,
    debugMode: PropTypes.bool
}

export default SceneHandler
