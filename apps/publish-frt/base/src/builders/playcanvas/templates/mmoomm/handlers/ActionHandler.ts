// Universo Platformo | MMOOMM Action Handler
// Handles Action nodes for MMO actions and responses

import { BuildOptions } from '../../../../common/types'

export class ActionHandler {
    process(actions: any[], options: BuildOptions = {}): string {
        if (!actions || actions.length === 0) return ''

        return actions.map((action) => this.processAction(action, options)).join('\n')
    }

    private processAction(action: any, options: BuildOptions): string {
        const actionType = action.data?.actionType || 'custom'
        const actionId = action.data?.id || `action_${Math.random().toString(36).substr(2, 9)}`
        const target = action.data?.target || 'self'
        const parameters = action.data?.parameters || {}

        return `
// MMO Action: ${actionId} (${actionType})
(function() {
    const actionData = {
        id: '${actionId}',
        type: '${actionType}',
        target: '${target}',
        parameters: ${JSON.stringify(parameters)}
    };
    
    // Initialize action system if not exists
    if (!window.MMOActions) {
        window.MMOActions = {
            execute(actionType, target, params) {
                console.log('[MMO Action] Executing:', actionType, 'on', target, 'with', params);
                
                // Execute action based on type
                switch(actionType) {
                    case 'move':
                        this.executeMove(target, params);
                        break;
                    case 'teleport':
                        this.executeTeleport(target, params);
                        break;
                    case 'send_message':
                        this.executeSendMessage(target, params);
                        break;
                    default:
                        this.executeCustom(actionType, target, params);
                }
            },
            
            executeMove(target, params) {
                if (window.MMOEntities?.has(target)) {
                    const entity = window.MMOEntities.get(target);
                    entity.setLocalPosition(params.x || 0, params.y || 0, params.z || 0);
                }
            },
            
            executeTeleport(target, params) {
                if (window.MMOEntities?.has(target)) {
                    const entity = window.MMOEntities.get(target);
                    entity.setLocalPosition(params.x || 0, params.y || 0, params.z || 0);
                    
                    // Network sync for teleport
                    if (window.UniversoGateway?.isConnected) {
                        window.UniversoGateway.send({
                            type: 'entity_teleport',
                            entityId: target,
                            position: { x: params.x, y: params.y, z: params.z },
                            timestamp: Date.now()
                        });
                    }
                }
            },
            
            executeSendMessage(target, params) {
                if (window.UniversoGateway?.isConnected) {
                    window.UniversoGateway.send({
                        type: 'chat_message',
                        target: target,
                        message: params.message || 'Hello',
                        timestamp: Date.now()
                    });
                }
            },
            
            executeCustom(actionType, target, params) {
                console.log('[MMO Action] Custom action:', actionType, target, params);
                // Handle custom actions
            }
        };
    }
    
    // Register this specific action
    console.log('[MMO Action] Registered action ${actionId}:', actionData);
})();
`
    }
}
