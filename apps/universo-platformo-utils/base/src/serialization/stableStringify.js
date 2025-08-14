"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = stableStringify;
function stableStringify(value) {
    const seen = new WeakSet();
    const sort = (v) => {
        if (v === null || typeof v !== 'object')
            return v;
        if (seen.has(v))
            throw new Error('Circular reference');
        seen.add(v);
        if (Array.isArray(v))
            return v.map(sort);
        const out = {};
        for (const k of Object.keys(v).sort())
            out[k] = sort(v[k]);
        return out;
    };
    return JSON.stringify(sort(value));
}
//# sourceMappingURL=stableStringify.js.map