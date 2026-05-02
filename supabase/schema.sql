create table if not exists public.sonidos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  url text not null,
  orden integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.cronometros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Cronómetro',
  objetivo_segundos integer not null default 60,
  sonido_url text default '',
  orden integer not null default 0,
  created_at timestamptz default now()
);

alter table public.sonidos enable row level security;
alter table public.cronometros enable row level security;

drop policy if exists "lectura publica sonidos" on public.sonidos;
drop policy if exists "insertar sonidos" on public.sonidos;
drop policy if exists "actualizar sonidos" on public.sonidos;
drop policy if exists "eliminar sonidos" on public.sonidos;

drop policy if exists "lectura publica cronometros" on public.cronometros;
drop policy if exists "insertar cronometros" on public.cronometros;
drop policy if exists "actualizar cronometros" on public.cronometros;
drop policy if exists "eliminar cronometros" on public.cronometros;

create policy "lectura publica sonidos" on public.sonidos for select using (true);
create policy "insertar sonidos" on public.sonidos for insert with check (true);
create policy "actualizar sonidos" on public.sonidos for update using (true);
create policy "eliminar sonidos" on public.sonidos for delete using (true);

create policy "lectura publica cronometros" on public.cronometros for select using (true);
create policy "insertar cronometros" on public.cronometros for insert with check (true);
create policy "actualizar cronometros" on public.cronometros for update using (true);
create policy "eliminar cronometros" on public.cronometros for delete using (true);

insert into public.sonidos (nombre, url, orden)
values
  ('Campana demo', 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg', 1),
  ('Alerta demo', 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg', 2)
on conflict do nothing;
