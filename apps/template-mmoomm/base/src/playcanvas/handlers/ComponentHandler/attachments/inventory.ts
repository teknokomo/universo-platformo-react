import { generateInventoryCode } from '../../shared/inventoryTemplate';

export default function inventoryAttachment(component: any, entityVar: string): string {
    const maxCapacity = component.data?.maxCapacity || 20;
    const currentLoad = component.data?.currentLoad || 0;

    return `
    // Attach inventory component ${component.id}
    ${entityVar}.inventory = ${generateInventoryCode(maxCapacity, currentLoad, false)};
    `;
}
