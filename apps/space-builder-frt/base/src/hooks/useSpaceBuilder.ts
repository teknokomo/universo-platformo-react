export interface GenerateFlowPayload {
  question: string
  selectedChatModel: unknown
}

export interface GeneratedFlowResponse {
  nodes: unknown[]
  edges: unknown[]
}

export function useSpaceBuilder() {
  async function generateFlow(payload: GenerateFlowPayload): Promise<GeneratedFlowResponse> {
    const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || ''
    const call = async (bearer?: string) =>
      fetch('/api/v1/space-builder/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(payload)
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
    return (await res.json()) as GeneratedFlowResponse
  }

  return { generateFlow }
}
