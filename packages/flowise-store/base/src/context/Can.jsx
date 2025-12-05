/**
 * CASL Can Component for Universo
 *
 * Wrapper around @casl/react Can that uses our AbilityContext.
 * Provides declarative permission checks in JSX.
 *
 * Usage:
 * ```jsx
 * import { Can, Cannot } from '@flowise/store'
 *
 * // Show element only if user CAN do action
 * <Can I="create" a="Metaverse">
 *   <CreateButton />
 * </Can>
 *
 * // Show element only if user CANNOT do action (for fallbacks)
 * <Cannot I="delete" a="Metaverse">
 *   <span>No delete permission</span>
 * </Cannot>
 *
 * // With passThrough (passes 'allowed' prop to child)
 * <Can I="update" a="Project" passThrough>
 *   {(allowed) => <Button disabled={!allowed}>Edit</Button>}
 * </Can>
 * ```
 */
import React, { useContext } from 'react'
import PropTypes from 'prop-types'
import { Can as CaslCan } from '@casl/react'
import AbilityContext from './AbilityContext'

/**
 * Can component that uses AbilityContext
 * Shows children only if user has permission
 */
const Can = ({ children, ...props }) => {
    const context = useContext(AbilityContext)
    const ability = context?.ability

    if (!ability) {
        // No ability loaded yet - hide content
        return null
    }

    return (
        <CaslCan ability={ability} {...props}>
            {children}
        </CaslCan>
    )
}

Can.propTypes = {
    children: PropTypes.any,
    I: PropTypes.string,
    a: PropTypes.string,
    an: PropTypes.string,
    this: PropTypes.any,
    do: PropTypes.string,
    on: PropTypes.any,
    field: PropTypes.string,
    not: PropTypes.bool,
    passThrough: PropTypes.bool
}

/**
 * Cannot component - inverse of Can
 * Shows children only if user does NOT have permission
 */
const Cannot = ({ children, ...props }) => {
    return (
        <Can {...props} not>
            {children}
        </Can>
    )
}

Cannot.propTypes = {
    children: PropTypes.any,
    I: PropTypes.string,
    a: PropTypes.string
}

export { Can, Cannot }
export default Can
