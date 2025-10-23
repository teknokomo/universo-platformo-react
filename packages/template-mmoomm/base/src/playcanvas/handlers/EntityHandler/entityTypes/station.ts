export function generateStationLogic(id: string): string {
    return `
    // Space station entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'box' });
    }

    // Collision setup (always needed for trading mechanics)
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(4, 2, 4)
    });
    
    // Apply default scale only if not set by UPDL
    const currentScale = entity.getLocalScale();
    if (currentScale.x === 1 && currentScale.y === 1 && currentScale.z === 1) {
        entity.setLocalScale(4, 2, 4);
        console.log('[Station] Applied default scale: { x: 4, y: 2, z: 4 }');
    } else {
        console.log('[Station] Preserving UPDL scale values');
    }

    // IMPROVED: Enhanced station material (only if no custom render component applied)
    if (
        entity.model &&
        !entity.__hasRenderComponent &&
        (!entity.model.meshInstances || !entity.model.meshInstances.some(function(mi){ return !!mi.material; }))
    ) {
        const stationMaterial = new pc.StandardMaterial();
        stationMaterial.diffuse.set(0.2, 0.5, 0.8); // Blue for stations
        stationMaterial.emissive.set(0.1, 0.2, 0.4); // Blue glow
        stationMaterial.shininess = 60;
        stationMaterial.metalness = 0.7;
        stationMaterial.update();
        entity.model.material = stationMaterial;
        if (entity.model && entity.model.meshInstances) {
            entity.model.meshInstances.forEach(function(mi){ mi.material = stationMaterial; });
        }
    }

    // Station trading system (only create if not already set by Trading Component)
    if (!entity.tradingPost) {
        entity.tradingPost = {
            isActive: true,
            pricePerTon: 10, // Inmo per ton of asteroid mass
            interactionRange: 15,

        // Check if ship is in range (distance from station's world-space AABB)
        // English comments only inside code
        isShipInRange(ship) {
            // Build or reuse cached union AABB for the station entity
            if (!entity.__stationAabb || entity.__stationAabb.__empty) {
                // Collect world-space AABBs from all mesh instances under this entity
                const collectMeshAabbs = (root) => {
                    const out = [];
                    const stack = [root];
                    while (stack.length) {
                        const node = stack.pop();
                        if (node && node.model && node.model.meshInstances) {
                            node.model.meshInstances.forEach(mi => mi && mi.aabb && out.push(mi.aabb));
                        }
                        // Optional support for render component if used in the future
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
            if (entity.__stationAabb && !entity.__stationAabb.__empty) {
                const aabb = entity.__stationAabb;
                // Distance from point to AABB by clamping
                const cx = Math.max(aabb.min.x, Math.min(shipPos.x, aabb.max.x));
                const cy = Math.max(aabb.min.y, Math.min(shipPos.y, aabb.max.y));
                const cz = Math.max(aabb.min.z, Math.min(shipPos.z, aabb.max.z));
                const dx = shipPos.x - cx;
                const dy = shipPos.y - cy;
                const dz = shipPos.z - cz;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                return distance <= this.interactionRange;
            }

            // Fallback: center-to-center distance when meshes are not yet available
            const fallbackDistance = entity.getPosition().distance(shipPos);
            return fallbackDistance <= this.interactionRange;
        },

        // Trade asteroid mass for Inmo currency
        trade(ship, itemType, amount) {
            if (!this.isShipInRange(ship)) {
                return { success: false, message: 'Ship too far from station' };
            }

            if (!ship.inventory || !ship.inventory.items[itemType]) {
                return { success: false, message: 'No ' + itemType + ' in ship inventory' };
            }

            const availableAmount = ship.inventory.items[itemType];
            const tradeAmount = Math.min(amount, availableAmount);
            const payment = tradeAmount * this.pricePerTon;

            // Remove items from ship
            if (ship.inventory.removeItem(itemType, tradeAmount)) {
                // Add currency to ship
                if (!ship.currency) ship.currency = 0;
                ship.currency += payment;

                console.log('[Station] Traded', tradeAmount, itemType, 'for', payment, 'Inmo');
                return {
                    success: true,
                    amount: tradeAmount,
                    payment: payment,
                    message: 'Trade successful: +' + payment + ' Inmo'
                };
            }

            return { success: false, message: 'Trade failed' };
        },

        // Get trading info for UI
        getTradingInfo() {
            return {
                stationName: 'Station ${id}',
                pricePerTon: this.pricePerTon,
                currency: 'Inmo',
                acceptedItems: ['asteroidMass'],
                interactionRange: this.interactionRange
            };
        }
    };
        // Diagnostic log (always on for clarity during integration)
        console.log('[Station]', 'Default tradingPost created for Station ${id}', 'range:', entity.tradingPost.interactionRange);
    } // End of if (!entity.tradingPost)

    // Station interaction zone
    entity.interactionZone = {
        checkShips() {
            if (window.MMOEntities) {
                window.MMOEntities.forEach((otherEntity, entityId) => {
                    if (otherEntity.shipController && entity.tradingPost.isShipInRange(otherEntity)) {
                        // Ship entered trading range
                        if (!otherEntity.nearStation) {
                            otherEntity.nearStation = entity;
                            console.log('[Station] Ship', entityId, 'entered trading range');

                            // Trigger UI update
                            if (window.MMOEvents) {
                                window.MMOEvents.emit('ship_near_station', {
                                    shipId: entityId,
                                    stationId: '${id}',
                                    tradingInfo: entity.tradingPost.getTradingInfo()
                                });
                            }
                        }
                    } else if (otherEntity.nearStation === entity) {
                        // Ship left trading range
                        otherEntity.nearStation = null;
                        console.log('[Station] Ship', entityId, 'left trading range');

                        if (window.MMOEvents) {
                            window.MMOEvents.emit('ship_left_station', {
                                shipId: entityId,
                                stationId: '${id}'
                            });
                        }
                    }
                });
            }
        }
    };

    // Check for ships every second
    setInterval(() => {
        entity.interactionZone.checkShips();
    }, 1000);
`;
}
