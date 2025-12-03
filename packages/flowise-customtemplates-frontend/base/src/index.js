/**
 * @fileoverview Main entry point for @flowise/customtemplates-frontend package
 *
 * This package provides frontend components for custom templates management.
 * Components are exported as source (JSX) for integration with flowise-ui.
 *
 * @example
 * import { Templates, TemplateCanvas } from '@flowise/customtemplates-frontend'
 */

// Note: i18n is now built separately via tsdown and exported as ./i18n subpath
// No need to import it here for JSX source-only distribution

// Export page components
export { default as Templates } from './pages/Templates'
export { default as TemplateCanvas } from './pages/Templates/TemplateCanvas'
export { default as TemplateCanvasHeader } from './pages/Templates/TemplateCanvasHeader'
export { default as TemplateCanvasNode } from './pages/Templates/TemplateCanvasNode'
