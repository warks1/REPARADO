# REPARADO V50 · Probar la privacidad con dos sesiones reales de clientes

Este control complementa las pruebas PostgreSQL de RLS: **inicia sesión con dos cuentas cliente reales de REPARADO Test** y comprueba mediante la API de Supabase que una no puede leer la información de la otra. No crea, modifica ni borra solicitudes, facturas o datos de clientes.

## Ejecución manual segura

La tarea **«REPARADO V50 · Comprobar privacidad con dos cuentas reales de Test»** solo hace consultas autenticadas cuando se pulsa `Run workflow` en GitHub Actions. La ejecución real **no** se lanza con cada `push` ni con los PR; esos eventos únicamente ejecutan pruebas unitarias simuladas sin credenciales.

Configurar en GitHub Environment **`reparado-private-test`** las seis variables secretas siguientes:

- `REPARADO_TEST_SUPABASE_URL`: URL HTTPS de **REPARADO Test** (único ID admitido `kpmmlzjvespenogqtujo`).
- `REPARADO_TEST_PUBLISHABLE_KEY`: clave publicable del proyecto de pruebas, nunca `service_role` o `sb_secret_...`.
- `REPARADO_TEST_CLIENT_A_EMAIL` y `REPARADO_TEST_CLIENT_A_PASSWORD`: credenciales de un cliente de pruebas autorizado.
- `REPARADO_TEST_CLIENT_B_EMAIL` y `REPARADO_TEST_CLIENT_B_PASSWORD`: credenciales de otro cliente de pruebas distinto.

Las credenciales deben pertenecer a **cuentas de test** dedicadas y estar almacenadas como secretos protegidos. No añadirlas al repositorio ni imprimirlas en incidencias.

Al iniciar el workflow se comprueba la identidad mediante `auth.getUser()`, que ambos perfiles tengan rol cliente y que no compartan usuario. La prueba realiza lecturas RLS cruzadas en perfiles, solicitudes, mensajes, avisos y facturas. Cuando existen incidencias o solicitudes de eliminación en la otra cuenta, también se comprueba que no sean visibles.

**Interpretación de resultados:** si una tabla está vacía, una consulta sin resultados NO demuestra por sí sola que su RLS impida ver datos de terceros. El script informa de las tablas opcionales donde faltan casos y verifica siempre el perfil existente de la otra cuenta. Las pruebas de políticas SQL de la suite siguen siendo obligatorias.

El resultado solo imprime el número de comprobaciones realizadas y las que no pudieron ejercitarse por ausencia de datos. No imprime IDs, emails, contraseñas, teléfonos, direcciones, tokens ni contenidos de la base de datos.

## Lo que queda pendiente

- Confirmar que las cuentas han recibido invitación o recuperación de contraseña y que se pueden autenticar normalmente.
- Ejecutar manualmente el test con secretos de prueba. Hasta entonces solo constan las pruebas unitarias, **no una comprobación de inicio de sesión real**.
- Revisar RLS de fotos mediante acceso binario real, mensajes y tareas de operarios, reprogramaciones concurrentes y procedimientos de eliminación.
- Repetir una auditoría controlada y separada sobre la futura base de **producción**; este script deliberadamente rechaza cualquier proyecto distinto de REPARADO Test.

No reutilizar estos secretos en workflows públicos ni activar registros públicos para facilitar pruebas.
