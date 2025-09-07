// Common types for template-quiz package

// Quiz data types (compatible with space-builder-srv)
export interface QuizAnswer {
    text: string
    isCorrect: boolean
    pointsValue?: number
    enablePoints?: boolean
}

export interface QuizItem {
    question: string
    answers: QuizAnswer[]
}

export interface QuizPlan {
    items: QuizItem[]
}

// Template configuration interface
export interface IQuizTemplateConfig {
    id: string
    name: string
    description: string
    version: string
    technology: string
    i18nNamespace: string
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

// Build options interface
export interface BuildOptions {
    includeStartCollectName?: boolean
    includeEndScore?: boolean
    generateAnswerGraphics?: boolean
    canvasId?: string // Canvas ID for new structure
    chatflowId?: string // Legacy chatflow ID for backward compatibility
    markerType?: string // AR marker type
    markerValue?: string // AR marker value
    [key: string]: any
}

// Template builder interface
export interface ITemplateBuilder {
    build(flowData: any, options?: BuildOptions): Promise<string>
    getTemplateInfo(): IQuizTemplateConfig
}

// Flow data interface (from UPDL)
export interface IFlowData {
    flowData?: string
    nodes?: any[]
    edges?: any[]
    updlSpace?: any
    multiScene?: any
    [key: string]: any
}

// Build result interface (compatible with publish-frt)
export interface BuildResult {
    success: boolean
    html?: string
    error?: string
    metadata?: {
        buildTime: number
        markerType: string
        markerValue: string
        templateId?: string
        templateInfo?: IQuizTemplateConfig
        libraryVersions: Record<string, string>
    }
}