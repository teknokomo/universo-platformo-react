import { Router } from 'express'

// Generic wildcard module declaration for Flowise route exports
// Each module exports an Express Router as default
declare module 'flowise/dist/routes/*' {
  const router: Router
  export default router
}
