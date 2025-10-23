export default function trading(id: string, props: any): string {
    // Resolve numbers from possible shapes
    const resolveNumber = (v: any, def: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    };
    const pick = (o: any, keys: string[]) => {
        for (const k of keys) {
            const val = k.split('.').reduce((acc: any, key: string) => (acc ? acc[key] : undefined), o);
            if (val !== undefined && val !== null && val !== '') return val;
        }
        return undefined;
    };
    const rangeRaw = pick(props || {}, ['interactionRange', 'inputs.interactionRange', 'properties.interactionRange']);
    const priceRaw = pick(props || {}, ['pricePerTon', 'inputs.pricePerTon', 'properties.pricePerTon']);
    const resolvedRange = resolveNumber(rangeRaw, 15);
    const resolvedPrice = resolveNumber(priceRaw, 10);
    return `
    // Trading component for stations
    const tradingComponent = {
        pricePerTon: ${resolvedPrice},
        acceptedItems: ${JSON.stringify(props.acceptedItems || ['asteroidMass'])},
        currency: '${props.currency || 'Inmo'}',
        interactionRange: ${resolvedRange},

        canTrade(ship, itemType, amount) {
            if (!this.acceptedItems.includes(itemType)) {
                return { success: false, message: 'Item not accepted' };
            }

            if (!ship.inventory || !ship.inventory.items[itemType] || ship.inventory.items[itemType] < amount) {
                return { success: false, message: 'Insufficient items' };
            }

            // English comments only inside code
            // Compute distance from ship to station's world-space AABB (entity root)
            if (!entity.__stationAabb || entity.__stationAabb.__empty) {
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

                const aabbs = collectMeshAabbs(entity);
                const union = buildUnionAabb(aabbs);
                entity.__stationAabb = union || { __empty: true };
            }

            const shipPos = ship.getPosition();
            let tooFar = false;
            if (entity.__stationAabb && !entity.__stationAabb.__empty) {
                const aabb = entity.__stationAabb;
                const cx = Math.max(aabb.min.x, Math.min(shipPos.x, aabb.max.x));
                const cy = Math.max(aabb.min.y, Math.min(shipPos.y, aabb.max.y));
                const cz = Math.max(aabb.min.z, Math.min(shipPos.z, aabb.max.z));
                const dx = shipPos.x - cx, dy = shipPos.y - cy, dz = shipPos.z - cz;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                tooFar = distance > this.interactionRange;
            } else {
                // Fallback: center-to-center distance if meshes are not available
                const fallbackDistance = entity.getPosition().distance(shipPos);
                tooFar = fallbackDistance > this.interactionRange;
            }

            if (tooFar) {
                return { success: false, message: 'Ship too far from station' };
            }

            return { success: true };
        },

        executeTrade(ship, itemType, amount) {
            const check = this.canTrade(ship, itemType, amount);
            if (!check.success) return check;

            const payment = amount * this.pricePerTon;

            if (ship.inventory.removeItem(itemType, amount)) {
                if (!ship.currency) ship.currency = 0;
                ship.currency += payment;

                console.log('[Trading] Traded', amount, itemType, 'for', payment, this.currency);
                return {
                    success: true,
                    amount: amount,
                    payment: payment,
                    message: 'Trade successful: +' + payment + ' ' + this.currency
                };
            }

            return { success: false, message: 'Trade failed' };
        },

        getTradingInfo() {
            return {
                pricePerTon: this.pricePerTon,
                acceptedItems: this.acceptedItems,
                currency: this.currency,
                interactionRange: this.interactionRange
            };
        }
    };

    if (window && window.DEBUG_MULTIPLAYER) console.log('[MMO Component] Trading component ${id} ready');
    `
}
