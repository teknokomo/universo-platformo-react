import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class ExampleSharedLibrary extends SharedLibraryModule {
    static formatValue(value: string) {
        return value.trim()
    }
}
