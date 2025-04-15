// Universo Platformo | AR camera handler
import PropTypes from 'prop-types'
import { formatCoordinates } from './ARUtils'

/**
 * Handler for creating a camera in AR
 * @param {Object} props - Component properties
 * @param {string} props.position - Camera position in 'x y z' format
 * @param {string} props.rotation - Camera rotation in 'x y z' format
 * @param {boolean} props.lookControls - Enable look controls
 * @returns {string} HTML markup for the camera
 */
const CameraHandler = ({ position = '0 0 0', rotation = '0 0 0', lookControls = true }) => {
    const controls = lookControls ? 'look-controls' : ''

    return `
    <a-entity camera></a-entity>
  `
}

/**
 * Processes camera components from JSON data
 * @param {Object} data - Camera data from JSON
 * @returns {string} HTML markup for the camera
 */
export const processComponent = (data) => {
    return CameraHandler({
        position: formatCoordinates(data?.position, '0 0 0'),
        rotation: formatCoordinates(data?.rotation, '0 0 0'),
        lookControls: data?.lookControls !== undefined ? data.lookControls : true
    })
}

CameraHandler.propTypes = {
    position: PropTypes.string,
    rotation: PropTypes.string,
    lookControls: PropTypes.bool
}

export default CameraHandler
