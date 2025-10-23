// Template Quiz module i18n (TypeScript version)
// English comments only inside code

export type TemplateQuizNamespace = {
    quiz: {
        name: string
        description: string
    }
}

export type TemplateQuizTranslations = {
    templateQuiz: TemplateQuizNamespace
}

export const templateQuizTranslations: Record<string, TemplateQuizTranslations> = {
    en: {
        templateQuiz: {
            quiz: {
                name: 'Quiz Template',
                description: 'Interactive AR quiz with 3D objects and questionnaire'
            }
        }
    },
    ru: {
        templateQuiz: {
            quiz: {
                name: 'Шаблон викторины',
                description: 'Интерактивная AR викторина с 3D объектами и анкетированием'
            }
        }
    }
}

export function getTemplateQuizTranslations(language: string): TemplateQuizNamespace {
    return templateQuizTranslations[language]?.templateQuiz || templateQuizTranslations.en.templateQuiz
}

export default templateQuizTranslations
