/**
 * CASL Ability Context
 *
 * React context for sharing CASL ability instance across components.
 * Used with @casl/react Can component for declarative permission checks.
 */
import React from 'react'

const AbilityContext = React.createContext(null)

export default AbilityContext
