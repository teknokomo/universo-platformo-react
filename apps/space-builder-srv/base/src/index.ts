import type { Router } from 'express'
import router from './routes/space-builder'
import { setCredentialResolver } from './services/providers/ModelFactory'

export function createSpaceBuilderRouter(config?: { resolveCredential?: (credentialId: string) => Promise<string> }): Router {
  if (config?.resolveCredential) setCredentialResolver(config.resolveCredential)
  return router
}
