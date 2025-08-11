import { getQuizMetaPrompt } from './prompts/quiz'
import { getPreparePrompt } from './prompts/prepare'
import { callProvider } from './providers/ModelFactory'
import type { QuizPlan } from '../schemas/quiz'

export class SpaceBuilderService {
  // Generate graph JSON by calling an LLM with a meta-prompt
  async generate(input: { question: string; selectedChatModel: { provider: string; modelName: string; credentialId?: string } }): Promise<{ nodes: any[]; edges: any[] }> {
    const system = getQuizMetaPrompt()
    const user = String(input.question || '').trim()
    if (!user) return { nodes: [], edges: [] }
    const prompt = `${system}\nUser Request: "${user}"`

    // First attempt
    let llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt })
    let json = this.extractGraphJSON(llmText)
    if (!json) {
      // Second attempt with strict JSON instruction
      llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt: `${prompt}\nSTRICT: Output raw JSON only.` })
      json = this.extractGraphJSON(llmText) || { nodes: [], edges: [] }
    }
    return this.normalize(json)
  }

  // Propose quiz plan from study material
  async proposeQuiz(input: { sourceText: string; selectedChatModel: { provider: string; modelName: string; credentialId?: string }; options: { questionsCount: number; answersPerQuestion: number } }): Promise<QuizPlan> {
    const prompt = getPreparePrompt({ sourceText: input.sourceText, questionsCount: input.options.questionsCount, answersPerQuestion: input.options.answersPerQuestion })
    const llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt })
    const json = this.extractAnyJSON(llmText)
    if (!json) throw new Error('Failed to parse quiz plan JSON from provider')
    return this.normalizePlan(json)
  }

  // Generate graph from an existing quiz plan
  async generateFromPlan(input: { quizPlan: QuizPlan; selectedChatModel: { provider: string; modelName: string; credentialId?: string } }): Promise<{ nodes: any[]; edges: any[] }> {
    const system = getQuizMetaPrompt()
    const planStr = JSON.stringify(input.quizPlan)
    const prompt = `${system}\nUser Request: "Generate UPDL graph for this quiz plan."\nQuizPlan: ${planStr}\nSTRICT: Output raw JSON only.`

    let llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt })
    let json = this.extractGraphJSON(llmText)
    if (!json) {
      // Second attempt
      llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt: `${prompt}\nSTRICT: Output raw JSON only.` })
      json = this.extractGraphJSON(llmText)
    }
    if (!json) {
      json = this.buildGraphFromPlan(input.quizPlan) // deterministic fallback graph
    }
    return this.normalize(json)
  }

  private extractAnyJSON(text: string): any | null {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') return parsed
    } catch (_) {}
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.substring(start, end + 1))
        if (parsed && typeof parsed === 'object') return parsed
      } catch (_) {}
    }
    return null
  }

  private extractGraphJSON(text: string): { nodes: any[]; edges: any[] } | null {
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

  private normalizePlan(plan: any): QuizPlan {
    const items = Array.isArray(plan?.items) ? plan.items : []
    return {
      items: items.map((it: any) => ({
        question: String(it?.question || '').slice(0, 400),
        answers: Array.isArray(it?.answers)
          ? it.answers.map((a: any) => ({ text: String(a?.text || '').slice(0, 400), isCorrect: Boolean(a?.isCorrect) }))
          : []
      }))
    }
  }

  private buildGraphFromPlan(plan: QuizPlan): { nodes: any[]; edges: any[] } {
    const nodes: any[] = []
    const edges: any[] = []
    const spaceId = 'Space_0'
    nodes.push({
      id: spaceId,
      type: 'customNode',
      position: { x: 0, y: 0 },
      data: { id: spaceId, name: 'Space', label: 'Space', category: 'UPDL', inputs: { spaceName: 'Start' } }
    })
    let y = 0
    plan.items.forEach((item, idx) => {
      const qId = `Q${idx + 1}`
      nodes.push({
        id: qId,
        type: 'customNode',
        position: { x: -300, y },
        data: { id: qId, name: 'Data', label: 'Data', category: 'UPDL', inputs: { dataType: 'question', content: item.question } }
      })
      edges.push({ source: qId, target: spaceId, type: 'buttonedge', id: `e_${qId}_${spaceId}` })
      item.answers.forEach((ans, ai) => {
        const aId = `${qId}_A${ai + 1}`
        nodes.push({
          id: aId,
          type: 'customNode',
          position: { x: -520 + ai * 200, y: y + 190 },
          data: { id: aId, name: 'Data', label: 'Data', category: 'UPDL', inputs: { dataType: 'answer', content: ans.text, isCorrect: !!ans.isCorrect } }
        })
        edges.push({ source: aId, target: qId, type: 'buttonedge', id: `e_${aId}_${qId}` })
      })
      y += 320
    })
    return { nodes, edges }
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
