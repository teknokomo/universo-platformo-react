// Universo Platformo | Builders main export
// Main entry point for all UPDL builders with template system

export { BaseBuilder } from './common/BaseBuilder'
export { AbstractTemplateBuilder } from './common/AbstractTemplateBuilder'
export { BuilderRegistry } from './common/BuilderRegistry'
export { TemplateRegistry } from './common/TemplateRegistry'
export * from './common/types'

// AR.js Builder with template support
export { ARJSBuilder } from './templates/quiz/arjs/ARJSBuilder'

// Template system exports - quiz template
export * from './templates/quiz/arjs'

// Export registry setup
export { setupBuilders } from './common/setup'
