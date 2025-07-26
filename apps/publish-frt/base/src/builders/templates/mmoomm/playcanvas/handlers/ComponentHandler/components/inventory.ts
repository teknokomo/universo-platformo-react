import { generateInventoryCode } from '../../shared/inventoryTemplate';

export default function inventory(id: string, props: any): string {
    const maxCapacity = props.maxCapacity || 20;
    const currentLoad = props.currentLoad || 0;
    const items = props.items || {};

    return `
    // Inventory component for space ships
    const inventoryComponent = ${generateInventoryCode(maxCapacity, currentLoad, true, true, true)};

    // Initialize with existing items if provided
    inventoryComponent.items = ${JSON.stringify(items)};

    console.log('[MMO Component] Inventory component ${id} ready');
    `;
}
