-- taxflix: Speicher für hochgeladene Belege.
-- In Supabase unter "SQL Editor" einfügen und "Run" klicken.
-- Jede Person sieht nur Dateien in ihrem eigenen Ordner (Ordnername = Benutzer-ID).

insert into storage.buckets (id, name, public)
values ('belege', 'belege', false)
on conflict (id) do nothing;

drop policy if exists "Eigene Belege lesen"     on storage.objects;
drop policy if exists "Eigene Belege hochladen" on storage.objects;
drop policy if exists "Eigene Belege löschen"   on storage.objects;

create policy "Eigene Belege lesen" on storage.objects for select
  using (bucket_id = 'belege' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Eigene Belege hochladen" on storage.objects for insert
  with check (bucket_id = 'belege' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Eigene Belege löschen" on storage.objects for delete
  using (bucket_id = 'belege' and (storage.foldername(name))[1] = auth.uid()::text);
