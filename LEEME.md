# Guía de Mantenimiento - Carwash SaaS

Esta guía te ayudará a retomar el proyecto en el futuro para hacer cambios y actualizaciones.

## 1. Requisitos Previos
Asegúrate de tener instalado:
- **Node.js**: Para ejecutar el proyecto.
- **VS Code**: Tu editor de código.
- **Git**: Para subir los cambios.

## 2. Cómo trabajar en tu computadora (Local)
Cada vez que quieras hacer cambios, sigue estos pasos:

1.  Abre la carpeta del proyecto en **VS Code**.
2.  Abre la terminal (`Ver` > `Terminal` o `Ctrl + ñ`).
3.  Si es la primera vez que lo abres en mucho tiempo, actualiza las librerías:
    ```bash
    npm install
    ```
4.  Inicia el servidor de desarrollo:
    ```bash
    npm run dev
    ```
5.  Abre el link que aparece (ej. `http://localhost:5173`) en tu navegador.
6.  Haz tus cambios en el código. Se guardarán y actualizarán automáticamente en el navegador.

## 3. Cómo subir tus cambios a Internet (Deploy)
Cuando termines tus cambios y quieras que se vean en tu celular (Vercel):

1.  En la terminal de VS Code, ejecuta estos 3 comandos en orden:

    **Paso 1: Preparar los archivos**
    ```bash
    git add .
    ```

    **Paso 2: Guardar la versión**
    ```bash
    git commit -m "Descripción breve de tus cambios"
    ```
    *(Ejemplo: `git commit -m "Cambié el color del botón" `)*

    **Paso 3: Subir a la nube**
    ```bash
    git push
    ```

2.  Espera unos minutos y revisa tu enlace de Vercel. ¡Tus cambios estarán ahí!

## 4. Solución de Problemas Comunes

- **Error "Address already in use"**: Si `npm run dev` falla, es probable que ya tengas otra terminal corriendo. Ciérralas todas o usa otro puerto.
- **No veo mis cambios en el celular**: Asegúrate de haber hecho el `git push` y espera 2-3 minutos.
