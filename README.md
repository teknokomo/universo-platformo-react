# Important! Grave! Важно!

-   Workers of the world, unite!
-   Proletoj el ĉiuj landoj, unuiĝu!
-   Пролетарии всех стран, соединяйтесь!

# Universo Platformo React

[![Version](https://img.shields.io/badge/version-0.44.0--alpha-blue)](https://github.com/teknokomo/universo-platformo-react)
[![License: Omsk Open License](https://img.shields.io/badge/license-Omsk%20Open%20License-green)](LICENSE.md)

## Basic Information

![image](https://github.com/user-attachments/assets/0be3687e-afe2-46be-a0f6-487ff03d9c80)

Implementation of Universo Platformo / Universo MMOOMM / Universo Kiberplano built on React and related stack. This project is based on [Flowise AI](https://github.com/FlowiseAI/Flowise) (version 2.2.8) with multi-user functionality through Supabase integration and extended with UPDL (Universal Platform Description Language) for creating 3D/AR/VR applications.

**In this repository, public efforts are currently underway to create Universo Platformo / Universo MMOOMM, in order to launch a global teknokomization and save humanity from final enslavement and complete destruction by creating special mass multi-user virtual worlds, such as Universo MMOOMM, and a platform for their creation - Universo Platformo, initially with gaming functionality, and then with the addition of the Cyberplan functionality.**

Universo Platformo React serves as the foundation for implementing **Universo Kiberplano** - a global planning and implementation system that unifies plans, tasks, and resources while controlling robots. This system aims to create a comprehensive framework for worldwide coordination of efforts, optimizing resource allocation, and enabling efficient automation through robotic systems, all within a unified digital environment.

More details about all this are written in "The Book of The Future" and various other materials of ours, most of which are still poorly structured and not in English, but right now work is underway to create new detailed documentation, which will be presented in many languages.

## Inspiration

Our wonderful project, which will help create a global teknokomization and save humanity from final enslavement and total destruction, is currently in pre-alpha stage. We are implementing a React-based version of Universo Platformo that will serve as a foundation for creating interactive 3D/AR/VR experiences.

This implementation focuses on extending Flowise AI with UPDL (Universal Platform Description Language) to enable the creation of cross-platform 3D applications through a visual node-based interface.

## Where Am I and What Should I Do?

The near future, Omsk is the capital of the world, in the Olympus-1 tower, scientists explain to you that it is possible to connect your consciousness to a robot in another part of the Universe, in a parallel reality, controlled by robots we call Robocubans, through the recently discovered Great Ring system.

In Universo Platformo React, you are at the control panel of this revolutionary technology. Through the visual node editor, you can create interactive 3D scenes, AR experiences, and VR worlds that bridge our reality with parallel universes.

Your mission is to help build and expand this platform, creating new exporters, enhancing the node system, and contributing to the publication mechanism that will allow these experiences to be shared across the multiverse.

## Contact Information

For questions or collaboration, please contact:

-   VK: [https://vk.com/vladimirlevadnij](https://vk.com/vladimirlevadnij)
-   Telegram: [https://t.me/Vladimir_Levadnij](https://t.me/Vladimir_Levadnij)
-   Email: [universo.pro@yandex.com](mailto:universo.pro@yandex.com)

Our website: [https://universo.pro](https://universo.pro)

## Overview

Universo Platformo React is a project that extends Flowise AI with:

-   **Multi-user functionality** through Supabase integration
-   **Universal node system (UPDL)** for describing scenes and logic
-   **Multi-platform export** capabilities for generating AR/VR/3D applications
-   **Publishing mechanism** for deploying generated applications

The project aims to create a unified platform for developing interactive 3D applications that can be exported to various technologies including AR.js, PlayCanvas, Babylon.js, Three.js, and A-Frame.

## Current Status

**Current Sprint**: 0.44.0-alpha (January 2026)

**Primary Focus**:

-   APPs architecture implementation with packages/updl and packages/publish
-   Universal UPDL node system development
-   AR.js and PlayCanvas React exporters
-   Publication and export UI integration

## Tech Stack

-   Node.js (>=18.15.0 <19.0.0 || ^20)
-   PNPM (>=9)
-   React
-   Supabase (for multi-user functionality)
-   Flowise AI (core framework)

## Project Structure

```
universo-platformo-react/
├── packages/                  # Original Flowise packages
│   ├── components/            # Components and utilities
│   ├── server/                # Server-side code
│   └── ui/                    # Frontend
├── packages/                      # New APPs architecture
│   ├── updl/                  # UPDL node system
│   │   └── imp/               # Implementation
│   └── publish/               # Publication system
│       ├── imp/               # Implementation
│       │   ├── react/         # Frontend
│       │   │   └── minipackages/  # Technology-specific handlers
│       │   └── express/       # Backend
```

This structure allows for:

-   **Modularity**: Each functional area is contained within its own application
-   **Minimal Core Changes**: Original Flowise code remains largely untouched
-   **Easy Extension**: New technologies can be added as miniapps
-   **Clean Separation**: Clear boundaries between different functional areas

## Features

### UPDL Node System

The Universal Platform Description Language (UPDL) provides a unified way to describe 3D scenes and interactions:

-   **Scene Nodes**: Define the environment and root container
-   **Object Nodes**: 3D models, primitives with materials and transformations
-   **Camera Nodes**: Different camera types with configurable properties
-   **Light Nodes**: Various light types with color and intensity controls
-   **Interaction Nodes**: Handle user input and events
-   **Animation Nodes**: Control object animations and behaviors

### Multi-Platform Export

The system can export to multiple platforms from a single UPDL description:

-   **AR.js / A-Frame**: Web-based augmented reality
-   **PlayCanvas React**: React components for PlayCanvas engine
-   **Babylon.js**: Advanced 3D rendering
-   **Three.js**: Popular 3D library for web
-   **A-Frame VR**: Virtual reality experiences

### Publication System

Easily publish and share your creations:

-   **URL Structure**: Clean URLs for accessing published projects
-   **Embedding**: Options for embedded or standalone viewing
-   **Versioning**: Support for project revisions

## Universo Platformo Functionality

Universo Platformo is a universal platform for developing metaverses, virtual reality, multiplayer games, and industrial applications. It provides tools for creating, editing, and managing projects in real-time, and supports integration with various technology stacks.

Key functional areas include:

-   **Metaverses**: Tools for creating virtual worlds with unique ecosystems, including dynamic nature, social structures, and economic systems
-   **Game Development**: Visual scripting, AI for NPCs, physics editors, animation tools, and shader editors
-   **Networking**: Multiplayer support, real-time collaboration, and cross-platform compatibility
-   **Asset Management**: 3D model import/export, texture management, and asset optimization
-   **Industrial Integration**: CAD integration, digital twins, simulation tools, and IoT connectivity
-   **Project Management**: Team collaboration, version control, and task tracking
-   **High-Level Abstraction**: Export/import between different game engines and technology stacks

## Universo MMOOMM Functionality

Universo MMOOMM is a massive multiplayer online game built on Universo Platformo. It's similar to EVE Online and Star Citizen but with additional functionality that helps people unite, create organizations, and implement Kiberplano (Cyberplan) functionality to create production chains, develop products down to the smallest details, create common action plans, and bring their developments into the real world, including through various robots.

Key features include:

-   **Parallel Worlds**: Different worlds with unique economic systems (capitalist, socialist, etc.)
-   **Character Mechanics**: Character creation, development, FPS mechanics, and specialization
-   **Ship and Transport**: Ship management, customization, repair, and various ship types
-   **Careers and Professions**: Military, trading, resource gathering, research, and manufacturing
-   **Economy and Trade**: Dynamic economy, trade hubs, production, and contracts
-   **Social Mechanics**: Corporations, diplomacy, politics, and social interactions
-   **Exploration**: Scanning, planetary exploration, wormholes, and archaeological discoveries
-   **Base Building**: Construction of bases, orbital stations, and territorial control
-   **Science and Technology**: Research, technology trees, and technological breakthroughs

## Cross-Platform Implementation

Universo Platformo is being developed on multiple technology stacks:

-   **React**: This repository implements Universo Platformo on React and related technologies
-   **Godot**: A parallel implementation exists using the Godot game engine ([Universo Platformo Godot](https://github.com/teknokomo/universo-platformo-godot))
-   **PlayCanvas**: Another implementation using the PlayCanvas engine ([Universo Platformo Nebulo](https://github.com/teknokomo/universo-platformo-nebulo))
-   **Quasar**: A version built with the Quasar framework for cross-platform applications

Each implementation shares the same core concepts and goals while leveraging the strengths of its respective technology stack. The high-level abstraction layer allows projects to be exported between different implementations.

## Getting Started

### Prerequisites

-   Node.js (>=18.15.0 <19.0.0 || ^20)
-   PNPM (>=9)

### Installation

0. ATTENTION! Due to the fact that a global refactoring of the project is currently underway, the current version of the project is very unstable. For simple testing of the functionality, use the release [0.31.0 Alpha](https://github.com/teknokomo/universo-platformo-react/releases/tag/0.31.0-alpha)

1. Clone the repository

    ```bash
    git clone https://github.com/teknokomo/universo-platformo-react.git
    cd universo-platformo-react
    ```

2. Install dependencies

    ```bash
    pnpm install
    ```

3. Set up environment variables

    - Create `.env` file in `packages/flowise-core-backend/base` directory
    - Add required Supabase configuration:
        ```
        SUPABASE_URL=your_supabase_url
        SUPABASE_ANON_KEY=your_supabase_anon_key
        SUPABASE_JWT_SECRET=your_supabase_jwt_secret
        ```
    - Optionally, create `.env` file in `packages/flowise-core-frontend/base` directory for UI-specific settings like `VITE_PORT`

    Note: After refactoring, Supabase configuration should only be specified in the `packages/flowise-core-backend/base` directory.

4. Build the project

    ```bash
    pnpm build
    ```

5. Start the application

    ```bash
    pnpm start
    ```

6. Access the application at [http://localhost:3000](http://localhost:3000)

### Development Mode

For development with hot-reloading:

```bash
pnpm dev
```

This will start the application in development mode at [http://localhost:8080](http://localhost:8080)

## Roadmap

The development of Universo Platformo React follows a phased approach:

### Phase 1: Foundation

-   Establishing the APPs architecture
-   Implementing the core UPDL node system
-   Creating the first exporters for AR/VR technologies
-   Developing the publication system

### Phase 2: Expansion

-   Adding support for additional 3D technologies and platforms
-   Enhancing node functionality and user experience
-   Implementing advanced interaction capabilities
-   Expanding the multi-user functionality

### Phase 3: Integration

-   Connecting with robotic systems for Universo Kiberplano
-   Implementing resource management and planning tools
-   Creating digital twins for real-world environments
-   Developing comprehensive automation workflows

## Contributing

We welcome contributions to Universo Platformo React! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is being implemented under the [Omsk Open License](https://universo.pro/ol) (Basic modification). Individual packages in `packages/` may have a different license, please check the license in each individual package.

The Omsk Open License is similar to the MIT license, but includes additional "Basic Provisions" aimed at creating a meaningful and secure public domain while protecting traditional values.

Packages `packages/flowise-*` are part of the [Flowise](https://github.com/FlowiseAI/Flowise), the code is licensed under Apache License Version 2.0, see the license text and information about the authors inside these packages. These packages are scheduled for removal when their functionality is transferred to the main structure of the project.

AI agents are actively used in the development of this project, which are trained on a variety of other projects / code of various free source projects, and Universo Platformo React uses many libraries and large projects such as Flowise, which are gradually being replaced by their own code. 

If you believe that some code in this repository violates your copyrights, please create an Issue in which describe this problem, specify which code violates your rights, show the original author's code and evidence that this code itself is not a copy of another code, describe your suggestions for resolving the problem (attribution, code replacement, etc.). 

In any case, thank you for your participation and contribution to the development of free source code, which directly or indirectly influenced the possibility of creating Universo Platformo React!
