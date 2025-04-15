// Universo Platformo | Base AR handler for HTML structure generation
import PropTypes from 'prop-types'

/**
 * Handler for generating the HTML structure of an AR scene
 * @param {Object} props - Component properties
 * @param {string} props.children - HTML content of the AR scene
 * @param {string} props.aframeVersion - A-Frame version
 * @returns {string} HTML structure for the iframe
 */
const BaseHandler = ({ children, aframeVersion = '1.6.0' }) => {
    return `
    <!DOCTYPE html>
    <html>
        <script src="https://aframe.io/releases/${aframeVersion}/aframe.min.js"></script>
        <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
        <body style="margin: 0; overflow: hidden;">
            ${children}
        </body>
    </html>
  `
}

/**
 * Processes base HTML components from JSON data
 * @param {Object} data - Component data from JSON
 * @param {string} childrenContent - HTML content of child elements
 * @returns {string} HTML structure of the base container
 */
export const processComponent = (data, childrenContent = '') => {
    return BaseHandler({
        aframeVersion: data?.aframeVersion || '1.6.0',
        children: childrenContent
    })
}

BaseHandler.propTypes = {
    children: PropTypes.string.isRequired,
    aframeVersion: PropTypes.string
}

export default BaseHandler
