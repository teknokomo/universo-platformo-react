import { getQuizMetaPrompt } from './prompts/quiz'
import { callProvider } from './providers/ModelFactory'

export class SpaceBuilderService {
  // Generate graph JSON by calling an LLM with a meta-prompt
  async generate(input: { question: string; selectedChatModel: { provider:string; modelName:string; credentialId?:string } }): Promise<{ nodes: any[]; edges: any[] }> {
    const system = getQuizMetaPrompt()
    const user = String(input.question || '').trim()
    if (!user) return { nodes: [], edges: [] }
    const prompt = `${system}\nUser Request: "${user}"`

    // First attempt
    let llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt })
    let json = this.extractJSON(llmText)
    if (!json) {
      // Second attempt with strict JSON instruction
      llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt: `${prompt}\nSTRICT: Output raw JSON only.` })
      json = this.extractJSON(llmText) || { nodes: [], edges: [] }
    }
    return this.normalize(json)
  }

  private extractJSON(text: string): { nodes: any[]; edges: any[] } | null {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && 'nodes' in parsed && 'edges' in parsed) return parsed as any
    } catch (_) {}
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.substring(start, end + 1))
        if (parsed && typeof parsed === 'object' && 'nodes' in parsed && 'edges' in parsed) return parsed as any
      } catch (_) {}
    }
    return null
  }

  private normalize(graph: any): { nodes: any[]; edges: any[] } {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
    const edges = Array.isArray(graph?.edges) ? graph.edges : []
    const safeNodes = nodes.map((n: any, i: number) => ({
      id: String(n?.id || `N_${i}`),
      type: 'customNode',
      position: n?.position || { x: 0, y: i * 80 },
      data: {
        ...(n?.data || {}),
        name: String(n?.data?.name || 'Data'),
        label: n?.data?.label || n?.data?.name || 'Node',
        category: n?.data?.category || 'UPDL',
        inputs: n?.data?.inputs || {},
        inputAnchors: Array.isArray(n?.data?.inputAnchors) ? n.data.inputAnchors : [],
        inputParams: Array.isArray(n?.data?.inputParams) ? n.data.inputParams : [],
        outputAnchors: Array.isArray(n?.data?.outputAnchors) ? n.data.outputAnchors : [],
        tags: Array.isArray(n?.data?.tags) ? n.data.tags : [],
        selected: false,
        version: n?.data?.version || 1
      }
    }))
    const safeEdges = edges.map((e: any) => ({
      ...e,
      source: String(e?.source || ''),
      target: String(e?.target || ''),
      type: e?.type || 'buttonedge'
    }))
    return { nodes: safeNodes, edges: safeEdges }
  }
}

export const spaceBuilderService = new SpaceBuilderService()
