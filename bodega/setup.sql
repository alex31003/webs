-- ════════════════════════════════════════════════════════════════════════
--  BODEGA EN VIVO — Script completo de base de datos para Supabase
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query > Run
--  Es seguro ejecutarlo más de una vez (no duplica datos ni políticas).
-- ════════════════════════════════════════════════════════════════════════
--
--  Contenido:
--    1. Tablas
--    2. Índices
--    3. Funciones auxiliares de seguridad (empresa y rol del usuario)
--    4. Triggers de negocio (movimientos atómicos, alertas automáticas)
--    5. Función revisar_alertas() (pedidos vencidos / camiones esperando)
--    6. Row Level Security: activación y políticas
--    7. Permisos y Realtime
--    8. Datos de ejemplo ("Distribuidora Demo")
--    9. Cómo crear usuarios de prueba (instrucciones comentadas)
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;


-- ════════════════════════════════════════════════════════════════════════
-- 1. TABLAS
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  color_primario  text default '#2563eb',
  -- Bahías de carga configuradas (se muestran como tarjetas en "Camiones")
  bahias          text[] not null default array['Bahía 1','Bahía 2','Bahía 3','Bahía 4','Bahía 5'],
  created_at      timestamptz not null default now()
);

create table if not exists public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  empresa_id  uuid references public.empresas (id) on delete cascade,
  nombre      text,
  rol         text not null default 'trabajador'
              check (rol in ('dueño', 'encargado', 'trabajador')),
  created_at  timestamptz not null default now()
);

create table if not exists public.productos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid references public.empresas (id) on delete cascade,
  nombre           text not null,
  codigo           text,
  cantidad_actual  integer not null default 0 check (cantidad_actual >= 0),
  cantidad_minima  integer not null default 10 check (cantidad_minima >= 0),
  ubicacion        text,
  unidad           text default 'unidades',
  updated_at       timestamptz default now()
);

create table if not exists public.movimientos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid references public.empresas (id) on delete cascade,
  producto_id      uuid references public.productos (id) on delete cascade,
  tipo             text not null check (tipo in ('entrada', 'salida')),
  cantidad         integer not null check (cantidad > 0),
  usuario_nombre   text,
  motivo           text,                 -- opcional (lo usa el modal del inventario)
  stock_resultante integer,              -- auditoría: stock que quedó tras el movimiento
  created_at       timestamptz default now()
);

create table if not exists public.camiones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid references public.empresas (id) on delete cascade,
  placa             text,
  conductor         text,
  estado            text not null default 'en_ruta'
                    check (estado in ('en_ruta', 'esperando', 'cargando', 'descargando', 'listo')),
  bahia             text,
  pallets_total     integer not null default 0 check (pallets_total >= 0),
  pallets_cargados  integer not null default 0 check (pallets_cargados >= 0),
  destino           text,
  hora_llegada      timestamptz,
  estado_desde      timestamptz not null default now(),  -- desde cuándo está en el estado actual
  constraint camiones_pallets_validos check (pallets_cargados <= pallets_total)
);

create table if not exists public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references public.empresas (id) on delete cascade,
  numero        text,
  cliente       text,
  estado        text not null default 'confirmado'
                check (estado in ('confirmado', 'preparando', 'enviado', 'entregado', 'tarde')),
  camion_id     uuid references public.camiones (id) on delete set null,
  fecha_limite  timestamptz,
  entregado_at  timestamptz,             -- se llena solo al pasar a 'entregado' (KPI de puntualidad)
  created_at    timestamptz default now()
);

create table if not exists public.alertas (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid references public.empresas (id) on delete cascade,
  tipo           text not null check (tipo in ('stock_bajo', 'entrega_tarde', 'camion_esperando')),
  mensaje        text,
  leida          boolean not null default false,
  referencia_id  uuid,                   -- producto / pedido / camión que originó la alerta
  created_at     timestamptz default now()
);


-- ════════════════════════════════════════════════════════════════════════
-- 2. ÍNDICES
-- ════════════════════════════════════════════════════════════════════════

create index if not exists perfiles_empresa_idx      on public.perfiles (empresa_id);
create index if not exists productos_empresa_idx     on public.productos (empresa_id, nombre);
create unique index if not exists productos_codigo_uidx
  on public.productos (empresa_id, lower(codigo)) where codigo is not null and codigo <> '';
create index if not exists movimientos_empresa_idx   on public.movimientos (empresa_id, created_at desc);
create index if not exists movimientos_producto_idx  on public.movimientos (producto_id);
create index if not exists camiones_empresa_idx      on public.camiones (empresa_id);
create index if not exists pedidos_empresa_idx       on public.pedidos (empresa_id, fecha_limite);
create index if not exists pedidos_camion_idx        on public.pedidos (camion_id);
create index if not exists alertas_empresa_idx       on public.alertas (empresa_id, leida, created_at desc);
create index if not exists alertas_referencia_idx    on public.alertas (referencia_id, tipo);


-- ════════════════════════════════════════════════════════════════════════
-- 3. FUNCIONES AUXILIARES DE SEGURIDAD
--    SECURITY DEFINER evita la recursión infinita al consultar "perfiles"
--    desde las propias políticas de RLS.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.mi_empresa_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from public.perfiles where id = auth.uid()
$$;

create or replace function public.mi_rol()
returns text
language sql stable security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

-- true si el usuario es 'dueño' o 'encargado'
create or replace function public.es_gestor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select rol in ('dueño', 'encargado') from public.perfiles where id = auth.uid()), false)
$$;

create or replace function public.es_dueno()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select rol = 'dueño' from public.perfiles where id = auth.uid()), false)
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 4. TRIGGERS DE NEGOCIO
-- ════════════════════════════════════════════════════════════════════════

-- 4.1 Registrar un movimiento = UNA sola transacción:
--     • valida datos y que el producto sea de la empresa del usuario
--     • bloquea la fila del producto (evita carreras entre dos trabajadores)
--     • suma o resta el stock (nunca baja de 0)
--     • crea la alerta 'stock_bajo' si queda bajo el mínimo
--     • resuelve la alerta 'stock_bajo' si el stock se recupera
--     Si algo falla, NO se guarda nada (ni el movimiento ni el stock).
create or replace function public.tg_movimiento_aplicar()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_perfil   public.perfiles%rowtype;
  v_prod     public.productos%rowtype;
  v_nueva    integer;
begin
  if new.tipo is null or new.tipo not in ('entrada', 'salida') then
    raise exception 'Tipo de movimiento inválido: debe ser "entrada" o "salida".';
  end if;
  if new.cantidad is null or new.cantidad <= 0 then
    raise exception 'La cantidad debe ser un número entero mayor a cero.';
  end if;

  -- Si lo registra un usuario de la app, la empresa y el nombre salen de su perfil
  if auth.uid() is not null then
    select * into v_perfil from public.perfiles where id = auth.uid();
    if not found then
      raise exception 'Tu usuario no tiene un perfil asignado. Contacta al administrador.';
    end if;
    new.empresa_id     := v_perfil.empresa_id;
    new.usuario_nombre := coalesce(nullif(trim(v_perfil.nombre), ''), new.usuario_nombre, 'Usuario');
  end if;

  select * into v_prod from public.productos where id = new.producto_id for update;
  if not found then
    raise exception 'El producto no existe o fue eliminado.';
  end if;
  if new.empresa_id is null then
    new.empresa_id := v_prod.empresa_id;
  end if;
  if v_prod.empresa_id is distinct from new.empresa_id then
    raise exception 'El producto no pertenece a tu empresa.';
  end if;

  if new.tipo = 'entrada' then
    v_nueva := v_prod.cantidad_actual + new.cantidad;
  else
    if v_prod.cantidad_actual <= 0 then
      raise exception 'No hay stock de "%" para registrar una salida.', v_prod.nombre;
    end if;
    -- Nunca bajar de 0: si piden sacar más de lo que hay, se registra lo que realmente salió
    new.cantidad := least(new.cantidad, v_prod.cantidad_actual);
    v_nueva := v_prod.cantidad_actual - new.cantidad;
  end if;

  new.stock_resultante := v_nueva;

  perform set_config('bodega.movimiento', 'si', true);
  update public.productos
     set cantidad_actual = v_nueva, updated_at = now()
   where id = v_prod.id;
  perform set_config('bodega.movimiento', 'no', true);

  if v_nueva < v_prod.cantidad_minima then
    if not exists (
      select 1 from public.alertas
       where referencia_id = v_prod.id and tipo = 'stock_bajo' and leida = false
    ) then
      insert into public.alertas (empresa_id, tipo, mensaje, referencia_id)
      values (
        v_prod.empresa_id, 'stock_bajo',
        format('Stock bajo: "%s" quedó en %s %s (mínimo %s).',
               v_prod.nombre, v_nueva, coalesce(v_prod.unidad, 'unidades'), v_prod.cantidad_minima),
        v_prod.id
      );
    end if;
  else
    update public.alertas
       set leida = true
     where referencia_id = v_prod.id and tipo = 'stock_bajo' and leida = false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_movimiento_aplicar on public.movimientos;
create trigger trg_movimiento_aplicar
  before insert on public.movimientos
  for each row execute function public.tg_movimiento_aplicar();


-- 4.2 Productos: updated_at automático + el stock SOLO cambia con movimientos
--     (así el historial de movimientos siempre cuadra con el stock).
create or replace function public.tg_producto_proteger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cantidad_actual is distinct from old.cantidad_actual
     and auth.uid() is not null
     and coalesce(current_setting('bodega.movimiento', true), 'no') <> 'si' then
    raise exception 'La cantidad solo puede cambiar registrando una entrada o salida.';
  end if;
  if new.empresa_id is distinct from old.empresa_id and auth.uid() is not null then
    raise exception 'No se puede mover un producto a otra empresa.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_producto_proteger on public.productos;
create trigger trg_producto_proteger
  before update on public.productos
  for each row execute function public.tg_producto_proteger();


-- 4.3 Camiones: registrar desde cuándo está en cada estado
create or replace function public.tg_camion_estado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.estado_desde := coalesce(new.estado_desde, now());
  elsif new.estado is distinct from old.estado then
    new.estado_desde := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_camion_estado on public.camiones;
create trigger trg_camion_estado
  before insert or update on public.camiones
  for each row execute function public.tg_camion_estado();


-- 4.4 Pedidos: fecha real de entrega + resolver alerta de atraso al entregar
create or replace function public.tg_pedido_estado()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.estado = 'entregado' then
    if tg_op = 'INSERT' then
      new.entregado_at := coalesce(new.entregado_at, now());
    elsif old.estado is distinct from 'entregado' then
      new.entregado_at := now();
    end if;
  else
    new.entregado_at := null;
  end if;

  if tg_op = 'UPDATE' and new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    update public.alertas
       set leida = true
     where referencia_id = new.id and tipo = 'entrega_tarde' and leida = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedido_estado on public.pedidos;
create trigger trg_pedido_estado
  before insert or update on public.pedidos
  for each row execute function public.tg_pedido_estado();


-- ════════════════════════════════════════════════════════════════════════
-- 5. ALERTAS AUTOMÁTICAS (la app la llama cada vez que carga el dashboard)
--    • Pedidos con fecha_limite vencida y estado distinto de 'entregado'
--    • Camiones en estado 'esperando' por más de 2 horas
--    No duplica: si ya existe una alerta para ese pedido / esa espera, no crea otra.
--    Devuelve cuántas alertas nuevas se crearon.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.revisar_alertas()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.mi_empresa_id();
  v_total   integer := 0;
  v_filas   integer;
begin
  if v_empresa is null or not public.es_gestor() then
    return 0;
  end if;

  insert into public.alertas (empresa_id, tipo, mensaje, referencia_id)
  select p.empresa_id, 'entrega_tarde',
         format('El pedido %s de %s superó su fecha límite y aún no se entrega.',
                coalesce(p.numero, 'sin número'), coalesce(p.cliente, 'cliente sin nombre')),
         p.id
    from public.pedidos p
   where p.empresa_id = v_empresa
     and p.estado <> 'entregado'
     and p.fecha_limite is not null
     and p.fecha_limite < now()
     and not exists (
       select 1 from public.alertas a
        where a.referencia_id = p.id and a.tipo = 'entrega_tarde'
     );
  get diagnostics v_filas = row_count;
  v_total := v_total + v_filas;

  insert into public.alertas (empresa_id, tipo, mensaje, referencia_id)
  select c.empresa_id, 'camion_esperando',
         format('El camión %s (%s) lleva más de 2 horas esperando%s.',
                coalesce(c.placa, 'sin placa'), coalesce(c.conductor, 'sin conductor'),
                case when c.bahia is not null and c.bahia <> '' then ' en ' || c.bahia else '' end),
         c.id
    from public.camiones c
   where c.empresa_id = v_empresa
     and c.estado = 'esperando'
     and c.estado_desde < now() - interval '2 hours'
     and not exists (
       select 1 from public.alertas a
        where a.referencia_id = c.id and a.tipo = 'camion_esperando'
          and a.created_at >= c.estado_desde
     );
  get diagnostics v_filas = row_count;
  v_total := v_total + v_filas;

  return v_total;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
--    Regla base: cada usuario solo ve filas de SU empresa (empresa_id).
--    • trabajador: SELECT en productos + INSERT en movimientos.
--      (además puede leer su propio perfil y el nombre de su empresa,
--       imprescindible para iniciar sesión)
--    • encargado:  SELECT e INSERT en todo excepto perfiles. También tiene
--      UPDATE en productos, camiones, pedidos y alertas porque la app lo
--      necesita para operar (cambiar estado de camiones/pedidos, marcar
--      alertas como leídas, editar fichas de producto). No puede borrar.
--    • dueño:      acceso total dentro de su empresa (incluye perfiles).
-- ════════════════════════════════════════════════════════════════════════

alter table public.empresas    enable row level security;
alter table public.perfiles    enable row level security;
alter table public.productos   enable row level security;
alter table public.movimientos enable row level security;
alter table public.camiones    enable row level security;
alter table public.pedidos     enable row level security;
alter table public.alertas     enable row level security;

-- ── EMPRESAS ────────────────────────────────────────────────────────────
drop policy if exists "empresas_select_miembros" on public.empresas;
create policy "empresas_select_miembros" on public.empresas
  for select to authenticated
  using (id = public.mi_empresa_id());

drop policy if exists "empresas_update_dueno" on public.empresas;
create policy "empresas_update_dueno" on public.empresas
  for update to authenticated
  using (id = public.mi_empresa_id() and public.es_dueno())
  with check (id = public.mi_empresa_id() and public.es_dueno());

-- ── PERFILES ────────────────────────────────────────────────────────────
drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.es_dueno() and empresa_id = public.mi_empresa_id())
  );

drop policy if exists "perfiles_insert_dueno" on public.perfiles;
create policy "perfiles_insert_dueno" on public.perfiles
  for insert to authenticated
  with check (public.es_dueno() and empresa_id = public.mi_empresa_id());

drop policy if exists "perfiles_update_dueno" on public.perfiles;
create policy "perfiles_update_dueno" on public.perfiles
  for update to authenticated
  using (public.es_dueno() and empresa_id = public.mi_empresa_id())
  with check (public.es_dueno() and empresa_id = public.mi_empresa_id());

drop policy if exists "perfiles_delete_dueno" on public.perfiles;
create policy "perfiles_delete_dueno" on public.perfiles
  for delete to authenticated
  using (public.es_dueno() and empresa_id = public.mi_empresa_id() and id <> auth.uid());

-- ── PRODUCTOS ───────────────────────────────────────────────────────────
drop policy if exists "productos_select_miembros" on public.productos;
create policy "productos_select_miembros" on public.productos
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

drop policy if exists "productos_insert_gestores" on public.productos;
create policy "productos_insert_gestores" on public.productos
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "productos_update_gestores" on public.productos;
create policy "productos_update_gestores" on public.productos
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor())
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "productos_delete_dueno" on public.productos;
create policy "productos_delete_dueno" on public.productos
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno());

-- ── MOVIMIENTOS ─────────────────────────────────────────────────────────
drop policy if exists "movimientos_select_gestores" on public.movimientos;
create policy "movimientos_select_gestores" on public.movimientos
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor());

-- Todos los roles (incluido trabajador) pueden registrar movimientos de su empresa
drop policy if exists "movimientos_insert_miembros" on public.movimientos;
create policy "movimientos_insert_miembros" on public.movimientos
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id());

drop policy if exists "movimientos_update_dueno" on public.movimientos;
create policy "movimientos_update_dueno" on public.movimientos
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno())
  with check (empresa_id = public.mi_empresa_id() and public.es_dueno());

drop policy if exists "movimientos_delete_dueno" on public.movimientos;
create policy "movimientos_delete_dueno" on public.movimientos
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno());

-- ── CAMIONES ────────────────────────────────────────────────────────────
drop policy if exists "camiones_select_gestores" on public.camiones;
create policy "camiones_select_gestores" on public.camiones
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "camiones_insert_gestores" on public.camiones;
create policy "camiones_insert_gestores" on public.camiones
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "camiones_update_gestores" on public.camiones;
create policy "camiones_update_gestores" on public.camiones
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor())
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "camiones_delete_dueno" on public.camiones;
create policy "camiones_delete_dueno" on public.camiones
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno());

-- ── PEDIDOS ─────────────────────────────────────────────────────────────
drop policy if exists "pedidos_select_gestores" on public.pedidos;
create policy "pedidos_select_gestores" on public.pedidos
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "pedidos_insert_gestores" on public.pedidos;
create policy "pedidos_insert_gestores" on public.pedidos
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "pedidos_update_gestores" on public.pedidos;
create policy "pedidos_update_gestores" on public.pedidos
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor())
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "pedidos_delete_dueno" on public.pedidos;
create policy "pedidos_delete_dueno" on public.pedidos
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno());

-- ── ALERTAS ─────────────────────────────────────────────────────────────
drop policy if exists "alertas_select_gestores" on public.alertas;
create policy "alertas_select_gestores" on public.alertas
  for select to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "alertas_insert_gestores" on public.alertas;
create policy "alertas_insert_gestores" on public.alertas
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "alertas_update_gestores" on public.alertas;
create policy "alertas_update_gestores" on public.alertas
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_gestor())
  with check (empresa_id = public.mi_empresa_id() and public.es_gestor());

drop policy if exists "alertas_delete_dueno" on public.alertas;
create policy "alertas_delete_dueno" on public.alertas
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno());


-- ════════════════════════════════════════════════════════════════════════
-- 7. PERMISOS Y REALTIME
-- ════════════════════════════════════════════════════════════════════════

-- Los usuarios sin sesión (anon) no ven nada. Los usuarios con sesión pasan por RLS.
revoke all on public.empresas, public.perfiles, public.productos, public.movimientos,
              public.camiones, public.pedidos, public.alertas from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.empresas, public.perfiles, public.productos,
      public.movimientos, public.camiones, public.pedidos, public.alertas to authenticated;

revoke all on function public.revisar_alertas() from public, anon;
grant execute on function public.revisar_alertas() to authenticated;
grant execute on function public.mi_empresa_id(), public.mi_rol(), public.es_gestor(), public.es_dueno()
  to authenticated;

-- Activar Realtime en las tablas que la app escucha en vivo
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['productos', 'movimientos', 'camiones', 'pedidos', 'alertas'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 8. DATOS DE EJEMPLO — "Distribuidora Demo"
--    ID fijo de la empresa (lo necesitarás al crear perfiles):
--    11111111-1111-1111-1111-111111111111
-- ════════════════════════════════════════════════════════════════════════

insert into public.empresas (id, nombre, color_primario, bahias)
values ('11111111-1111-1111-1111-111111111111', 'Distribuidora Demo', '#2563eb',
        array['Bahía 1', 'Bahía 2', 'Bahía 3', 'Bahía 4', 'Bahía 5'])
on conflict (id) do nothing;

-- 8 productos (3 en stock bajo, 2 en zona amarilla, 3 holgados)
insert into public.productos (id, empresa_id, codigo, nombre, cantidad_actual, cantidad_minima, ubicacion, unidad)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'ARZ-001', 'Arroz grano largo 5 kg',        240, 50, 'Pasillo A · Rack 1', 'sacos'),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'ACE-002', 'Aceite vegetal 1 L',             18, 30, 'Pasillo A · Rack 2', 'cajas'),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'AZU-003', 'Azúcar blanca 1 kg',             64, 40, 'Pasillo B · Rack 1', 'fardos'),
  ('a0000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'HAR-004', 'Harina de trigo 25 kg',           6, 15, 'Pasillo B · Rack 3', 'sacos'),
  ('a0000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'LEC-005', 'Leche entera 1 L (caja x12)',   130, 40, 'Cámara de frío 1',   'cajas'),
  ('a0000000-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', 'DET-006', 'Detergente en polvo 3 kg',       52, 30, 'Pasillo C · Rack 2', 'unidades'),
  ('a0000000-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', 'AGU-007', 'Agua mineral 600 ml (pack x24)', 310, 80, 'Zona de pallets 2', 'packs'),
  ('a0000000-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111', 'FID-008', 'Fideos spaghetti 400 g',          9, 25, 'Pasillo A · Rack 4', 'cajas')
on conflict (id) do nothing;

-- 3 camiones en estados distintos
insert into public.camiones (id, empresa_id, placa, conductor, estado, bahia, pallets_total, pallets_cargados, destino, hora_llegada, estado_desde)
values
  ('c0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'ABC-123', 'Juan Pérez',     'cargando',  'Bahía 1', 20, 12, 'Zona Centro',       now() - interval '50 minutes', now() - interval '35 minutes'),
  ('c0000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'XYZ-789', 'María González', 'esperando', 'Bahía 2', 16,  0, 'Zona Norte',        now() - interval '3 hours',    now() - interval '3 hours'),
  ('c0000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'LMN-456', 'Pedro Soto',     'en_ruta',   null,      18,  0, 'Centro de distribución', now() + interval '83 minutes', now() - interval '40 minutes')
on conflict (id) do nothing;

-- 4 pedidos en estados distintos (PED-1004 está vencido)
insert into public.pedidos (id, empresa_id, numero, cliente, estado, camion_id, fecha_limite, entregado_at, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'PED-1001', 'Supermercado El Sol',    'confirmado', null,
     now() + interval '2 days', null, now() - interval '2 hours'),
  ('b0000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'PED-1002', 'Minimarket La Esquina',  'preparando', 'c0000000-0000-4000-8000-000000000001',
     now() + interval '5 hours', null, now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'PED-1003', 'Restaurante Buen Sabor', 'entregado',  'c0000000-0000-4000-8000-000000000001',
     greatest(now() - interval '1 day', date_trunc('month', now())) + interval '4 hours',
     greatest(now() - interval '1 day', date_trunc('month', now())), now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'PED-1004', 'Hotel Plaza',            'tarde',      'c0000000-0000-4000-8000-000000000002',
     now() - interval '6 hours', null, now() - interval '2 days')
on conflict (id) do nothing;

-- 3 alertas activas (vinculadas a su origen para que no se dupliquen)
insert into public.alertas (id, empresa_id, tipo, mensaje, leida, referencia_id, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'stock_bajo',
     'Stock bajo: "Harina de trigo 25 kg" quedó en 6 sacos (mínimo 15).', false,
     'a0000000-0000-4000-8000-000000000004', now() - interval '25 minutes'),
  ('d0000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'entrega_tarde',
     'El pedido PED-1004 de Hotel Plaza superó su fecha límite y aún no se entrega.', false,
     'b0000000-0000-4000-8000-000000000004', now() - interval '5 hours'),
  ('d0000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'camion_esperando',
     'El camión XYZ-789 (María González) lleva más de 2 horas esperando en Bahía 2.', false,
     'c0000000-0000-4000-8000-000000000002', now() - interval '55 minutes')
on conflict (id) do nothing;

-- Historial de movimientos de ejemplo (solo informativo: el stock de arriba
-- ya es el resultado final, por eso se desactiva el trigger un momento)
alter table public.movimientos disable trigger trg_movimiento_aplicar;
insert into public.movimientos (id, empresa_id, producto_id, tipo, cantidad, usuario_nombre, motivo, stock_resultante, created_at)
values
  ('e0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-000000000007', 'entrada', 120, 'Carlos (demo)', 'Recepción proveedor',  310, now() - interval '20 minutes'),
  ('e0000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-000000000004', 'salida',   9, 'Lucía (demo)',  'Pedido PED-1002',        6, now() - interval '25 minutes'),
  ('e0000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'salida',  30, 'Lucía (demo)',  'Pedido PED-1002',      240, now() - interval '48 minutes'),
  ('e0000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-000000000005', 'entrada',  60, 'Carlos (demo)', 'Recepción proveedor',  130, now() - interval '1 hour 30 minutes'),
  ('e0000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-000000000002', 'salida',  12, 'Lucía (demo)',  'Pedido PED-1003',       18, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-000000000008', 'salida',  16, 'Carlos (demo)', 'Pedido PED-1003',        9, now() - interval '1 day 2 hours')
on conflict (id) do nothing;
alter table public.movimientos enable trigger trg_movimiento_aplicar;


-- ════════════════════════════════════════════════════════════════════════
-- 9. CÓMO CREAR USUARIOS DE PRUEBA
-- ════════════════════════════════════════════════════════════════════════
--
--  A) En Supabase ve a: Authentication > Users > "Add user" > "Create new user"
--     Crea, por ejemplo, estos tres (marca "Auto Confirm User"):
--        dueno@demo.com       contraseña: Demo1234!
--        encargado@demo.com   contraseña: Demo1234!
--        trabajador@demo.com  contraseña: Demo1234!
--
--  B) Asigna a cada uno su perfil. Tienes dos opciones:
--
--     Opción 1 (Table Editor): abre la tabla "perfiles" > "Insert row" y llena:
--        id         = el User UID que aparece en Authentication > Users
--        empresa_id = 11111111-1111-1111-1111-111111111111
--        nombre     = nombre visible (ej: "Ana Torres")
--        rol        = dueño  |  encargado  |  trabajador
--
--     Opción 2 (más rápida): quita los "--" de las líneas de abajo, ajusta los
--     correos si usaste otros, y ejecútalas aquí en el SQL Editor:
--
-- insert into public.perfiles (id, empresa_id, nombre, rol)
-- select id, '11111111-1111-1111-1111-111111111111', 'Ana Torres', 'dueño'
--   from auth.users where email = 'dueno@demo.com'
-- on conflict (id) do update set empresa_id = excluded.empresa_id, nombre = excluded.nombre, rol = excluded.rol;
--
-- insert into public.perfiles (id, empresa_id, nombre, rol)
-- select id, '11111111-1111-1111-1111-111111111111', 'Luis Ramírez', 'encargado'
--   from auth.users where email = 'encargado@demo.com'
-- on conflict (id) do update set empresa_id = excluded.empresa_id, nombre = excluded.nombre, rol = excluded.rol;
--
-- insert into public.perfiles (id, empresa_id, nombre, rol)
-- select id, '11111111-1111-1111-1111-111111111111', 'Diego Muñoz', 'trabajador'
--   from auth.users where email = 'trabajador@demo.com'
-- on conflict (id) do update set empresa_id = excluded.empresa_id, nombre = excluded.nombre, rol = excluded.rol;
--
--  C) Para una empresa nueva (otro cliente), crea primero la empresa:
--
-- insert into public.empresas (nombre, color_primario) values ('Mi Cliente SpA', '#2563eb') returning id;
--
--     y usa el id que devuelve como empresa_id en sus perfiles.
--     Cada empresa solo ve sus propios datos gracias a Row Level Security.
-- ════════════════════════════════════════════════════════════════════════
