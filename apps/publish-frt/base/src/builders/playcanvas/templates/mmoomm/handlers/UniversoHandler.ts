// Universo Platformo | MMOOMM Universo Handler
// Handles Universo nodes - Network gateway to Kiberplano ecosystem

import { BuildOptions } from '../../../../common/types'

export class UniversoHandler {
    /**
     * Process Universo nodes for network gateway setup
     */
    process(universoNodes: any[], options: BuildOptions = {}): string {
        if (!universoNodes || universoNodes.length === 0) {
            return this.generateDefaultGateway(options)
        }

        return universoNodes.map((node) => this.processUniversoNode(node, options)).join('\n')
    }

    private processUniversoNode(node: any, options: BuildOptions): string {
        const protocol = node.data?.protocol || 'websocket'
        const endpoint = node.data?.endpoint || 'wss://universo.network/mmo'
        const topics = node.data?.topics || ['player.sync', 'world.events', 'entity.updates']
        const authToken = node.data?.authToken || ''

        return this.generateGatewayScript(protocol, endpoint, topics, authToken, options)
    }

    private generateDefaultGateway(options: BuildOptions): string {
        return this.generateGatewayScript(
            'websocket',
            'wss://universo.network/mmo',
            ['player.sync', 'world.events', 'entity.updates'],
            '',
            options
        )
    }

    private generateGatewayScript(protocol: string, endpoint: string, topics: string[], authToken: string, options: BuildOptions): string {
        return `
// Universo Network Gateway - Connection to Kiberplano ecosystem
window.UniversoGateway = {
    protocol: '${protocol}',
    endpoint: '${endpoint}',
    topics: ${JSON.stringify(topics)},
    authToken: '${authToken}',
    ws: null,
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    
    // Initialize connection to Universo network
    connect() {
        console.log('[Universo Gateway] Connecting to Kiberplano:', this.endpoint);
        
        if (this.protocol === 'websocket') {
            this.connectWebSocket();
        }
        
        // Auto-subscribe to configured topics
        this.subscribeToTopics();
    },
    
    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.endpoint);
            this.setupWebSocketHandlers();
        } catch (error) {
            console.error('[Universo Gateway] Connection failed:', error);
            this.handleReconnect();
        }
    },
    
    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            console.log('[Universo Gateway] Connected to Kiberplano network');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Send authentication if token provided
            if (this.authToken) {
                this.send({
                    type: 'auth',
                    token: this.authToken,
                    timestamp: Date.now()
                });
            }
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('[Universo Gateway] Message parse error:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('[Universo Gateway] Connection closed');
            this.isConnected = false;
            this.handleReconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('[Universo Gateway] WebSocket error:', error);
            this.isConnected = false;
        };
    },
    
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
            
            console.log(\`[Universo Gateway] Reconnect attempt \${this.reconnectAttempts} in \${delay}ms\`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('[Universo Gateway] Max reconnection attempts reached');
        }
    },
    
    subscribeToTopics() {
        this.topics.forEach(topic => {
            console.log('[Universo Gateway] Subscribing to topic:', topic);
            this.send({
                type: 'subscribe',
                topic: topic,
                timestamp: Date.now()
            });
        });
    },
    
    send(data) {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('[Universo Gateway] Cannot send - not connected:', data);
        }
    },
    
    handleMessage(data) {
        console.log('[Universo Gateway] Received:', data.type);
        
        switch(data.type) {
            case 'player_joined':
                this.onPlayerJoined(data);
                break;
            case 'player_left':
                this.onPlayerLeft(data);
                break;
            case 'entity_update':
                this.onEntityUpdate(data);
                break;
            case 'world_event':
                this.onWorldEvent(data);
                break;
            case 'chat_message':
                this.onChatMessage(data);
                break;
            case 'auth_response':
                this.onAuthResponse(data);
                break;
            default:
                console.log('[Universo Gateway] Unknown message type:', data.type);
        }
    },
    
    // Event handlers for different message types
    onPlayerJoined(data) {
        console.log('[MMO] Player joined:', data.playerId);
        
        // Spawn player entity if not exists
        if (window.MMOEntities && !window.MMOEntities.has(data.playerId)) {
            // Create player entity logic here
            // This would typically be handled by EntityHandler
        }
        
        // Update player count
        if (window.MMOSpace) {
            window.MMOSpace.currentPlayers++;
        }
    },
    
    onPlayerLeft(data) {
        console.log('[MMO] Player left:', data.playerId);
        
        // Remove player entity
        if (window.MMOEntities && window.MMOEntities.has(data.playerId)) {
            const entity = window.MMOEntities.get(data.playerId);
            if (entity && entity.destroy) {
                entity.destroy();
            }
            window.MMOEntities.delete(data.playerId);
        }
        
        // Update player count
        if (window.MMOSpace) {
            window.MMOSpace.currentPlayers--;
        }
    },
    
    onEntityUpdate(data) {
        // Sync entity position/rotation from network
        if (window.MMOEntities && window.MMOEntities.has(data.id)) {
            const entity = window.MMOEntities.get(data.id);
            if (entity && data.position) {
                entity.setLocalPosition(data.position.x, data.position.y, data.position.z);
            }
            if (entity && data.rotation) {
                entity.setLocalEulerAngles(data.rotation.x, data.rotation.y, data.rotation.z);
            }
        }
    },
    
    onWorldEvent(data) {
        console.log('[MMO] World event:', data.eventType, data);
        
        // Handle world-wide events (weather, time changes, etc.)
        // This would typically trigger Action handlers
    },
    
    onChatMessage(data) {
        console.log('[MMO] Chat:', data.playerId, ':', data.message);
        
        // Display chat message in UI
        // This would typically be handled by UI components
    },
    
    onAuthResponse(data) {
        if (data.success) {
            console.log('[Universo Gateway] Authentication successful');
        } else {
            console.error('[Universo Gateway] Authentication failed:', data.error);
        }
    }
};

// Auto-connect when gateway is initialized
if (typeof window !== 'undefined') {
    // Small delay to ensure other systems are ready
    setTimeout(() => {
        window.UniversoGateway.connect();
    }, 1000);
}
`
    }
}
