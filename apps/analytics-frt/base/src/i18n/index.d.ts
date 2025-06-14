// Universo Platformo | Analytics module i18n TypeScript definitions

export interface AnalyticsTranslations {
    analytics: {
        title: string
        searchPlaceholder: string
        selectQuiz: string
        noQuizzesFound: string
        selectQuizToView: string
        noDataAvailable: string
        metrics: {
            totalParticipants: string
            averageScore: string
            maxScore: string
            totalPoints: string
        }
        table: {
            name: string
            email: string
            points: string
            completionDate: string
            chatflowId: string
            notSpecified: string
        }
        loading: string
        error: string
    }
}

export interface AnalyticsTranslationsObject {
    en: AnalyticsTranslations
    ru: AnalyticsTranslations
}

export declare const analyticsTranslations: AnalyticsTranslationsObject
export declare function getAnalyticsTranslations(language: string): AnalyticsTranslations['analytics']
export default analyticsTranslations
