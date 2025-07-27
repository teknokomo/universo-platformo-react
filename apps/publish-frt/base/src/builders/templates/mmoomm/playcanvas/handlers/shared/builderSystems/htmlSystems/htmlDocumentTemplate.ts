// Universo Platformo | MMOOMM HTML Document Template
// Shared template for HTML document generation

import { BuildOptions } from '../../../../../../../common/types'
import { HTMLDocumentGenerator, IHTMLDocumentGenerator } from './HTMLDocumentGenerator'

/**
 * Creates a standardized HTML document generator
 * @returns HTML document generator instance
 */
export function createHTMLDocumentGenerator(): IHTMLDocumentGenerator {
    return new HTMLDocumentGenerator()
}

/**
 * Generates HTML document code string for injection
 * Used by builder to create complete HTML documents
 * @param sceneScript PlayCanvas scene script
 * @param embeddedJavaScript Embedded JavaScript systems
 * @param options Build options
 * @returns Complete HTML document string
 */
export function generateHTMLDocumentCode(
    sceneScript: string,
    embeddedJavaScript: string,
    options: BuildOptions = {}
): string {
    const generator = createHTMLDocumentGenerator()
    return generator.generateDocument(sceneScript, embeddedJavaScript, options)
}

/**
 * Generates library scripts section
 * @param librarySources Array of library URLs
 * @returns Library script tags string
 */
export function generateLibraryScriptsCode(librarySources: string[]): string {
    const generator = createHTMLDocumentGenerator()
    return generator.generateLibraryScripts(librarySources)
}

/**
 * Generates HUD styles section
 * @returns CSS styles string
 */
export function generateHUDStylesCode(): string {
    const generator = createHTMLDocumentGenerator()
    return generator.generateHUDStyles()
}

/**
 * Generates HUD structure section
 * @returns HTML structure string
 */
export function generateHUDStructureCode(): string {
    const generator = createHTMLDocumentGenerator()
    return generator.generateHUDStructure()
}
