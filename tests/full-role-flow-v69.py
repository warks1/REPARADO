#!/usr/bin/env python3
"""REPARADO V69 · Ciclo completo con cuatro roles y datos ficticios.

Ejecutar SOLO en PostgreSQL local desechable, después de
tests/supabase-roles-rls.py. Instala migraciones posteriores y prueba
el circuito de una reparación con cambios de rol y JWT simulados.
No se conecta a REPARADO Test ni a producción.
La solicitud creada se revierte con ROLLBACK y no queda guardada.
"""
import os
from contextlib import contextmanager
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
import psycopg

dsn=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not dsn:
    raise SystemExit('V69: REPARADO_TEST_DATABASE_URL local obligatorio')
settings=psycopg.conninfo.conninfo_to_dict(dsn)
if settings.get('host') not in ('127.0.0.1','localhost') or settings.get('dbname')!='reparado_test':
    raise SystemExit('V69: prohibido ejecutar fuera de PostgreSQL local desechable')

ROOT=Path(__file__).resolve().parents[1]
CUSTOMER='00000000-0000-4000-8000-000000000001'
OTHER='00000000-0000-4000-8000-000000000002'
OPERATOR='00000000-0000-4000-8000-000000000003'
ADMIN='00000000-0000-4000-8000-000000000004'
KEY='dd30836c-65aa-4e1f-b375-35aa2cb158f0'
PRICE=Decimal('175.00')

@contextmanager
def as_identity(db,uid,role='authenticated'):
    assert role in ('authenticated','anon')
    db.execute('set local role '+role)
    db.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid or '',))
    db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
    try:
        yield
    finally:
        db.execute('reset role')
        db.execute("select set_config('request.jwt.claim.sub','',true)")
        db.execute("select set_config('request.jwt.claim.role','',true)")

def forbidden(db,sql,params=(),states=None):
    """Los rechazos por RLS pueden ser error o simplemente cero filas."""
    try:
        with db.transaction():
            rows=db.execute(sql,params).fetchall()
    except psycopg.Error as exc:
        if states is not None:
            assert exc.sqlstate in states,(exc.sqlstate,str(exc))
        return
    assert not rows,'REPARADO: se permitió una operación que debía bloquearse'

with psycopg.connect(dsn) as db:
    # Estos cambios de esquema sí se quedan en la BD EFÍMERA de GitHub Actions;
    # los datos del escenario, en cambio, se revierten al terminar.
    for path in [
        'supabase/migration-v27.sql',
        'supabase/migration-v34.sql',
        'supabase/migration-v35.sql',
        'supabase/migration-v65-service-area.sql',
        'supabase/migration-v66-preferred-date.sql'
    ]:
        db.execute((ROOT/path).read_text(encoding='utf-8'))
    db.commit()

with psycopg.connect(dsn) as db:
    job_id=None
    try:
        baseline=db.execute('select count(*) from public.service_requests').fetchone()[0]
        today=db.execute("select (now() at time zone 'Europe/Madrid')::date").fetchone()[0]
        future=today+timedelta(days=1)
        appointment=db.execute("select now()+interval '15 days'").fetchone()[0]

        with as_identity(db,CUSTOMER):
            # 1. Un cliente introduce una solicitud válida en Cataluña.
            job_id=db.execute("""insert into public.service_requests(
                customer_id,service_name,category,street,address_number,
                postal_code,city,phone,status,preferred_date,client_submission_id
              ) values (
                %s,'Sustitución de grifo','Fontanería','Calle Ejemplo','5',
                '08001','Barcelona','000000000','new',%s,%s
              ) returning id""",(CUSTOMER,future,KEY)).fetchone()[0]
            assert job_id is not None
            own=db.execute("select status::text,preferred_date from public.service_requests where id=%s",
                           (job_id,)).fetchone()
            assert own==('new',future)

            # 2. La fecha pasada se rechaza desde API y el ID de envío es único.
            forbidden(db,"""insert into public.service_requests(
              customer_id,service_name,category,street,address_number,
              postal_code,city,phone,preferred_date
              ) values(%s,'Servicio de prueba','Fontanería','Test','1',
              '08001','Barcelona','000000000',%s) returning id""",
              (CUSTOMER,today-timedelta(days=1)),{'23514'})
            forbidden(db,"""insert into public.service_requests(
              customer_id,service_name,category,street,address_number,
              postal_code,city,phone,client_submission_id
              ) values(%s,'Servicio de prueba','Fontanería','Test','1',
              '08001','Barcelona','000000000',%s) returning id""",
              (CUSTOMER,KEY),{'23505'})
            forbidden(db,"""insert into public.service_requests(
              customer_id,service_name,category,street,address_number,
              postal_code,city,phone
              ) values (%s,'Fuera de Cataluña','Fontanería','Test','1',
              '28001','Madrid','000000000') returning id""",(CUSTOMER,),{'23514'})

        with as_identity(db,OTHER):
            # 3. El otro cliente no puede leer ni modificar la solicitud.
            assert db.execute("select id from public.service_requests where id=%s",
                              (job_id,)).fetchone() is None
            forbidden(db,"update public.service_requests set price=1 where id=%s returning id",(job_id,))
            assert db.execute("select public.accept_reparado_quote(%s,%s)",
                              (job_id,PRICE)).fetchone()[0] is False

        with as_identity(db,OPERATOR):
            # 4. Un operario aún sin asignación tampoco debe verla.
            assert db.execute("select id from public.service_requests where id=%s",
                              (job_id,)).fetchone() is None

        with as_identity(db,ADMIN):
            # 5. Administración la ve y prepara un presupuesto con IVA incluido.
            assert db.execute("select status::text from public.service_requests where id=%s",
                              (job_id,)).fetchone()[0]=='new'
            assert db.execute("""update public.service_requests
                set price=%s,status='quoted' where id=%s
                returning status::text""",(PRICE,job_id)).fetchone()[0]=='quoted'
            # Administración no puede aceptar en nombre del cliente.
            forbidden(db,"update public.service_requests set status='accepted' where id=%s returning id",
                      (job_id,),{'23514'})

        with as_identity(db,CUSTOMER):
            # 6. Solo el cliente acepta exactamente el precio mostrado.
            assert db.execute("select public.accept_reparado_quote(%s,%s)",
                              (job_id,Decimal('174.99'))).fetchone()[0] is False
            assert db.execute("select public.accept_reparado_quote(%s,%s)",
                              (job_id,PRICE)).fetchone()[0] is True
            accepted=db.execute("""select status::text,accepted_at,accepted_price
                from public.service_requests where id=%s""",(job_id,)).fetchone()
            assert accepted[0]=='accepted' and accepted[1] is not None
            assert accepted[2]==PRICE

        with as_identity(db,ADMIN):
            # 7. El precio aceptado no se puede alterar después.
            forbidden(db,"update public.service_requests set price=999 where id=%s returning id",
                      (job_id,),{'23514'})
            assert db.execute("""update public.service_requests
              set operator_id=%s,operator_name='Operario Test',
                  scheduled_at=%s,status='scheduled'
              where id=%s returning status::text""",
              (OPERATOR,appointment,job_id)).fetchone()[0]=='scheduled'

        with as_identity(db,OTHER):
            assert db.execute("select id from public.service_requests where id=%s",
                              (job_id,)).fetchone() is None

        with as_identity(db,OPERATOR):
            # 8. El operario asignado ve el trabajo y completa el servicio.
            assert db.execute("select status::text from public.service_requests where id=%s",
                              (job_id,)).fetchone()[0]=='scheduled'
            assert db.execute("""update public.service_requests
                 set status='in_progress' where id=%s returning status::text""",
                 (job_id,)).fetchone()[0]=='in_progress'
            assert db.execute("""update public.service_requests
                 set status='completed' where id=%s returning status::text""",
                 (job_id,)).fetchone()[0]=='completed'
            forbidden(db,"update public.service_requests set price=5 where id=%s returning id",
                      (job_id,),{'23514','42501'})

        with as_identity(db,ADMIN):
            # 9. Estado completo, importe y consentimiento intactos.
            result=db.execute("""select status::text,price,accepted_price,
                accepted_at,operator_id from public.service_requests where id=%s""",
                (job_id,)).fetchone()
            assert result[0]=='completed'
            assert result[1]==result[2]==PRICE
            assert result[3] is not None and str(result[4])==OPERATOR
            # No se presume que la terminación haya emitido una factura fiscal.
            assert db.execute("select count(*) from public.invoices where request_id=%s",
                              (job_id,)).fetchone()[0]==0
        assert db.execute('select count(*) from public.service_requests').fetchone()[0]==baseline+1
        print('V69 OK: cliente → presupuesto admin → aceptación cliente → operario → completado; sin datos entre cuentas',flush=True)
    finally:
        # Los cambios de datos, incluidas notificaciones y colas creadas por
        # triggers, se revierten todos. Nunca hacemos COMMIT aquí.
        db.rollback()

# Comprobación independiente: ninguna fila de prueba persistió.
with psycopg.connect(dsn) as db:
    assert db.execute("select count(*) from public.service_requests where id=%s",
                      (job_id,)).fetchone()[0]==0
print('V69 OK: ROLLBACK comprobado; no persisten solicitudes de prueba.',flush=True)
