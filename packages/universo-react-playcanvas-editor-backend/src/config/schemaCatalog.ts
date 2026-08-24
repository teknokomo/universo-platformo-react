import { playCanvasEditorSchemaCatalogSchema, type PlayCanvasEditorSchemaCatalog } from '@universo-react/types'
import generatedSchemaCatalogJson from './generated-schema-catalog.json'

export const SCHEMA_CATALOG_VERSION = 1

const validatedSchemaCatalog: PlayCanvasEditorSchemaCatalog = playCanvasEditorSchemaCatalogSchema.parse(generatedSchemaCatalogJson)

export const buildEditorSchemaCatalog = (): PlayCanvasEditorSchemaCatalog => structuredClone(validatedSchemaCatalog)
