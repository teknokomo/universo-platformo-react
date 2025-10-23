// Universo Platformo | UPDL Data Node
// Universal node for quiz data, questions, answers, and transitions

import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * DataNode is a universal node for storing quiz-related data
 * It can represent questions, answers, intro screens, or transitions
 * depending on the dataType configuration
 */
export class DataNode extends BaseUPDLNode {
    constructor() {
        // Configure node metadata
        super({
            name: 'Data',
            type: 'UPDLData',
            icon: 'data.svg',
            description: 'Universal node for quiz data, questions, answers, and transitions',
            version: 1.0,
            inputs: [
                {
                    label: 'Datas',
                    name: 'datas',
                    type: 'UPDLData',
                    description: 'Connect Data nodes to create data chains',
                    list: true,
                    optional: true
                },
                {
                    name: 'dataName',
                    type: 'string',
                    label: 'Data Name',
                    description: 'Name of the data element',
                    default: 'My Data'
                },
                {
                    name: 'key',
                    type: 'string',
                    label: 'Key',
                    description: 'Data key identifier',
                    optional: true,
                    additionalParams: true
                },
                {
                    name: 'scope',
                    type: 'options',
                    label: 'Scope',
                    description: 'Variable scope',
                    options: [
                        { label: 'Local', name: 'Local' },
                        { label: 'Space', name: 'Space' },
                        { label: 'Global', name: 'Global' }
                    ],
                    default: 'Local',
                    additionalParams: true
                },
                {
                    name: 'value',
                    type: 'string',
                    label: 'Value',
                    description: 'Stored value',
                    optional: true,
                    additionalParams: true
                },
                {
                    name: 'dataType',
                    type: 'options',
                    label: 'Data Type',
                    description: 'Type of data this node represents',
                    options: [
                        { label: 'Question', name: 'question', description: 'Quiz question' },
                        { label: 'Answer', name: 'answer', description: 'Quiz answer option' },
                        { label: 'Intro', name: 'intro', description: 'Introduction screen' },
                        { label: 'Transition', name: 'transition', description: 'Screen transition' }
                    ],
                    default: 'question'
                },
                {
                    name: 'content',
                    type: 'string',
                    label: 'Content',
                    description: 'Main content text (question text, answer text, etc.)',
                    multiline: true,
                    rows: 3,
                    default: ''
                },
                {
                    name: 'isCorrect',
                    type: 'boolean',
                    label: 'Is Correct Answer',
                    description: 'Mark this as the correct answer (only for answer type)',
                    default: false,
                    additionalParams: true,
                    show: {
                        'inputs.dataType': ['answer']
                    }
                },
                {
                    name: 'nextSpace',
                    type: 'string',
                    label: 'Next Space ID',
                    description: 'ID of the next space to transition to',
                    optional: true,
                    additionalParams: true,
                    show: {
                        'inputs.dataType': ['transition', 'answer']
                    }
                },
                {
                    name: 'userInputType',
                    type: 'options',
                    label: 'User Input Type',
                    description: 'Type of user input expected',
                    options: [
                        { label: 'Button Click', name: 'button', description: 'Simple button interaction' },
                        { label: 'Text Input', name: 'text', description: 'Text input field' },
                        { label: 'None', name: 'none', description: 'No user input' }
                    ],
                    default: 'button',
                    additionalParams: true,
                    show: {
                        'inputs.dataType': ['intro', 'transition']
                    }
                },
                {
                    name: 'enablePoints',
                    type: 'boolean',
                    label: 'Enable Points',
                    description: 'Enable point calculation for this data element',
                    default: false,
                    additionalParams: true
                },
                {
                    name: 'pointsValue',
                    type: 'number',
                    label: 'Points Value',
                    description: 'Points to add/subtract when interacting with this element (-100 to +100)',
                    default: 1,
                    min: -100,
                    max: 100,
                    additionalParams: true,
                    show: {
                        'inputs.enablePoints': [true]
                    }
                },
                {
                    label: 'Objects',
                    name: 'objects',
                    type: 'UPDLObject',
                    description: 'Connect Object nodes to associate with this data',
                    list: true,
                    optional: true
                }
            ]
        })
    }

    /**
     * Initialize the node with data from Flowise
     * @param nodeData Node data from Flowise
     */
    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        // Initialize data properties if necessary
        return this
    }

    /**
     * Execute the node logic
     * @param nodeData Node data from Flowise
     * @param input Input data (not used for Data properties)
     * @param options Additional options
     * @returns Data object
     */
    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        // Extract properties via nodeData.inputs
        const dataName = (nodeData.inputs?.dataName as string) || 'My Data'
        const key = (nodeData.inputs?.key as string) || ''
        const scope = (nodeData.inputs?.scope as string) || 'Local'
        const value = (nodeData.inputs?.value as string) || ''
        const dataType = (nodeData.inputs?.dataType as string) || 'question'
        const content = (nodeData.inputs?.content as string) || ''
        const isCorrect = nodeData.inputs?.isCorrect ? true : false
        const nextSpace = (nodeData.inputs?.nextSpace as string) || ''
        const userInputType = (nodeData.inputs?.userInputType as string) || 'button'

        // Universo Platformo | Points system properties
        const enablePoints = nodeData.inputs?.enablePoints ? true : false
        const pointsValue = Number(nodeData.inputs?.pointsValue) || 1

        // Connected elements are handled by Flowise graph execution
        const inputData = nodeData.inputs?.datas || null
        const objects = []

        // Generate a unique ID for the data
        const id = `data-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        // Return data configuration
        return {
            id,
            type: 'UPDLData',
            name: dataName,
            key,
            scope,
            value,
            dataType,
            content,
            isCorrect,
            nextSpace,
            userInputType,
            enablePoints,
            pointsValue,
            inputData,
            objects
        }
    }
}
