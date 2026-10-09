# Reparado — versión reparada para GitHub Pages

## Correcciones realizadas
- Rutas relativas de Vite para evitar que los recursos fallen al publicar en un repositorio de GitHub Pages.
- Inicio seguro cuando todavía no se han configurado las credenciales de Supabase; ya no debe quedarse en blanco por `supabaseUrl is required`.
- Vista de demostración navegable que permite explorar los servicios y guardar solicitudes localmente en el navegador.
- Flujo de GitHub Actions para construir y publicar automáticamente la carpeta `dist` en GitHub Pages.

## Publicar en GitHub
1. Sube estos archivos al repositorio (rama `main`).
2. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como fuente de publicación.
3. En **Actions**, espera a que termine el flujo **Deploy Reparado to GitHub Pages** y abre la URL publicada.

## Modo de demostración y modo real
Sin credenciales de Supabase, la aplicación abre en modo demostración. Las solicitudes se guardan únicamente en el navegador del dispositivo y no llegan a un operario.

Para activar el modo real, crea un proyecto de Supabase y ejecuta `supabase/schema.sql` en su SQL Editor. Después añade estos secretos en **Settings → Secrets and variables → Actions**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (clave pública/anon, nunca la `service_role`)

Haz un nuevo push para que GitHub Pages reconstruya la aplicación con el backend configurado.

## Desarrollo local
Requiere Node.js 22 o superior:
```sh
npm install
npm run dev
```

## Aplicación móvil
Capacitor está preparado en el proyecto. Para compilar para iOS/Android hay que configurar el backend y completar la configuración nativa correspondiente.

© AMS · Empresa propietaria del software
