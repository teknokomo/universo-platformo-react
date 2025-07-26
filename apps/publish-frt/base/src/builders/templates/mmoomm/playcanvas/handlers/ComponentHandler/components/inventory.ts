export default function inventory(id: string, props: any): string {
    return `
    // Inventory component for space ships
    const inventoryComponent = {
        maxCapacity: ${props.maxCapacity || 20}, // m³
        currentLoad: ${props.currentLoad || 0},
        items: ${JSON.stringify(props.items || {})},

        addItem(itemType, amount) {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;
                console.log('[Inventory] Added', amount, itemType, '- Load:', this.currentLoad + '/' + this.maxCapacity);
            if (typeof app !== 'undefined') {
                app.fire('cargo:changed', this.currentLoad, this.maxCapacity);
            }
                return true;
            }
            console.log('[Inventory] Cannot add', amount, itemType, '- Insufficient space');
            return false;
        },

        removeItem(itemType, amount) {
            if (this.items[itemType] && this.items[itemType] >= amount) {
                this.items[itemType] -= amount;
                this.currentLoad -= amount;
                if (this.items[itemType] === 0) delete this.items[itemType];
                console.log('[Inventory] Removed', amount, itemType, '- Load:', this.currentLoad + '/' + this.maxCapacity);
                return true;
            }
            console.log('[Inventory] Cannot remove', amount, itemType, '- Insufficient quantity');
            return false;
        },

        getCapacityInfo() {
            return {
                current: this.currentLoad,
                max: this.maxCapacity,
                free: this.maxCapacity - this.currentLoad,
                percentage: (this.currentLoad / this.maxCapacity) * 100
            };
        },

        getItemList() {
            return Object.keys(this.items).map(itemType => ({
                type: itemType,
                amount: this.items[itemType]
            }));
        }
    };

    console.log('[MMO Component] Inventory component ${id} ready');
    `
}
