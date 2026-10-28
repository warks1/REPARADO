# REPARADO V56 · Auditorías de seguridad actualizadas

Se actualizan los scripts de **solo lectura** de REPARADO Test, sin aplicar migraciones, tocar usuarios ni cambiar permisos.

## Por qué cambiaron tres controles
- La migración V34 dejó inaccesible la antigua RPC `accept_reparado_quote(uuid)`, pues permitía aceptar el presupuesto sin contrastar el importe visible.
- El contrato válido es `accept_reparado_quote(uuid,numeric)` y solo debe ser ejecutable por usuarios autenticados.
- La auditoría V9 confundía las RPC autenticadas de soporte y dispositivos, añadidas posteriormente, con funciones internas de triggers. Ahora distingue funciones que retornan `trigger` y comprueba que no se pueden invocar directamente.

## Resultados verificados (REPARADO Test, 28/10/2026)
- Auditoría general actualizada: **20/20 OK**.
- Cuentas y permisos actualizados: **10/10 OK**.
- Auditoría independiente de fotos: **4/4 OK**.

Las consultas se ejecutaron exclusivamente en modo lectura. Los resultados NO sustituyen una prueba de inicio de sesión, el aislamiento E2E con varias cuentas ni el cierre real de altas públicas en Supabase Authentication.

## Bloqueos vigentes para producción
- Confirmar en Auth que la creación pública de cuentas está deshabilitada y el alta anónima no está habilitada. No basta con ocultar el botón.
- Activar protección contra contraseñas filtradas cuando el plan la ofrezca.
- Validar permisos de datos con dos clientes, un operario y un administrador desde aplicaciones reales.
- Las advertencias de RPC `SECURITY DEFINER` del Security Advisor deben evaluarse por función; no revocar funciones de uso legítimo sin comprobar las políticas de autorización.
- No conectar REPARADO Test a Pages ni utilizarlo como backend de clientes.
