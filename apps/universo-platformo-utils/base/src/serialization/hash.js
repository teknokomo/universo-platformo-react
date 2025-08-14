"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFNV1a32 = hashFNV1a32;
function hashFNV1a32(input) {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
}
//# sourceMappingURL=hash.js.map