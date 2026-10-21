// taxflix: Erstellt das ausgefüllte Steuerformular als PDF und verschickt es per E-Mail (Resend).
// Wird von api/zahlung.js und api/stripe.js verwendet.
// Umgebungsvariablen in Vercel:
//   RESEND_API_KEY  Schlüssel aus resend.com (API Keys)
//   MAIL_FROM       Absender, z.B. taxflix <post@deine-domain.ch> (Domain muss bei Resend bestätigt sein)
//   MAIL_KOPIE      optional: deine E-Mail. Du bekommst eine Kopie jeder Kunden-E-Mail.

global.window = global.window || {};
require("../taxcore.js");
const TX = global.window.TX;
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const env = k => process.env[k] || "";
const mailConfigured = () => !!(env("RESEND_API_KEY") && env("MAIL_FROM"));

const NAVY = rgb(11 / 255, 31 / 255, 56 / 255), ACC = rgb(20 / 255, 64 / 255, 110 / 255);
const INK = rgb(14 / 255, 26 / 255, 43 / 255), MUTED = rgb(91 / 255, 103 / 255, 120 / 255);
const LINE = rgb(217 / 255, 224 / 255, 232 / 255), SOFT = rgb(241 / 255, 244 / 255, 248 / 255), ACC_SOFT = rgb(233 / 255, 240 / 255, 248 / 255);
const OK = rgb(20 / 255, 122 / 255, 74 / 255), WARN = rgb(154 / 255, 91 / 255, 6 / 255);

// Standardschrift kennt nur Westeuropäisch (WinAnsi): andere Zeichen ersetzen
const WIN = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const clean = t => String(t == null ? "" : t).replace(/[  ]/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, c => WIN.includes(c) ? c : (c === "−" ? "-" : "?"));
const fmt = v => TX.nf.format(Math.round(v || 0));

function stand(S) {
  S = TX.rebuild(S) || S;
  return { S, R: TX.calc(S) };
}

async function buildPdf(row, opt) {
  opt = opt || {};
  const { S, R } = stand(TX.stateFromRow(row));
  const rows = TX.formRows(S, R);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Steuererklärung ${row.jahr} · ${row.kunde_name || ""}`);
  pdf.setAuthor("taxflix"); pdf.setCreator("taxflix"); pdf.setLanguage("de-CH");
  const F = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 44, CW = W - 2 * M;
  let page, y, nr = 0;
  const pages = [];

  const text = (t, x, yy, o) => {
    o = o || {}; const f = o.bold ? B : F, s = o.size || 9.5; let str = clean(t);
    if (o.max) while (str.length > 1 && f.widthOfTextAtSize(str, s) > o.max) str = str.slice(0, -2) + "…";
    const w = f.widthOfTextAtSize(str, s);
    page.drawText(str, { x: o.right ? x - w : x, y: yy, size: s, font: f, color: o.color || INK });
    return w;
  };
  const wrap = (t, f, s, max) => {
    const out = []; let line = "";
    for (const w of clean(t).split(/\s+/)) { const tr = line ? line + " " + w : w; if (f.widthOfTextAtSize(tr, s) > max && line) { out.push(line); line = w; } else line = tr; }
    if (line) out.push(line); return out;
  };
  function newPage() {
    page = pdf.addPage([W, H]); pages.push(page); nr++;
    if (nr === 1) {
      page.drawRectangle({ x: 0, y: H - 118, width: W, height: 118, color: NAVY });
      text("tax", M, H - 46, { bold: true, size: 20, color: rgb(1, 1, 1) });
      text("flix", M + B.widthOfTextAtSize("tax", 20), H - 46, { bold: true, size: 20, color: rgb(.62, .76, .92) });
      text(`Steuererklärung ${row.jahr} · Kanton Zürich`, M, H - 80, { bold: true, size: 17, color: rgb(1, 1, 1) });
      text("Ausgefülltes Formular mit allen Ziffern und Feldcodes · zur Aufbewahrung", M, H - 99, { size: 9.5, color: rgb(.78, .84, .91) });
      const chip = opt.geprueft ? "GEPRÜFT" : "VORLÄUFIG · NOCH NICHT GEPRÜFT";
      const cw = B.widthOfTextAtSize(chip, 8) + 16;
      page.drawRectangle({ x: W - M - cw, y: H - 54, width: cw, height: 18, color: opt.geprueft ? OK : rgb(.98, .95, .87), borderRadius: 3 });
      text(chip, W - M - cw + 8, H - 48, { bold: true, size: 8, color: opt.geprueft ? rgb(1, 1, 1) : WARN });
      y = H - 146;
    } else {
      text("taxflix · Steuererklärung " + row.jahr + (row.kunde_name ? " · " + row.kunde_name : ""), M, H - 34, { size: 8.5, color: MUTED });
      page.drawLine({ start: { x: M, y: H - 42 }, end: { x: W - M, y: H - 42 }, thickness: .6, color: LINE });
      y = H - 62;
    }
  }
  const need = h => { if (y - h < 58) newPage(); };
  const heading = t => { need(40); y -= 8; text(t, M, y, { bold: true, size: 12, color: ACC }); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ACC }); y -= 16; };

  newPage();

  // Angaben
  const verh = S.zivil === "verheiratet";
  const names = verh ? [S.persons[0].name, S.persons[1].name].join(" und ") : S.persons[0].name;
  const kids = (S.derived && S.derived.kids || []).map(k => k.name + (k.age != null ? ` (${k.age})` : "")).join(", ");
  const info = [
    ["Fallnummer", TX.fallNr(row)], ["Name", row.kunde_name || names], ["Personen", names], ["Zivilstand", verh ? "verheiratet" : (S.zivil || "ledig")],
    ["Kinder", kids || (S.kinder ? String(S.kinder) : "keine")],
    ["Gemeinde", (S.gemeindeName || "–") + (S.gfuss ? ` · Steuerfuss ${S.gfuss} %` : "")],
    ["Kirchensteuer", S.kfuss ? S.kfuss + " %" + (S.kircheAnteil === 0.5 ? " (halbe, eine Person Mitglied)" : "") + (S.kfussSchaetzung ? " (geschätzt)" : "") : "keine"],
    ["E-Mail", row.kunde_email || "–"],
    ["Erstellt", new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Zurich" })]
  ];
  heading("Angaben");
  for (let i = 0; i < info.length; i += 2) {
    for (let c = 0; c < 2; c++) {
      const it = info[i + c]; if (!it) continue; const x = M + c * (CW / 2);
      text(it[0], x, y, { size: 8.5, color: MUTED }); text(it[1], x + 78, y, { size: 9.5, max: CW / 2 - 86 });
    }
    y -= 16;
  }

  // Ergebnis
  y -= 6; heading("Ergebnis (Schätzung)");
  const T = R.T;
  const box = [["Steuerbares Einkommen Staat", fmt(Math.max(0, R.raw.e25s))], ["Steuerbares Einkommen Bund", fmt(Math.max(0, R.raw.e25b))], ["Steuerbares Vermögen", fmt(Math.max(0, R.raw.v35))], ["Steuern total", "CHF " + fmt(T.total)]];
  const bw = (CW - 18) / 4;
  box.forEach((b, i) => {
    const x = M + i * (bw + 6), last = i === 3;
    page.drawRectangle({ x, y: y - 34, width: bw, height: 46, color: last ? ACC : SOFT });
    text(b[0], x + 8, y - 2, { size: 7.5, color: last ? rgb(.85, .9, .96) : MUTED, max: bw - 14 });
    text(b[1], x + 8, y - 24, { bold: true, size: 13, color: last ? rgb(1, 1, 1) : INK });
  });
  y -= 52;
  const parts = [["Kantonssteuer", T.kanton], ["Gemeindesteuer", T.gemeinde], ["Kirchensteuer", T.kirche], ["Personalsteuer", T.personal], ["Direkte Bundessteuer", T.bund]];
  for (const [l, v] of parts) { if (!Math.round(v)) continue; text(l, M, y, { size: 9, color: MUTED }); text(fmt(v), M + 230, y, { size: 9, right: true }); y -= 13; }
  if (R.vst > 0) { text("Rückerstattung Verrechnungssteuer", M, y, { size: 9, color: MUTED }); text(fmt(R.vst), M + 230, y, { size: 9, right: true }); y -= 13; }

  // Formular
  y -= 8;
  const cx = { z: M, code: M + 40, l: M + 76, s: W - M - 82, b: W - M };
  const tableHead = () => {
    need(30);
    page.drawRectangle({ x: M, y: y - 6, width: CW, height: 20, color: NAVY });
    text("Ziffer", cx.z + 5, y, { bold: true, size: 8, color: rgb(1, 1, 1) });
    text("Code", cx.code, y, { bold: true, size: 8, color: rgb(1, 1, 1) });
    text("Bezeichnung", cx.l, y, { bold: true, size: 8, color: rgb(1, 1, 1) });
    text("Staat/Gemeinde", cx.s - 4, y, { bold: true, size: 8, color: rgb(1, 1, 1), right: true });
    text("Bund", cx.b - 5, y, { bold: true, size: 8, color: rgb(1, 1, 1), right: true });
    y -= 22;
  };
  heading("Steuererklärung · Ziffern und Feldcodes");
  text("Leere Zeilen sind ausgelassen. Beträge in CHF, gerundet. Bei Vermögen gibt es keine Bundessteuer.", M, y, { size: 8.5, color: MUTED }); y -= 16;
  tableHead();
  const has = r => Math.round(r.s || 0) || Math.round(r.b || 0);
  rows.forEach((r, i) => {
    if (r.kind === "page") {
      need(40); y -= 4; text(r.l, M, y, { bold: true, size: 9.5, color: ACC }); y -= 15; return;
    }
    if (r.kind === "head") {
      const kids = []; for (let j = i + 1; j < rows.length && rows[j].kind === "wert" && rows[j].sub; j++) kids.push(rows[j]);
      if (!kids.some(has)) return;
      need(30); text(r.z, cx.z + 5, y, { bold: true, size: 9, color: ACC }); text(r.l, cx.l, y, { bold: true, size: 9, max: cx.s - cx.l - 70 }); y -= 14; return;
    }
    if (r.kind === "wert" && !has(r)) return;
    const strong = r.kind === "summe" || r.kind === "total";
    const lines = wrap(r.l, strong ? B : F, 9, cx.s - cx.l - 74);
    const noteLines = r.note ? wrap(r.note, F, 7.5, cx.s - cx.l - 74) : [];
    const h = lines.length * 11 + noteLines.length * 9.5 + 6;
    need(h + 4);
    if (r.kind === "total") page.drawRectangle({ x: M, y: y - h + 9, width: CW, height: h + 2, color: ACC_SOFT });
    else if (r.kind === "summe") page.drawRectangle({ x: M, y: y - h + 9, width: CW, height: h + 2, color: SOFT });
    text(r.z, cx.z + 5, y, { size: 9, color: ACC, bold: strong });
    if (r.code != null) text(String(r.code), cx.code, y, { size: 9, color: INK, bold: true });
    let ly = y;
    lines.forEach(l => { text(l, cx.l + (r.sub ? 0 : 0), ly, { size: 9, bold: strong }); ly -= 11; });
    noteLines.forEach(l => { text(l, cx.l, ly + 1, { size: 7.5, color: MUTED }); ly -= 9.5; });
    text(Math.round(r.s || 0) ? fmt(r.s) : "–", cx.s - 4, y, { size: 9, bold: strong, right: true });
    text(r.staat ? "" : (Math.round(r.b || 0) ? fmt(r.b) : "–"), cx.b - 5, y, { size: 9, bold: strong, right: true });
    y -= h;
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: .4, color: LINE });
    y -= 4;
  });

  // Belege
  const docs = (S.docs || []).filter(d => d.status !== "fehler" || d.path);
  if (docs.length) {
    y -= 6; heading(`Eingereichte Belege (${docs.length})`);
    for (const d of docs) {
      need(14);
      text(TX.typeName(d.type), M, y, { size: 9, bold: true, max: 170 });
      text(d.name, M + 180, y, { size: 9, color: MUTED, max: CW - 180 }); y -= 13;
    }
  }

  // Hinweis
  y -= 10; need(70);
  const hinweis = (opt.geprueft
    ? "Diese Aufstellung wurde von taxflix geprüft. "
    : "Diese Aufstellung beruht auf Ihren Belegen und ist noch nicht geprüft. Nach der Prüfung erhalten Sie die definitive Fassung. ")
    + "Sie dient Ihrer Aufbewahrung und ersetzt nicht das amtliche Formular. Massgebend sind die beim Kantonalen Steueramt Zürich eingereichte Steuererklärung und die Veranlagung. Die Steuerbeträge sind eine Schätzung ohne Gewähr. taxflix ist kein Angebot des Kantonalen Steueramts Zürich.";
  const hl = wrap(hinweis, F, 8.5, CW - 24);
  page.drawRectangle({ x: M, y: y - hl.length * 11.5 + 2, width: CW, height: hl.length * 11.5 + 14, color: SOFT });
  hl.forEach(l => { text(l, M + 12, y - 4, { size: 8.5, color: MUTED }); y -= 11.5; });

  pages.forEach((p, i) => {
    const t = `Seite ${i + 1} von ${pages.length}`;
    p.drawText(t, { x: W - M - F.widthOfTextAtSize(t, 8), y: 28, size: 8, font: F, color: MUTED });
    p.drawText("taxflix · Steuererklärung Kanton Zürich", { x: M, y: 28, size: 8, font: F, color: MUTED });
  });
  return { bytes: await pdf.save(), total: T.total };
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function sendFormular(row, opt) {
  opt = opt || {};
  if (!mailConfigured()) throw new Error("mail_not_configured");
  if (!row.kunde_email) throw new Error("no_email");
  const { bytes } = await buildPdf(row, opt);
  const vorname = String(row.kunde_name || "").trim().split(/\s+/)[0];
  const subject = (opt.geprueft ? `Ihre geprüfte Steuererklärung ${row.jahr}` : `Ihre Steuererklärung ${row.jahr} · Bestätigung`) + ` (${TX.fallNr(row)})`;
  const intro = opt.geprueft
    ? `wir haben Ihre Belege geprüft. Im Anhang finden Sie Ihre Steuererklärung ${row.jahr} mit allen Ziffern und Feldcodes.`
    : `vielen Dank für Ihre Zahlung. Im Anhang finden Sie Ihre ausgefüllte Steuererklärung ${row.jahr} mit allen Ziffern und Feldcodes. Wir prüfen jetzt Ihre Belege und melden uns, falls etwas fehlt.`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f5f7fa;font-family:Helvetica,Arial,sans-serif;color:#0e1a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #d9e0e8;border-radius:10px">
<tr><td style="background:#0b1f38;padding:20px 26px;border-radius:10px 10px 0 0;font-size:20px;font-weight:700;color:#fff">tax<span style="color:#9ec2eb">flix</span></td></tr>
<tr><td style="padding:26px;font-size:15px;line-height:1.55">
<p style="margin:0 0 14px">Guten Tag${vorname ? " " + esc(vorname) : ""}</p>
<p style="margin:0 0 14px">${esc(intro)}</p>
<p style="margin:0 0 14px">Bitte bewahren Sie das PDF zusammen mit Ihren Belegen auf. Es ersetzt nicht das amtliche Formular. Massgebend ist die Veranlagung des Steueramts.</p>
<p style="margin:0">Freundliche Grüsse<br>taxflix</p>
</td></tr>
<tr><td style="padding:14px 26px;border-top:1px solid #e8edf2;font-size:12px;color:#5b6778">taxflix · Kein Angebot des Kantonalen Steueramts Zürich</td></tr>
</table></td></tr></table></body></html>`;
  const safeName = String(row.kunde_name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  const payload = {
    from: env("MAIL_FROM"), to: [row.kunde_email], subject, html,
    text: `Guten Tag${vorname ? " " + vorname : ""}\n\n${intro}\n\nBitte bewahren Sie das PDF zusammen mit Ihren Belegen auf. Es ersetzt nicht das amtliche Formular.\n\nFreundliche Grüsse\ntaxflix`,
    attachments: [{ filename: `Steuererklaerung-${row.jahr}${safeName ? "-" + safeName : ""}.pdf`, content: Buffer.from(bytes).toString("base64") }]
  };
  if (env("MAIL_KOPIE")) payload.bcc = [env("MAIL_KOPIE")];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  if (!r.ok) { console.error("Resend", r.status, await r.text().catch(() => "")); throw new Error("mail"); }
  return true;
}

module.exports = { buildPdf, sendFormular, mailConfigured, TX };
