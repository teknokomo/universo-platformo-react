// Universo Platformo | Template Registry
// Central registry for managing export templates

import { ITemplateBuilder, TemplateInfo } from './types'
import { ARJSQuizBuilder, QuizTemplateConfig } from '../templates/quiz/arjs'
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
        console.log('[TemplateRegistry] Initializing with available templates')

        // Register Quiz template
        this.registerTemplate({
            id: QuizTemplateConfig.id,
            name: QuizTemplateConfig.name,
            description: QuizTemplateConfig.description,
            version: QuizTemplateConfig.version,
            technology: QuizTemplateConfig.technology,
            supportedNodes: QuizTemplateConfig.supportedNodes,
            features: QuizTemplateConfig.features,
            defaults: QuizTemplateConfig.defaults,
            builder: ARJSQuizBuilder,
            // propagate i18n namespace if provided by config
            i18nNamespace: (QuizTemplateConfig as unknown as { i18nNamespace?: string }).i18nNamespace
        })

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
        console.log(`[TemplateRegistry] Registered template: ${template.id} (${template.name})`)
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
        // Quiz is the default (and currently only) template
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
        const template = this.getTemplate(templateId)
        if (!template) {
            throw new Error(`[TemplateRegistry] Template not found: ${templateId}`)
        }

        return new template.builder()
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
