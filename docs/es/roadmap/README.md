# Hoja de Ruta de Universo Platformo

## Descripción Breve

La hoja de ruta define el desarrollo estratégico de Universo Platformo desde su estado Alpha actual hasta una plataforma completa para crear Universo MMOOMM y otras aplicaciones 3D/AR/VR. Este documento describe la evolución arquitectónica desde 6 aplicaciones existentes hasta un ecosistema integral de más de 20 microservicios.

## Contenidos

- [Arquitectura Actual](#arquitectura-actual)
- [Arquitectura Objetivo](#arquitectura-objetivo)
- [Plan de Implementación](#plan-de-implementación)
- [Aplicaciones](#aplicaciones)
- [Especificaciones Técnicas](#especificaciones-técnicas)
- [Hitos](#hitos)

## Arquitectura Actual

**Estado**: Alpha alcanzado (v0.21.0-alpha, julio 2025)

Universo Platformo actualmente consiste en 6 aplicaciones funcionales construidas sobre la base de Flowise 2.2.8:

### Aplicaciones Existentes

```
packages/
├── updl/                # Sistema de Nodos UPDL (7 nodos de alto nivel)
├── publish-frt/         # Frontend de Publicación (AR.js, PlayCanvas)
├── publish-srv/         # Backend de Publicación (paquete workspace)
├── profile-frt/         # Frontend de Perfiles de Usuario
├── profile-srv/         # Backend de Perfiles (paquete workspace)
└── analytics-frt/       # Frontend de Análisis de Cuestionarios
```

### Logros Clave

- ✅ **Sistema UPDL**: 7 nodos abstractos (Space, Entity, Component, Event, Action, Data, Universo)
- ✅ **Exportación Multi-tecnología**: AR.js (producción), PlayCanvas (listo)
- ✅ **Arquitectura de Plantillas**: Plantillas de exportación reutilizables
- ✅ **MVP MMOOMM**: MMO espacial básico con minería láser
- ✅ **Sistema de Recursos**: Física realista de materiales con densidad

## Arquitectura Objetivo

**Visión**: Ecosistema de microservicios de más de 20 aplicaciones para crear Universo MMOOMM completo

### Categorías de Aplicaciones

1. **Mecánicas de Juego** (8 aplicaciones)
   - Recursos, economía, naves, estaciones, minería, navegación

2. **Sistemas Sociales** (6 aplicaciones)
   - Corporaciones, diplomacia, comercio, comunicaciones

3. **Sistemas Técnicos** (6 aplicaciones)
   - Autenticación mejorada, multijugador, seguridad, análisis

4. **Aplicaciones de Plataforma** (4 aplicaciones)
   - Motor de flujo de trabajo, registro de nodos, API Gateway, plantillas

### Principios Arquitectónicos

- **Arquitectura de Microservicios**: Cada aplicación como servicio independiente
- **Enfoque API-first**: Todas las interacciones a través de APIs bien definidas
- **Arquitectura Dirigida por Eventos**: Comunicación asíncrona vía Supabase Realtime
- **Paquetes Workspace**: Componentes reutilizables entre aplicaciones

## Plan de Implementación

### Fase 1: MVP Universo MMOOMM (v0.22.0-alpha) - Q2 2025

**Objetivo**: Crear funcionalidad básica del juego

**Aplicaciones Prioritarias**:
- `resources-frt/srv` - Sistema de recursos con densidad de materiales
- `ships-frt/srv` - Gestión de naves
- `economy-frt/srv` - Economía básica entre mundos

**Criterios de Preparación**:
- [ ] MVP funcional con mecánicas básicas del juego
- [ ] Integración con plantilla PlayCanvas
- [ ] Economía entre 3 mundos (Kubio, Konkordo, Triumfo)

### Fase 2: Sistemas Base (v0.25.0-beta) - Q3 2025

**Objetivo**: Sistemas sociales y técnicos

**Aplicaciones**:
- `corporations-frt/srv` - Corporaciones y organizaciones
- `auth-enhanced-frt/srv` - Autenticación mejorada
- `multiplayer-frt/srv` - Multijugador en tiempo real

### Fase 3: Funciones Avanzadas (v1.0.0) - Q4 2025

**Objetivo**: Ecosistema completo de mecánicas del juego

**Aplicaciones**:
- `stations-frt/srv` - Estaciones espaciales
- `trading-frt/srv` - Comercio avanzado
- `diplomacy-frt/srv` - Relaciones diplomáticas

### Fase 4: Ecosistema (v1.5.0+) - 2026+

**Objetivo**: Plataforma de microservicios

**Aplicaciones**:
- `workflow-engine-srv` - Motor Chatflow
- `node-registry-srv` - Registro de nodos
- `api-gateway-srv` - API Gateway

## Aplicaciones

### Mecánicas de Juego

Aplicaciones que implementan las mecánicas centrales del juego Universo MMOOMM:

- **Recursos**: Sistema con 16 tipos de materiales y física realista
- **Economía**: Moneda Inmo con diferentes sistemas económicos
- **Naves**: Gestión de flota con personalización
- **Estaciones**: Bases espaciales y producción
- **Minería**: Minería láser industrial
- **Navegación**: Puertas estelares entre mundos

### Sistemas Sociales

Aplicaciones para interacción de jugadores:

- **Corporaciones**: Organizaciones con jerarquía de roles
- **Diplomacia**: Alianzas, conflictos, negociaciones
- **Comercio**: Subastas, contratos, logística
- **Comunicaciones**: Comunicación en el juego y foros

### Sistemas Técnicos

Aplicaciones para soporte técnico de la plataforma:

- **Autenticación**: Integración de cuentas de juego y plataforma
- **Multijugador**: Sincronización en tiempo real
- **Seguridad**: Protección contra trampas y exploits
- **Análisis**: Métricas y análisis de comportamiento

## Especificaciones Técnicas

### Stack Tecnológico

- **Frontend**: React + TypeScript + Material-UI
- **Backend**: Node.js + Express + TypeScript
- **Base de Datos**: Supabase (PostgreSQL)
- **Tiempo Real**: Supabase Realtime
- **Gestor de Paquetes**: PNPM workspaces
- **Motores 3D**: PlayCanvas, AR.js

### Patrones Arquitectónicos

- **API Gateway**: Punto único de entrada para todas las solicitudes
- **Event Bus**: Comunicación asíncrona vía Supabase Realtime
- **Paquetes Workspace**: Componentes reutilizables
- **Motor de Plantillas**: Generación de código para diferentes plataformas

## Hitos

### Próximos Lanzamientos

- **v0.22.0-alpha** (Q2 2025): Mecánicas MVP del juego
- **v0.25.0-beta** (Q3 2025): Sistemas sociales
- **v1.0.0** (Q4 2025): Primer lanzamiento estable

### Objetivos a Largo Plazo

- **v1.5.0** (2026): Arquitectura de microservicios
- **v2.0.0** (2027): Integración blockchain TON
- **v3.0.0** (2028): Funcionalidad Kiberplano

## Páginas Relacionadas

- [Arquitectura Actual](current-architecture/README.md)
- [Arquitectura Objetivo](target-architecture/README.md)
- [Plan de Implementación](implementation-plan/README.md)
- [Aplicaciones](applications/README.md)
- [Especificaciones Técnicas](technical-specifications/README.md)
- [Hitos](milestones/README.md)

## Estado de Implementación

- [x] Análisis de arquitectura actual
- [x] Planificación de arquitectura objetivo
- [/] Creación de documentación
- [ ] Inicio de implementación Fase 1

---
*Última actualización: 5 de agosto de 2025*
