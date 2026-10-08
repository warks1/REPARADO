# Reparado — versión real / arquitectura v1

Esta versión sustituye la demo local por una arquitectura preparada para producción:

- Vite + JavaScript
- Supabase Auth
- PostgreSQL + Row Level Security
- Solicitudes persistentes
- Perfiles y roles: cliente / admin / operario
- Chat persistente
- Notificaciones persistentes
- Registro de tokens push
- Facturas
- Capacitor para iOS y Android
- Responsive web/PWA-ready

## Arranque web

1. Instalar Node.js LTS.
2. `npm install`
3. Copiar `.env.example` a `.env`
4. Poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Crear un proyecto en Supabase.
6. Ejecutar `supabase/schema.sql` en el SQL Editor.
7. `npm run dev`

## iPhone / Android

Después de configurar Supabase:
`npm run build`
`npx cap add ios`
`npx cap add android`
`npx cap sync`

iOS se termina en Xcode y Android en Android Studio, con certificados y cuentas de desarrollador.

## Lo que NO se debe poner en el frontend

Nunca colocar la `service_role key` de Supabase en `.env` del frontend. Solo la anon/public key.

## Push

La aplicación registra el token nativo en `device_tokens`. Para enviar push reales hay que conectar una Edge Function de Supabase con APNs (iOS) y FCM (Android), guardando las credenciales en secrets del backend, nunca en la app.

## Fotos

El esquema reserva el sistema para Storage privado `request-photos`. La siguiente integración debe subir cada fotografía y asociarla a la solicitud.

## Facturación

La tabla `invoices` deja preparada la facturación. Para PDF definitivo y envío por email/WhatsApp conviene generar el documento en backend y guardar el PDF en Storage.

## Datos de empresa

Antes de publicar hay que configurar los datos fiscales reales de AMS, numeración de facturas, condiciones y textos legales.
