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
  const keys = Array.isArray(body.keys) ? body.keys.filter(k => LABELS[k]) : [];
  const mediaType = String(body.mediaType || "");
  const data = typeof body.data === "string" ? body.data : "";
  const year = Number(body.year) || new Date().getFullYear() - 1;
  if (!keys.length || !MEDIA.includes(mediaType) || !data) return res.status(400).json({ error: "bad_request" });
  if (data.length > 4.3 * 1024 * 1024) return res.status(413).json({ error: "too_large" });

  const keyList = keys.map(k => `- ${k}: ${LABELS[k]}`).join("\n");
  const prompt = `Du liest einen Schweizer Steuerbeleg für die Steuererklärung ${year} des Kantons Zürich.

Suche nur diese Beträge in CHF und ordne sie den Schlüsseln zu:
${keyList}

Regeln:
- Nur Werte des Jahres ${year} bzw. per 31.12.${year}. Weicht das Jahr ab, trotzdem auslesen und in "hinweise" erwähnen.
- Mehrere Konten oder Positionen zum gleichen Schlüssel zusammenzählen.
- Keine Beträge erfinden. Fehlt ein Betrag, den Schlüssel weglassen. Unsichere Werte mit "sicherheit": "tief" markieren.
- Beträge als Zahl ohne Tausendertrennzeichen.

Antworte nur mit JSON:
{"dokumenttyp":"...","jahr":${year},"positionen":[{"key":"${keys[0]}","betrag":12345.50,"sicherheit":"hoch"}],"hinweise":["kurzer Hinweis"]}`;

  const fileBlock = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 1500,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt }] }] })
    });
    if (!r.ok) { const t = await r.text(); console.error("Anthropic", r.status, t.slice(0, 500)); return res.status(502).json({ error: "upstream", status: r.status }); }
    const out = await r.json();
    const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
    const json = parseJson(text);
    if (!json) return res.status(502).json({ error: "parse" });
    const positionen = (Array.isArray(json.positionen) ? json.positionen : [])
      .filter(p => keys.includes(p.key) && isFinite(Number(p.betrag)))
      .map(p => ({ key: p.key, betrag: Math.abs(Number(p.betrag)), sicherheit: p.sicherheit === "tief" ? "tief" : "hoch" }));
    return res.status(200).json({ dokumenttyp: String(json.dokumenttyp || "").slice(0, 80), jahr: json.jahr || null, positionen,
      hinweise: (Array.isArray(json.hinweise) ? json.hinweise : []).map(String).slice(0, 3) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
};
