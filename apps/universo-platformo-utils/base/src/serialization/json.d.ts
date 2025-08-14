export type SafeParseResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: Error;
};
export declare function safeParseJson<T = unknown>(raw: string): SafeParseResult<T>;
