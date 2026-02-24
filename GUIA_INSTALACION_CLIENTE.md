# Guía de Instalación para Nuevos Clientes (White-Label)

Esta guía te explica cómo crear una copia independiente de la aplicación para un nuevo cliente (colega).

## 1. Crear Base de Datos (Supabase)
1.  Ve a [supabase.com](https://supabase.com) y crea una cuenta o inicia sesión.
2.  Haz clic en **"New Project"**.
3.  Nombre: `CarWash de Juan` (Ejemplo).
4.  Password: Genera uno seguro y guárdalo.
5.  Región: Elige la más cercana (ej. US East).
6.  Espera a que se cree el proyecto (tarda 1-2 minutos).

## 2. Preparar Base de Datos
1.  En el panel de Supabase de tu nuevo proyecto, ve a **SQL Editor** (icono de hoja de papel en la izquierda).
2.  Haz clic en **"New Query"**.
3.  Copia TODO el contenido del archivo `install_new_client.sql` que te he preparado en este proyecto.
4.  Pégalo en el editor y dale al botón **RUN**.
    *   *Esto creará todas las tablas, configuraciones y el usuario admin inicial.*

## 3. Conectar la App (Vercel)
1.  Ve a [vercel.com](https://vercel.com).
2.  Haz clic en **"Add New..."** -> **"Project"**.
3.  Importa el repositorio de `carwash-saas` (el mismo código sirve para todos).
4.  Ponle un nombre al proyecto: `carwash-juan`.
5.  En **Environment Variables**, añade las credenciales del NUEVO Supabase:
    *   `VITE_SUPABASE_URL`: (Lo encuentras en Supabase > Project Settings > API)
    *   `VITE_SUPABASE_ANON_KEY`: (Lo encuentras en el mismo lugar)
6.  Haz clic en **Deploy**.

## 4. Configuración Final
1.  Cuando termine el despliegue, entra a la URL de la nueva app (ej. `carwash-juan.vercel.app`).
2.  Ve a `/login`.
3.  **Crear Primer Usuario:**
    *   Como es un proyecto nuevo, no hay usuarios. Ve a Supabase > Authentication > Users y haz clic en "Add User".
    *   Email: `admin@juan.com`
    *   Password: `juanpassword`
    *   Marca "Auto-confirm email".
4.  **Hacerlo Admin:**
    *   En Supabase > Table Editor > `employees`.
    *   Inserta una fila nueva.
    *   `name`: "Juan Admin"
    *   `role`: "admin"
    *   `email`: `admin@juan.com`
    *   `user_id`: (Copia el UUID del usuario que creaste en el paso anterior).
5.  Conéctate a la app con ese usuario.
6.  Ve a **Configuración Negocio** (`/settings`).
7.  Sube el Logo de Juan y cambia el nombre a "CarWash Juan".

¡Listo! Juan tiene su propia app, base de datos y clientes, totalmente separados de los tuyos.
