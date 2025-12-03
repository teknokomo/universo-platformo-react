# Universo Platformo Features

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific features.

Welcome to the Universo Platformo features documentation. This section covers the unique capabilities that extend beyond the base Flowise functionality.

## Overview

Universo Platformo React builds upon Flowise to provide advanced capabilities for creating immersive 3D/AR/VR experiences and implementing the Universo Kiberplano system.

## Key Features

### UPDL Node System
The Universal Platform Description Language (UPDL) provides a comprehensive set of nodes for creating complex 3D/AR/VR experiences:

- **Space Nodes** - Define virtual spaces and environments
- **Entity Nodes** - Create interactive objects and characters
- **Component Nodes** - Add behaviors and properties to entities
- **Action Nodes** - Define interactions and behaviors
- **Event Nodes** - Handle user interactions and system events
- **Data Nodes** - Manage data flow and state

### MMOOMM Templates
Massive Multiplayer Online Open Metaverse (MMOOMM) templates provide pre-built solutions for:

- **PlayCanvas MMOOMM** - 3D space exploration with mining and trading
- **AR.js Templates** - Augmented reality experiences
- **A-Frame Templates** - WebVR virtual reality environments

### Multi-Platform Export
Export your UPDL flows to multiple platforms:

- **AR.js Export** - Augmented reality web applications
- **PlayCanvas Export** - 3D web games and experiences
- **A-Frame Export** - Virtual reality web experiences

### Enhanced Resource Systems
Advanced resource management capabilities:

- **Resource Management** - Complex resource tracking and allocation
- **Trading Systems** - Inter-player and NPC trading mechanics
- **Mining Mechanics** - Resource extraction and processing systems

## Getting Started

To begin using Universo Platformo features:

1. **Explore UPDL Nodes** - Start with the [UPDL Node System](updl-nodes/README.md) documentation
2. **Try MMOOMM Templates** - Use pre-built templates from [MMOOMM Templates](mmoomm-templates/README.md)
3. **Export Your Project** - Learn about [Multi-Platform Export](export/README.md) options
4. **Implement Resources** - Add advanced features with [Enhanced Resource Systems](resources/README.md)

## Architecture

Universo Platformo follows a modular architecture:

```
universo-platformo-react/
├── packages/                  # Original Flowise packages
├── packages/                      # Universo Platformo extensions
│   ├── updl/                  # UPDL node system
│   ├── publish-frontend/           # Frontend publishing system
│   ├── publish-backend/           # Backend publishing system
│   └── profile-frontend/           # User profile management
└── docs/                      # This documentation
```

## Integration with Flowise

Universo Platformo seamlessly integrates with existing Flowise functionality:

- All original Flowise nodes remain available
- UPDL nodes can be mixed with Flowise nodes in the same flow
- Existing Flowise canvases can be enhanced with Universo features
- API compatibility is maintained for existing integrations

## Next Steps

- [UPDL Node System](updl-nodes/README.md) - Learn about the core node system
- [MMOOMM Templates](mmoomm-templates/README.md) - Explore pre-built templates
- [Multi-Platform Export](export/README.md) - Export to different platforms
- [Enhanced Resource Systems](resources/README.md) - Implement advanced resource mechanics
