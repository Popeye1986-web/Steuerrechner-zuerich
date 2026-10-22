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
