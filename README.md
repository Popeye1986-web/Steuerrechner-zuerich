# taxflix

Steuer-App für den Kanton Zürich: anmelden, Belege hochladen, Beträge auslesen lassen und das Ergebnis nach den Ziffern der Zürcher Steuererklärung sehen.

## Seiten

| Datei | Seite |
|---|---|
| `login.html` | 1 · Anmelden, Konto erstellen, Passwort vergessen |
| `upload.html` | 2 · Alle Belege hochladen. Typ, Personen, Zivilstand, Kinder, Gemeinde und Beträge werden erkannt, nur Fehlendes wird gefragt |
| `ergebnis.html` | 3 · Steuern, Auswertung, alle Ziffern 1.1 bis 35 mit Staats- und Bundessteuer, Export |
| `index.html`, `app.html` | Leiten zu `upload.html` weiter |

Weitere Dateien: `taxcore.js` (Tarife und Berechnung), `auth.js` (Login und Speichern), `styles.css` (Aussehen), `config.js` (deine Supabase-Werte), `api/auslesen.js` (Server-Funktion fürs Auslesen), `supabase/*.sql` (Datenbank).

## Einrichtung

Die Schritte für Supabase, Tabelle `steuerdaten` und `config.js` hast du schon erledigt. Neu dazu kommt:

### 1. Speicher für Belege anlegen
1. Supabase → **SQL Editor** → **New query**.
2. Inhalt von `supabase/speicher.sql` einfügen → **Run** → «Success».

Damit werden hochgeladene Dateien gespeichert. Jede Person sieht nur ihre eigenen.

### 2. Automatisches Auslesen einschalten (nötig für die Erkennung, kostet pro Beleg ein paar Rappen)
1. Auf [console.anthropic.com](https://console.anthropic.com) ein Konto erstellen, Guthaben aufladen und unter **API Keys** einen Schlüssel erstellen.
2. In Vercel: Projekt → **Settings → Environment Variables**. Drei Einträge hinzufügen:
   - `ANTHROPIC_API_KEY` = dein Anthropic-Schlüssel
   - `SUPABASE_URL` = gleiche Project URL wie in `config.js`
   - `SUPABASE_ANON_KEY` = gleicher Schlüssel wie in `config.js`
3. Vercel → **Deployments** → beim neuesten Eintrag **⋯ → Redeploy**.

Ohne diesen Schritt werden die Belege nur gespeichert. Typ, Beträge und Angaben zum Haushalt trägt man dann von Hand ein.

Der Anthropic-Schlüssel steht nur in Vercel, nie im Code. Die Funktion liest nur für angemeldete Personen aus.

## Grenzen

- PDFs bis 3 MB werden ausgelesen, grössere nur gespeichert. Fotos werden vor dem Senden verkleinert.
- Nicht berechnet: Selbständigkeit im Detail, Kapitalleistungen (Ziffer 40), Teilsteuerpflicht (Ziffern 26, 36), Liegenschaften ausserhalb des Kantons.
- Für 2026 sind Versicherungsabzug und Fahrkostenmaximum des Kantons noch mit den Werten 2025 hinterlegt.

## Quellen

- Formular «Steuererklärung 2025» des Kantonalen Steueramts Zürich (Ziffern und Höchstbeträge)
- Verordnung über den Ausgleich der kalten Progression, ZStB Nr. 48.1
- Art. 36 DBG gemäss ESTV-Rundschreiben 2026
- Wegleitung zur Steuererklärung 2025, Kanton Zürich

Schätzung ohne Gewähr. Massgebend ist die Veranlagung des Steueramts. Kein Angebot des Kantonalen Steueramts Zürich.
