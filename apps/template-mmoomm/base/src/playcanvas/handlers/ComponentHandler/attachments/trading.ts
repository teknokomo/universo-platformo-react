export default function tradingAttachment(component: any, entityVar: string): string {
    // Use best-effort resolution across possible shapes (data, inputs, properties)
    const resolveNumber = (v: any, def: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    };
    const resolvePath = (obj: any, keys: string[]): any => {
        for (const k of keys) {
            const val = k.split('.').reduce((acc: any, key: string) => (acc ? acc[key] : undefined), obj);
            if (val !== undefined && val !== null && val !== '') return val;
        }
        return undefined;
    };
    const priceRaw = resolvePath(component, [
        'data.pricePerTon',
        'data.inputs.pricePerTon',
        'data.properties.pricePerTon',
        'properties.pricePerTon',
        'inputs.pricePerTon'
    ]);
    const rangeRaw = resolvePath(component, [
        'data.interactionRange',
        'data.inputs.interactionRange',
        'data.properties.interactionRange',
        'properties.interactionRange',
        'inputs.interactionRange'
    ]);
    const pricePerTon = resolveNumber(priceRaw, 10);
    const interactionRange = resolveNumber(rangeRaw, 15);
    return `
    // Attach trading component ${component.id}
    ${entityVar}.tradingPost = {
        pricePerTon: ${pricePerTon},
        interactionRange: ${interactionRange},

        // Check if ship is in range (distance from station's world-space AABB)
        // English comments only inside code
        isShipInRange(ship) {
            // Build or reuse cached union AABB on the entity
            if (!${entityVar}.__stationAabb || ${entityVar}.__stationAabb.__empty) {
                const collectMeshAabbs = (root) => {
                    const out = [];
                    const stack = [root];
                    while (stack.length) {
                        const node = stack.pop();
                        if (node && node.model && node.model.meshInstances) {
                            node.model.meshInstances.forEach(mi => mi && mi.aabb && out.push(mi.aabb));
                        }
                        if (node && node.render && node.render.meshInstances) {
                            node.render.meshInstances.forEach(mi => mi && mi.aabb && out.push(mi.aabb));
                        }
                        if (node && node.children && node.children.length) stack.push.apply(stack, node.children);
                    }
                    return out;
                };

                const buildUnionAabb = (aabbs) => {
                    if (!aabbs.length) return null;
                    const first = aabbs[0];
                    const min = first.center.clone().sub(first.halfExtents);
                    const max = first.center.clone().add(first.halfExtents);
                    for (let i = 1; i < aabbs.length; i++) {
                        const bb = aabbs[i];
                        const bbMin = bb.center.clone().sub(bb.halfExtents);
                        const bbMax = bb.center.clone().add(bb.halfExtents);
                        min.x = Math.min(min.x, bbMin.x);
                        min.y = Math.min(min.y, bbMin.y);
                        min.z = Math.min(min.z, bbMin.z);
                        max.x = Math.max(max.x, bbMax.x);
                        max.y = Math.max(max.y, bbMax.y);
                        max.z = Math.max(max.z, bbMax.z);
                    }
                    return { min, max };
                };

                const aabbs = collectMeshAabbs(${entityVar});
                const union = buildUnionAabb(aabbs);
                ${entityVar}.__stationAabb = union || { __empty: true };
            }

            const shipPos = ship.getPosition();
            if (${entityVar}.__stationAabb && !${entityVar}.__stationAabb.__empty) {
                const aabb = ${entityVar}.__stationAabb;
                const cx = Math.max(aabb.min.x, Math.min(shipPos.x, aabb.max.x));
                const cy = Math.max(aabb.min.y, Math.min(shipPos.y, aabb.max.y));
                const cz = Math.max(aabb.min.z, Math.min(shipPos.z, aabb.max.z));
                const dx = shipPos.x - cx;
                const dy = shipPos.y - cy;
                const dz = shipPos.z - cz;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                return distance <= this.interactionRange;
            }

            // Fallback to center distance if meshes unavailable yet
            const fallbackDistance = ${entityVar}.getPosition().distance(shipPos);
            return fallbackDistance <= this.interactionRange;
        },

        trade(ship, itemType, amount) {
            if (!this.isShipInRange(ship)) {
                return { success: false, message: 'Ship too far from station' };
            }

            if (ship.inventory && ship.inventory.removeItem(itemType, amount)) {
                const payment = amount * this.pricePerTon;
                if (!ship.currency) ship.currency = 0;
                ship.currency += payment;
                return { success: true, payment: payment };
            }

            return { success: false, message: 'Trade failed' };
        },

        getTradingInfo() {
            return {
                pricePerTon: this.pricePerTon,
                interactionRange: this.interactionRange
            };
        }
    };
    // Diagnostic log (always on for clarity during integration)
    console.log('[TradingAttachment] Applied tradingPost to', ${entityVar}.name || '${entityVar}', 'range:', ${entityVar}.tradingPost.interactionRange, 'pricePerTon:', ${entityVar}.tradingPost.pricePerTon);
    `;
}
