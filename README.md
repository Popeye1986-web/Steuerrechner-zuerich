# Steuerpilot Zürich

Steuerrechner für den Kanton Zürich mit Login: Belege erfassen, Positionen nach den Ziffern der Zürcher Steuererklärung ordnen, Staats-, Gemeinde- und Bundessteuer schätzen und die Werte für ZHprivateTax vorbereiten. Die Daten jeder Person werden in ihrem eigenen Konto gespeichert.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Leitet zum Rechner weiter (wird später durch die Startseite ersetzt) |
| `login.html` | Anmelden, Konto erstellen, Passwort vergessen, neues Passwort |
| `app.html` | Der Rechner. Nur nach dem Login erreichbar |
| `auth.js` | Login, Abmelden, Laden und Speichern der Daten |
| `config.js` | Zugangsdaten zu Supabase (musst du ausfüllen) |
| `supabase/schema.sql` | Datenbanktabelle mit Zugriffsschutz |

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. Supabase-Projekt erstellen
1. Auf [supabase.com](https://supabase.com) mit GitHub anmelden → **New project**.
2. Name: `steuerpilot-zuerich`, ein sicheres Datenbank-Passwort wählen und notieren.
3. Region: einen Standort in Europa wählen (für Steuerdaten wegen Datenschutz wichtig).

### 2. Tabelle anlegen
1. Links **SQL Editor** → **New query**.
2. Den ganzen Inhalt von `supabase/schema.sql` einfügen → **Run**.
3. Es sollte «Success. No rows returned» erscheinen.

### 3. Zugangsdaten eintragen
1. **Project Settings → API**.
2. **Project URL** und den Schlüssel **anon public** kopieren.
3. In `config.js` eintragen:
   ```js
   supabaseUrl: "https://abcdefgh.supabase.co",
   supabaseAnonKey: "eyJhbGciOi..."
   ```
   Der Schlüssel **service_role** gehört niemals in diese Datei.

### 4. Adressen für E-Mail-Links eintragen
Damit Bestätigungs- und Passwort-Mails auf deine Seite führen:
1. **Authentication → URL Configuration**.
2. **Site URL:** `https://steuerpilot-zuerich.vercel.app/login.html` (deine Vercel-Adresse).
3. Unter **Redirect URLs** dieselbe Adresse hinzufügen.

### 5. Hochladen
Alle Dateien und den Ordner `supabase` auf GitHub hochladen (bestehende Dateien ersetzen). Vercel veröffentlicht die neue Version automatisch.

### 6. Testen
1. `https://<deine-adresse>/login.html` öffnen → **Konto erstellen**.
2. Bestätigungs-Mail öffnen und auf den Link klicken.
3. Anmelden, einen Wert im Rechner ändern. Oben rechts erscheint «Gespeichert».
4. In Supabase unter **Table Editor → steuerdaten** siehst du eine Zeile für dein Konto.

## Gut zu wissen

- **Ohne ausgefülltes `config.js`** läuft der Rechner ohne Login und speichert nur im Browser. Oben steht dann ein Hinweis.
- **Zugriffsschutz:** Die Regeln in `schema.sql` sorgen dafür, dass jede Person nur ihre eigene Zeile lesen und ändern kann, auch wenn jemand den anon key kennt.
- **E-Mails:** Supabase verschickt die Mails anfangs über einen eigenen Dienst mit wenigen Mails pro Stunde. Für echte Kunden unter **Authentication → Emails → SMTP Settings** einen eigenen Mail-Anbieter eintragen und die Texte auf Deutsch anpassen.
- **Belege automatisch auslesen** funktioniert auf der eigenen Website noch nicht. Dafür braucht es eine Server-Funktion mit der Claude API.

## Quellen der Tarife

- Verordnung über den Ausgleich der kalten Progression, ZStB Nr. 48.1 (gültig ab 2024 bzw. ab 2026)
- Art. 36 DBG gemäss ESTV-Rundschreiben 2026
- Wegleitung zur Steuererklärung 2025, Kantonales Steueramt Zürich

Für 2026 sind Versicherungsabzug und Fahrkostenmaximum des Kantons noch mit den Werten 2025 hinterlegt.

## Hinweis

Schätzung ohne Gewähr. Massgebend ist die Veranlagung des Steueramts. Kein Angebot des Kantonalen Steueramts Zürich.
