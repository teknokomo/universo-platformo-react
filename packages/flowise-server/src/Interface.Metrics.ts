export interface IMetricsProvider {
    getName(): string
    initializeCounters(): void
    setupMetricsEndpoint(): void
    incrementCounter(counter: FLOWISE_METRIC_COUNTERS, payload: any): void
}

export enum FLOWISE_COUNTER_STATUS {
    SUCCESS = 'success',
    FAILURE = 'failure'
}

export enum FLOWISE_METRIC_COUNTERS {
    CANVAS_CREATED = 'canvas_created',
    AGENTFLOW_CREATED = 'agentflow_created',
    ASSISTANT_CREATED = 'assistant_created',
    TOOL_CREATED = 'tool_created',
    VECTORSTORE_UPSERT = 'vector_upserted',

    CANVAS_PREDICTION_INTERNAL = 'canvas_prediction_internal',
    CANVAS_PREDICTION_EXTERNAL = 'canvas_prediction_external',

    AGENTFLOW_PREDICTION_INTERNAL = 'agentflow_prediction_internal',
    AGENTFLOW_PREDICTION_EXTERNAL = 'agentflow_prediction_external'
}
