// Universo Platformo | Publish Frontend Module
// Main entry point for the publish frontend module

import { Publisher } from './components/Publisher'
import { ARJSPublisher } from './components/ARJSPublisher'
import { ExporterSelector } from './components/ExporterSelector'

// Import APIs
import * as exporterApi from './api/exporterApi'
import * as updlApi from './api/updlApi'
import * as publishApi from './api/publishApi'

// Import types
import { ExporterSelectorProps } from './interfaces/types'
import { PublishRequest, PublishResponse } from './interfaces/publishTypes'

// Import features
import { ARJSExporter } from './features/arjs/ARJSExporter'
import { AFrameVRExporter } from './features/aframe/AFrameExporter'

// Re-export components
export { Publisher, ARJSPublisher, ExporterSelector }

// Re-export APIs
export { exporterApi, updlApi, publishApi }

// Re-export types
export { ExporterSelectorProps, PublishRequest, PublishResponse }

// Re-export features
export { ARJSExporter, AFrameVRExporter }

// Define interface for the module exports
interface PublishModuleExports {
    components: {
        Publisher: typeof Publisher
        ARJSPublisher: typeof ARJSPublisher
        ExporterSelector: typeof ExporterSelector
    }
    api: {
        exporter: typeof exporterApi
        updl: typeof updlApi
        publish: typeof publishApi
    }
    features: {
        arjs: {
            ARJSExporter: typeof ARJSExporter
        }
        aframe: {
            AFrameVRExporter: typeof AFrameVRExporter
        }
    }
}

// Default module export
const moduleExports: PublishModuleExports = {
    components: {
        Publisher,
        ARJSPublisher,
        ExporterSelector
    },
    api: {
        exporter: exporterApi,
        updl: updlApi,
        publish: publishApi
    },
    features: {
        arjs: {
            ARJSExporter
        },
        aframe: {
            AFrameVRExporter
        }
    }
}

export default moduleExports
