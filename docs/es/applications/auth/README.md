# Sistema de Autenticación

> **📋 Aviso**: Esta documentación está basada en la documentación original de Flowise y actualmente se está adaptando para Universo Platformo React. Algunas secciones pueden aún hacer referencia a funcionalidades de Flowise que no han sido completamente actualizadas para las características específicas de Universo Platformo.

Sistema frontend de autenticación para Universo Platformo basado en integración con Supabase.

## Descripción del Proyecto

Este módulo proporciona un sistema completo de autenticación que reemplaza la autenticación heredada de Flowise con un sistema moderno basado en Supabase con tokens JWT y flujo de autenticación adecuado.

## Arquitectura de Autenticación

### Migración desde Sistema Heredado

El sistema de autenticación ha sido migrado desde una autenticación heredada basada en Flowise (usuario/contraseña en localStorage) a un sistema moderno basado en Supabase con tokens JWT y flujo de autenticación adecuado.

#### Sistema Heredado (Eliminado)
- **Componente LoginDialog**: Autenticación modal con usuario/contraseña básico
- **Almacenamiento localStorage**: Credenciales almacenadas en localStorage del navegador
- **Manejo Manual de Errores**: Cada componente manejaba errores 401 individualmente

#### Sistema Nuevo (Actual)
- **Componente Auth Page**: Interfaz de autenticación de página completa
- **AuthProvider Context**: Gestión centralizada del estado de autenticación
- **Almacenamiento de Tokens JWT**: Autenticación segura basada en tokens
- **Manejo Unificado de Errores**: Manejo consistente de errores de autenticación vía hook personalizado

### Componentes del Sistema

```
packages/flowise-ui/src/
├── views/up-auth/
│   └── Auth.jsx                    # Página principal de autenticación
├── utils/
│   └── authProvider.jsx            # Proveedor de contexto de autenticación
├── routes/
│   ├── AuthGuard.jsx              # Componente de protección de rutas
│   └── index.jsx                  # Configuración principal de enrutamiento
└── hooks/
    └── useAuthError.js            # Manejador personalizado de errores de autenticación
```

## Componentes Principales

### 1. Página de Autenticación (`Auth.jsx`)

La interfaz principal de autenticación que maneja el inicio de sesión y registro de usuarios.

**Características:**
- Autenticación por email/contraseña
- Registro de usuarios
- Funcionalidad de restablecimiento de contraseña
- Integración con Supabase
- Traducción de mensajes de error
- Diseño responsivo

**Funciones Clave:**
```javascript
// Función de inicio de sesión
const handleLogin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
}

// Función de registro
const handleRegister = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })
}
```

### 2. Proveedor de Autenticación (`authProvider.jsx`)

Gestión centralizada del estado de autenticación usando React Context.

**Proporciona:**
- Estado de autenticación del usuario
- Funciones de inicio/cierre de sesión
- Gestión de tokens
- Información del perfil de usuario

**Estructura del Contexto:**
```javascript
const AuthContext = createContext({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: () => {},
    logout: () => {},
    register: () => {}
})
```

### 3. Guardia de Autenticación (`AuthGuard.jsx`)

Componente de protección de rutas que asegura que solo usuarios autenticados puedan acceder a rutas protegidas.

**Características:**
- Control de acceso basado en rutas
- Redirección automática a página de autenticación
- Gestión de estado de carga
- Preservación de ruta de retorno

### 4. Hook de Error de Autenticación (`useAuthError.js`)

Hook personalizado para manejo consistente de errores de autenticación en componentes.

**Propósito:**
- Centraliza el manejo de errores 401
- Proporciona cierre de sesión automático en fallo de autenticación
- Redirige a página de autenticación con ruta de retorno
- Elimina duplicación de código

**Ejemplo de Uso:**
```javascript
import { useAuthError } from '@/hooks/useAuthError'

const MyComponent = () => {
    const { handleAuthError } = useAuthError()

    useEffect(() => {
        if (apiError) {
            if (!handleAuthError(apiError)) {
                // Manejar errores no relacionados con autenticación
                setError(apiError)
            }
        }
    }, [apiError, handleAuthError])
}
```

## Flujo de Autenticación

### 1. Carga Inicial
1. La aplicación se carga y verifica el estado de autenticación
2. `AuthProvider` verifica la sesión existente con Supabase
3. Las rutas protegidas por `AuthGuard` verifican el estado de autenticación

### 2. Acceso No Autenticado
1. El usuario intenta acceder a una ruta protegida
2. `AuthGuard` detecta estado no autenticado
3. El usuario es redirigido a la página `/auth` con ruta de retorno

### 3. Proceso de Autenticación
1. El usuario ingresa credenciales en la página de autenticación
2. Supabase valida las credenciales
3. El token JWT se almacena en la sesión
4. El usuario es redirigido al destino original

### 4. Manejo de Errores de API
1. La solicitud API devuelve estado 401
2. El hook `useAuthError` detecta error de autenticación
3. El usuario es automáticamente desconectado
4. Redirección a página de autenticación con ruta actual

## Características de Seguridad

### Gestión de Tokens
- Tokens JWT almacenados de forma segura en sesión de Supabase
- Renovación automática de tokens
- Proceso seguro de cierre de sesión

### Protección de Rutas
- Todas las rutas sensibles protegidas por `AuthGuard`
- Redirección automática para usuarios no autenticados
- Preservación de ruta de retorno

### Manejo de Errores
- Manejo centralizado de errores de autenticación
- Limpieza automática en fallo de autenticación
- Mensajes de error amigables para el usuario

## Integración con Supabase

### Configuración
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Métodos de Autenticación
- Autenticación por email/contraseña
- Registro de usuarios con verificación de email
- Funcionalidad de restablecimiento de contraseña
- Gestión de sesiones

## Desarrollo

### Configuración
```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con sus credenciales de Supabase
```

### Modo Desarrollo
```bash
# Ejecutar aplicación en modo desarrollo
pnpm dev
```

### Pruebas
```bash
# Ejecutar pruebas
pnpm test

# Ejecutar pruebas con cobertura
pnpm test:coverage
```

## Directrices de Desarrollo

### Agregar Nuevos Componentes Protegidos

1. Importar y usar el hook `useAuthError` para manejo de errores de API
2. Envolver rutas con el componente `AuthGuard`
3. Usar el hook `useAuth` para estado de autenticación

### Mejores Prácticas de Manejo de Errores

```javascript
// Siempre usar useAuthError para errores de API
const { handleAuthError } = useAuthError()

useEffect(() => {
    if (error) {
        // Permitir que useAuthError maneje 401s, manejar otros manualmente
        if (!handleAuthError(error)) {
            setLocalError(error)
        }
    }
}, [error, handleAuthError])
```

### Acceso al Estado de Autenticación

```javascript
// Usar contexto AuthProvider para estado de autenticación
const { user, isAuthenticated, login, logout } = useAuth()
```

## Mejoras Futuras

### Características Planificadas

1. **Integración OAuth**: Soporte para Google, GitHub y otros proveedores
2. **Autenticación Multifactor**: Soporte para SMS y aplicaciones autenticadoras
3. **Gestión de Sesiones**: Controles avanzados de sesión
4. **Registro de Auditoría**: Seguimiento de eventos de autenticación

### Hoja de Ruta de Migración

1. **Fase 1**: Migración completa a estructura `packages/auth-frt`
2. **Fase 2**: Características de seguridad mejoradas
3. **Fase 3**: Métodos de autenticación avanzados
4. **Fase 4**: Auditoría completa y características de cumplimiento

## Siguientes Pasos

- [Sistema UPDL](../updl/README.md) - Aprende sobre el Lenguaje Universal de Definición de Plataformas
- [Sistema de Publicación](../publish/README.md) - Explora la publicación y compartición de contenido
- [Gestión de Perfiles](../profile/README.md) - Comprende las capacidades de gestión de usuarios
