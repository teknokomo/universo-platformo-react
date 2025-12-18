# Flowise License Attribution

This package contains code derived from Flowise (https://github.com/FlowiseAI/Flowise).

**Original License**: Apache License 2.0

**Original Source**: 
- Flowise version: 3.0.12
- Repository: https://github.com/FlowiseAI/Flowise
- License: https://github.com/FlowiseAI/Flowise/blob/main/LICENSE.md

## Modifications

This code has been adapted for use in Universo Platformo with the following changes:
- Converted to TypeScript factory pattern architecture
- Replaced `agentflowId` with `canvas_id` to match Universo's data model
- Added soft delete support (`is_deleted`, `deleted_date`)
- Integrated with Universo's authentication and RLS systems
- Added Zod validation schemas
- Refactored for modular package structure

## License Compliance

This derivative work maintains the Apache 2.0 license and includes this attribution as required by the original license terms.
