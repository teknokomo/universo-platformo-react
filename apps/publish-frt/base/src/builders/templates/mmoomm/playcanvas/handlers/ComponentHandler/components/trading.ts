export default function trading(id: string, props: any): string {
    return `
    // Trading component for stations
    const tradingComponent = {
        pricePerTon: ${props.pricePerTon || 10},
        acceptedItems: ${JSON.stringify(props.acceptedItems || ['asteroidMass'])},
        currency: '${props.currency || 'Inmo'}',
        interactionRange: ${props.interactionRange || 15},

        canTrade(ship, itemType, amount) {
            if (!this.acceptedItems.includes(itemType)) {
                return { success: false, message: 'Item not accepted' };
            }

            if (!ship.inventory || !ship.inventory.items[itemType] || ship.inventory.items[itemType] < amount) {
                return { success: false, message: 'Insufficient items' };
            }

            const distance = entity.getPosition().distance(ship.getPosition());
            if (distance > this.interactionRange) {
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

    console.log('[MMO Component] Trading component ${id} ready');
    `
}
