/**
 * Tool and Node component types
 */

/**
 * Component category
 */
export type ComponentCategory = 
    | 'Chat Models'
    | 'Agents'
    | 'Chains'
    | 'Tools'
    | 'Memory'
    | 'Document Loaders'
    | 'Text Splitters'
    | 'Vector Stores'
    | 'Embeddings'
    | 'Output Parsers'
    | 'Utilities'

/**
 * Node/Component input parameter
 */
export interface ComponentInput {
    readonly label: string
    readonly name: string
    readonly type: string
    readonly placeholder?: string
    readonly description?: string
    readonly default?: unknown
    readonly optional?: boolean
    readonly rows?: number
    readonly list?: boolean
    readonly acceptVariable?: boolean
    readonly options?: readonly { label: string; name: string; description?: string }[]
}

/**
 * Tool component metadata
 */
export interface Tool {
    readonly name: string
    readonly label: string
    readonly description: string
    readonly category: ComponentCategory
    readonly icon?: string
    readonly version: number
    readonly baseClasses?: readonly string[]
    readonly inputs?: readonly ComponentInput[]
}

/**
 * Node component metadata (alias for Tool with additional properties)
 */
export interface Node extends Tool {
    readonly filePath?: string
    readonly badge?: string
}

/**
 * Component icon data
 */
export interface ComponentIcon {
    readonly src: string
    readonly type?: 'svg' | 'png' | 'emoji'
}
