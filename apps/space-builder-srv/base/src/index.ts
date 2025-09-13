import type { Router } from 'express'
import router, { configureProviders } from './routes/space-builder'
import { setCredentialResolver } from './services/providers/ModelFactory'

export function createSpaceBuilderRouter(config?: {
  resolveCredential?: (credentialId: string) => Promise<string>
  listChatModelNodes?: () => Promise<any[]>
  listComponentCredentials?: () => Promise<any[]>
  listUserCredentials?: (unikId?: string, names?: string | string[]) => Promise<any[]>
}): Router {
  if (config?.resolveCredential) setCredentialResolver(config.resolveCredential)
  if (config?.listChatModelNodes && config?.listComponentCredentials && config?.listUserCredentials) {
    configureProviders({
      listChatModelNodes: config.listChatModelNodes,
      listComponentCredentials: config.listComponentCredentials,
      listUserCredentials: config.listUserCredentials
    })
  }
  return router
}
