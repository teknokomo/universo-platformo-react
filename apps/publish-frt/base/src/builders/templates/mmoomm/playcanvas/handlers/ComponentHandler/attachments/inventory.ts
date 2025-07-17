export default function inventoryAttachment(component: any, entityVar: string): string {
    const maxCapacity = component.data?.maxCapacity || 20;
    const currentLoad = component.data?.currentLoad || 0;
    return `
    // Attach inventory component ${component.id}
    ${entityVar}.inventory = {
        maxCapacity: ${maxCapacity},
        currentLoad: ${currentLoad},
        items: {},

        addItem(itemType, amount) {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;
                return true;
            }
            return false;
        },

        removeItem(itemType, amount) {
            if (this.items[itemType] && this.items[itemType] >= amount) {
                this.items[itemType] -= amount;
                this.currentLoad -= amount;
                if (this.items[itemType] === 0) delete this.items[itemType];
                return true;
            }
            return false;
        },

        getCapacityInfo() {
            return {
                current: this.currentLoad,
                max: this.maxCapacity,
                free: this.maxCapacity - this.currentLoad,
                percentage: (this.currentLoad / this.maxCapacity) * 100
            };
        }
    };
    `;
}
