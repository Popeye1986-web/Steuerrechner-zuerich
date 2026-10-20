# taxflix

Steuer-App für den Kanton Zürich. Kunden machen ihre Steuererklärung ohne Konto: Belege hochladen, offene Fragen beantworten, online bezahlen, ausgefülltes Formular per E-Mail erhalten. Du als **Prüfer** siehst alle Fälle und prüfst sie.

## Ablauf für Kunden

1. **Startseite öffnen** (`upload.html`, die Hauptadresse leitet dorthin). Kein Konto, keine Einladung.
2. **Belege hochladen**: alle auf einmal. Sie werden automatisch gelesen.
3. **Offene Fragen**: erscheinen erst, wenn alle Belege gelesen sind, und nur, wenn etwas auf keinem Beleg steht.
4. **Bezahlen**: Name und E-Mail eingeben, dann mit Karte, TWINT, Apple Pay oder Google Pay bezahlen (über Stripe).
5. **Fertig**: Der Kunde bekommt per E-Mail ein PDF mit seiner ausgefüllten Steuererklärung (alle Ziffern und Feldcodes). Der Fall ist bezahlt, eingereicht und für ihn gesperrt.

Nach deiner Prüfung schickst du auf der Ergebnisseite mit **«Formular an Kunde senden»** die geprüfte Fassung.

Technisch: Der Browser des Kunden wird unsichtbar und anonym bei Supabase angemeldet. So sieht nur er seine Belege. Kommt er im gleichen Browser zurück, geht es beim offenen Fall weiter.

## Seiten

| Datei | Wer | Zweck |
|---|---|---|
| `upload.html` | alle | Startseite. Kunde: hochladen und Fragen. Prüfer (`?fall=…`): zusätzlich Korrekturen und Status |
| `bezahlen.html?fall=…` | Kunde | Name, E-Mail, Bezahlung, Bestätigung |
| `login.html` | Prüfer | Anmelden |
| `faelle.html` | Prüfer | Alle Fälle mit Status, Zahlung, versandtem PDF, Belegen, geschätzter Steuer |
| `ergebnis.html?fall=…` | Prüfer | Steuern, Auswertung, alle Ziffern, Export, Formular senden |
| `kunde.html` | Kunde mit Konto | Nur noch für Kunden, die früher ein Konto erstellt haben |

Server-Funktionen: `api/auslesen.js` (Belege lesen), `api/zahlung.js` (Stripe und Formular senden), `api/stripe.js` (Bestätigung von Stripe). Gemeinsamer Code in `lib/` (PDF mit pdf-lib, E-Mail mit Resend).

## Einrichtung

### 1. Datenbank
Supabase → **SQL Editor**: `supabase/anonym.sql` ausführen (enthält auch `zahlung.sql`).
Dann **Authentication → Sign In / Providers → Allow anonymous sign-ins** einschalten.

### 2. Stripe
1. Konto auf [stripe.com](https://stripe.com) erstellen (Land Schweiz, Währung CHF).
2. **Settings → Payment methods**: Karten, TWINT, Apple Pay und Google Pay einschalten.
3. **Developers → API keys**: den **Secret key** kopieren (`sk_test_…` zum Testen, später `sk_live_…`).
4. Empfohlen: **Developers → Webhooks → Add endpoint**, URL `https://<deine-adresse>/api/stripe`, Events `checkout.session.completed` und `checkout.session.async_payment_succeeded`. Dann wird auch dann bestätigt und gemailt, wenn der Kunde das Fenster nach der Zahlung sofort schliesst.

### 3. E-Mail (Resend)
1. Konto auf [resend.com](https://resend.com) erstellen.
2. **Domains → Add Domain**: deine Domain eintragen und die angezeigten DNS-Einträge beim Domain-Anbieter setzen. Ohne eigene Domain kann Resend nur an deine eigene Adresse senden (zum Testen).
3. **API Keys → Create API Key** und kopieren.

### 4. Einträge in Vercel
Settings → Environment Variables, zusätzlich zu den bestehenden:

| Key | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Secret key von Stripe |
| `PREIS_CHF` | Dein Preis pro Steuererklärung, z.B. `89` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **service_role** bzw. **secret** Key |
| `RESEND_API_KEY` | API Key von Resend |
| `MAIL_FROM` | Absender, z.B. `taxflix <post@deine-domain.ch>` |
| `MAIL_KOPIE` | optional: deine E-Mail für eine Kopie jeder Kunden-E-Mail |

Alle Schlüssel sind geheim. Sie gehören nur in Vercel, nie in GitHub oder `config.js`.

### 5. Testen
Mit dem Testschlüssel `sk_test_…` und der Testkarte `4242 4242 4242 4242`, beliebiges künftiges Ablaufdatum, beliebige CVC.

## Gut zu wissen

- Die Zahlung wird bei der Rückkehr von Stripe geprüft und, falls eingerichtet, zusätzlich über den Webhook. Das PDF wird genau einmal automatisch verschickt.
- Das PDF ist eine Aufstellung zur Aufbewahrung, kein amtliches Formular. Vor der Prüfung ist es als «vorläufig» markiert, die Fassung nach deiner Prüfung als «geprüft».
- Kunden können Name, E-Mail, Status und Zahlung nicht selbst setzen. Das erledigt die Datenbank (`anonym.sql`). Pro Besucher sind höchstens 5 Fälle möglich.
- Du kannst weiterhin selbst Fälle eröffnen (`faelle.html` → Neuer Fall), z.B. wenn dir ein Kunde Belege per Post schickt.
- AGB und Datenschutzerklärung sind auf der Bezahlseite verlinkt, aber noch Platzhalter (`#`).

## Grenzen

- PDFs bis 3 MB werden ausgelesen, grössere nur gespeichert.
- Nicht berechnet: Selbständigkeit im Detail, Kapitalleistungen (Ziffer 40), Teilsteuerpflicht (Ziffern 26, 36).
- Für 2026 sind Versicherungsabzug und Fahrkostenmaximum des Kantons noch mit den Werten 2025 hinterlegt.

Schätzung ohne Gewähr. Massgebend ist die Veranlagung des Steueramts. Kein Angebot des Kantonalen Steueramts Zürich.
