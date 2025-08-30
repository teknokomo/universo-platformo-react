export default function portalAttachment(component: any, entityVar: string): string {
    const targetWorld = component.targetWorld ?? component.data?.targetWorld ?? 'konkordo';
    const cooldownTime = component.cooldownTime ?? component.data?.cooldownTime ?? 2000;
    return `
    // Attach portal component ${component.id}
    ${entityVar}.portal = {
        targetWorld: '${targetWorld}',
        cooldownTime: ${cooldownTime},
        lastUsed: 0,

        transport(ship) {
            const now = Date.now();
            if (now - this.lastUsed >= this.cooldownTime) {
                this.lastUsed = now;
                console.log('[Portal] Transporting to', this.targetWorld);
                return true;
            }
            return false;
        }
    };
    `;
}
