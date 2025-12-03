import { IComponentNodes, IComponentCredentials } from './Interface'
import path from 'path'
import { Dirent } from 'fs'
import { getNodeModulesPackagePath } from './utils'
import { promises } from 'fs'
import { ICommonObject } from 'flowise-components'
import logger from './utils/logger'
import { appConfig } from './AppConfig'

export class NodesPool {
    componentNodes: IComponentNodes = {}
    componentCredentials: IComponentCredentials = {}
    private credentialIconPath: ICommonObject = {}

    /**
     * Initialize to get all nodes & credentials
     */
    async initialize() {
        await this.initializeNodes()
        await this.initializeCredentials()
    }

    /**
     * Initialize nodes
     */
    private async initializeNodes() {
        const disabled_nodes = process.env.DISABLED_NODES ? process.env.DISABLED_NODES.split(',') : []
        const packagePath = getNodeModulesPackagePath('flowise-components')
        const nodesPath = path.join(packagePath, 'dist', 'nodes')
        const nodeFiles = await this.getFiles(nodesPath)
        await Promise.all(
            nodeFiles.map(async (file) => {
                if (file.endsWith('.js')) {
                    try {
                        const nodeModule = await require(file)

                        if (nodeModule.nodeClass) {
                            const newNodeInstance = new nodeModule.nodeClass()
                            newNodeInstance.filePath = file

                            // Replace file icon with absolute path
                            if (
                                newNodeInstance.icon &&
                                (newNodeInstance.icon.endsWith('.svg') ||
                                    newNodeInstance.icon.endsWith('.png') ||
                                    newNodeInstance.icon.endsWith('.jpg'))
                            ) {
                                const filePath = file.replace(/\\/g, '/').split('/')
                                filePath.pop()
                                const nodeIconAbsolutePath = `${filePath.join('/')}/${newNodeInstance.icon}`
                                newNodeInstance.icon = nodeIconAbsolutePath

                                // Store icon path for componentCredentials
                                if (newNodeInstance.credential) {
                                    for (const credName of newNodeInstance.credential.credentialNames) {
                                        this.credentialIconPath[credName] = nodeIconAbsolutePath
                                    }
                                }
                            }

                            const skipCategories = ['Analytic', 'SpeechToText']
                            const conditionOne = !skipCategories.includes(newNodeInstance.category)

                            const isCommunityNodesAllowed = appConfig.showCommunityNodes
                            const isAuthorPresent = newNodeInstance.author
                            let conditionTwo = true
                            if (!isCommunityNodesAllowed && isAuthorPresent) conditionTwo = false

                            const isDisabled = disabled_nodes.includes(newNodeInstance.name)

                            if (conditionOne && conditionTwo && !isDisabled) {
                                this.componentNodes[newNodeInstance.name] = newNodeInstance
                            }
                        }
                    } catch (err) {
                        logger.error(`❌ [server]: Error during initDatabase with file ${file}:`, err)
                    }
                }
            })
        )

        // Load UPDL nodes
        try {
            // Import UPDL package directly
            const updlPackage = require('@universo/updl')
            
            // List of UPDL node classes to register
            const updlNodeClasses = [
                updlPackage.CameraNode,
                updlPackage.DataNode,
                updlPackage.LightNode,
                updlPackage.ObjectNode,
                updlPackage.SpaceNode,
                updlPackage.EntityNode,
                updlPackage.ComponentNode,
                updlPackage.EventNode,
                updlPackage.ActionNode,
                updlPackage.UniversoNode
            ]

            // Register each UPDL node
            for (const NodeClass of updlNodeClasses) {
                if (!NodeClass) continue

                try {
                    const newNodeInstance = new NodeClass()
                    
                    // Set file path for reference (pointing to the package)
                    newNodeInstance.filePath = require.resolve('@universo/updl')

                    // Replace icon path with absolute path from dist/nodes
                    if (
                        newNodeInstance.icon &&
                        (newNodeInstance.icon.endsWith('.svg') ||
                            newNodeInstance.icon.endsWith('.png') ||
                            newNodeInstance.icon.endsWith('.jpg'))
                    ) {
                        // Path to UPDL package dist/nodes directory
                        const updlPackagePath = require.resolve('@universo/updl').replace(/index\.js$/, '')
                        const nodeIconAbsolutePath = path.join(updlPackagePath, 'nodes', newNodeInstance.type.replace('UPDL', '').toLowerCase(), newNodeInstance.icon)
                        newNodeInstance.icon = nodeIconAbsolutePath
                    }

                    // Check if node is disabled
                    const isDisabled = disabled_nodes.includes(newNodeInstance.name)

                    if (!isDisabled) {
                        this.componentNodes[newNodeInstance.name] = newNodeInstance
                        logger.info(`✅ [server]: Registered UPDL node: ${newNodeInstance.name}`)
                    }
                } catch (err) {
                    logger.error(`❌ [server]: Error instantiating UPDL node ${NodeClass?.name}:`, err)
                }
            }

            logger.info(`✅ [server]: UPDL nodes loaded successfully (${updlNodeClasses.filter(Boolean).length} nodes)`)
        } catch (err) {
            logger.error('❌ [server]: Error loading UPDL package:', err)
        }
    }

    /**
     * Initialize credentials
     */
    private async initializeCredentials() {
        const packagePath = getNodeModulesPackagePath('flowise-components')
        const nodesPath = path.join(packagePath, 'dist', 'credentials')
        const nodeFiles = await this.getFiles(nodesPath)
        return Promise.all(
            nodeFiles.map(async (file) => {
                if (file.endsWith('.credential.js')) {
                    const credentialModule = await require(file)
                    if (credentialModule.credClass) {
                        const newCredInstance = new credentialModule.credClass()
                        newCredInstance.icon = this.credentialIconPath[newCredInstance.name] ?? ''
                        this.componentCredentials[newCredInstance.name] = newCredInstance
                    }
                }
            })
        )
    }

    /**
     * Recursive function to get node files
     * @param {string} dir
     * @returns {string[]}
     */
    private async getFiles(dir: string): Promise<string[]> {
        const dirents = await promises.readdir(dir, { withFileTypes: true })
        const files = await Promise.all(
            dirents.map((dirent: Dirent) => {
                const res = path.resolve(dir, dirent.name)
                return dirent.isDirectory() ? this.getFiles(res) : res
            })
        )
        return Array.prototype.concat(...files)
    }
}
