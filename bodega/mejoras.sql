-- ════════════════════════════════════════════════════════════════════════
--  BODEGA EN VIVO — MEJORAS v2
--  Ejecuta este archivo DESPUÉS de setup.sql en: Supabase > SQL Editor > Run
--  No modifica ni borra nada existente: solo AGREGA columnas, tablas y
--  funciones nuevas. Es seguro ejecutarlo más de una vez.
--
--  Activa:  • Logo (texto) y color de la empresa       → columnas en "empresas"
--           • Chat interno en tiempo real              → tabla "mensajes"
--           • Links de invitación para trabajadores    → tabla "invitaciones"
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. EMPRESAS: logo y color (solo se agregan si no existen) ──────────
alter table public.empresas add column if not exists color_primario text default '#2563eb';
alter table public.empresas add column if not exists logo_texto text;


-- ── 2. CHAT INTERNO ────────────────────────────────────────────────────
create table if not exists public.mensajes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid references public.empresas (id) on delete cascade,
  usuario_id      uuid references auth.users (id) on delete set null,
  usuario_nombre  text,                  -- nombre del remitente (lo pone la base de datos)
  texto           text not null check (char_length(texto) between 1 and 2000),
  producto_id     uuid references public.productos (id) on delete set null,
  created_at      timestamptz default now()
);
create index if not exists mensajes_empresa_idx on public.mensajes (empresa_id, created_at desc);

-- El remitente, su nombre y su empresa SIEMPRE salen de su perfil (no se pueden falsificar)
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
  if new.producto_id is not null and not exists (
    select 1 from public.productos where id = new.producto_id and empresa_id = new.empresa_id
  ) then
    new.producto_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mensaje_preparar on public.mensajes;
create trigger trg_mensaje_preparar
  before insert on public.mensajes
  for each row execute function public.tg_mensaje_preparar();

alter table public.mensajes enable row level security;

drop policy if exists "mensajes_select_miembros" on public.mensajes;
create policy "mensajes_select_miembros" on public.mensajes
  for select to authenticated
  using (empresa_id = public.mi_empresa_id());

drop policy if exists "mensajes_insert_miembros" on public.mensajes;
create policy "mensajes_insert_miembros" on public.mensajes
  for insert to authenticated
  with check (empresa_id = public.mi_empresa_id() and usuario_id = auth.uid());

drop policy if exists "mensajes_delete_autor_o_dueno" on public.mensajes;
create policy "mensajes_delete_autor_o_dueno" on public.mensajes
  for delete to authenticated
  using (empresa_id = public.mi_empresa_id() and (usuario_id = auth.uid() or public.es_dueno()));

revoke all on public.mensajes from anon;
grant select, insert, delete on public.mensajes to authenticated;


-- ── 3. INVITACIONES (link para que un trabajador cree su cuenta) ───────
create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references public.empresas (id) on delete cascade,
  email       text not null,
  nombre      text,
  rol         text not null default 'trabajador' check (rol in ('encargado', 'trabajador')),
  token       text not null unique
              default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  creada_por  uuid default auth.uid(),
  usada_at    timestamptz,
  usada_por   uuid,
  expira_at   timestamptz not null default now() + interval '14 days',
  created_at  timestamptz default now()
);
create index if not exists invitaciones_empresa_idx on public.invitaciones (empresa_id);

alter table public.invitaciones enable row level security;

drop policy if exists "invitaciones_dueno" on public.invitaciones;
create policy "invitaciones_dueno" on public.invitaciones
  for all to authenticated
  using (empresa_id = public.mi_empresa_id() and public.es_dueno())
  with check (empresa_id = public.mi_empresa_id() and public.es_dueno());

revoke all on public.invitaciones from anon;
grant select, insert, update, delete on public.invitaciones to authenticated;

-- Datos públicos mínimos de una invitación (para mostrar "Te invitaron a ...")
create or replace function public.ver_invitacion(p_token text)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object('empresa', e.nombre, 'email', i.email, 'nombre', i.nombre, 'rol', i.rol)
    from public.invitaciones i
    join public.empresas e on e.id = i.empresa_id
   where i.token = p_token and i.usada_at is null and i.expira_at > now()
$$;

-- El invitado (ya con sesión) reclama la invitación: se crea su perfil.
-- Exige que el correo de su cuenta sea el mismo de la invitación.
create or replace function public.reclamar_invitacion(p_token text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_inv   public.invitaciones%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación.';
  end if;
  if exists (select 1 from public.perfiles where id = auth.uid()) then
    return false;
  end if;
  select * into v_inv from public.invitaciones
   where token = p_token and usada_at is null and expira_at > now()
   for update;
  if not found then
    raise exception 'La invitación no existe, ya fue usada o expiró. Pide una nueva.';
  end if;
  if lower(v_inv.email) <> v_email then
    raise exception 'Esta invitación es para %. Entra con ese correo.', v_inv.email;
  end if;
  insert into public.perfiles (id, empresa_id, nombre, rol)
  values (auth.uid(), v_inv.empresa_id, coalesce(nullif(trim(v_inv.nombre), ''), split_part(v_inv.email, '@', 1)), v_inv.rol);
  update public.invitaciones set usada_at = now(), usada_por = auth.uid() where id = v_inv.id;
  return true;
end;
$$;

revoke all on function public.ver_invitacion(text) from public;
revoke all on function public.reclamar_invitacion(text) from public, anon;
grant execute on function public.ver_invitacion(text) to anon, authenticated;
grant execute on function public.reclamar_invitacion(text) to authenticated;


-- ── 4. REALTIME para el chat ───────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes'
  ) then
    alter publication supabase_realtime add table public.mensajes;
  end if;
end;
$$;
