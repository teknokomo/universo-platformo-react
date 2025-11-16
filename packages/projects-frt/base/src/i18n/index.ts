// Universo Platformo | Projects module i18n
// Register consolidated projects namespace (includes Milestones, Tasks, members)
import { registerNamespace } from '@universo/i18n/registry'
import enProjects from './locales/en/projects.json'
import ruProjects from './locales/ru/projects.json'

// Register single consolidated namespace
registerNamespace('projects', {
    en: enProjects.projects,
    ru: ruProjects.projects
})

type LanguageCode = 'en' | 'ru'

interface ProjectsTranslation {
    projects: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ProjectsTranslation
}

// Export translations for backwards compatibility
export const projectsTranslations: TranslationsMap = {
    en: { projects: enProjects.projects },
    ru: { projects: ruProjects.projects }
}

export function getProjectsTranslations(language: LanguageCode): Record<string, unknown> {
    return projectsTranslations[language]?.projects || projectsTranslations.en.projects
}
