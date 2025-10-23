// Universo Platformo | MMOOMM Data Handler
// Handles Data nodes with real-time synchronization

import { BuildOptions } from '../../../common/types'

export class DataHandler {
    process(dataNodes: any[], options: BuildOptions = {}): string {
        if (!dataNodes || dataNodes.length === 0) return ''

        return dataNodes.map(node => this.processDataNode(node, options)).join('\n')
    }

    private processDataNode(node: any, options: BuildOptions): string {
        const key = node.data?.key || 'defaultKey'
        const scope = node.data?.scope || 'local' // local, space, global
        const value = node.data?.value || null
        const sync = node.data?.sync || false

        return `
// MMO Data Node: ${key}
(function() {
    // Initialize data storage
    if (!window.MMOData) {
        window.MMOData = { 
            local: {}, 
            space: {}, 
            global: {},
            
            get(key, scope = 'local') {
                return this[scope][key];
            },
            
            set(key, value, scope = 'local') {
                this[scope][key] = value;
                
                // Sync to network if enabled and not local
                if (scope !== 'local' && window.UniversoGateway?.isConnected) {
                    window.UniversoGateway.send({
                        type: 'data_update',
                        key: key,
                        value: value,
                        scope: scope,
                        timestamp: Date.now()
                    });
                }
                
                // Trigger change event
                this.trigger('change', { key, value, scope });
            },
            
            // Simple event system
            listeners: {},
            on(event, callback) {
                if (!this.listeners[event]) this.listeners[event] = [];
                this.listeners[event].push(callback);
            },
            
            trigger(event, data) {
                if (this.listeners[event]) {
                    this.listeners[event].forEach(callback => callback(data));
                }
            }
        };
    }
    
    // Set initial value
    window.MMOData.${scope}['${key}'] = ${JSON.stringify(value)};
    
    ${sync ? this.generateSyncLogic(key, scope) : '// Local data only - no network sync'}
})();
`;
    }

    private generateSyncLogic(key: string, scope: string): string {
        return `
    // Real-time synchronization setup for ${key}
    if (window.UniversoGateway) {
        // Setup data sync listener
        const originalHandleMessage = window.UniversoGateway.handleMessage;
        window.UniversoGateway.handleMessage = function(data) {
            // Handle data updates from network
            if (data.type === 'data_update' && data.key === '${key}' && data.scope === '${scope}') {
                window.MMOData.${scope}['${key}'] = data.value;
                window.MMOData.trigger('sync', { key: '${key}', value: data.value, scope: '${scope}' });
                console.log('[MMO Data] Synced ${key}:', data.value);
            }
            
            // Call original handler
            originalHandleMessage.call(this, data);
        };
    }
`;
    }
} 