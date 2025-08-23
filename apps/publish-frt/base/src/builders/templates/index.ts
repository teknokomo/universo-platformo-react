// Thin registry for external templates
// English comments only inside code

export type ExternalTemplateInfo = {
  id: string
  package: string
  builder: string
}

export const externalTemplates: ExternalTemplateInfo[] = [
  {
    id: 'mmoomm-playcanvas',
    package: '@universo/template-mmoomm',
    builder: 'PlayCanvasMMOOMMBuilder'
  }
]

// Helper to discover external template metadata (future use)
export function getExternalTemplateById(id: string): ExternalTemplateInfo | undefined {
  return externalTemplates.find(t => t.id === id)
}

