-- taxflix: Lernregeln für doppelte Belege
-- Jeder Entscheid eines Prüfers («doppelt» oder «separat») wird hier gespeichert.
-- Künftige Fälle nutzen diese Entscheide automatisch:
--   gleicher Aussteller + gleiche Merkmale  → gleicher Entscheid wie zuletzt
--   gleiche Belegtypen + gleiche Merkmale, mindestens 3 einheitliche Entscheide → automatisch
-- Es werden keine Kundendaten gespeichert, nur Belegtyp, Merkmale, Name des Rechnungsstellers und Betrag.
-- Einmal im Supabase SQL Editor ausführen.

create table if not exists public.lernregeln (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  typ_a text not null,            -- Belegtyp der Einzelrechnung, z.B. liegenschaft
  typ_b text not null,            -- Belegtyp der Aufstellung, z.B. liegenschaft
  merkmale text not null,         -- z.B. betrag+aussteller+datum
  aussteller text,                -- Rechnungssteller, vereinfacht geschrieben
  betrag numeric,
  entscheid text not null check (entscheid in ('doppelt','separat')),
  pruefer uuid default auth.uid()
);
alter table public.lernregeln enable row level security;
drop policy if exists "Lernregeln lesen" on public.lernregeln;
drop policy if exists "Lernregeln anlegen" on public.lernregeln;
create policy "Lernregeln lesen"   on public.lernregeln for select using (public.ist_pruefer());
create policy "Lernregeln anlegen" on public.lernregeln for insert with check (public.ist_pruefer());

-- Lernregeln können in der Übersicht «Gelerntes» deaktiviert werden
alter table public.lernregeln add column if not exists aktiv boolean not null default true;
drop policy if exists "Lernregeln ändern" on public.lernregeln;
create policy "Lernregeln ändern" on public.lernregeln for update using (public.ist_pruefer()) with check (public.ist_pruefer());

-- Gelernte Zuordnungen: Rechnungssteller oder Stichwort aus dem Dateinamen → Ziffer (Schlüssel) oder Belegtyp («typ:…»)
-- Keine Kundendaten: nur Belegtyp, Rechnungssteller (vereinfacht), Stichwort aus dem Dateinamen bzw. der Zeile und die Ziffer.
create table if not exists public.zuordnungen (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  belegtyp text,
  aussteller text,
  stichwort text,
  key text not null,
  aktiv boolean not null default true,
  pruefer uuid default auth.uid()
);
alter table public.zuordnungen enable row level security;
drop policy if exists "Zuordnungen lesen" on public.zuordnungen;
drop policy if exists "Zuordnungen anlegen" on public.zuordnungen;
drop policy if exists "Zuordnungen ändern" on public.zuordnungen;
create policy "Zuordnungen lesen"   on public.zuordnungen for select using (public.ist_pruefer());
create policy "Zuordnungen anlegen" on public.zuordnungen for insert with check (public.ist_pruefer());
create policy "Zuordnungen ändern"  on public.zuordnungen for update using (public.ist_pruefer()) with check (public.ist_pruefer());
