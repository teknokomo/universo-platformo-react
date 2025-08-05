# Arquitectura Actual

## Descripción Breve

Análisis de la arquitectura actual de Universo Platformo en estado Alpha (v0.21.0-alpha, julio 2025), que consiste en 6 aplicaciones funcionales construidas sobre la base de Flowise 2.2.8, con examen detallado de los packages existentes y patrones de integración.

## Contenidos

- [Aplicaciones Existentes](#aplicaciones-existentes)
- [Análisis de Packages](#análisis-de-packages)
- [Patrones de Integración](#patrones-de-integración)
- [Deuda Técnica](#deuda-técnica)
- [Preparación para Migración](#preparación-para-migración)

## Aplicaciones Existentes

### Estructura Actual de Aplicaciones

```
apps/
├── updl/                # Sistema de Nodos UPDL (7 nodos de alto nivel)
├── publish-frt/         # Frontend de Publicación (AR.js, PlayCanvas)
├── publish-srv/         # Backend de Publicación (paquete workspace)
├── profile-frt/         # Frontend de Perfiles de Usuario
├── profile-srv/         # Backend de Perfiles (paquete workspace)
└── analytics-frt/       # Frontend de Análisis de Cuestionarios
```

### Detalles de Aplicaciones

#### Sistema UPDL (`apps/updl/`)
**Propósito**: Sistema central de nodos para crear aplicaciones Universo
**Características Clave**:
- 7 nodos abstractos de alto nivel (Space, Entity, Component, Event, Action, Data, Universo)
- Editor de flujo visual para crear lógica de juego
- Capacidades de exportación a múltiples plataformas

#### Sistema de Publicación (`apps/publish-frt/`, `apps/publish-srv/`)
**Propósito**: Exportación y publicación multiplataforma
**Características Clave**:
- Exportación AR.js (listo para producción)
- Exportación PlayCanvas (listo para uso)
- Generación de código basada en plantillas
- Soporte para plantilla MMOOMM

#### Gestión de Perfiles (`apps/profile-frt/`, `apps/profile-srv/`)
**Propósito**: Gestión de cuentas de usuario y perfiles
**Características Clave**:
- Registro y autenticación de usuarios
- Personalización de perfiles
- Gestión de configuraciones

#### Sistema de Análisis (`apps/analytics-frt/`)
**Propósito**: Análisis de cuestionarios e interacciones
**Características Clave**:
- Seguimiento de resultados de cuestionarios
- Análisis de interacciones de usuarios
- Métricas de rendimiento

## Análisis de Packages

### Estructura del Workspace

```
packages/
├── api-documentation/   # Generador de documentación API
├── components/         # Componentes UI y de negocio compartidos
├── server/            # Funcionalidad central del servidor
└── ui/               # Biblioteca UI frontend
```

### Detalles de Packages

#### Documentación API (`packages/api-documentation/`)
**Propósito**: Generación automatizada de documentación API
**Tecnología**: TypeScript + OpenAPI
**Dependencias**: 
- Express.js para servir documentación
- Swagger UI para interfaz de documentación

#### Componentes (`packages/components/`)
**Propósito**: Lógica de negocio compartida y componentes UI
**Tecnología**: TypeScript + React
**Módulos Clave**:
- Definiciones de interfaces
- Utilidades de validación
- Utilidades de almacenamiento
- Manejo de errores
- Carga de modelos

#### Servidor (`packages/server/`)
**Propósito**: Funcionalidad central del servidor y middleware
**Tecnología**: Node.js + Express.js + TypeScript
**Características Clave**:
- Middleware de autenticación
- Conexiones de base de datos
- Enrutamiento API
- Manejo de carga de archivos
- Soporte WebSocket

#### UI (`packages/ui/`)
**Propósito**: Biblioteca UI frontend y componentes
**Tecnología**: React + Material-UI + TypeScript
**Componentes Clave**:
- Componentes de diseño
- Componentes de formulario
- Visualización de datos
- Sistema de temas

## Patrones de Integración

### Enfoque de Integración Actual

1. **Base Monolítica Flowise**: Todas las aplicaciones construidas sobre base Flowise compartida
2. **Packages Workspace**: Código compartido a través de workspaces PNPM
3. **Sistema de Plantillas**: Generación de código para diferentes plataformas
4. **Integración de Base de Datos**: Supabase para persistencia de datos

### Patrones de Comunicación

- **Frontend-Backend**: Llamadas REST API
- **Inter-servicio**: Llamadas directas de función (monolítico)
- **Tiempo Real**: Supabase Realtime para actualizaciones en vivo
- **Almacenamiento de Archivos**: Supabase Storage para assets

## Deuda Técnica

### Problemas Identificados

1. **Arquitectura Monolítica**: Todas las aplicaciones comparten la misma base de código
2. **Escalabilidad Limitada**: Unidad de despliegue única
3. **Acoplamiento Fuerte**: Las aplicaciones dependen del núcleo Flowise compartido
4. **Complejidad de Pruebas**: Difícil probar componentes individuales

### Desafíos de Migración

1. **Migración de Datos**: Mover de base de datos compartida a microservicios
2. **Autenticación**: Implementar autenticación distribuida
3. **Gestión de Estado**: Transición de estado monolítico
4. **Despliegue**: Mover a despliegues en contenedores

## Preparación para Migración

### Assets para Migración

#### Componentes Reutilizables
- Definiciones de nodos UPDL
- Biblioteca de componentes UI
- Patrones de autenticación
- Esquemas de base de datos

#### Patrones Probados
- Exportación basada en plantillas
- Soporte multiplataforma
- Actualizaciones en tiempo real
- Gestión de usuarios

### Estrategia de Migración

1. **Extracción Gradual**: Extraer aplicaciones una por una
2. **Estandarización API**: Definir contratos API claros
3. **Aislamiento de Datos**: Separar esquemas de base de datos
4. **Estrategia de Pruebas**: Pruebas integrales para cada servicio

## Páginas Relacionadas

- [Arquitectura Objetivo](../target-architecture/README.md)
- [Plan de Implementación](../implementation-plan/README.md)
- [Aplicaciones Existentes](existing-apps.md)
- [Análisis de Packages](packages-analysis.md)

## Estado

- [x] Análisis de arquitectura completado
- [x] Deuda técnica identificada
- [x] Estrategia de migración definida
- [ ] Planificación de implementación de migración

---
*Última actualización: 5 de agosto de 2025*
