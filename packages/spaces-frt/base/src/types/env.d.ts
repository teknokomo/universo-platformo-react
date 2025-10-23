// Declarations for non-TS imports used by this package
declare module '*.css'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.svg' {
    const content: string
    export default content
}
// Third-party packages without bundled types
declare module 'react-perfect-scrollbar'
