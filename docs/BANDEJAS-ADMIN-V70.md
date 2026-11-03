# REPARADO V70 · Bandejas internas completas

## Problema resuelto

La vista general de personal carga por rendimiento **150 trabajos recientes**, mientras que la bandeja `Nuevas` (V68) consulta todas las solicitudes `new`. La sección `Sin operario` todavía se limitaba a esas 150, lo que podía dejar sin revisar solicitudes antiguas pendientes de asignación.

## Comportamiento

- **Nuevas:** cuenta todas las solicitudes con `status = 'new'` y muestra 50 por página.
- **Sin operario:** cuenta todas las solicitudes con `operator_id IS NULL` y `status IN ('new','quoted','accepted','scheduled','in_progress')`, y muestra 50 por página. Los trabajos `completed` y `cancelled` no necesitan asignación y no se incluyen.
- **Todos / Pendientes / Agenda / En curso / Finalizados:** mantienen la vista de los **150 más recientes**; sus contadores son parciales y no deben confundirse con cifras históricas globales.
- El **administrador** puede utilizar ambas bandejas globales. El **operario** conserva su vista privada de trabajos asignados, sometida a RLS, y no consulta las bandejas globales.
- Si el contador o la página de Supabase falla, se muestra un error y **Reintentar**, no un falso `0` ni un listado incompleto.
- Cuando un operario queda asignado y la página actual desaparece, la interfaz regresa a la primera página.

## Seguridad y alcance

Las consultas usan `supabase.from('service_requests')`, filtros SQL y las políticas RLS existentes. No se crea ninguna función privilegiada ni se modifican RLS, permisos, cuentas, presupuestos, órdenes o datos almacenados. La comprobación de estas vistas con sesiones reales de administrador y operario sigue pendiente.

Los avisos por correo no estarán activos hasta desplegar la función `reparado-mail-worker` y proporcionar un proveedor verificado. **La bandeja no equivale a una notificación externa garantizada.**

## Verificación

Ejecutar `npm test` y `npm run build`. La prueba `tests/staff-unassigned-v70.test.mjs` verifica paginación a partir del trabajo 151, conteos reales, filtros de estado y usuario sin asignación, fallos de red y protección de la interfaz.
