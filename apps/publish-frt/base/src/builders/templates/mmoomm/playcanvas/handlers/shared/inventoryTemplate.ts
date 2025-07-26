// Universo Platformo | MMOOMM Shared Inventory Template
// Shared template for inventory system used across different components

/**
 * Interface for inventory system
 */
export interface InventorySystem {
    maxCapacity: number;
    currentLoad: number;
    items: Record<string, number>;
    addItem(itemType: string, amount: number): boolean;
    removeItem(itemType: string, amount: number): boolean;
    getCapacityInfo(): {
        current: number;
        max: number;
        free: number;
        percentage: number;
    };
    getItemList?(): Array<{ type: string; amount: number }>;
}

/**
 * Creates a standardized inventory system object
 * @param maxCapacity Maximum cargo capacity in cubic meters
 * @param currentLoad Current cargo load in cubic meters
 * @param includeItemList Whether to include getItemList method (needed for HUD integration)
 * @returns Inventory system object
 */
export function createInventorySystem(
    maxCapacity: number = 20,
    currentLoad: number = 0,
    includeItemList: boolean = false
): InventorySystem {
    const inventory: InventorySystem = {
        maxCapacity,
        currentLoad,
        items: {},

        addItem(itemType: string, amount: number): boolean {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;
                return true;
            }
            return false;
        },

        removeItem(itemType: string, amount: number): boolean {
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

    // Add getItemList method only if needed (for HUD integration)
    if (includeItemList) {
        inventory.getItemList = function() {
            return Object.keys(this.items).map(itemType => ({
                type: itemType,
                amount: this.items[itemType]
            }));
        };
    }

    return inventory;
}

/**
 * Generates JavaScript code string for inventory system
 * Used by attachment generators to create runtime inventory objects
 * @param maxCapacity Maximum cargo capacity in cubic meters
 * @param currentLoad Current cargo load in cubic meters
 * @param includeItemList Whether to include getItemList method
 * @param includeLogging Whether to include console logging
 * @param includeEvents Whether to include app.fire events
 * @returns JavaScript code string
 */
export function generateInventoryCode(
    maxCapacity: number = 20,
    currentLoad: number = 0,
    includeItemList: boolean = false,
    includeLogging: boolean = false,
    includeEvents: boolean = false
): string {
    const itemListMethod = includeItemList ? `,
        getItemList() {
            return Object.keys(this.items).map(itemType => ({
                type: itemType,
                amount: this.items[itemType]
            }));
        }` : '';

    const addItemLogging = includeLogging ? `
                console.log('[Inventory] Added', amount, itemType, '- Load:', this.currentLoad + '/' + this.maxCapacity);` : '';

    const addItemEvents = includeEvents ? `
            if (typeof app !== 'undefined') {
                app.fire('cargo:changed', this.currentLoad, this.maxCapacity);
            }` : '';

    const addItemFailLogging = includeLogging ? `
            console.log('[Inventory] Cannot add', amount, itemType, '- Insufficient space');` : '';

    const removeItemLogging = includeLogging ? `
                console.log('[Inventory] Removed', amount, itemType, '- Load:', this.currentLoad + '/' + this.maxCapacity);` : '';

    const removeItemFailLogging = includeLogging ? `
            console.log('[Inventory] Cannot remove', amount, itemType, '- Insufficient quantity');` : '';

    return `{
        maxCapacity: ${maxCapacity},
        currentLoad: ${currentLoad},
        items: {},

        addItem(itemType, amount) {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;${addItemLogging}${addItemEvents}
                return true;
            }${addItemFailLogging}
            return false;
        },

        removeItem(itemType, amount) {
            if (this.items[itemType] && this.items[itemType] >= amount) {
                this.items[itemType] -= amount;
                this.currentLoad -= amount;
                if (this.items[itemType] === 0) delete this.items[itemType];${removeItemLogging}
                return true;
            }${removeItemFailLogging}
            return false;
        },

        getCapacityInfo() {
            return {
                current: this.currentLoad,
                max: this.maxCapacity,
                free: this.maxCapacity - this.currentLoad,
                percentage: (this.currentLoad / this.maxCapacity) * 100
            };
        }${itemListMethod}
    }`;
}
