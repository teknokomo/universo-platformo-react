// Universo Platformo | Quiz Template Configuration
// Configuration for AR.js Quiz Template

import { getQuizTemplateConfig } from '../common/config'
import type { IQuizTemplateConfig } from '../common/types'

// Export the template configuration
export const quizTemplateConfig: IQuizTemplateConfig = getQuizTemplateConfig()

// Re-export the type and function for backward compatibility
export type { IQuizTemplateConfig as QuizTemplateConfig }
export { getQuizTemplateConfig }
