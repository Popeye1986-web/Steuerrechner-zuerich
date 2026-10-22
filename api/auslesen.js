// Vercel-Funktion: liest einen Beleg mit der Claude API aus.
// Nötige Umgebungsvariablen in Vercel (Settings → Environment Variables):
//   ANTHROPIC_API_KEY   Schlüssel aus console.anthropic.com
//   SUPABASE_URL        gleiche Project URL wie in config.js
//   SUPABASE_ANON_KEY   gleicher öffentlicher Schlüssel wie in config.js
//   ANTHROPIC_MODEL     optional, Standard: claude-sonnet-5-5

const LABELS = {
  nettolohn: "Nettolohn gemäss Lohnausweis Ziffer 11",
  nebenerwerb: "Nettoeinkommen aus Nebenerwerb",
  selbstaendig: "Gewinn aus selbständiger Erwerbstätigkeit",
  ahv_rente: "AHV-/IV-Rente des Jahres",
  pk_rente: "Rente/Pension der Pensionskasse des Jahres",
  alv: "Arbeitslosenentschädigung des Jahres",
  taggelder: "Taggelder, Mutterschaftsentschädigung, separat bezahlte Kinderzulagen",
  wertschriftenertrag: "Bruttoertrag aus Zinsen und Dividenden des Jahres (vor Verrechnungssteuer)",
  verrechnungssteuer: "Verrechnungssteuer 35 %, die zurückgefordert werden kann",
  bankguthaben: "Saldo aller Bank- und Postkonten per 31.12.",
  wertschriften_wert: "Steuerwert aller Wertschriften im Depot per 31.12.",
  krankenkasse_praemien: "Bezahlte Krankenkassenprämien Grund- und Zusatzversicherung, nach Abzug der Prämienverbilligung",
  versicherung_uebrige: "Übrige bezahlte Versicherungsprämien (Lebens-, Unfallversicherung)",
  krankheitskosten: "Selbst bezahlte Krankheitskosten (Franchise, Selbstbehalt, nicht gedeckte Rechnungen)",
  saeule3a: "Im Jahr einbezahlter Betrag Säule 3a (nicht das Guthaben)",
  oev_abo: "Kosten des ÖV-Abonnements",
  pk_einkauf: "Freiwilliger Einkauf in die Pensionskasse im Jahr",
  kinderbetreuung: "Bezahlte Kosten für Kita, Hort, Tagesfamilie",
  eigenmietwert: "Eigenmietwert",
  mietertrag: "Mieteinnahmen",
  liegenschaft_unterhalt: "Unterhaltskosten der Liegenschaft",
  liegenschaft_steuerwert: "Steuerwert der Liegenschaft",
  schuldzinsen: "Im Jahr bezahlte Schuldzinsen (Hypothek, Kredit)",
  schulden: "Schulden per 31.12. (Hypothek, Kredit)",
  spenden: "Spenden an gemeinnützige Institutionen",
  weiterbildung: "Kosten berufsorientierte Weiterbildung",
  unterhalt_bezahlt: "Bezahlte Unterhaltsbeiträge",
  unterhalt_erhalten: "Erhaltene Unterhaltsbeiträge",
  uebrige_einkuenfte: "Weitere Einkünfte",
  bargeld: "Bargeld, Gold, Edelmetalle",
  fahrzeuge: "Wert Motorfahrzeuge",
  lebensversicherung: "Rückkaufswert Lebensversicherung",
  uebriges_vermoegen: "Übrige Vermögenswerte"
};
const TYPES = {
  lohnausweis: "Lohnausweis / Rentenbescheinigung des Arbeitgebers (Formular 11)",
  bank: "Bank- oder Postkontoauszug, Depotauszug, Zinsausweis, eSteuerauszug",
  krankenkasse: "Prämienbescheinigung oder Police der Krankenkasse",
  saeule3a: "Bescheinigung Säule 3a",
  oev: "Quittung ÖV-Abonnement (GA, ZVV-Netzpass)",
  pk_einkauf: "Bestätigung Einkauf Pensionskasse",
  rente: "Rentenbescheinigung AHV, IV oder Pensionskasse",
  taggeld: "Bescheinigung Arbeitslosenkasse, Taggelder, Mutterschaft",
  selbst: "Jahresrechnung selbständige Erwerbstätigkeit",
  kita: "Rechnung Kita, Hort, Tagesfamilie",
  liegenschaft: "Eigenmietwert, Liegenschaftsverzeichnis, Mieterträge, Unterhaltskosten",
  hypothek: "Zinsausweis Hypothek oder Kredit",
  spenden: "Spendenbescheinigung",
  weiterbildung: "Rechnung Weiterbildung",
  krankheit: "Arzt-, Zahnarzt- oder Spitalrechnung, Leistungsabrechnung",
  unterhalt: "Beleg Unterhaltsbeiträge",
  steuerrechnung: "Steuerrechnung, Veranlagung oder Einschätzungsentscheid",
  steuererklaerung: "Steuererklärung (Formular des Kantonalen Steueramts, z.B. vom Vorjahr) mit Seite 1 «Personalien»",
  sonstiges: "Anderer Beleg"
};
const MEDIA = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

async function userFromToken(token) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !token) return null;
  const r = await fetch(url.replace(/\/$/, "") + "/auth/v1/user", { headers: { Authorization: "Bearer " + token, apikey: key } });
  return r.ok ? r.json() : null;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (_) {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch (_) {} }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (_) {} }
  return null;
}

module.exports = async function handler(req, res) {
  const configured = !!(process.env.ANTHROPIC_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  if (req.method === "GET") return res.status(200).json({ configured });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!configured) return res.status(503).json({ error: "not_configured" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await userFromToken(token);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const body = req.body || {};
  const mediaType = String(body.mediaType || "");
  const data = typeof body.data === "string" ? body.data : "";
  const year = Number(body.year) || new Date().getFullYear() - 1;
  const typeHint = TYPES[body.typeHint] ? body.typeHint : "";
  if (!MEDIA.includes(mediaType) || !data) return res.status(400).json({ error: "bad_request" });
  if (data.length > 4.3 * 1024 * 1024) return res.status(413).json({ error: "too_large" });

  const keyList = Object.entries(LABELS).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const typeList = Object.entries(TYPES).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const prompt = `Du liest einen Schweizer Beleg für die Steuererklärung ${year} des Kantons Zürich.

1. Bestimme den Belegtyp${typeHint ? ` (die Person sagt, es sei: ${typeHint})` : ""}. Genau eine ID:
${typeList}

2. Lies die Personen aus:
- "inhaber": die Person, der der Beleg gehört (Arbeitnehmer, Versicherter, Kontoinhaber).
- "personen": alle Personen, die auf dem Beleg stehen, mit Rolle "steuerpflichtig", "ehepartner", "kind" oder "andere". Familienpolicen der Krankenkasse listen oft alle Familienmitglieder.
- Geburtsdatum als JJJJ-MM-TT, nur wenn sichtbar.
- "adresse": PLZ und Ort der Wohnadresse (nicht die des Arbeitgebers).
- "zivilstand": nur wenn ausdrücklich genannt (verheiratet, ledig, geschieden, verwitwet, eingetragene Partnerschaft = verheiratet), sonst null.

3. Lies die Beträge in CHF aus und ordne sie diesen Schlüsseln zu:
${keyList}

4. Nur beim Lohnausweis: "lohnausweis" mit arbeitgeber, kantine (Feld G angekreuzt), gratis_transport (Feld F angekreuzt), geschaeftsauto (Ziffer 2.2 Privatanteil Geschäftsfahrzeug > 0), pk_beitraege (Ziffer 10.1).
Nur bei Steuerrechnung, Veranlagung oder Steuererklärung: "steuern" mit gemeinde, steuerfuss_gemeinde (Prozent), steuerfuss_kirche (Prozent oder 0), konfession ("reformiert", "katholisch", "christkatholisch", "keine"), und zivilstand.

5. Bei einer Steuererklärung (dokumenttyp "steuererklaerung"): Lies die Seite 1 «Personalien, Berufs- und Familienverhältnisse» VOLLSTÄNDIG aus und gib sie als "personalien" zurück:
- "gemeinde": politische Gemeinde bzw. Wohnort laut Formular.
- "zivilstand": angekreuzter Zivilstand.
- "personen": Person 1 (Steuerpflichtige/r bzw. Ehemann/Person 1) und Person 2 (Ehefrau/Person 2), in dieser Reihenfolge, je mit vorname, nachname, geburtsdatum, konfession, beruf, arbeitgeber.
  konfession genau so: "reformiert" (evangelisch-reformiert), "katholisch" (römisch-katholisch), "christkatholisch", "keine" (andere, keine, konfessionslos). Null nur, wenn nichts angekreuzt oder eingetragen ist.
- "kinder": alle Kinder (im eigenen Haushalt und ausserhalb) mit vorname, nachname, geburtsdatum, im_haushalt (true/false), ausbildung (true, wenn Schule, Lehre, Studium oder Ausbildung eingetragen ist; false, wenn ausdrücklich keine; sonst null).
- "unterstuetzte_personen": Anzahl unterstützter Personen (0, wenn keine).
Trage dieselben Personen auch in "personen" ein (Person 1 "steuerpflichtig", Person 2 "ehepartner", Kinder "kind").
Steht auf einem anderen Beleg (z.B. Steuerrechnung) die Konfession, gib sie in "steuern.konfession" an.

6. Rechnungen und Aufstellungen (damit nichts doppelt gezählt wird):
- Ist der Beleg EINE einzelne Rechnung oder Quittung (z.B. Handwerker-, Arzt-, Kita-Rechnung): "rechnung" mit aussteller (Firma oder Person, die die Rechnung stellt), datum (JJJJ-MM-TT), nummer (Rechnungsnummer, sonst null) und betrag (Rechnungstotal in CHF).
- Enthält der Beleg eine AUFSTELLUNG mehrerer Rechnungen oder Kosten (z.B. Liegenschaftenverzeichnis oder Abrechnung mit Detail der Unterhaltskosten, Liste von Arzt- oder Kitarechnungen): "einzelposten" mit jeder einzelnen Zeile als {aussteller, datum, nummer, betrag, key}. key ist der Schlüssel aus Punkt 3, zu dem die Zeile gehört. Höchstens 80 Zeilen.
- Sonst "rechnung": null und "einzelposten": [].

Regeln:
- Beträge nur aus dem Jahr ${year} bzw. per 31.12.${year}. Andere Jahre trotzdem auslesen und in "hinweise" nennen.
- Bei einer Steuerrechnung oder Steuererklärung eines Vorjahres KEINE Beträge in "positionen" übernehmen, nur "steuern", "personalien" und Personen.
- Mehrere Konten zum gleichen Schlüssel zusammenzählen. Nichts erfinden. Unsichere Werte mit "sicherheit": "tief".
- Keine AHV-Nummern, IBAN oder Kontonummern ausgeben.

Antworte nur mit JSON:
{"dokumenttyp":"lohnausweis","jahr":${year},"inhaber":{"vorname":"","nachname":"","geburtsdatum":null},"personen":[{"vorname":"","nachname":"","geburtsdatum":null,"rolle":"steuerpflichtig"}],"adresse":{"plz":"","ort":""},"zivilstand":null,"lohnausweis":null,"steuern":null,"personalien":null,"positionen":[{"key":"nettolohn","betrag":0,"sicherheit":"hoch"}],"rechnung":null,"einzelposten":[],"hinweise":[]}`;

  const fileBlock = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 6000,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt }] }] })
    });
    if (!r.ok) { const t = await r.text(); console.error("Anthropic", r.status, t.slice(0, 500)); return res.status(502).json({ error: "upstream", status: r.status }); }
    const out = await r.json();
    const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
    const json = parseJson(text);
    if (!json) return res.status(502).json({ error: "parse" });
    const str = (v, n) => v == null ? "" : String(v).slice(0, n || 60);
    const dob = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null;
    const person = p => p && (p.vorname || p.nachname) ? { vorname: str(p.vorname, 40), nachname: str(p.nachname, 40), geburtsdatum: dob(p.geburtsdatum), rolle: ["steuerpflichtig", "ehepartner", "kind", "andere"].includes(p.rolle) ? p.rolle : null } : null;
    const ziv = v => ["verheiratet", "ledig", "geschieden", "verwitwet"].includes(v) ? (v === "verheiratet" ? "verheiratet" : "ledig") : null;
    const typ = TYPES[json.dokumenttyp] ? json.dokumenttyp : (typeHint || "sonstiges");
    const positionen = (Array.isArray(json.positionen) ? json.positionen : [])
      .filter(p => LABELS[p.key] && isFinite(Number(p.betrag)) && Number(p.betrag) !== 0)
      .map(p => ({ key: p.key, betrag: Math.abs(Number(p.betrag)), sicherheit: p.sicherheit === "tief" ? "tief" : "hoch" }));
    const la = json.lohnausweis && typeof json.lohnausweis === "object" ? {
      arbeitgeber: str(json.lohnausweis.arbeitgeber, 80), kantine: !!json.lohnausweis.kantine, gratis_transport: !!json.lohnausweis.gratis_transport,
      geschaeftsauto: !!json.lohnausweis.geschaeftsauto, pk_beitraege: isFinite(Number(json.lohnausweis.pk_beitraege)) ? Number(json.lohnausweis.pk_beitraege) : null } : null;
    const stx = json.steuern && typeof json.steuern === "object" ? {
      gemeinde: str(json.steuern.gemeinde, 60), steuerfuss_gemeinde: Number(json.steuern.steuerfuss_gemeinde) || null,
      steuerfuss_kirche: json.steuern.steuerfuss_kirche == null ? null : (Number(json.steuern.steuerfuss_kirche) || 0),
      konfession: ["reformiert", "katholisch", "christkatholisch", "keine"].includes(json.steuern.konfession) ? json.steuern.konfession : null } : null;
    const KONF = v => { const t = String(v || "").toLowerCase(); if (!t) return null;
      if (/christ/.test(t)) return "christkatholisch"; if (/kath/.test(t)) return "katholisch"; if (/ref|evang|protest/.test(t)) return "reformiert";
      if (/kein|ander|konfessionslos|ohne|none/.test(t)) return "keine"; return null; };
    const prior = typ === "steuerrechnung" || typ === "steuererklaerung";
    const datum = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null;
    const betrag = v => { const n = Math.abs(Number(v)); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
    const rj = json.rechnung && typeof json.rechnung === "object" ? json.rechnung : null;
    const rechnung = rj && betrag(rj.betrag) ? { aussteller: str(rj.aussteller, 80), datum: datum(rj.datum), nummer: str(rj.nummer, 40) || null, betrag: betrag(rj.betrag) } : null;
    const einzelposten = (Array.isArray(json.einzelposten) ? json.einzelposten : []).filter(z => z && betrag(z.betrag)).slice(0, 80)
      .map(z => ({ aussteller: str(z.aussteller, 80), datum: datum(z.datum), nummer: str(z.nummer, 40) || null, betrag: betrag(z.betrag), key: LABELS[z.key] ? z.key : null }));
    const pj = json.personalien && typeof json.personalien === "object" ? json.personalien : null;
    const pers = pj ? {
      gemeinde: str(pj.gemeinde, 60),
      zivilstand: ziv(pj.zivilstand),
      personen: (Array.isArray(pj.personen) ? pj.personen : []).slice(0, 2).map(p => p && (p.vorname || p.nachname) ? {
        vorname: str(p.vorname, 40), nachname: str(p.nachname, 40), geburtsdatum: dob(p.geburtsdatum),
        konfession: KONF(p.konfession), beruf: str(p.beruf, 60), arbeitgeber: str(p.arbeitgeber, 80) } : null),
      kinder: (Array.isArray(pj.kinder) ? pj.kinder : []).filter(k => k && (k.vorname || k.nachname)).slice(0, 10).map(k => ({
        vorname: str(k.vorname, 40), nachname: str(k.nachname, 40), geburtsdatum: dob(k.geburtsdatum),
        im_haushalt: k.im_haushalt === false ? false : true, ausbildung: k.ausbildung === true ? true : k.ausbildung === false ? false : null })),
      unterstuetzte_personen: Math.max(0, Math.min(9, parseInt(pj.unterstuetzte_personen, 10) || 0))
    } : null;
    if (stx && !stx.konfession && json.steuern) stx.konfession = KONF(json.steuern.konfession);
    // Personen aus Seite 1 auch in die Personenliste übernehmen
    let personen = (Array.isArray(json.personen) ? json.personen : []).map(person).filter(Boolean);
    if (pers) {
      pers.personen.forEach((p, i) => { if (p) personen.push(person(Object.assign({}, p, { rolle: i === 0 ? "steuerpflichtig" : "ehepartner" }))); });
      pers.kinder.forEach(k => personen.push(person(Object.assign({}, k, { rolle: "kind" }))));
      personen = personen.filter(Boolean);
    }
    return res.status(200).json({
      dokumenttyp: typ, jahr: Number(json.jahr) || null,
      inhaber: person(json.inhaber), personen: personen.slice(0, 16),
      adresse: json.adresse ? { plz: str(json.adresse.plz, 6), ort: str(json.adresse.ort, 60) } : null,
      zivilstand: ziv(json.zivilstand) || (pers && pers.zivilstand) || (stx ? ziv(json.steuern.zivilstand) : null),
      lohnausweis: typ === "lohnausweis" ? la : null, steuern: prior ? stx : null,
      personalien: typ === "steuererklaerung" ? pers : null,
      positionen: prior ? [] : positionen,
      rechnung: prior ? null : rechnung, einzelposten: prior ? [] : einzelposten,
      hinweise: (Array.isArray(json.hinweise) ? json.hinweise : []).map(v => str(v, 160)).slice(0, 3)
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
};
