# Aplicaciones de Universo Platformo

> **📋 Aviso**: Esta documentación está basada en la documentación original de Flowise y actualmente se está adaptando para Universo Platformo React. Algunas secciones pueden aún hacer referencia a funcionalidades de Flowise que no han sido completamente actualizadas para las características específicas de Universo Platformo.

Esta sección documenta las aplicaciones modulares que extienden la plataforma principal de Flowise, proporcionando funcionalidad adicional sin modificar el código base principal.

## Descripción General

El directorio de aplicaciones de Universo Platformo (`apps/`) contiene módulos especializados que implementan las características únicas de la plataforma. Estas aplicaciones trabajan juntas para proporcionar un ecosistema completo para crear agentes de IA, experiencias 3D/AR/VR y gestionar interacciones de usuario.

## Arquitectura de Aplicaciones

Todas las aplicaciones siguen una estructura modular consistente diseñada para escalabilidad y mantenibilidad:

```
apps/
├── updl/                # Sistema de nodos UPDL para espacios universales 3D/AR/VR
├── publish-frt/         # Frontend del sistema de publicación
├── publish-srv/         # Backend del sistema de publicación
├── profile-frt/         # Frontend de gestión de perfil de usuario
├── profile-srv/         # Backend de gestión de perfil de usuario
├── analytics-frt/       # Frontend de análisis y reportes
└── auth-frt/           # Frontend del sistema de autenticación
```

## Aplicaciones Principales

### UPDL (Lenguaje Universal de Definición de Plataformas)
La base de las capacidades 3D/AR/VR de Universo Platformo, proporcionando un sistema de nodos unificado para describir espacios interactivos.

**Características Clave:**
- 7 nodos principales de alto nivel para descripción universal de escenas
- Nodos heredados para compatibilidad hacia atrás
- Integración pura con Flowise
- Interfaces TypeScript y seguridad de tipos

[Aprende más sobre UPDL →](updl/README.md)

### Sistema de Publicación
Un sistema completo para exportar espacios UPDL a varias plataformas y compartirlos con URLs públicas.

**Frontend (publish-frt):**
- Procesamiento UPDL del lado del cliente
- Constructores basados en plantillas (AR.js, PlayCanvas)
- Plantilla MMOOMM de espacio MMO
- Integración con Supabase

**Backend (publish-srv):**
- Proveedor de datos en bruto
- Gestión de publicaciones
- Definiciones de tipos centralizadas
- Inicialización asíncrona de rutas

[Aprende más sobre el Sistema de Publicación →](publish/README.md)

### Gestión de Perfiles
Sistema completo de perfil de usuario y autenticación con gestión segura de datos.

**Frontend (profile-frt):**
- Actualizaciones de email y contraseña
- Autenticación basada en tokens JWT
- Diseño responsivo amigable para móviles
- Soporte de internacionalización

**Backend (profile-srv):**
- Endpoints seguros para datos de usuario
- Funciones SQL con SECURITY DEFINER
- Políticas de Seguridad a Nivel de Fila (RLS)
- Integración con TypeORM

[Aprende más sobre Gestión de Perfiles →](profile/README.md)

### Sistema de Análisis
Módulo frontend para mostrar análisis de cuestionarios y datos de interacción de usuario.

**Características:**
- Análisis de rendimiento de cuestionarios
- Métricas de participación de usuario
- Componentes de visualización de datos
- Integración con la plataforma principal

[Aprende más sobre Análisis →](analytics/README.md)

### Sistema de Autenticación
Sistema de autenticación moderno basado en Supabase que reemplaza la autenticación heredada.

**Características:**
- Autenticación por email/contraseña
- Gestión de tokens JWT
- Protección de rutas
- Manejo centralizado de errores

[Aprende más sobre Autenticación →](auth/README.md)

## Interacciones de Aplicaciones

Las aplicaciones trabajan juntas en un ecosistema coordinado:

```
┌──────────────┐       ┌────────────────┐        ┌────────────────┐
│              │       │                │        │                │
│   Editor     │──────▶│  Módulo UPDL   │───────▶│ Módulo Publish │
│   Flowise    │       │ (Grafo Espacio)│        │ (Export/Share) │
│              │       │                │        │                │
└──────────────┘       └────────────────┘        └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  URL Pública   │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

## Directrices de Desarrollo

### Principios de Diseño Modular

1. **Aplicaciones Autocontenidas**: Cada aplicación es independiente con interfaces claras
2. **Cambios Mínimos al Núcleo**: Evitar modificar el código base principal de Flowise
3. **Definiciones de Tipos Compartidas**: Usar tipos comunes para comunicación entre aplicaciones
4. **Documentación Consistente**: Mantener archivos README en cada directorio de aplicación

### Sistema de Construcción

Todas las aplicaciones usan un sistema de construcción unificado:

```bash
# Instalar dependencias para todo el workspace
pnpm install

# Construir todas las aplicaciones
pnpm build

# Construir aplicación específica
pnpm build --filter <app-name>

# Modo desarrollo con observación de archivos
pnpm --filter <app-name> dev
```

### Estándares de Estructura de Directorios

Cada aplicación sigue esta estructura:

```
app-name/
├── base/                # Funcionalidad principal
│   ├── src/             # Código fuente
│   │   ├── components/  # Componentes React (frontend)
│   │   ├── controllers/ # Controladores Express (backend)
│   │   ├── services/    # Lógica de negocio
│   │   ├── types/       # Interfaces TypeScript
│   │   ├── utils/       # Funciones utilitarias
│   │   └── index.ts     # Punto de entrada
│   ├── dist/            # Salida compilada
│   ├── package.json     # Configuración del paquete
│   ├── tsconfig.json    # Configuración TypeScript
│   └── README.md        # Documentación de la aplicación
```

## Puntos de Integración

### Integración de Base de Datos
- **Entidades TypeORM**: Definiciones de entidades compartidas
- **Sistema de Migración**: Migraciones de base de datos coordinadas
- **Pool de Conexiones**: Conexiones eficientes a la base de datos

### Integración de Autenticación
- **Tokens JWT**: Autenticación consistente entre aplicaciones
- **Integración Supabase**: Gestión centralizada de usuarios
- **Protección de Rutas**: Control de acceso unificado

### Integración de API
- **Endpoints RESTful**: Diseño de API estandarizado
- **Manejo de Errores**: Respuestas de error consistentes
- **Seguridad de Tipos**: Interfaces TypeScript compartidas

## Consideraciones de Seguridad

### Autenticación y Autorización
- Autenticación basada en tokens JWT
- Políticas de Seguridad a Nivel de Fila (RLS)
- Hash seguro de contraseñas con bcrypt
- Validación y sanitización de entrada

### Protección de Datos
- Comunicación solo HTTPS
- Almacenamiento seguro de tokens
- Prevención de inyección SQL
- Protección XSS

### Seguridad de API
- Limitación de velocidad
- Configuración CORS
- Validación de solicitudes
- Sanitización de mensajes de error

## Arquitectura de Despliegue

### Entorno de Desarrollo
```bash
# Iniciar todas las aplicaciones en modo desarrollo
pnpm dev

# Iniciar aplicación específica
pnpm --filter <app-name> dev
```

### Construcción de Producción
```bash
# Construcción limpia de todas las aplicaciones
pnpm clean
pnpm build

# Desplegar al entorno de producción
pnpm deploy
```

### Configuración de Entorno
- Cadenas de conexión de base de datos
- Configuración de Supabase
- Secretos JWT
- Endpoints de API

## Monitoreo y Registro

### Monitoreo de Aplicaciones
- Métricas de rendimiento
- Seguimiento de errores
- Análisis de usuario
- Verificaciones de salud del sistema

### Estrategia de Registro
- Registro estructurado
- Agregación de errores
- Pistas de auditoría
- Información de depuración

## Expansión Futura

### Añadir Nuevas Aplicaciones

Al crear nuevas aplicaciones:

1. **Seguir Convención de Nomenclatura**: Usar nombres descriptivos con sufijos `-frt` (frontend) o `-srv` (backend)
2. **Implementar Estructura Estándar**: Seguir la estructura de directorios establecida
3. **Añadir Documentación**: Incluir archivos README.md completos
4. **Actualizar Integración**: Añadir al sistema de construcción y configuración de enrutamiento
5. **Probar Integración**: Asegurar compatibilidad con aplicaciones existentes

### Mejoras Planificadas

- **Comunicación en Tiempo Real**: Integración WebSocket para actualizaciones en vivo
- **Arquitectura de Microservicios**: Mayor modularización de servicios
- **Despliegue en Contenedores**: Containerización Docker para escalabilidad
- **Gateway de API**: Gestión y enrutamiento centralizado de API

## Siguientes Pasos

- [Sistema UPDL](updl/README.md) - Aprende sobre el Lenguaje Universal de Definición de Plataformas
- [Sistema de Publicación](publish/README.md) - Explora la publicación y compartición de contenido
- [Gestión de Perfiles](profile/README.md) - Comprende las características de gestión de usuarios
- [Sistema de Análisis](analytics/README.md) - Descubre las capacidades de análisis
- [Sistema de Autenticación](auth/README.md) - Aprende sobre las características de seguridad
