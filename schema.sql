-- Steuerpilot Zürich: Tabelle für die Steuerdaten der Benutzer.
-- In Supabase unter "SQL Editor" einfügen und "Run" klicken.

create table if not exists public.steuerdaten (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Jede Person darf nur ihre eigenen Daten sehen und ändern.
alter table public.steuerdaten enable row level security;

drop policy if exists "Eigene Daten lesen"   on public.steuerdaten;
drop policy if exists "Eigene Daten anlegen" on public.steuerdaten;
drop policy if exists "Eigene Daten ändern"  on public.steuerdaten;
drop policy if exists "Eigene Daten löschen" on public.steuerdaten;

create policy "Eigene Daten lesen"   on public.steuerdaten for select using (auth.uid() = user_id);
create policy "Eigene Daten anlegen" on public.steuerdaten for insert with check (auth.uid() = user_id);
create policy "Eigene Daten ändern"  on public.steuerdaten for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Eigene Daten löschen" on public.steuerdaten for delete using (auth.uid() = user_id);
