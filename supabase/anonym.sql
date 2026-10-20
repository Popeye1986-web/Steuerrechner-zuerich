-- taxflix: Kunden starten ohne Konto. Name und E-Mail kommen erst bei der Bezahlung.
-- In Supabase unter "SQL Editor" einfügen und "Run" klicken (nach faelle.sql).
-- Enthält auch alles aus zahlung.sql. Mehrfaches Ausführen schadet nicht.
-- Zusätzlich nötig: Authentication → Sign In / Providers → "Allow anonymous sign-ins" einschalten.

-- 1. Neue Spalten
alter table public.faelle add column if not exists bezahlt          boolean not null default false;
alter table public.faelle add column if not exists bezahlt_am       timestamptz;
alter table public.faelle add column if not exists betrag_chf       numeric;
alter table public.faelle add column if not exists zahlung_session  text;
alter table public.faelle add column if not exists kunde_id         uuid default auth.uid();
alter table public.faelle add column if not exists mail_gesendet_am timestamptz;
alter table public.faelle alter column kunde_email drop not null;
alter table public.faelle alter column kunde_name  drop not null;
create index if not exists faelle_kunde_id on public.faelle (kunde_id);

-- Die Server-Funktionen (Vercel) arbeiten mit dem service_role-Schlüssel
create or replace function public.ist_server() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

-- Gehört der Fall der angemeldeten Person? (anonym über kunde_id, mit Konto auch über die E-Mail)
create or replace function public.mein_fall(f_kunde_id uuid, f_email text) returns boolean
language sql stable as $$
  select (auth.uid() is not null and f_kunde_id = auth.uid())
      or (public.meine_email() <> '' and lower(coalesce(f_email, '')) = public.meine_email())
$$;

-- 2. Zugriffsregeln
drop policy if exists "Fälle lesen"   on public.faelle;
drop policy if exists "Fälle anlegen" on public.faelle;
drop policy if exists "Fälle ändern"  on public.faelle;
drop policy if exists "Fälle löschen" on public.faelle;
create policy "Fälle lesen"   on public.faelle for select using (public.ist_pruefer() or public.mein_fall(kunde_id, kunde_email));
create policy "Fälle anlegen" on public.faelle for insert with check (public.ist_pruefer() or auth.uid() is not null);
create policy "Fälle ändern"  on public.faelle for update using (public.ist_pruefer() or public.mein_fall(kunde_id, kunde_email))
                                                        with check (public.ist_pruefer() or public.mein_fall(kunde_id, kunde_email));
create policy "Fälle löschen" on public.faelle for delete using (public.ist_pruefer());

-- 3. Neuer Fall eines Kunden: gehört ihm, ist offen und unbezahlt. Höchstens 5 Fälle pro Besucher.
create or replace function public.faelle_neu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.ist_pruefer() and not public.ist_server() then
    if (select count(*) from public.faelle where kunde_id = auth.uid()) >= 5 then
      raise exception 'Zu viele Steuererklärungen';
    end if;
    new.kunde_id         := auth.uid();
    new.kunde_email      := nullif(public.meine_email(), '');
    new.kunde_name       := coalesce(new.kunde_name, '');
    new.status           := 'offen';
    new.bezahlt          := false;
    new.bezahlt_am       := null;
    new.betrag_chf       := null;
    new.zahlung_session  := null;
    new.mail_gesendet_am := null;
    new.notiz            := null;
  elsif public.ist_pruefer() then
    new.kunde_id := null;  -- vom Prüfer eröffnete Fälle gehören keinem Besucher
  end if;
  return new;
end $$;
drop trigger if exists faelle_neu on public.faelle;
create trigger faelle_neu before insert on public.faelle for each row execute function public.faelle_neu();

-- 4. Kunden ändern nur ihre Belege, und nur solange der Fall offen und unbezahlt ist.
--    Name, E-Mail, Status und Zahlung setzen nur der Prüfer oder die Server-Funktion.
create or replace function public.faelle_schutz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.ist_pruefer() or public.ist_server() then
    return new;
  end if;
  new.kunde_id         := old.kunde_id;
  new.kunde_name       := old.kunde_name;
  new.kunde_email      := old.kunde_email;
  new.jahr             := old.jahr;
  new.notiz            := old.notiz;
  new.status           := old.status;
  new.bezahlt          := old.bezahlt;
  new.bezahlt_am       := old.bezahlt_am;
  new.betrag_chf       := old.betrag_chf;
  new.zahlung_session  := old.zahlung_session;
  new.mail_gesendet_am := old.mail_gesendet_am;
  if old.status <> 'offen' or old.bezahlt then
    new.data := old.data;
  end if;
  return new;
end $$;
drop trigger if exists faelle_schutz on public.faelle;
create trigger faelle_schutz before update on public.faelle for each row execute function public.faelle_schutz();

-- Kontrolle: Diese Zeile muss "kunde_id" anzeigen.
select column_name from information_schema.columns where table_name = 'faelle' and column_name = 'kunde_id';
