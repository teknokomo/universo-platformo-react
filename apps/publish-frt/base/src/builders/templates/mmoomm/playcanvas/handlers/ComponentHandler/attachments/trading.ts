export default function tradingAttachment(component: any, entityVar: string): string {
    const pricePerTon = component.data?.pricePerTon || 10;
    const interactionRange = component.data?.interactionRange || 8;
    return `
    // Attach trading component ${component.id}
    ${entityVar}.tradingPost = {
        pricePerTon: ${pricePerTon},
        interactionRange: ${interactionRange},

        // Check if ship is in range
        isShipInRange(ship) {
            const distance = ${entityVar}.getPosition().distance(ship.getPosition());
            return distance <= this.interactionRange;
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
    `;
}
