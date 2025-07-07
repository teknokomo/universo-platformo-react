// Universo Platformo | Quiz Template Configuration
// Configuration for AR.js Quiz Template

export interface QuizTemplateConfig {
    id: string
    name: string
    description: string
    version: string
    technology: string
    supportedNodes: string[]
    features: string[]
    defaults: {
        marker: {
            type: string
            value: string
        }
        pointsEnabled: boolean
        leadCollection: {
            collectName: boolean
            collectEmail: boolean
            collectPhone: boolean
        }
    }
}

export const QuizTemplateConfig: QuizTemplateConfig = {
    id: 'quiz',
    name: 'Квиз-приложение',
    description: 'Интерактивные квизы с системой баллов и сбором контактов',
    version: '0.1.0',
    technology: 'arjs',

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
