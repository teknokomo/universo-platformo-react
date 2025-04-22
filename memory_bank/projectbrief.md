# Project Brief - Universo Platformo

## Overview
Universo Platformo (Universo Kiberplano) is a project based on the modification of Flowise AI, adding multi-user functionality through Supabase integration.

## Project Name
- Universo Platformo / Universo Kiberplano
- Based on Flowise AI (version 2.2.7-patch.1)

## Core Technologies
- Node.js (>=18.15.0 <19.0.0 || ^20)
- PNPM (>=9)
- Supabase (for multi-user functionality)
- React

## Key Goals
- Implement multi-user functionality
- Minimize changes to original Flowise code
- Maintain backwards compatibility
- Keep implementation simple and concise

## Coding Standards
- Prefix comments with "Universo Platformo | "
- Write concise English comments
- Follow existing code patterns
- Fewer lines of code is better

## UPDL (Work is currently underway to implement it)

UPDL is an initiative to create a universal visual design language **UPDL (Universo Platformo Definition Language)** within the Universo Platformo ecosystem. The goal of the project is to provide **a single way to describe** 3D/AR/VR scenes and interactive logic in a form understandable to both humans and machines, which can then be used to generate applications on different technologies. In other words, developers will be able to describe the structure of a scene and the behavior of an application once, in the form of a **graph of nodes**, and then export this specification to various engines (for example, PlayCanvas, Babylon.js, Three.js, A-Frame, AR.js, etc.) without duplicating work. This approach separates the **“what” (content and logic)** from the **“how” (platform-specific implementation)**: *what* should happen is described in UPDL, and *how* it is realized is determined by the code generator during export. By decoupling content from platform details in this way, UPDL enables a true “write once, deploy anywhere” workflow for interactive 3D/AR applications.

Key outcomes the project aims to achieve:  
- **Universal node system (UPDL):** A unified node-based system for describing scenes and logic, integrated into the application (based on FlowiseAI).  
- **Multi-platform export:** The ability to generate, from one description, multiple versions of an application – an AR application in the browser, a 3D application on PlayCanvas (including React), scenes in Babylon.js, Three.js, A-Frame, etc.  
- **Publishing mechanism:** A user-friendly interface to generate and deploy the generated applications via a unique link (similar to the *Publish* system in PlayCanvas).  
- **Documentation and automation:** A well-tuned Memory Bank system to preserve development context and a set of Cursor AI prompts to assist in planning, code generation, and creative tasks.

This project is expected to significantly reduce the effort required to develop interactive applications for different platforms. In the long term, UPDL will become the **central link of the Universo Platformo ecosystem**, providing a unified format for sharing content between design tools and runtime engines.
