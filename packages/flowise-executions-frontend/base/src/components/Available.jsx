import PropTypes from 'prop-types'

const Available = ({ children }) => {
    return children
}

Available.propTypes = {
    permissions: PropTypes.array,
    children: PropTypes.node
}

export default Available
