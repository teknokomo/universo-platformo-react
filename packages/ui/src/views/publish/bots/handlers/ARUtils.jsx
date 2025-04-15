// Universo Platformo | Utility functions for handling AR data

/**
 * Converts a coordinate object {x, y, z} into a string format 'x y z'
 * @param {Object|string} value - Coordinate object or string
 * @param {string} defaultValue - Default value
 * @returns {string} Coordinate string
 */
export const formatCoordinates = (value, defaultValue) => {
    if (!value) return defaultValue

    // Universo Platformo | If value is already a string, return it
    if (typeof value === 'string') return value

    // Universo Platformo | If value is an object with x, y, z, convert to string
    if (typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
        return `${value.x} ${value.y} ${value.z}`
    }

    // Universo Platformo | If nothing matched, return the default value
    return defaultValue
}

/**
 * Logs information about the component and its properties
 * @param {string} componentName - Component name
 * @param {Object} props - Component properties
 */
export const logComponent = (componentName, props) => {
    console.log(`AR Component [${componentName}]:`, props)
}
