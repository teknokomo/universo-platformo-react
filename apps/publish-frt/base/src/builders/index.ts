// Universo Platformo | Builders main export
// Main entry point for all UPDL builders with template system

export { BaseBuilder } from './common/BaseBuilder'
export { AbstractTemplateBuilder } from './common/AbstractTemplateBuilder'
export { BuilderRegistry } from './common/BuilderRegistry'
export { TemplateRegistry } from './common/TemplateRegistry'
export * from './common/types'

// AR.js Builder with template support
export { ARJSBuilder } from './arjs/ARJSBuilder'

// Template system exports
export * from './arjs/templates'

// Export registry setup
export { setupBuilders } from './common/setup'
