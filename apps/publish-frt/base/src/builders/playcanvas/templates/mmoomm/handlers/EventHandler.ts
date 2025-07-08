// Universo Platformo | MMOOMM Event Handler
// Handles Event nodes for real-time MMO events

import { BuildOptions } from '../../../../common/types'

export class EventHandler {
    process(events: any[], options: BuildOptions = {}): string {
        if (!events || events.length === 0) return ''

        return events.map((event) => this.processEvent(event, options)).join('\n')
    }

    private processEvent(event: any, options: BuildOptions): string {
        const eventType = event.data?.eventType || 'custom'
        const eventId = event.data?.id || `event_${Math.random().toString(36).substr(2, 9)}`
        const trigger = event.data?.trigger || 'manual'
        const networked = event.data?.networked || false

        return `
// MMO Event: ${eventId} (${eventType})
(function() {
    const eventData = {
        id: '${eventId}',
        type: '${eventType}',
        trigger: '${trigger}',
        networked: ${networked}
    };
    
    // Initialize event system if not exists
    if (!window.MMOEvents) {
        window.MMOEvents = {
            listeners: {},
            
            on(eventType, callback) {
                if (!this.listeners[eventType]) this.listeners[eventType] = [];
                this.listeners[eventType].push(callback);
            },
            
            emit(eventType, data) {
                console.log('[MMO Event] Emitting:', eventType, data);
                
                if (this.listeners[eventType]) {
                    this.listeners[eventType].forEach(callback => callback(data));
                }
                
                // Network broadcast if enabled
                if (data.networked && window.UniversoGateway?.isConnected) {
                    window.UniversoGateway.send({
                        type: 'world_event',
                        eventType: eventType,
                        eventData: data,
                        timestamp: Date.now()
                    });
                }
            }
        };
    }
    
    ${this.generateEventLogic(eventType, eventId, trigger, networked)}
})();
`
    }

    private generateEventLogic(type: string, id: string, trigger: string, networked: boolean): string {
        switch (type) {
            case 'player_joined':
                return `
    // Player joined event
    window.MMOEvents.on('player_joined', (data) => {
        console.log('[MMO] Player joined event:', data.playerId);
        // Handle player joined logic
    });
`
            case 'collision':
                return `
    // Collision event
    window.MMOEvents.on('collision', (data) => {
        console.log('[MMO] Collision event:', data.entityA, 'hit', data.entityB);
        // Handle collision logic
    });
`
            case 'timer':
                return `
    // Timer event
    setInterval(() => {
        window.MMOEvents.emit('timer', {
            eventId: '${id}',
            timestamp: Date.now(),
            networked: ${networked}
        });
    }, 1000); // 1 second timer
`
            default:
                return `
    // Custom event
    window.MMOEvents.on('${type}', (data) => {
        console.log('[MMO] Custom event ${type}:', data);
        // Handle custom event logic
    });
`
        }
    }
}
