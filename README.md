# Taskboard + Supabase

Aplicación React (Create React App) que gestiona tareas sincronizadas con Supabase y UI basada en Tailwind + Flowbite.

## Requisitos previos

- Node.js >= 18 (incluye npm)
- Cuenta Supabase con un proyecto y la tabla `tasks`

### Variables de entorno

Crea un archivo `.env` en la raíz:

```bash
REACT_APP_SUPABASE_URL=https://tu-proyecto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=tu_clave_publica
```

> El cliente se inicializa mediante `getRequiredEnvVar`, por lo que la app mostrará un error claro si las variables faltan.

## Configuración de Supabase

### Tablas y políticas

```sql
-- Proyectos por usuario
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid not null references auth.users(id),
  owner_email text,
  inserted_at timestamptz not null default timezone('utc', now())
);

alter table public.projects enable row level security;

create policy "Allow select own projects"
on public.projects for select
using (auth.uid() = user_id);

create policy "Allow insert own projects"
on public.projects for insert
with check (auth.uid() = user_id);

create policy "Allow update own projects"
on public.projects for update
using (auth.uid() = user_id);

create policy "Allow delete own projects"
on public.projects for delete
using (auth.uid() = user_id);

-- Miembros de proyectos y roles
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references auth.users(id),
  member_email text,
  role text not null default 'owner',
  inserted_at timestamptz not null default timezone('utc', now()),
  unique (project_id, member_id)
);

alter table public.project_members enable row level security;

create policy "Allow select member projects"
on public.project_members for select using (
  auth.uid() = member_id or auth.uid() in (
    select user_id from public.projects where id = project_id
  )
);

drop policy if exists "Allow insert member projects" on public.project_members;
drop policy if exists "Allow update member projects" on public.project_members;
drop policy if exists "Allow delete member projects" on public.project_members;

create policy "Allow invite members as owner/editor"
on public.project_members for insert
with check (
  auth.uid() in (
    select user_id from public.projects where id = project_id
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_id
      and pm.member_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "Allow update member projects as owner/editor"
on public.project_members for update
using (
  auth.uid() in (
    select user_id from public.projects where id = project_id
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_id
      and pm.member_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
)
with check (
  auth.uid() in (
    select user_id from public.projects where id = project_id
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_id
      and pm.member_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "Allow delete member projects as owner/editor"
on public.project_members for delete
using (
  auth.uid() in (
    select user_id from public.projects where id = project_id
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_id
      and pm.member_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

> **Nota:** Con estas políticas solo el propietario del proyecto y los miembros con rol `owner`/`editor` pueden invitar, actualizar o eliminar miembros. Los usuarios con rol `viewer` mantienen acceso de solo lectura (select) y los propietarios siguen pudiendo gestionar toda la lista incluso si no están en `project_members`.

-- Tareas vinculadas a proyectos
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  user_id uuid not null references auth.users(id),
  project_id uuid references public.projects(id),
  owner_email text,
  completed boolean not null default false,
  inserted_at timestamptz not null default timezone('utc', now())
);

alter table public.tasks enable row level security;

create index tasks_project_id_idx on public.tasks(project_id);

drop policy if exists "Allow select own tasks" on public.tasks;
drop policy if exists "Allow insert own tasks" on public.tasks;
drop policy if exists "Allow update own tasks" on public.tasks;
drop policy if exists "Allow delete own tasks" on public.tasks;

create policy "Allow select own tasks"
on public.tasks for select
using (
  auth.uid() = user_id
  and (project_id is null or project_id in (
    select id from public.projects where user_id = auth.uid()
  ))
);

create policy "Allow insert own tasks"
on public.tasks for insert
with check (
  auth.uid() = user_id
  and (project_id is null or project_id in (
    select id from public.projects where user_id = auth.uid()
  ))
);

create policy "Allow update own tasks"
on public.tasks for update
using (
  auth.uid() = user_id
  and (project_id is null or project_id in (
    select id from public.projects where user_id = auth.uid()
  ))
);

create policy "Allow delete own tasks"
on public.tasks for delete
using (
  auth.uid() = user_id
  and (project_id is null or project_id in (
    select id from public.projects where user_id = auth.uid()
  ))
);
```

> Para evitar `project_id` nulo puedes crear un proyecto por defecto y migrar las tareas existentes: `update public.tasks set project_id = '<uuid>' where project_id is null;`.

## Scripts npm

| Comando | Descripción |
| --- | --- |
| `npm install` | Instala dependencias (incluye Tailwind/Flowbite). |
| `npm start` | Arranca CRA en http://localhost:3000. |
| `npm test` | Ejecuta la suite de pruebas en modo watch (Jest + React Testing Library). |
| `npm run build` | Genera el bundle de producción en `build/`. |

## Arquitectura

- **`src/context/AuthContext.jsx`**: encapsula Supabase Auth y expone `signIn`, `signUp`, `signOut`, estados `user`, `initializing`, `authLoading`, errores.
- **`src/components/AppLayout.jsx`**: layout principal responsivo con cabecera y slot para acciones.
- **`src/components/ProjectSelector.jsx`**: gestiona listado, creación y selección de proyectos.
- **`src/App.js`**: orquesta autenticación, panel de proyectos y render de `TaskList` o estados vacíos.
- **`src/TaskList.jsx`**: CRUD de tareas filtradas por proyecto con detalles de propietario y manejo optimista de estado.
- **Interfaz**: la vista de proyectos muestra tarjetas con nombre, propietario y fecha de creación; las tareas indican responsable, estado y marca temporal.
- **`src/index.css`**: Tailwind base + tema oscuro.

## Pruebas

Las pruebas se ejecutan con `npm test`. El runner entra en modo interactivo (watch). Atajos útiles:

- `a`: volver a ejecutar toda la suite.
- `p`: filtrar por nombre de test.
- `q`: salir.

### Añadir nuevas pruebas

1. Crea archivos `*.test.js` junto al componente.
2. Usa `render` de `@testing-library/react`; si el componente depende del contexto, mockea `useAuth` o crea un wrapper con `AuthProvider`.
3. Para Supabase, mockea el cliente (`jest.mock('../supabaseClient')`) devolviendo promesas controladas.

Consulta `src/App.test.js` para ejemplos de cómo stubear el contexto y verificar casos autenticado/no autenticado.

## Estilo y UI

Tailwind está configurado con Flowbite y variantes personalizadas en `tailwind.config.js`. Puedes extender colores y componentes allí. Los componentes Flowbite se importan directamente (`Button`, `Card`, etc.) sin necesidad de CSS adicional.

---

¡Listo! Ejecuta `npm start`, crea un usuario y comienza a añadir tareas sincronizadas con Supabase.
