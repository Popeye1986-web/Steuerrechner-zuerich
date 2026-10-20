# Steuerpilot Zürich

Steuerrechner für den Kanton Zürich: Belege erfassen, Positionen nach den Ziffern der Zürcher Steuererklärung ordnen, Staats-, Gemeinde- und Bundessteuer schätzen und die Werte für ZHprivateTax vorbereiten.

## Starten

Die ganze App steckt in `index.html` (HTML, CSS und JavaScript in einer Datei). Es braucht keinen Build-Schritt.

- **Lokal:** `index.html` im Browser öffnen.
- **GitHub Pages:** Repository → Settings → Pages → Branch `main`, Ordner `/ (root)` → Save. Die Seite ist danach unter `https://<benutzername>.github.io/<repository>/` erreichbar.

## Was ausserhalb von Claude funktioniert

| Funktion | Auf GitHub Pages / lokal |
|---|---|
| Haushalt, Gemeinde, Arbeitsweg erfassen | ja |
| Positionen von Hand erfassen und ändern | ja |
| Steuerberechnung 2025 und 2026 | ja |
| Übertragungsliste für ZHprivateTax mit Kopier-Knöpfen | ja |
| Daten im Browser speichern (localStorage) | ja |
| **Belege automatisch auslesen** | **nein** |
| CSV-/JSON-Export | nein (Ersatz: Inhalt wird in die Zwischenablage kopiert) |

Das automatische Auslesen nutzt in der Claude-App das Claude-Konto der jeweiligen Person. Für eine eigene Website braucht es dafür einen Server, der die Belege an die Claude API schickt. Den API-Schlüssel nie in `index.html` schreiben, weil er sonst öffentlich ist.

## Aufbau von `index.html`

- `ZH`, `BUND`: Tarife und Abzüge pro Steuerperiode
- `KEYS`: alle Positionen mit Ziffer und Gruppe (Einkünfte, Abzüge, Vermögen)
- `calc()`: komplette Steuerberechnung
- `buildPrompt()`, `readDoc()`: Auslesen der Belege (PDF-Seiten werden mit pdf.js in Bilder umgewandelt)

## Quellen der Tarife

- Verordnung über den Ausgleich der kalten Progression, ZStB Nr. 48.1 (gültig ab 2024 bzw. ab 2026)
- Art. 36 DBG gemäss ESTV-Rundschreiben 2026
- Wegleitung zur Steuererklärung 2025, Kantonales Steueramt Zürich

Für 2026 sind Versicherungsabzug und Fahrkostenmaximum des Kantons noch mit den Werten 2025 hinterlegt.

## Hinweis

Schätzung ohne Gewähr. Massgebend ist die Veranlagung des Steueramts. Kein Angebot des Kantonalen Steueramts Zürich.
