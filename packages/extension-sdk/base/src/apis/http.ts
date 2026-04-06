export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export interface HttpRequestOptions {
    method?: HttpMethod
    headers?: Record<string, string>
    query?: Record<string, string | number | boolean | null | undefined>
    body?: unknown
    timeoutMs?: number
}

export interface HttpResponse<TData = unknown> {
    status: number
    ok: boolean
    headers: Record<string, string>
    data: TData
}

export interface HttpAPI {
    request<TData = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<TData>>
    get<TData = unknown>(url: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<TData>>
    post<TData = unknown>(url: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<TData>>
    put<TData = unknown>(url: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<TData>>
    patch<TData = unknown>(url: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<TData>>
    delete<TData = unknown>(url: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<TData>>
}