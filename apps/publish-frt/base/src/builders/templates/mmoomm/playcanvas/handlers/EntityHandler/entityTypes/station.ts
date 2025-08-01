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
    entity.setLocalScale(4, 2, 4);

    // IMPROVED: Enhanced station material (only if no custom material from Component)
    if (entity.model && !entity.model.material) {
        const stationMaterial = new pc.StandardMaterial();
        stationMaterial.diffuse.set(0.2, 0.5, 0.8); // Blue for stations
        stationMaterial.emissive.set(0.1, 0.2, 0.4); // Blue glow
        stationMaterial.shininess = 60;
        stationMaterial.metalness = 0.7;
        stationMaterial.update();
        entity.model.material = stationMaterial;
    }

    // Station trading system (only create if not already set by Trading Component)
    if (!entity.tradingPost) {
        entity.tradingPost = {
            isActive: true,
            pricePerTon: 10, // Inmo per ton of asteroid mass
            interactionRange: 15,

        // Check if ship is in range
        isShipInRange(ship) {
            const distance = entity.getPosition().distance(ship.getPosition());
            return distance <= this.interactionRange;
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
