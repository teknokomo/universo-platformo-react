// Universo Platformo | UPDL Universo Node
import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * UniversoNode provides global connectivity to the Kiberplano network
 */
export class UniversoNode extends BaseUPDLNode {
    constructor() {
        super({
            name: 'Universo',
            type: 'UPDLUniverso',
            icon: 'universo.svg',
            description: 'Global connectivity to Kiberplano network (GraphQL, MQTT UNS, OPC UA)',
            inputs: [
                // Configuration settings only - no input connectors needed for MVP
                {
                    name: 'connectionType',
                    label: 'Connection Type',
                    type: 'options',
                    options: [
                        { label: 'GraphQL API', name: 'graphql' },
                        { label: 'MQTT UNS', name: 'mqtt' },
                        { label: 'OPC UA', name: 'opcua' },
                        { label: 'WebSocket', name: 'websocket' }
                    ],
                    default: 'graphql',
                    additionalParams: true
                },
                {
                    name: 'endpoint',
                    label: 'Endpoint URL',
                    type: 'string',
                    placeholder: 'wss://api.kiberplano.com/graphql',
                    additionalParams: true
                },
                {
                    name: 'authentication',
                    label: 'Authentication',
                    type: 'options',
                    options: [
                        { label: 'API Key', name: 'apikey' },
                        { label: 'JWT Token', name: 'jwt' },
                        { label: 'OAuth2', name: 'oauth2' },
                        { label: 'None', name: 'none' }
                    ],
                    default: 'apikey',
                    additionalParams: true
                },
                {
                    name: 'credentials',
                    label: 'Credentials',
                    type: 'string',
                    placeholder: 'API key or token',
                    additionalParams: true,
                    optional: true
                },
                {
                    name: 'namespace',
                    label: 'Namespace',
                    type: 'string',
                    placeholder: 'universo.mmoomm',
                    default: 'universo.mmoomm',
                    additionalParams: true
                },
                {
                    name: 'syncMode',
                    label: 'Sync Mode',
                    type: 'options',
                    options: [
                        { label: 'Real-time', name: 'realtime' },
                        { label: 'Periodic', name: 'periodic' },
                        { label: 'On-demand', name: 'ondemand' }
                    ],
                    default: 'realtime',
                    additionalParams: true
                }
            ]
        })
    }

    async run(nodeData: INodeData): Promise<ICommonObject> {
        const connectionType = (nodeData.inputs?.connectionType as string) || 'graphql'
        const endpoint = (nodeData.inputs?.endpoint as string) || ''
        const authentication = (nodeData.inputs?.authentication as string) || 'apikey'
        const credentials = (nodeData.inputs?.credentials as string) || ''
        const namespace = (nodeData.inputs?.namespace as string) || 'universo.mmoomm'
        const syncMode = (nodeData.inputs?.syncMode as string) || 'realtime'

        const obj = {
            type: 'UPDLUniverso',
            connectionType,
            endpoint,
            authentication,
            credentials: credentials ? '***' : '', // Mask credentials in output
            namespace,
            syncMode,
            // Runtime connection state (will be handled by the export template)
            connected: false,
            lastSync: null
        }

        return obj
    }
}
