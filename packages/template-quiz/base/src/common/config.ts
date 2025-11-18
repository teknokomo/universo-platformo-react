// Template configuration for quiz package
import type { IQuizTemplateConfig } from './types'

export const QuizTemplateConfig: IQuizTemplateConfig = {
    id: 'quiz',
    name: 'publish.quiz.name',
    description: 'publish.quiz.description',
    version: '0.1.0',
    technology: 'arjs',
    i18nNamespace: 'publish',

    // Supported nodes (existing)
    supportedNodes: ['Space', 'Object', 'Camera', 'Light', 'Data'],

    // Quiz features
    features: ['multiScene', 'pointsSystem', 'leadCollection', 'analytics'],

    // Default settings
    defaults: {
        marker: { type: 'preset', value: 'hiro' },
        pointsEnabled: true,
        leadCollection: { collectName: false, collectEmail: false, collectPhone: false }
    }
}

// Function export for compatibility
export const getQuizTemplateConfig = (): IQuizTemplateConfig => QuizTemplateConfig

export default QuizTemplateConfig
