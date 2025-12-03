import { INodeParams, INodeCredential } from '../src/Interface'

class CanvasApi implements INodeCredential {
    label: string
    name: string
    version: number
    inputs: INodeParams[]

    constructor() {
        this.label = 'Canvas API'
        this.name = 'canvasApi'
        this.version = 1.0
        this.inputs = [
            {
                label: 'Canvas API Key',
                name: 'canvasApiKey',
                type: 'password'
            }
        ]
    }
}

export { CanvasApi as credClass };