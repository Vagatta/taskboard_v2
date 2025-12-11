# 📋 Taskboard

> **Sistema de gestión de tareas colaborativo con workspaces, proyectos y seguimiento en tiempo real**

[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat&logo=react&logoColor=white)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.81.0-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Flowbite](https://img.shields.io/badge/Flowbite-3.1.2-1C64F2?style=flat&logo=flowbite&logoColor=white)](https://flowbite.com/)

## ✨ Características

### 🏢 Gestión de Workspaces
- **Creación y administración** de espacios de trabajo colaborativos
- **Invitación de miembros** mediante email
- **Control de permisos** por workspace
- **Dashboard de estadísticas** por workspace

### 📁 Proyectos
- **Organización jerárquica**: Workspaces → Proyectos → Tareas
- **Asignación de colaboradores** específicos por proyecto
- **Seguimiento de progreso** en tiempo real
- **Múltiples vistas**: Lista, Kanban, Secciones

### ✅ Gestión de Tareas
- **Creación rápida** con atajos de teclado (`Ctrl+G`)
- **Asignación de responsables** y fechas límite
- **Sistema de prioridades** (Alta, Media, Baja)
- **Estados personalizables**: Pendiente, En progreso, Completada
- **Comentarios y menciones** (`@usuario`)
- **Registro de actividad** completo

### 🎨 Interfaz Moderna
- **Tema claro/oscuro** con transiciones suaves
- **Diseño responsive** para móvil, tablet y desktop
- **Animaciones fluidas** con Tailwind CSS
- **Componentes accesibles** con Flowbite React
- **Glassmorphism** y efectos visuales modernos

### 🔔 Notificaciones
- **Centro de notificaciones** integrado
- **Menciones en comentarios** con alertas
- **Resumen de actividad** por workspace
- **Notificaciones en tiempo real** vía Supabase Realtime

### 📊 Estadísticas y Reportes
- **Métricas de productividad** por usuario
- **Tareas completadas a tiempo** vs fuera de plazo
- **Distribución de carga** entre colaboradores
- **Gráficos visuales** de progreso

## 🚀 Tecnologías

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Frontend** | React | 19.2.0 |
| **Backend/DB** | Supabase | 2.81.0 |
| **Estilos** | Tailwind CSS | 3.4.17 |
| **Componentes** | Flowbite React | 0.12.10 |
| **Build** | React Scripts | 5.0.1 |
| **Testing** | Testing Library | 16.3.0 |

## 📦 Instalación

### Prerrequisitos
- Node.js 16+ y npm/yarn
- Cuenta de Supabase (gratuita)

### 1. Clonar el repositorio
```bash
git clone https://github.com/Vagatta/taskboard_v2.git
cd taskboard_v2
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:

```env
REACT_APP_SUPABASE_URL=tu_url_de_supabase
REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

> **Nota**: Obtén estas credenciales desde tu [panel de Supabase](https://app.supabase.com/) → Settings → API

### 4. Configurar base de datos
Ejecuta las migraciones SQL en tu proyecto de Supabase. Consulta `DOCUMENTACION_APP.md` para el esquema completo.

### 5. Iniciar en desarrollo
```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## 🏗️ Estructura del Proyecto

```
taskboard_v2/
├── public/
│   ├── .htaccess          # Configuración para Apache
│   ├── manifest.json      # PWA manifest
│   └── index.html
├── src/
│   ├── components/        # Componentes React
│   │   ├── AppLayout.jsx
│   │   ├── TaskKanbanBoard.jsx
│   │   ├── TaskSectionsBoard.jsx
│   │   ├── WorkspaceManagementPanel.jsx
│   │   ├── ProjectsManagementPanel.jsx
│   │   ├── TasksManagementPanel.jsx
│   │   ├── NotificationPanel.jsx
│   │   ├── ThemeToggle.jsx
│   │   └── ...
│   ├── context/
│   │   └── AuthContext.jsx  # Contexto de autenticación
│   ├── App.js             # Componente principal
│   ├── App.css            # Estilos globales
│   └── index.js           # Punto de entrada
├── .env                   # Variables de entorno (no versionado)
├── package.json
├── tailwind.config.js     # Configuración de Tailwind
└── README.md
```

## 🎯 Uso

### Primeros pasos
1. **Registrarse**: Crea una cuenta con email y contraseña
2. **Crear workspace**: Desde el dashboard, crea tu primer espacio de trabajo
3. **Invitar colaboradores**: Añade miembros por email
4. **Crear proyecto**: Organiza tus tareas en proyectos
5. **Añadir tareas**: Usa `Ctrl+G` para crear tareas rápidamente

### Atajos de teclado
| Atajo | Acción |
|-------|--------|
| `Ctrl+G` | Nueva tarea rápida |
| `Ctrl+V` | Cambiar vista (Lista/Kanban/Secciones) |

### Vistas disponibles
- **📝 Lista**: Vista tradicional con filtros y búsqueda
- **📊 Kanban**: Tablero visual por estados
- **🗂️ Secciones**: Organización por secciones personalizadas

## 🔐 Autenticación

El sistema utiliza **Supabase Auth** con:
- ✅ Email/Contraseña
- ✅ Verificación de email
- ✅ Recuperación de contraseña
- ✅ Sesiones persistentes
- ✅ Row Level Security (RLS)

## 🌐 Despliegue

### Build de producción
```bash
npm run build
```

### Despliegue en subdirectorio
El proyecto está configurado para desplegarse en `/Taskboard` (ver `homepage` en `package.json`).

Para cambiar la ruta:
```json
{
  "homepage": "/tu-ruta"
}
```

### Apache (.htaccess)
El archivo `public/.htaccess` incluye configuración para:
- Reescritura de URLs para SPA
- Caché de assets estáticos
- Compresión GZIP

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Cobertura
npm test -- --coverage
```

## 📝 Documentación adicional

- [DOCUMENTACION_APP.md](./DOCUMENTACION_APP.md) - Documentación técnica completa
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código privado. Todos los derechos reservados.

## 👤 Autor

**Vagatta**
- GitHub: [@Vagatta](https://github.com/Vagatta)

## 🙏 Agradecimientos

- [Supabase](https://supabase.com/) - Backend as a Service
- [Flowbite](https://flowbite.com/) - Componentes UI
- [Heroicons](https://heroicons.com/) - Iconos SVG
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS

---

⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub!