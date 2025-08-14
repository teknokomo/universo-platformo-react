"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDelta = applyDelta;
function applyDelta(snapshot, delta) {
    const entities = { ...snapshot.entities };
    delta.added?.forEach((a) => {
        entities[a.entityId] = { ...(a.components || {}) };
    });
    delta.updated?.forEach((u) => {
        const cur = entities[u.entityId] || {};
        entities[u.entityId] = { ...cur, ...(u.components || {}) };
        u.removedComponents?.forEach((k) => {
            if (k in entities[u.entityId])
                delete entities[u.entityId][k];
        });
    });
    delta.removed?.forEach((id) => {
        delete entities[id];
    });
    return { tick: delta.tick, serverTimeMs: snapshot.serverTimeMs, entities, events: snapshot.events };
}
//# sourceMappingURL=applyDelta.js.map