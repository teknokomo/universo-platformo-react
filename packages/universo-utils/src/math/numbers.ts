export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const approxEq = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
