-- taxflix: Fortlaufende Fallnummer für jeden Steuerfall (z.B. TF-1001).
-- In Supabase unter "SQL Editor" einfügen und "Run" klicken. Bestehende Fälle erhalten automatisch eine Nummer.
-- Die Nummer wird von der Datenbank vergeben und kann von niemandem geändert werden.
alter table public.faelle add column if not exists nr bigint generated always as identity (start with 1001);
create unique index if not exists faelle_nr on public.faelle (nr);

-- Kontrolle: die Fälle mit ihrer Nummer
select nr, kunde_name, jahr, created_at from public.faelle order by nr;
