-- taxflix: Kunden starten ihren Fall selbst und bezahlen online.
-- Nach faelle.sql in Supabase unter "SQL Editor" einfügen und "Run" klicken.

-- 1. Zahlungsangaben am Fall
alter table public.faelle add column if not exists bezahlt         boolean not null default false;
alter table public.faelle add column if not exists bezahlt_am      timestamptz;
alter table public.faelle add column if not exists betrag_chf      numeric;
alter table public.faelle add column if not exists zahlung_session text;

-- Die Server-Funktion (Vercel) arbeitet mit dem service_role-Schlüssel
create or replace function public.ist_server() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

-- 2. Kunden dürfen einen Fall für ihre eigene E-Mail anlegen
drop policy if exists "Fälle anlegen" on public.faelle;
create policy "Fälle anlegen" on public.faelle for insert
  with check (public.ist_pruefer() or lower(kunde_email) = public.meine_email());

create or replace function public.faelle_neu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.ist_pruefer() and not public.ist_server() then
    new.kunde_email     := public.meine_email();
    new.status          := 'offen';
    new.bezahlt         := false;
    new.bezahlt_am      := null;
    new.betrag_chf      := null;
    new.zahlung_session := null;
    new.notiz           := null;
  end if;
  return new;
end $$;
drop trigger if exists faelle_neu on public.faelle;
create trigger faelle_neu before insert on public.faelle for each row execute function public.faelle_neu();

-- 3. Kunden ändern nur ihre Belege, und nur solange der Fall offen und unbezahlt ist.
--    Status und Zahlung setzen nur der Prüfer oder die Server-Funktion nach erfolgreicher Zahlung.
create or replace function public.faelle_schutz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.ist_pruefer() or public.ist_server() then
    return new;
  end if;
  new.kunde_name      := old.kunde_name;
  new.kunde_email     := old.kunde_email;
  new.jahr            := old.jahr;
  new.notiz           := old.notiz;
  new.status          := old.status;
  new.bezahlt         := old.bezahlt;
  new.bezahlt_am      := old.bezahlt_am;
  new.betrag_chf      := old.betrag_chf;
  new.zahlung_session := old.zahlung_session;
  if old.status <> 'offen' or old.bezahlt then
    new.data := old.data;
  end if;
  return new;
end $$;
drop trigger if exists faelle_schutz on public.faelle;
create trigger faelle_schutz before update on public.faelle for each row execute function public.faelle_schutz();
