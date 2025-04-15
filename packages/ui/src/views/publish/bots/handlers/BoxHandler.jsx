// Universo Platformo | AR cube handler
import PropTypes from 'prop-types'
import { formatCoordinates } from './ARUtils'

/**
 * Handler for creating a cube in AR
 * @param {Object} props - Component properties
 * @param {string} props.color - Cube color in HEX format
 * @param {string} props.position - Position in 'x y z' format
 * @param {string} props.rotation - Rotation in 'x y z' format
 * @param {string} props.scale - Scale in 'x y z' format
 * @returns {string} HTML markup for the cube
 */
const BoxHandler = ({ color = '#FF0000', position = '0 0.5 0', rotation = '0 0 0', scale = '1 1 1' }) => {
    return `
    <a-box 
      position="${position}" 
      material="color: ${color};" 
      rotation="${rotation}"
      scale="${scale}">
    </a-box>
  `
}

/**
 * Processes cube components from JSON data
 * @param {Object} data - Cube data from JSON
 * @returns {string} HTML markup for the cube
 */
export const processComponent = (data) => {
    return BoxHandler({
        color: data?.color || '#FF0000',
        position: formatCoordinates(data?.position, '0 0.5 0'),
        rotation: formatCoordinates(data?.rotation, '0 0 0'),
        scale: formatCoordinates(data?.scale, '1 1 1')
    })
}

BoxHandler.propTypes = {
    color: PropTypes.string,
    position: PropTypes.string,
    rotation: PropTypes.string,
    scale: PropTypes.string
}

export default BoxHandler
