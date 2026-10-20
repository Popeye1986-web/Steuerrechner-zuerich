# taxflix

Steuer-App für den Kanton Zürich. Kunden machen ihre Steuererklärung selbst: Konto erstellen, Belege hochladen, offene Fragen beantworten, online bezahlen, fertig. Du als **Prüfer** siehst alle Fälle und prüfst sie.

## Ablauf für Kunden

1. **Konto erstellen** auf der Login-Seite (`login.html`, die Startadresse leitet dorthin).
2. **Steuererklärung starten**: Name und Steuerjahr.
3. **Belege hochladen**: alle auf einmal. Sie werden automatisch gelesen.
4. **Offene Fragen**: erscheinen erst, wenn alle Belege gelesen sind, und nur, wenn etwas auf keinem Beleg steht.
5. **Bezahlen** mit Karte, TWINT, Apple Pay oder Google Pay (über Stripe).
6. **Fertig**: Der Fall ist bezahlt, eingereicht und für den Kunden gesperrt.

## Seiten

| Datei | Wer | Zweck |
|---|---|---|
| `login.html` | alle | Anmelden, registrieren, Passwort vergessen. Leitet je nach Rolle weiter |
| `kunde.html` | Kunde | Start der Steuererklärung, Fortschritt, Bestätigung nach der Zahlung |
| `upload.html?fall=…` | beide | Belege. Kunde: hochladen und Fragen. Prüfer: zusätzlich Korrekturen und Status |
| `bezahlen.html?fall=…` | Kunde | Bezahlseite |
| `faelle.html` | Prüfer | Alle Fälle mit Status, Zahlung, Belegen, geschätzter Steuer |
| `ergebnis.html?fall=…` | Prüfer | Steuern, Auswertung, alle Ziffern, Export |

Server-Funktionen: `api/auslesen.js` (Belege lesen), `api/zahlung.js` (Stripe).

## Einrichtung (neu)

### 1. Datenbank erweitern
Supabase → **SQL Editor**: zuerst `supabase/faelle.sql` ausführen (falls noch nicht geschehen), dann `supabase/zahlung.sql`.

### 2. Stripe einrichten
1. Konto auf [stripe.com](https://stripe.com) erstellen (Land Schweiz, Währung CHF).
2. **Settings → Payment methods**: Karten, TWINT, Apple Pay und Google Pay einschalten.
3. **Developers → API keys**: den **Secret key** kopieren. Zum Testen den Testschlüssel `sk_test_…`, später den echten `sk_live_…`.

### 3. Einträge in Vercel
Settings → Environment Variables, zusätzlich zu den bestehenden:

| Key | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Secret key von Stripe |
| `PREIS_CHF` | Dein Preis pro Steuererklärung, z.B. `89` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **service_role** bzw. **secret** Key |

Der service_role-Schlüssel und der Stripe-Schlüssel sind geheim. Sie gehören nur in Vercel, nie in GitHub oder `config.js`.

Danach Dateien auf GitHub hochladen (`config.js` nicht ersetzen). Vercel veröffentlicht automatisch.

### 4. Testen
Mit dem Testschlüssel `sk_test_…` und der Testkarte `4242 4242 4242 4242`, beliebiges künftiges Ablaufdatum, beliebige CVC.

## Gut zu wissen

- Die Zahlung wird bei der Rückkehr von Stripe und bei jedem Öffnen von `kunde.html` bei Stripe geprüft. Schliesst ein Kunde das Fenster vor der Rückkehr, wird der Fall beim nächsten Besuch als bezahlt markiert. In Stripe siehst du jede Zahlung sofort.
- Kunden können Status und Zahlung nicht selbst setzen. Das erledigt die Datenbank (`zahlung.sql`).
- Du kannst weiterhin selbst Fälle eröffnen und Kunden einladen (`faelle.html` → Neuer Fall).
- AGB und Datenschutzerklärung sind auf der Bezahlseite verlinkt, aber noch Platzhalter (`#`).

## Grenzen

- PDFs bis 3 MB werden ausgelesen, grössere nur gespeichert.
- Nicht berechnet: Selbständigkeit im Detail, Kapitalleistungen (Ziffer 40), Teilsteuerpflicht (Ziffern 26, 36).
- Für 2026 sind Versicherungsabzug und Fahrkostenmaximum des Kantons noch mit den Werten 2025 hinterlegt.

Schätzung ohne Gewähr. Massgebend ist die Veranlagung des Steueramts. Kein Angebot des Kantonalen Steueramts Zürich.
