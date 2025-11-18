// Main exports for template-quiz package
export * from './arjs'

// Common types and interfaces
export type {
    IQuizTemplateConfig,
    QuizPlan,
    QuizItem,
    QuizAnswer,
    IFlowData,
    BuildOptions,
    BuildResult,
    ITemplateBuilder
} from './common/types'

// Template configuration
export { QuizTemplateConfig, getQuizTemplateConfig } from './common/config'

// i18n exports
export { templateQuizTranslations, getTemplateQuizTranslations } from './i18n'
export type { TemplateQuizTranslations } from './i18n'
