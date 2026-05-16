declare module '@editorjs/editorjs' {
    type EditorJsConfig = Record<string, unknown>
    class EditorJS {
        constructor(config: EditorJsConfig)
        isReady: Promise<void>
        destroy(): void
    }
    export default EditorJS
}

declare module '@editorjs/header' {
    const Header: unknown
    export default Header
}

declare module '@editorjs/list' {
    const List: unknown
    export default List
}

declare module '@editorjs/quote' {
    const Quote: unknown
    export default Quote
}

declare module '@editorjs/table' {
    const Table: unknown
    export default Table
}

declare module '@editorjs/embed' {
    const Embed: unknown
    export default Embed
}

declare module '@editorjs/delimiter' {
    const Delimiter: unknown
    export default Delimiter
}

declare module '@editorjs/image' {
    const ImageTool: unknown
    export default ImageTool
}
