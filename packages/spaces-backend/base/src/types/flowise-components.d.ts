declare module 'flowise-components' {
    export const removeFolderFromStorage: (...args: string[]) => Promise<{ totalSize: number }>
}
