import { getQuizMetaPrompt } from './prompts/quiz'
import { getPreparePrompt } from './prompts/prepare'
import { getRevisePrompt } from './prompts/revise'
import { getNormalizePrompt } from './prompts/normalize'
import { callProvider } from './providers/ModelFactory'
import type { QuizPlan } from '../schemas/quiz'
import { QuizPlanSchema } from '../schemas/quiz'
import { ManualQuizParseError, parseManualQuizText } from './parsers/manualQuiz'

export const MANUAL_QUIZ_MAX_LENGTH = 6000

export class SpaceBuilderService {
  // Layout constants for deterministic positioning
  private readonly SPACE_V = 1000
  private readonly Q_OFFSET_X = Math.round(this.SPACE_V / 2)
  // Node visual width is ~300 in Flow UI; keep safe margin to avoid overlap
  private readonly NODE_WIDTH = 300
  private readonly NODE_MARGIN_X = 60
  private readonly A_OFFSET_X = Math.max(Math.round(this.Q_OFFSET_X / 2), this.NODE_WIDTH + this.NODE_MARGIN_X)
  private readonly A_OFFSET_Y = 200
  private readonly BASE_X = 840
  private readonly BASE_Y = 40

  // Generate graph JSON by calling an LLM with a meta-prompt (legacy single-question mode)
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
  async proposeQuiz(input: { sourceText: string; selectedChatModel: { provider: string; modelName: string; credentialId?: string }; options: { questionsCount: number; answersPerQuestion: number }; additionalConditions?: string }): Promise<QuizPlan> {
    const prompt = getPreparePrompt({ sourceText: input.sourceText, questionsCount: input.options.questionsCount, answersPerQuestion: input.options.answersPerQuestion, additionalConditions: input.additionalConditions?.trim() || undefined })
    const llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt })
    const json = this.extractAnyJSON(llmText)
    if (!json) throw new Error('Failed to parse quiz plan JSON from provider')
    return this.normalizePlan(json)
  }

  // Generate graph from an existing quiz plan (deterministic)
  async generateFromPlan(input: { quizPlan: QuizPlan; selectedChatModel: { provider: string; modelName: string; credentialId?: string }; options?: { includeStartCollectName?: boolean; includeEndScore?: boolean; generateAnswerGraphics?: boolean } }): Promise<{ nodes: any[]; edges: any[] }> {
    const json = this.buildGraphFromPlan(input.quizPlan, input.options)
    return this.normalize(json)
  }

  // Revise existing quiz plan with minimal changes
  async reviseQuizPlan(input: { quizPlan: QuizPlan; instructions: string; selectedChatModel: { provider: string; modelName: string; credentialId?: string } }): Promise<QuizPlan> {
    const currentPlanJson = JSON.stringify(input.quizPlan)
    const prompt = getRevisePrompt({ currentPlanJson, instructions: String(input.instructions || '').slice(0, 500) })
    let llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt })
    let json = this.extractAnyJSON(llmText)
    if (!json) {
      llmText = await callProvider({ provider: input.selectedChatModel.provider, model: input.selectedChatModel.modelName, credentialId: input.selectedChatModel.credentialId, prompt: `${prompt}\nSTRICT: Output RAW JSON only.` })
      json = this.extractAnyJSON(llmText)
    }
    if (!json) throw new Error('Failed to parse revised quiz plan JSON from provider')
    return this.normalizePlan(json)
  }

  async normalizeManualQuiz(input: {
    rawText: string
    selectedChatModel: { provider?: string; modelName?: string; credentialId?: string }
    fallbackToLLM?: boolean
  }): Promise<QuizPlan> {
    try {
      const manualPlan = parseManualQuizText(input.rawText)
      const parsed = QuizPlanSchema.safeParse(manualPlan)
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => issue.message || issue.code)
        throw new ManualQuizParseError('Manual quiz validation failed', issues)
      }
      return parsed.data
    } catch (err) {
      if (!(err instanceof ManualQuizParseError)) {
        throw err
      }
      if (!input.fallbackToLLM) {
        throw err
      }

      const prompt = getNormalizePrompt({ rawText: String(input.rawText || '').slice(0, MANUAL_QUIZ_MAX_LENGTH) })
      const provider = String(input.selectedChatModel.provider || '').trim()
      const modelName = String(input.selectedChatModel.modelName || '').trim()
      if (!provider || !modelName) {
        throw new ManualQuizParseError('AI normalization is unavailable', [
          'Select a chat model before using AI fallback for manual normalization.'
        ])
      }
      const llmText = await callProvider({
        provider,
        model: modelName,
        credentialId: input.selectedChatModel.credentialId,
        prompt
      })
      const json = this.extractAnyJSON(llmText)
      if (!json) {
        throw new ManualQuizParseError('AI normalization returned no JSON', [
          'The AI fallback could not produce a valid quiz structure. Please fix the text manually.'
        ])
      }
      const parsed = QuizPlanSchema.safeParse(json)
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => issue.message || issue.code)
        throw new ManualQuizParseError('AI normalization produced invalid quiz plan', issues)
      }
      return this.normalizePlan(parsed.data)
    }
  }

  private extractAnyJSON(text: string): any | null {
    const raw = String(text || '')
    const trimmed = raw.trim()
    if (!trimmed) return null

    const candidates = new Set<string>([trimmed])

    // Handle Markdown code fences like ```json\n{ ... }\n``` or ```\n[ ... ]\n```
    if (trimmed.startsWith('```')) {
      const fenceMatch = trimmed.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)```$/)
      if (fenceMatch?.[1]) {
        candidates.add(fenceMatch[1].trim())
      }
    }

    const curlyStart = trimmed.indexOf('{')
    const curlyEnd = trimmed.lastIndexOf('}')
    if (curlyStart >= 0 && curlyEnd > curlyStart) {
      candidates.add(trimmed.substring(curlyStart, curlyEnd + 1))
    }

    const arrayStart = trimmed.indexOf('[')
    const arrayEnd = trimmed.lastIndexOf(']')
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      candidates.add(trimmed.substring(arrayStart, arrayEnd + 1))
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
        if (typeof parsed === 'string') {
          const inner = parsed.trim()
          if (inner) {
            try {
              const reparsed = JSON.parse(inner)
              if (reparsed && typeof reparsed === 'object') {
                return reparsed
              }
            } catch (_) {}
          }
        }
      } catch (_) {
        continue
      }
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

  private buildGraphFromPlan(plan: QuizPlan, opts?: { includeStartCollectName?: boolean; includeEndScore?: boolean; generateAnswerGraphics?: boolean }): { nodes: any[]; edges: any[] } {
    const includeStart = opts?.includeStartCollectName ?? true
    const includeEnd = opts?.includeEndScore ?? true

    const nodes: any[] = []
    const edges: any[] = []

    let spaceSeq = 0
    let dataSeq = 0
    let edgeSeq = 0

    const newSpaceId = () => `Space_${spaceSeq++}`
    const newDataId = () => `Data_${dataSeq++}`
    const newEdgeId = (s: string, t: string) => `e_${s}_${t}_${edgeSeq++}`

    const addSpace = (spaceName: string, extraInputs: Record<string, any> = {}) => {
      const id = newSpaceId()
      const y = this.BASE_Y + (spaceSeq - 1) * this.SPACE_V
      nodes.push({
        id,
        type: 'customNode',
        position: { x: this.BASE_X, y },
        data: { id, name: 'Space', label: 'Space', category: 'UPDL', inputs: { spaceName, isRootNode: true, ...extraInputs } }
      })
      return { id, y }
    }

    let prev: { id: string; y: number } | null = null
    if (includeStart) prev = addSpace('Start', { collectLeadName: true })

    if (!Array.isArray(plan?.items) || plan.items.length === 0) return { nodes, edges }

    plan.items.forEach((item, idx) => {
      const level = addSpace(`Level ${idx + 1}`)
      if (prev) edges.push({ source: prev.id, target: level.id, type: 'buttonedge', id: newEdgeId(prev.id, level.id) })

      const qName = `Q${idx + 1}`
      const qId = newDataId()
      const qX = this.BASE_X - this.Q_OFFSET_X
      const qY = level.y

      nodes.push({
        id: qId,
        type: 'customNode',
        position: { x: qX, y: qY },
        data: { id: qId, name: 'Data', label: 'Data', category: 'UPDL', inputs: { dataName: qName, dataType: 'question', content: item.question } }
      })
      edges.push({ source: qId, target: level.id, type: 'buttonedge', id: newEdgeId(qId, level.id) })

      item.answers.forEach((ans, j) => {
        const aName = `${qName}A${j + 1}`
        const aId = newDataId()
        const aX = qX - (j + 1) * this.A_OFFSET_X
        const aY = qY + this.A_OFFSET_Y

        nodes.push({
          id: aId,
          type: 'customNode',
          position: { x: aX, y: aY },
          data: {
            id: aId,
            name: 'Data',
            label: 'Data',
            category: 'UPDL',
            inputs: {
              dataName: aName,
              dataType: 'answer',
              content: ans.text,
              isCorrect: !!ans.isCorrect,
              enablePoints: !!ans.isCorrect,
              pointsValue: 1
            }
          }
        })
        edges.push({ source: aId, target: qId, type: 'buttonedge', id: newEdgeId(aId, qId) })
      })

      prev = level
    })

    if (includeEnd) {
      const end = addSpace('End', { showPoints: true })
      if (prev) edges.push({ source: prev.id, target: end.id, type: 'buttonedge', id: newEdgeId(prev.id, end.id) })
    }

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
    const safeEdges = edges.map((e: any, i: number) => ({
      ...e,
      id: String(e?.id || `E_${i}`),
      source: String(e?.source || ''),
      target: String(e?.target || ''),
      type: e?.type || 'buttonedge'
    }))
    return { nodes: safeNodes, edges: safeEdges }
  }
}

export const spaceBuilderService = new SpaceBuilderService()
