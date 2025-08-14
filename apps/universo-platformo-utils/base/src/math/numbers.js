"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approxEq = exports.lerp = exports.clamp = void 0;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
exports.clamp = clamp;
const lerp = (a, b, t) => a + (b - a) * t;
exports.lerp = lerp;
const approxEq = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
exports.approxEq = approxEq;
//# sourceMappingURL=numbers.js.map