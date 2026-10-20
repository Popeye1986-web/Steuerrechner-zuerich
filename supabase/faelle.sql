-- taxflix: Steuerfälle, Rollen (Prüfer / Kunde) und Zugriffsschutz.
-- In Supabase unter "SQL Editor" einfügen und "Run" klicken.
-- WICHTIG: Ganz unten deine eigene E-Mail-Adresse prüfen. Damit wirst du Prüfer.

-- 1. Prüfer
create table if not exists public.pruefer (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.pruefer enable row level security;
drop policy if exists "Prüfer sehen sich selbst" on public.pruefer;
create policy "Prüfer sehen sich selbst" on public.pruefer for select using (user_id = auth.uid());

create or replace function public.ist_pruefer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pruefer where user_id = auth.uid())
$$;
grant execute on function public.ist_pruefer() to authenticated;

create or replace function public.meine_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- 2. Steuerfälle
create table if not exists public.faelle (
  id          uuid primary key default gen_random_uuid(),
  kunde_name  text not null,
  kunde_email text not null,
  jahr        int  not null,
  status      text not null default 'offen' check (status in ('offen', 'eingereicht', 'pruefung', 'abgeschlossen')),
  notiz       text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.faelle enable row level security;

drop policy if exists "Fälle lesen"    on public.faelle;
drop policy if exists "Fälle anlegen"  on public.faelle;
drop policy if exists "Fälle ändern"   on public.faelle;
drop policy if exists "Fälle löschen"  on public.faelle;

-- Prüfer sehen alle Fälle, Kunden nur Fälle mit ihrer E-Mail-Adresse
create policy "Fälle lesen"   on public.faelle for select using (public.ist_pruefer() or lower(kunde_email) = public.meine_email());
create policy "Fälle anlegen" on public.faelle for insert with check (public.ist_pruefer());
create policy "Fälle ändern"  on public.faelle for update using (public.ist_pruefer() or lower(kunde_email) = public.meine_email())
                                                        with check (public.ist_pruefer() or lower(kunde_email) = public.meine_email());
create policy "Fälle löschen" on public.faelle for delete using (public.ist_pruefer());

-- Kunden dürfen nur Belege ändern und "offen" → "eingereicht" setzen. Ab "In Prüfung" ist der Fall für sie gesperrt.
create or replace function public.faelle_schutz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.ist_pruefer() then
    new.kunde_name  := old.kunde_name;
    new.kunde_email := old.kunde_email;
    new.jahr        := old.jahr;
    new.notiz       := old.notiz;
    if new.status <> old.status and not (old.status = 'offen' and new.status = 'eingereicht') then
      new.status := old.status;
    end if;
    if old.status in ('pruefung', 'abgeschlossen') then
      new.data := old.data;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists faelle_schutz on public.faelle;
create trigger faelle_schutz before update on public.faelle for each row execute function public.faelle_schutz();

-- 3. Belege im Speicher: Ordner faelle/<Fall-ID>/..., Zugriff wie auf den Fall
insert into storage.buckets (id, name, public) values ('belege', 'belege', false) on conflict (id) do nothing;

drop policy if exists "Fallbelege lesen"     on storage.objects;
drop policy if exists "Fallbelege hochladen" on storage.objects;
drop policy if exists "Fallbelege löschen"   on storage.objects;

create policy "Fallbelege lesen" on storage.objects for select using (
  bucket_id = 'belege' and (storage.foldername(name))[1] = 'faelle'
  and exists (select 1 from public.faelle f where f.id::text = (storage.foldername(name))[2]));
create policy "Fallbelege hochladen" on storage.objects for insert with check (
  bucket_id = 'belege' and (storage.foldername(name))[1] = 'faelle'
  and exists (select 1 from public.faelle f where f.id::text = (storage.foldername(name))[2]));
create policy "Fallbelege löschen" on storage.objects for delete using (
  bucket_id = 'belege' and (storage.foldername(name))[1] = 'faelle'
  and exists (select 1 from public.faelle f where f.id::text = (storage.foldername(name))[2]));

-- 4. Dich als Prüfer eintragen. Die E-Mail muss die sein, mit der du dich bei taxflix anmeldest.
insert into public.pruefer (user_id)
select id from auth.users where lower(email) = lower('dominicisliker@bluewin.ch')
on conflict do nothing;

-- Kontrolle: Hier muss genau eine Zeile mit deiner E-Mail erscheinen.
select u.email from public.pruefer p join auth.users u on u.id = p.user_id;
