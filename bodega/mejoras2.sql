-- ════════════════════════════════════════════════════════════════════════
--  BODEGA EN VIVO — MEJORAS v3 (Excel · Chat con canales · Red de Bodegas)
--  Ejecuta este archivo DESPUÉS de setup.sql y mejoras.sql en:
--  Supabase > SQL Editor > New query > pegar todo > Run
--
--  No modifica ni borra nada existente: solo AGREGA columnas, tablas y
--  funciones nuevas. Es seguro ejecutarlo más de una vez.
--
--  Activa:  • Chat con canales (#general, #camiones, #inventario),
--             menciones @usuario / #producto y estado leído ✓✓
--           • Tabla "sucursales" (mapa Red de Bodegas) con 3 bodegas demo
--           • Columna "sucursal_id" en productos y camiones
--           • Columna "productos_detalle" en pedidos (hoja Pedidos del Excel)
-- ════════════════════════════════════════════════════════════════════════


-- ── 0. Requisito: mejoras.sql ya ejecutado ─────────────────────────────
do $$
begin
  if to_regclass('public.mensajes') is null then
    raise exception 'Primero ejecuta mejoras.sql (crea la tabla del chat) y luego vuelve a ejecutar este archivo.';
  end if;
end;
$$;


-- ── 1. CHAT: canales, menciones y leído ────────────────────────────────
alter table public.mensajes add column if not exists room text not null default 'general';
alter table public.mensajes add column if not exists menciones_usuarios  uuid[] not null default '{}';
alter table public.mensajes add column if not exists menciones_productos uuid[] not null default '{}';
alter table public.mensajes add column if not exists leido_por           uuid[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mensajes_room_valida') then
    alter table public.mensajes
      add constraint mensajes_room_valida check (room in ('general', 'camiones', 'inventario'));
  end if;
end;
$$;

create index if not exists mensajes_room_idx on public.mensajes (empresa_id, room, created_at desc);

-- El remitente, su nombre y su empresa SIEMPRE salen de su perfil.
-- Las menciones solo pueden apuntar a usuarios y productos de la misma empresa.
create or replace function public.tg_mensaje_preparar()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_perfil public.perfiles%rowtype;
begin
  if auth.uid() is not null then
    select * into v_perfil from public.perfiles where id = auth.uid();
    if not found then
      raise exception 'Tu usuario no tiene un perfil asignado.';
    end if;
    new.usuario_id     := auth.uid();
    new.empresa_id     := v_perfil.empresa_id;
    new.usuario_nombre := coalesce(nullif(trim(v_perfil.nombre), ''), 'Usuario');
  end if;
  new.texto := trim(new.texto);
  new.room  := coalesce(nullif(new.room, ''), 'general');

  if new.producto_id is not null and not exists (
    select 1 from public.productos where id = new.producto_id and empresa_id = new.empresa_id
  ) then
    new.producto_id := null;
  end if;

  new.menciones_usuarios := coalesce((
    select array_agg(distinct p.id)
      from public.perfiles p
     where p.empresa_id = new.empresa_id
       and p.id = any (coalesce(new.menciones_usuarios, '{}'))
  ), '{}');

  new.menciones_productos := coalesce((
    select array_agg(distinct pr.id)
      from public.productos pr
     where pr.empresa_id = new.empresa_id
       and pr.id = any (coalesce(new.menciones_productos, '{}'))
  ), '{}');

  if new.producto_id is null and cardinality(new.menciones_productos) > 0 then
    new.producto_id := new.menciones_productos[1];
  end if;

  new.leido_por := '{}';
  return new;
end;
$$;

-- Lista de compañeros de la empresa (para el menú @). Solo id, nombre y rol.
create or replace function public.usuarios_empresa()
returns table (id uuid, nombre text, rol text)
language sql stable security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(trim(p.nombre), ''), 'Usuario'), p.rol
    from public.perfiles p
   where p.empresa_id = public.mi_empresa_id()
   order by 2
$$;

-- Marca como leídos (✓✓) los mensajes de otros en un canal.
create or replace function public.marcar_mensajes_leidos(p_room text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  update public.mensajes
     set leido_por = array_append(leido_por, auth.uid())
   where empresa_id = public.mi_empresa_id()
     and room = p_room
     and usuario_id is distinct from auth.uid()
     and not (auth.uid() = any (leido_por))
     and created_at > now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.usuarios_empresa() from public, anon;
revoke all on function public.marcar_mensajes_leidos(text) from public, anon;
grant execute on function public.usuarios_empresa() to authenticated;
grant execute on function public.marcar_mensajes_leidos(text) to authenticated;


-- ── 2. PEDIDOS: detalle de productos (texto libre) ─────────────────────
alter table public.pedidos add column if not exists productos_detalle text;


-- ── 3. SUCURSALES (Red de Bodegas) ─────────────────────────────────────
create table if not exists public.sucursales (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references public.empresas (id) on delete cascade,
  nombre      text not null,
  direccion   text,
  ciudad      text,
  latitud     double precision not null check (latitud between -90 and 90),
  longitud    double precision not null check (longitud between -180 and 180),
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists sucursales_empresa_idx on public.sucursales (empresa_id, created_at);

-- La empresa de la sucursal siempre es la del usuario que la crea
create or replace function public.tg_sucursal_preparar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.empresa_id := public.mi_empresa_id();
    elsif new.empresa_id is distinct from old.empresa_id then
      raise exception 'No se puede mover una sucursal a otra empresa.';
    end if;
  end if;
  new.nombre := trim(new.nombre);
  return new;
end;
$$;

drop trigger if exists trg_sucursal_preparar on public.sucursales;
create trigger trg_sucursal_preparar
  before insert or update on public.sucursales
  for each row execute function public.tg_sucursal_preparar();

alter table public.sucursales enable row level security;

drop policy if exists "sucursales_select_miembros" on public.sucursales;
create policy "sucursales_select_miembros" on public.sucursales
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

drop policy if exists "sucursales_insert_dueno" on public.sucursales;
create policy "sucursales_insert_dueno" on public.sucursales
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and public.es_dueno());

drop policy if exists "sucursales_update_dueno" on public.sucursales;
create policy "sucursales_update_dueno" on public.sucursales
  for update to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno())
  with check (empresa_id = public.mi_empresa_id() and public.es_dueno());

drop policy if exists "sucursales_delete_dueno" on public.sucursales;
create policy "sucursales_delete_dueno" on public.sucursales
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno());

revoke all on public.sucursales from anon;
grant select, insert, update, delete on public.sucursales to authenticated;


-- ── 4. Productos y camiones pueden pertenecer a una sucursal ───────────
--     (si no tienen, la app los cuenta en la sucursal principal = la más antigua)
alter table public.productos add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;
alter table public.camiones  add column if not exists sucursal_id uuid references public.sucursales (id) on delete set null;
create index if not exists productos_sucursal_idx on public.productos (sucursal_id);
create index if not exists camiones_sucursal_idx  on public.camiones (sucursal_id);

-- Una sucursal de otra empresa nunca se puede asignar
create or replace function public.tg_sucursal_asignada()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.sucursal_id is not null and not exists (
    select 1 from public.sucursales where id = new.sucursal_id and empresa_id = new.empresa_id
  ) then
    new.sucursal_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_producto_sucursal on public.productos;
create trigger trg_producto_sucursal
  before insert or update of sucursal_id on public.productos
  for each row execute function public.tg_sucursal_asignada();

drop trigger if exists trg_camion_sucursal on public.camiones;
create trigger trg_camion_sucursal
  before insert or update of sucursal_id on public.camiones
  for each row execute function public.tg_sucursal_asignada();


-- ── 5. DATOS DEMO: 3 bodegas para cada empresa que aún no tenga ────────
insert into public.sucursales (empresa_id, nombre, direccion, ciudad, latitud, longitud, activa, created_at)
select e.id, s.nombre, s.direccion, s.ciudad, s.lat, s.lng, true, now() + s.orden * interval '1 second'
  from public.empresas e
 cross join (values
   (0, 'Bodega Norte', 'Av. Francisco de Orellana, Kennedy Norte', 'Guayaquil', -2.1894, -79.8891),
   (1, 'Bodega Sur',   'Av. 25 de Julio, sector Puerto Marítimo',  'Guayaquil', -2.2100, -79.9200),
   (2, 'Bodega Quito', 'Av. Amazonas y Naciones Unidas',           'Quito',     -0.1807, -78.4678)
 ) as s (orden, nombre, direccion, ciudad, lat, lng)
 where not exists (select 1 from public.sucursales x where x.empresa_id = e.id);

-- Empresa demo: repartir productos y camiones entre las 3 bodegas
-- (solo los que aún no tienen sucursal; así no se pisa lo que tú asignes)
do $$
declare
  v_emp   uuid := '11111111-1111-1111-1111-111111111111';
  v_norte uuid;
  v_sur   uuid;
  v_quito uuid;
begin
  select id into v_norte from public.sucursales where empresa_id = v_emp and nombre = 'Bodega Norte' order by created_at limit 1;
  select id into v_sur   from public.sucursales where empresa_id = v_emp and nombre = 'Bodega Sur'   order by created_at limit 1;
  select id into v_quito from public.sucursales where empresa_id = v_emp and nombre = 'Bodega Quito' order by created_at limit 1;
  if v_norte is null or v_sur is null or v_quito is null then
    return;
  end if;

  update public.productos set sucursal_id = v_norte
   where empresa_id = v_emp and sucursal_id is null and codigo in ('ARZ-001', 'ACE-002', 'HAR-004', 'FID-008');
  update public.productos set sucursal_id = v_sur
   where empresa_id = v_emp and sucursal_id is null and codigo in ('AZU-003', 'DET-006');
  update public.productos set sucursal_id = v_quito
   where empresa_id = v_emp and sucursal_id is null and codigo in ('LEC-005', 'AGU-007');

  update public.camiones set sucursal_id = v_norte
   where empresa_id = v_emp and sucursal_id is null and placa in ('ABC-123', 'XYZ-789');
  update public.camiones set sucursal_id = v_quito
   where empresa_id = v_emp and sucursal_id is null and placa = 'LMN-456';
end;
$$;


-- ── 6. REALTIME para sucursales (mensajes ya está publicado) ───────────
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['sucursales', 'mensajes'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
