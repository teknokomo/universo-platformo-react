// Universo Platformo | Template Registry
// Central registry for managing export templates

import { ITemplateBuilder, TemplateInfo } from './types'
import { ARJSQuizBuilder } from '../templates/quiz/arjs/ARJSQuizBuilder'
import { PlayCanvasMMOOMMBuilder } from '../templates/mmoomm/playcanvas/PlayCanvasMMOOMMBuilder'

/**
 * Central registry for all export templates
 */
export class TemplateRegistry {
    private static templates = new Map<string, TemplateInfo>()

    /**
     * Initialize registry with available templates
     */
    static initialize(): void {
        // Initializing templates - detailed logs disabled for production

        // Register Quiz template
        const quizInfo = new ARJSQuizBuilder().getTemplateInfo()
        this.registerTemplate({
            id: quizInfo.id,
            name: quizInfo.name,
            description: quizInfo.description,
            version: quizInfo.version,
            technology: quizInfo.technology,
            supportedNodes: quizInfo.supportedNodes,
            features: quizInfo.features,
            defaults: quizInfo.defaults,
            builder: ARJSQuizBuilder,
            i18nNamespace: (quizInfo as unknown as { i18nNamespace?: string }).i18nNamespace
        })
        // Quiz template registered - detailed logs disabled for production

        // Universo Platformo | Register PlayCanvas MMOOMM template (with Colyseus fixes)
        const mmoommInfo = new PlayCanvasMMOOMMBuilder().getTemplateInfo()
        this.registerTemplate({
            id: mmoommInfo.id,
            name: mmoommInfo.name,
            description: mmoommInfo.description,
            version: mmoommInfo.version,
            technology: mmoommInfo.technology,
            supportedNodes: mmoommInfo.supportedNodes,
            features: mmoommInfo.features,
            defaults: mmoommInfo.defaults,
            builder: PlayCanvasMMOOMMBuilder,
            i18nNamespace: (mmoommInfo as unknown as { i18nNamespace?: string }).i18nNamespace
        })

        console.log(`[TemplateRegistry] Registered ${this.templates.size} templates`)
    }

    /**
     * Register a new template
     */
    static registerTemplate(template: TemplateInfo): void {
        this.templates.set(template.id, template)
        // Template registered - detailed logs disabled for production
    }

    /**
     * Get all available templates
     */
    static getTemplates(): TemplateInfo[] {
        return Array.from(this.templates.values())
    }

    /**
     * Get template by ID
     */
    static getTemplate(id: string): TemplateInfo | undefined {
        return this.templates.get(id)
    }

    /**
     * Get default template
     */
    static getDefaultTemplate(): TemplateInfo {
        // Quiz is the default template
        const quiz = this.getTemplate('quiz')
        if (!quiz) {
            throw new Error('[TemplateRegistry] Default quiz template not found')
        }
        return quiz
    }

    /**
     * Create builder instance for template
     */
    static createBuilder(templateId: string): ITemplateBuilder {
        // Creating builder instance - detailed logs disabled for production

        const template = this.getTemplate(templateId)
        if (!template) {
            console.error('[TemplateRegistry] Template not found:', templateId)
            throw new Error(`[TemplateRegistry] Template not found: ${templateId}`)
        }

        // Builder instance creation - detailed logs disabled for production
        const builderInstance = new template.builder()
        return builderInstance
    }

    /**
     * Check if template exists
     */
    static hasTemplate(id: string): boolean {
        return this.templates.has(id)
    }

    /**
     * Get template count
     */
    static getTemplateCount(): number {
        return this.templates.size
    }
}

// Initialize registry
TemplateRegistry.initialize()
