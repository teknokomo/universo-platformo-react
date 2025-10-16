// Universo Platformo | Utils package entrypoint
// Namespaced exports for tree-shaking friendly consumption

export * as validation from './validation'
export * as delta from './delta'
export * as net from './net'
export * as serialization from './serialization'
export * as math from './math'
export * as updl from './updl'
export * as publish from './publish'

// Direct exports for commonly used classes
export { UPDLProcessor } from './updl/UPDLProcessor'
