export type SelectedChatModel = { provider: string; modelName: string; credentialId?: string }

export interface QuizPlan {
  items: Array<{ question: string; answers: Array<{ text: string; isCorrect: boolean }> }>
}

export interface PreparePayload {
  sourceText: string
  selectedChatModel: SelectedChatModel
  options: { questionsCount: number; answersPerQuestion: number }
}

export interface GenerateFlowPayload {
  question?: string
  selectedChatModel: SelectedChatModel
  quizPlan?: QuizPlan
}

export interface GeneratedFlowResponse {
  nodes: unknown[]
  edges: unknown[]
}

export function useSpaceBuilder() {
  async function callWithRefresh<T = any>(path: string, body: unknown): Promise<T> {
    const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
    const call = async (bearer?: string) =>
      fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(body)
      })

    let res = await call(token)
    if (res.status === 401) {
      try {
        await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
      } catch (_) {}
      const newToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || token
      res = await call(newToken)
    }

    const ct = res.headers.get('content-type') || ''
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Request failed: ${res.status}`)
    }
    if (!ct.includes('application/json')) {
      const text = await res.text().catch(() => '')
      const snippet = text ? ` | ${text.slice(0, 200)}` : ''
      throw new Error(`Bad response type: ${ct || 'unknown'}${snippet}`)
    }
    return (await res.json()) as T
  }

  async function prepareQuiz(payload: PreparePayload): Promise<QuizPlan> {
    const data = await callWithRefresh<{ quizPlan: QuizPlan }>('/api/v1/space-builder/prepare', payload)
    return data.quizPlan
  }

  async function generateFlow(payload: GenerateFlowPayload): Promise<GeneratedFlowResponse> {
    return callWithRefresh<GeneratedFlowResponse>('/api/v1/space-builder/generate', payload)
  }

  return { prepareQuiz, generateFlow }
}
