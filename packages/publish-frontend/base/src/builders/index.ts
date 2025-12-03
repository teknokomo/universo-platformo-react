// Universo Platformo | Builders main export
// Main entry point for all UPDL builders with template system

export { BaseBuilder } from './common/BaseBuilder'
export { AbstractTemplateBuilder } from './common/AbstractTemplateBuilder'
export { BuilderRegistry } from './common/BuilderRegistry'
export { TemplateRegistry } from './common/TemplateRegistry'
export * from './common/types'

// Template coordinators
export { ARJSQuizBuilder as ARJSBuilder } from './templates/quiz/arjs/ARJSQuizBuilder'
export { PlayCanvasMMOOMMBuilder } from './templates/mmoomm/playcanvas/PlayCanvasMMOOMMBuilder'

// Template system exports (specific exports to avoid conflicts)
export { QuizTemplateConfig } from '@universo/template-quiz'
export { MMOOMMTemplateConfig } from '@universo/template-mmoomm'

// Export registry setup
export { setupBuilders } from './common/setup'
