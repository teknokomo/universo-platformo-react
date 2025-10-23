// @universo/template-mmoomm - Main Package Entry Point
// Universal template system for MMOOMM functionality

// PlayCanvas is the primary technology for now
export * from './playcanvas'

// Common utilities and types
export * from './common'

// Re-export key interfaces for convenience
export type { ITemplateBuilder, BuildOptions, ProcessedGameData } from './common/types'