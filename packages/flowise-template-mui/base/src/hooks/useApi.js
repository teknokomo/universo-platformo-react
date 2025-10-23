// Minimal useApi hook shim for build-time
export default function useApi() {
    return {
        request: async () => ({ data: null }),
        data: null,
        error: null,
        loading: false
    }
}
