// taxflix: Prüfung der Steuerberechnung. Ausführen mit: node tests/rechnen.test.js
// Alle Sollwerte stammen aus amtlichen Quellen (siehe Kommentare) oder werden von Hand nachgerechnet.
global.window = {};
require("../taxcore.js");
const TX = window.TX;
let ok = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.005 : tol);
function check(name, got, want, tol) {
  if (near(got, want, tol)) ok++;
  else { fail++; console.log("FEHLER  " + name + ": erhalten " + got + ", erwartet " + want); }
}
function truthy(name, cond) { if (cond) ok++; else { fail++; console.log("FEHLER  " + name); } }

/* 1. Bundessteuer-Tarif Art. 36 DBG (ESTV 2-210-D-2024 für 2025, 2-216-D-2025 für 2026) */
const OFFIZIELL = {
  2025: { single: [[15200,0],[33200,138.60],[43500,229.20],[58000,612.00],[76100,1149.55],[82000,1500.00],[108800,3268.80],[141500,6146.40],[184900,10920.40],[793300,91229.20],[793400,91241.00]],
          verh: [[29700,0],[53400,237],[61300,395],[79100,929],[94900,1561],[108600,2246],[120500,2960],[130500,3660],[138300,4284],[144200,4815],[148200,5215],[150300,5446],[152300,5686],[940800,108191],[940900,108203.50]] },
  2026: { single: [[15200,0],[33200,138.60],[43500,229.20],[58000,612.00],[76200,1152.50],[82100,1502.95],[108900,3271.75],[141500,6140.55],[185100,10936.55],[793900,91298.15],[794000,91310.00]],
          verh: [[29700,0],[53400,237],[61300,395],[79100,929],[94900,1561],[108700,2251],[120600,2965],[130500,3658],[138400,4290],[144300,4821],[148300,5221],[150400,5452],[152400,5692],[941300,108249],[941400,108261]] }
};
for (const y of [2025, 2026]) for (const t of ["single", "verh"])
  for (const [inc, tax] of OFFIZIELL[y][t]) check(`Bund ${y} ${t} bei ${inc}`, TX.bundTarif(inc, t === "verh", y), tax, 0.01);
check("Bund 2025 alleinstehend 100'000 (76'100 + 23'900: 1'149.55 + 239 × 5.94 → 82'000: 1'500 + 180 × 6.60)", TX.bundTarif(100000, false, 2025), 1500 + 180 * 6.60, 0.01);
check("Bund 2026 verheiratet 1'000'000 (11.5 %)", TX.bundTarif(1000000, true, 2026), 115000, 0.01);
// Steigt nie, wenn das Einkommen steigt
for (const y of [2025, 2026]) for (const v of [false, true]) {
  let prev = -1, mono = true;
  for (let i = 0; i <= 1200000; i += 100) { const t = TX.bundTarif(i, v, y); if (t < prev - 0.001) { mono = false; break; } prev = t; }
  truthy(`Bund ${y} ${v ? "verh" : "single"} steigt nie bei höherem Einkommen`, mono);
}

/* 2. Staatssteuer Kanton Zürich: Tarif § 35 und § 47 StG (Fassung ab Steuerperiode 2026, zhlex LS 631.1) */
function einfach(S, stE, verm) { return TX.taxes(S, stE, stE, verm); }
function state(year, zivil, kinder) { const S = TX.emptyState(year); S.zivil = zivil; S.kinder = kinder || 0; S.gfuss = 100; S.kfuss = 0; return S; }
// Grundtarif 2026, steuerbar 100'000: 0 + 100 + 144 + 320 + 485 + 672 + 917 + 1'408 + 23'600 × 9 % = 6'170
check("ZH 2026 Grundtarif 100'000", einfach(state(2026, "ledig"), 100000, 0).einfE, 6170);
// Verheiratetentarif 2026, steuerbar 100'000: 0 + 128 + 243 + 392 + 560 + 870 + 2'254 + (100'000 − 96'300) × 8 % = 4'743
check("ZH 2026 Verheiratetentarif 100'000", einfach(state(2026, "verheiratet"), 100000, 0).einfE, 128 + 243 + 392 + 560 + 870 + 2254 + 3700 * 0.08);
// Alleinerziehend: Verheiratetentarif (§ 35 Abs. 2 StG)
check("ZH 2026 alleinerziehend = Verheiratetentarif", einfach(state(2026, "ledig", 1), 100000, 0).einfE, einfach(state(2026, "verheiratet"), 100000, 0).einfE);
// Vermögen 2026 Grundtarif, 500'000: 81'000 frei, 241'000 × 0.5 ‰ = 120.50, 178'000 × 1 ‰ = 178 → 298.50
check("ZH 2026 Vermögen Grundtarif 500'000", einfach(state(2026, "ledig"), 0, 500000).einfV, 298.5);
// Staatssteuerfuss 2025: 98 %, 2026: 95 % (zh.ch, Aktuelle Gemeindesteuerfüsse)
check("Staatssteuerfuss 2025", TX.ZH[2025].kfuss, 98); check("Staatssteuerfuss 2026", TX.ZH[2026].kfuss, 95);
// Personalsteuer 24 Franken pro Person (§ 200 StG, ESTV Steuermäppchen 2025)
check("Personalsteuer verheiratet", einfach(state(2026, "verheiratet"), 0, 0).personal, 48);
// Kirchensteuer: nur eine Person Mitglied → die Hälfte (§ 202 Abs. 2 StG, ZStB 201.1)
{ const S = state(2026, "verheiratet"); S.kfuss = 10; S.kircheAnteil = 0.5; const T = TX.taxes(S, 100000, 100000, 0); check("Kirchensteuer halb", T.kirche, T.einf * 0.10 * 0.5); }
// Bundessteuer unter 25 Franken wird nicht erhoben (Art. 36 Abs. 3 DBG), Elterntarif 263 je Kind
check("Bund unter 25 Franken = 0", TX.taxes(state(2026, "ledig"), 0, 16000, 0).bund, 0);
{ const S = state(2026, "verheiratet", 2); check("Elterntarif 2 Kinder", TX.taxes(S, 0, 120000, 0).bund, TX.bundTarif(120000, true, 2026) - 2 * 263, 0.01); }

/* 3. Ganze Berechnung mit Belegen: jeder Abzug nach Regel */
function fall(year, opts) {
  const S = TX.emptyState(year);
  S.zivil = opts.verh ? "verheiratet" : "ledig"; S.kinder = opts.kinder || 0; S.kinderU14 = opts.u14 || 0; S.gfuss = 100; S.kfuss = 0;
  S.persons[0] = Object.assign(S.persons[0], { name: "A", pk: true, weg: "keine", tage: 220, verpflegung: "voll", geschaeftsauto: false }, opts.p0 || {});
  S.persons[1] = Object.assign(S.persons[1], { name: "B", pk: true, weg: "keine", tage: 220, verpflegung: "voll", geschaeftsauto: false }, opts.p1 || {});
  S.overrides = Object.assign(S.overrides || {}, opts.O || {});
  S.items = (opts.items || []).map(([key, person, amount], i) => ({ id: "i" + i, key, person, amount }));
  return { S, R: TX.calc(S) };
}
const row = (R, z, p) => R.rows.find(r => r.z === z && (p === undefined || r.p === p)) || { s: 0, b: 0 };
// Berufsauslagen: Verpflegung 3'200, übrige 3 % (min 2'000, max 4'000), ÖV-Abo
{ const { R } = fall(2025, { p0: { weg: "oev" }, items: [["nettolohn", 0, 80000], ["oev_abo", 0, 2100]] });
  check("Berufsauslagen 80'000 Staat", row(R, "11.1").s, 2100 + 3200 + 2400); }
// Fahrkosten Auto: Staat max 5'200, Bund max 3'300; Bund 2026 0.75 / km
{ const { R } = fall(2026, { p0: { weg: "auto", km: 30, tage: 220 }, items: [["nettolohn", 0, 100000]] });
  const x = R.P[0]; check("Fahrkosten Staat begrenzt 5'200", x.fahrS, 5200); check("Fahrkosten Bund begrenzt 3'300", x.fahrB, 3300); }
// Versicherungsabzug Staat 2'900 ledig, ×1.5 ohne 2. Säule/3a; Bund 1'800 bzw. 2'700
{ const { R } = fall(2025, { items: [["nettolohn", 0, 60000], ["krankenkasse_praemien", "g", 9000]] });
  check("Versicherung Staat ledig mit PK", row(R, "15").s, 2900); check("Versicherung Bund ledig mit PK", row(R, "15").b, 1800); }
{ const { R } = fall(2025, { p0: { pk: false }, items: [["nettolohn", 0, 60000], ["krankenkasse_praemien", "g", 9000]] });
  check("Versicherung Staat ledig ohne Vorsorge", row(R, "15").s, 4350); check("Versicherung Bund ledig ohne Vorsorge", row(R, "15").b, 2700); }
{ const { R } = fall(2026, { verh: true, kinder: 2, items: [["nettolohn", 0, 90000], ["nettolohn", 1, 50000], ["krankenkasse_praemien", "g", 20000]] });
  check("Versicherung Staat verheiratet 2 Kinder", row(R, "15").s, 5800 + 2 * 1300); check("Versicherung Bund verheiratet 2 Kinder", row(R, "15").b, 3700 + 2 * 700); }
// Zweiverdienerabzug: vom tieferen Erwerbseinkommen nach Berufsauslagen (Art. 33 Abs. 2 DBG)
{ const { R } = fall(2025, { verh: true, items: [["nettolohn", 0, 90000], ["nettolohn", 1, 20000]] });
  const x = R.P[1], netB = 20000 - (x.fahrB + x.verpf + x.uebrige);
  check("Zweiverdiener Staat 6'100", row(R, "17").s, 6100);
  check("Zweiverdiener Bund: 50 % vom Nettoerwerb, min 8'600", row(R, "17").b, netB < 8600 ? netB : Math.min(14100, Math.max(8600, netB * 0.5))); }
// Säule 3a: höchstens 7'258 mit Pensionskasse
{ const { R } = fall(2025, { items: [["nettolohn", 0, 80000], ["saeule3a", 0, 9000]] }); check("Säule 3a begrenzt", row(R, "14.1").s, 7258); }
// Spenden: Staat 20 % des Nettoeinkommens, Bund 20 % nach Krankheitskosten
{ const { R } = fall(2025, { items: [["nettolohn", 0, 30000], ["spenden", "g", 20000], ["krankheitskosten", "g", 5000]] });
  const n = row(R, "21"), k = row(R, "22.1");
  check("Spenden Staat Grenze", row(R, "22.2").s, n.s * 0.2); check("Spenden Bund Grenze", row(R, "22.2").b, (n.b - k.b) * 0.2);
  check("Krankheitskosten Selbstbehalt 5 % Staat", k.s, 5000 - n.s * 0.05); }
{ const { R } = fall(2025, { items: [["nettolohn", 0, 60000], ["spenden", "g", 90]] }); check("Spenden unter 100 nicht abzugsfähig", row(R, "22.2").s, 0); }
// Liegenschaft Pauschale: Staat 20 %, Bund 10 % bei Gebäuden bis 10 Jahre
{ const { R } = fall(2025, { O: { liegJung: true }, items: [["nettolohn", 0, 80000], ["eigenmietwert", "g", 20000]] });
  check("Liegenschaft Staat 20 %", row(R, "6").s, 16000); check("Liegenschaft Bund 10 % (jung)", row(R, "6").b, 18000); }
// Kinder: Staat 9'300 (2025) / 9'400 (2026), Bund 6'800; Betreuung nur unter 14
{ const { R } = fall(2026, { kinder: 1, u14: 1, items: [["nettolohn", 0, 80000], ["kinderbetreuung", "g", 30000]] });
  check("Kinderabzug Staat 2026", row(R, "24.1").s, 9400); check("Kinderabzug Bund", row(R, "24.1").b, 6800);
  check("Betreuung Staat 2026 max 25'300", row(R, "16.6").s, 25300); check("Betreuung Bund max 25'800", row(R, "16.6").b, 25800); }
// Rundung: steuerbares Einkommen auf 100, Vermögen auf 1000 abgerundet
{ const { R } = fall(2025, { items: [["nettolohn", 0, 80055], ["bankguthaben", "g", 123456]] });
  truthy("Einkommen auf 100 abgerundet", R.stE % 100 === 0 && R.stB % 100 === 0); truthy("Vermögen auf 1000 abgerundet", R.verm % 1000 === 0); }
// Nichts wird negativ
{ const { R } = fall(2025, { items: [["nettolohn", 0, 5000], ["schuldzinsen", "g", 90000], ["schulden", "g", 900000]] });
  truthy("keine negativen Steuern", R.T.total >= 0 && R.stE >= 0 && R.stB >= 0 && R.verm >= 0); }

/* 4. Regel Lohnausweis: Feld F nicht angekreuzt und keine ÖV-Quittung → Fahrkosten-Pauschale 700 */
function mitBelegen(docs) {
  const S = TX.emptyState(2025);
  S.docs = docs.map((r, i) => ({ id: "d" + i, name: "b" + i, type: r.dokumenttyp, status: "fertig", result: r, edits: {} }));
  TX.rebuild(S); return { S, R: TX.calc(S) };
}
const lohn = (F) => ({ dokumenttyp: "lohnausweis", jahr: 2025, inhaber: { vorname: "Anna", nachname: "Meier" }, personen: [], lohnausweis: { gratis_transport: F, kantine: false, geschaeftsauto: false, pk_beitraege: 5000 }, positionen: [{ key: "nettolohn", betrag: 80000 }] });
{ const { S, R } = mitBelegen([lohn(false)]); check("Feld F leer, kein ÖV → Pauschale Staat", R.P[0].fahrS, 700); check("… und Bund", R.P[0].fahrB, 700);
  truthy("keine Frage zum Arbeitsweg", !S.derived.questions.some(q => q.id.startsWith("weg"))); }
{ const { R } = mitBelegen([lohn(true)]); check("Feld F angekreuzt → keine Fahrkosten", R.P[0].fahrS, 0); }
{ const { R } = mitBelegen([lohn(false), { dokumenttyp: "oev", jahr: 2025, inhaber: { vorname: "Anna", nachname: "Meier" }, personen: [], positionen: [{ key: "oev_abo", betrag: 2100 }] }]);
  check("ÖV-Quittung → effektive Abokosten", R.P[0].fahrS, 2100); }

console.log(`\n${ok} Prüfungen bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
