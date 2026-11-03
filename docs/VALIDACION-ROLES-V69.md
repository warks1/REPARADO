# REPARADO V69 · Verificación del circuito cliente → administrador → operario

Fecha de auditoría: 03/11/2026. **REPARADO Test** es un proyecto privado de pruebas en la UE, distinto de la futura producción. No publicar aún la app para clientes reales.

## Dos niveles de comprobación: no confundirlos

1. **Circuito PostgreSQL de V69, desechable:** `tests/full-role-flow-v69.py` instala V27, V34, V35, V65 y V66 tras la base local inicializada por `tests/supabase-roles-rls.py`. Utiliza cuatro identidades **ficticias** (JWT simulados mediante variables de sesión) y verifica inserción de solicitud, privacidad frente al segundo cliente y al operario no asignado, presupuesto del administrador, aceptación exclusiva por el cliente con precio exacto, instantánea de consentimiento, programación y finalización por el operario. Un `ROLLBACK` retira la solicitud y sus efectos. No se conecta a Supabase real ni acredita que el inicio de sesión funcione en dispositivos.
2. **Cuentas auténticas de REPARADO Test:** `supabase/auditoria-sesiones-v69.sql` es **solo lectura** y devuelve recuentos por rol sin identificadores personales. Para comprobar de verdad Auth y RLS entre sesiones siguen siendo necesarias conexiones de prueba con usuarios invitados y sus credenciales, sin compartirlas en código o chats.

## Resultado de la consulta agregada al proyecto Test (03/11/2026)

| Rol | Perfiles | Correos confirmados | Cuentas con inicio de sesión registrado |
| --- | ---: | ---: | ---: |
| Cliente | 2 | 2 | 1 |
| Operario | 1 | 1 | 0 |
| Administrador | 1 | 1 | 0 |

No se contabilizaron solicitudes reales o de prueba existentes. **No consta aún la ejecución exitosa de un flujo completo con sesiones reales**, y el dato `last_sign_in_at` no prueba las funciones de la app por sí solo. La consulta no revela quién ha entrado ni genera accesos.

## Orden para completar la verificación real

1. Confirmar en el panel de Supabase Auth que el registro público está cerrado. La bandera visual `VITE_REPARADO_ALLOW_PUBLIC_REGISTRATION=false` no sustituye la configuración del servidor.
2. Verificar, en dispositivos de prueba, que cada usuario ya autorizado puede iniciar sesión normalmente y ve su rol; revisar recuperación e invitaciones por email. **No crear más usuarios ni restablecer contraseñas sin autorización del titular.**
3. Ejecutar manualmente el workflow existente **«REPARADO V50 · Comprobar privacidad con dos cuentas reales de Test»** con credenciales de prueba guardadas como secretos en el Environment protegido `reparado-private-test`. Ver `docs/VERIFICAR-CUENTAS-REALES-V50.md`. Este workflow realiza solo lecturas.
4. En el proyecto Test, crear y después eliminar por un proceso controlado una solicitud ficticia *con permiso del titular*, comprobar desde cuentas autorizadas: cliente → administración → presupuesto → aceptación → asignación a operario → finalización. No mezclar el resultado con la futura producción. Si no hay un procedimiento de limpieza fiable, limitarse a pruebas en la base efímera.
5. Revisar que las fotografías privadas, los mensajes y las citas reales entre dos cuentas no son accesibles desde otra sesión; ensayar errores de conexión. Verificar luego eliminación de cuenta y derechos de acceso.
6. Repetir la validación en un proyecto Supabase de **producción independiente** y en dispositivos físicos, con protecciones de seguridad, copias, privacidad y credenciales firmadas. Los avisos por correo siguen sin enviar hasta desplegar el worker y configurar el proveedor; la emisión fiscal definitiva sigue pendiente.

## Seguridad y ejecución local automatizada

El workflow `.github/workflows/qa-full-role-flow-v69.yml` levanta un PostgreSQL temporal y ejecuta la prueba. El script **rechaza bases remotas**: requiere host localhost/127.0.0.1 y nombre `reparado_test`. Los datos ficticios se insertan dentro de una transacción revertida, y la ausencia del expediente se comprueba desde una conexión independiente. Si falla una comprobación, el job debe fallar y nunca informar de un éxito inexistente.

La auditoría SQL de cuentas es de solo lectura, diseñada para ejecutar desde la conexión administrativa de Test. No incluir claves, tokens, correos ni capturas de sesiones en repositorios o informes públicos.
