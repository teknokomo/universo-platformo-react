"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseJson = safeParseJson;
function safeParseJson(raw) {
    try {
        const value = JSON.parse(raw);
        return { ok: true, value };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e : new Error('Invalid JSON') };
    }
}
//# sourceMappingURL=json.js.map