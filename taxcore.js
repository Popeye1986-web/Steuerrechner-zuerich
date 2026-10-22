// taxflix Rechenkern: Tarife, Positionen, Belegliste, Speichern und Steuerberechnung.
// Wird von upload.html und ergebnis.html gemeinsam verwendet.
window.TX = (function () {
  "use strict";
  const INF = Infinity;

  /* ---------- Tarife und Abzüge ---------- */
  // Quellen (amtlich):
  // - Staatssteuer 2026: Steuergesetz ZH LS 631.1 §§ 26, 31, 34, 35, 47 (zhlex, Fassung ab 2026) und ESTV-Kantonsblatt ZH (Stand Feb. 2026)
  // - Staatssteuer 2025: Quellensteuer-Grundlagen KStA ZH 2025 (Abzüge), Wegleitung ZH 2025 (Berufsauslagen)
  //   Noch NICHT amtlich bestätigt: Tarifstufen 2025 und Drittbetreuung 2025 (25'000), siehe tests/rechnen.test.js
  // - Staatssteuerfuss: zh.ch «Aktuelle Gemeindesteuerfüsse» (2025: 98 %, 2026: 95 %)
  // - Bund: ESTV-Rundschreiben 2-210-D-2024 (2025), 2-216-D-2025 und 2-215-D-2025 (2026), Medienmitteilung EFD 11.9.2025
  const ZH = {
    2025: { kfuss: 98, kmAuto: .70,
      grund: [[6900,0],[4900,2],[4800,3],[7900,4],[9600,5],[11000,6],[12900,7],[17400,8],[33600,9],[33200,10],[52700,11],[68400,12],[INF,13]],
      verh: [[13900,0],[6300,2],[8000,3],[9700,4],[11100,5],[14300,6],[31800,7],[31900,8],[47900,9],[57200,10],[62100,11],[71600,12],[INF,13]],
      vgrund: [[80000,0],[238000,.5],[399000,1],[636000,1.5],[956000,2],[953000,2.5],[INF,3]],
      vverh: [[159000,0],[239000,.5],[397000,1],[637000,1.5],[955000,2],[955000,2.5],[INF,3]],
      kinder: 9300, zweiverd: 6100, betreuung: 25000, weiterb: 12400, fahrMax: 5200, vers: { single: 2900, verh: 5800, kind: 1300 } },
    2026: { kfuss: 95, kmAuto: .70,
      grund: [[7000,0],[5000,2],[4800,3],[8000,4],[9700,5],[11200,6],[13100,7],[17600,8],[34000,9],[33700,10],[53300,11],[69300,12],[INF,13]],
      verh: [[14100,0],[6400,2],[8100,3],[9800,4],[11200,5],[14500,6],[32200,7],[32400,8],[48500,9],[57900,10],[62900,11],[72600,12],[INF,13]],
      vgrund: [[81000,0],[241000,.5],[404000,1],[645000,1.5],[968000,2],[965000,2.5],[INF,3]],
      vverh: [[161000,0],[242000,.5],[402000,1],[646000,1.5],[967000,2],[967000,2.5],[INF,3]],
      kinder: 9400, zweiverd: 6200, betreuung: 25300, weiterb: 12600, fahrMax: 5200, vers: { single: 2900, verh: 5800, kind: 1300 } }
  };
  // Direkte Bundessteuer, Tarif Art. 36 DBG. Quelle: ESTV-Rundschreiben 2-210-D-2024 (Steuerjahr 2025)
  // und 2-216-D-2025 (Steuerjahr 2026). Pro Zeile: ab Einkommen, Steuer bei dieser Schwelle, Zuschlag je weitere 100 Franken.
  const BUND_TARIF = {
    2025: {
      single: [[15200,0,.77],[33200,138.60,.88],[43500,229.20,2.64],[58000,612.00,2.97],[76100,1149.55,5.94],[82000,1500.00,6.60],[108800,3268.80,8.80],[141500,6146.40,11.00],[184900,10920.40,13.20]], singleFlat: 793400,
      verh: [[29700,0,1],[53400,237,2],[61300,395,3],[79100,929,4],[94900,1561,5],[108600,2246,6],[120500,2960,7],[130500,3660,8],[138300,4284,9],[144200,4815,10],[148200,5215,11],[150300,5446,12],[152300,5686,13]], verhFlat: 940900 },
    2026: {
      single: [[15200,0,.77],[33200,138.60,.88],[43500,229.20,2.64],[58000,612.00,2.97],[76200,1152.50,5.94],[82100,1502.95,6.60],[108900,3271.75,8.80],[141500,6140.55,11.00],[185100,10936.55,13.20]], singleFlat: 794000,
      verh: [[29700,0,1],[53400,237,2],[61300,395,3],[79100,929,4],[94900,1561,5],[108700,2251,6],[120600,2965,7],[130500,3658,8],[138400,4290,9],[144300,4821,10],[148300,5221,11],[150400,5452,12],[152400,5692,13]], verhFlat: 941400 }
  };
  // Abzüge direkte Bundessteuer 2025 und 2026 (unverändert gemäss ESTV, ausser Autokilometer 2026: 0.75)
  const BUND = {
    kmAuto: { 2025: .70, 2026: .75 }, fahrMax: 3300, kinder: 6800, verhAbzug: 2800, eltern: 263, betreuung: 25800, weiterb: 13000,
    vers: { verhMit: 3700, verhOhne: 5550, mit: 1800, ohne: 2700, kind: 700 }, zwMin: 8600, zwMax: 14100
  };
  const S3A_PK = 7258, S3A_OHNE = 36288, PERSONALSTEUER = 24;
  const GEMEINDEN = [
    { id: "zuerich", name: "Zürich (Stadt)", fuss: 119 },
    { id: "uster", name: "Uster", fuss: 94 },
    { id: "illnau", name: "Illnau-Effretikon", fuss: 113 },
    { id: "andere", name: "Andere Gemeinde", fuss: null }
  ];

  /* ---------- Positionen mit Ziffern des Formulars ---------- */
  const KEYS = {
    nettolohn: { l: "Nettolohn (Lohnausweis Ziffer 11)", z: "1.1", p: true },
    nebenerwerb: { l: "Nebenerwerb netto", z: "1.2", p: true },
    selbstaendig: { l: "Einkommen selbständige Tätigkeit", z: "2.1", p: true },
    ahv_rente: { l: "AHV-/IV-Rente", z: "3.1", p: true },
    pk_rente: { l: "Rente / Pension 2. Säule", z: "3.2", p: true },
    alv: { l: "Arbeitslosenentschädigung", z: "3.3", p: true },
    taggelder: { l: "Taggelder, Mutterschaft, Kinderzulagen (separat bezahlt)", z: "3.4", p: true },
    wertschriftenertrag: { l: "Ertrag Wertschriften und Guthaben (brutto)", z: "4.1", p: false },
    unterhalt_erhalten: { l: "Erhaltene Unterhaltsbeiträge", z: "5.1", p: false },
    uebrige_einkuenfte: { l: "Weitere Einkünfte", z: "5.4", p: false },
    eigenmietwert: { l: "Eigenmietwert", z: "6", p: false },
    mietertrag: { l: "Mietertrag", z: "6", p: false },
    liegenschaft_unterhalt: { l: "Unterhaltskosten Liegenschaft (effektiv)", z: "6", p: false },
    oev_abo: { l: "Kosten ÖV-Abo Arbeitsweg", z: "11", p: true },
    schuldzinsen: { l: "Bezahlte Schuldzinsen", z: "12", p: false },
    unterhalt_bezahlt: { l: "Bezahlte Unterhaltsbeiträge", z: "13.1", p: false },
    saeule3a: { l: "Einzahlung Säule 3a", z: "14", p: true },
    krankenkasse_praemien: { l: "Krankenkassenprämien (nach Verbilligung)", z: "15", p: false },
    versicherung_uebrige: { l: "Übrige Versicherungsprämien, Sparzinsen", z: "15", p: false },
    pk_einkauf: { l: "Einkauf Pensionskasse", z: "16.1", p: true },
    weiterbildung: { l: "Berufsorientierte Weiterbildung", z: "16.2", p: true },
    kinderbetreuung: { l: "Kosten Kinderdrittbetreuung", z: "16.6", p: false },
    krankheitskosten: { l: "Selbst bezahlte Krankheitskosten", z: "22.1", p: false },
    spenden: { l: "Spenden an gemeinnützige Institutionen", z: "22.2", p: false },
    bankguthaben: { l: "Bank- und Postguthaben per 31.12.", z: "30.1", p: false },
    wertschriften_wert: { l: "Wertschriften, Steuerwert per 31.12.", z: "30.1", p: false },
    bargeld: { l: "Bargeld, Gold, Edelmetalle", z: "30.2", p: false },
    lebensversicherung: { l: "Lebensversicherungen (Rückkaufswert)", z: "30.3", p: false },
    fahrzeuge: { l: "Motorfahrzeuge", z: "30.4", p: false },
    uebriges_vermoegen: { l: "Übrige Vermögenswerte", z: "30.6", p: false },
    liegenschaft_steuerwert: { l: "Liegenschaften (Steuerwert)", z: "31.1", p: false },
    schulden: { l: "Schulden per 31.12. (Hypotheken, Kredite)", z: "34", p: false },
    verrechnungssteuer: { l: "Verrechnungssteuer (Rückforderung)", z: "WV", p: false }
  };

  /* ---------- Belegliste ---------- */
  // need(S) entscheidet, ob ein Beleg für diesen Haushalt nötig ist. perPerson: eine Zeile pro Person.
  const DOCTYPES = [
    { id: "lohnausweis", name: "Lohnausweis", why: "Nettolohn und Grundlage für die Berufsauslagen.", keys: ["nettolohn"], perPerson: true,
      need: (S, p) => S.sit.angestellt[p] },
    { id: "bank", name: "Bank- und Depotauszüge per 31.12. oder eSteuerauszug", why: "Guthaben, Wertschriften, Zinsen und Dividenden. Ein eSteuerauszug der Bank enthält alles auf einmal.", keys: ["bankguthaben", "wertschriften_wert", "wertschriftenertrag", "verrechnungssteuer"],
      need: () => true },
    { id: "krankenkasse", name: "Prämienbescheinigung Krankenkasse", why: "Bezahlte Prämien für Grund- und Zusatzversicherung.", keys: ["krankenkasse_praemien", "versicherung_uebrige"],
      need: () => true },
    { id: "saeule3a", name: "Bescheinigung Säule 3a", why: "Einzahlungen des Jahres sind abzugsfähig.", keys: ["saeule3a"], perPerson: true,
      need: (S, p) => S.sit.saeule3a[p] },
    { id: "oev", name: "Quittung ÖV-Abo", why: "Fahrkosten zur Arbeit.", keys: ["oev_abo"], perPerson: true,
      need: (S, p) => S.sit.angestellt[p] && S.persons[p].weg === "oev" },
    { id: "pk_einkauf", name: "Bestätigung Einkauf Pensionskasse", why: "Freiwillige Einkäufe sind voll abzugsfähig.", keys: ["pk_einkauf"], perPerson: true,
      need: (S, p) => S.sit.pkEinkauf[p] },
    { id: "rente", name: "Rentenbescheinigung AHV / Pensionskasse", why: "Renten sind steuerbares Einkommen.", keys: ["ahv_rente", "pk_rente"], perPerson: true,
      need: (S, p) => S.sit.rente[p] },
    { id: "taggeld", name: "Bescheinigung Arbeitslosenkasse, Taggelder, Mutterschaft", why: "Ersatzeinkommen, das nicht im Lohnausweis steht.", keys: ["alv", "taggelder"], perPerson: true,
      need: (S, p) => S.sit.taggeld[p] },
    { id: "selbst", name: "Jahresrechnung selbständige Tätigkeit", why: "Bilanz und Erfolgsrechnung, Gewinn des Jahres.", keys: ["selbstaendig"], perPerson: true,
      need: (S, p) => S.sit.selbst[p] },
    { id: "kita", name: "Rechnungen Kita, Hort, Tagesfamilie", why: "Kinderdrittbetreuung für Kinder unter 14.", keys: ["kinderbetreuung"],
      need: S => S.kinderU14 > 0 && S.sit.kita },
    { id: "liegenschaft", name: "Eigenmietwert, Mieterträge, Unterhaltskosten", why: "Einschätzungsentscheid bzw. Liegenschaftenverzeichnis.", keys: ["eigenmietwert", "mietertrag", "liegenschaft_unterhalt", "liegenschaft_steuerwert"],
      need: S => S.sit.liegenschaft },
    { id: "hypothek", name: "Zinsausweis Hypothek oder Kredit", why: "Schuldzinsen sind abzugsfähig, Schulden mindern das Vermögen.", keys: ["schuldzinsen", "schulden"],
      need: S => S.sit.liegenschaft || S.sit.kredit },
    { id: "spenden", name: "Spendenbescheinigungen", why: "Ab CHF 100 pro Jahr abzugsfähig.", keys: ["spenden"],
      need: S => S.sit.spenden },
    { id: "weiterbildung", name: "Belege Weiterbildung", why: "Kurs- und Prüfungskosten.", keys: ["weiterbildung"], perPerson: true,
      need: (S, p) => S.sit.weiterbildung[p] },
    { id: "krankheit", name: "Arzt-, Zahnarzt- und Spitalrechnungen", why: "Selbst bezahlte Kosten über 5 % des Nettoeinkommens.", keys: ["krankheitskosten"],
      need: S => S.sit.krankheit },
    { id: "unterhalt", name: "Belege Unterhaltsbeiträge", why: "Bezahlte oder erhaltene Alimente.", keys: ["unterhalt_bezahlt", "unterhalt_erhalten"],
      need: S => S.sit.unterhalt },
    { id: "steuerrechnung", name: "Letzte Steuerrechnung oder Veranlagung", why: "Zivilstand, Gemeinde, Steuerfuss und Konfession.", keys: [],
      need: () => false, optional: true },
    { id: "steuererklaerung", name: "Steuererklärung Vorjahr (Seite 1 Personalien)", why: "Personen, Kinder, Zivilstand, Gemeinde und Konfession.", keys: [],
      need: () => false, optional: true },
    { id: "sonstiges", name: "Weiteres Vermögen und weitere Einkünfte", why: "Bargeld, Fahrzeuge, Lebensversicherungen, Nebenerwerb. Nur ausfüllen, wenn vorhanden.", keys: ["nebenerwerb", "uebrige_einkuenfte", "bargeld", "fahrzeuge", "lebensversicherung", "uebriges_vermoegen"],
      need: () => false, optional: true }
  ];

  /* ---------- Zustand ---------- */
  const STORE = "taxflix-v2";
  const uid = () => Math.random().toString(36).slice(2, 10);
  const blankPerson = n => ({ name: "Person " + n, pk: true, weg: "oev", km: 0, tage: 220, verpflegung: "voll", geschaeftsauto: false });
  const pair = v => [v, v];
  function emptyState(year) {
    return { v: 2, year: year || 2025, zivil: "ledig", kinder: 0, kinderU14: 0, gemeinde: "zuerich", gfuss: 119, kfuss: 0,
      persons: [blankPerson(1), blankPerson(2)],
      sit: { angestellt: [true, true], selbst: pair(false), rente: pair(false), taggeld: pair(false), saeule3a: [true, true], pkEinkauf: pair(false),
        weiterbildung: pair(false), kita: true, liegenschaft: false, kredit: false, spenden: false, krankheit: false, unterhalt: false },
      overrides: { persons: [{}, {}], ausbildung: {} }, na: {}, docs: [], items: [] };
  }
  function normalize(st) {
    if (!st || !st.persons) return null;
    const base = emptyState(st.year);
    const out = Object.assign(base, st);
    out.sit = Object.assign(base.sit, st.sit || {});
    out.na = st.na || {};
    out.items = (st.items || []).filter(i => KEYS[i.key]);
    out.docs = (st.docs || []).map(d => (d.status === "lesen" || d.status === "wartet") ? Object.assign({}, d, { status: "fehler", error: "Unterbrochen. Bitte erneut auslesen oder Werte eingeben." }) : d);
    delete out.example;
    out.v = 2;
    return out;
  }

  const CLOUD = { user: null, timer: null };
  async function loadState() {
    if (window.SP && SP.configured && SP.client) {
      CLOUD.user = await SP.requireUser();
      try { localStorage.removeItem(STORE); } catch (_) {}
      const d = await SP.load();
      return { state: normalize(d) || emptyState(), user: CLOUD.user };
    }
    let d = null;
    try { d = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (_) {}
    return { state: normalize(d) || emptyState(), user: null };
  }
  function saveState(S, onStatus) {
    const status = onStatus || function () {};
    if (CLOUD.user) {
      status("saving");
      clearTimeout(CLOUD.timer);
      CLOUD.timer = setTimeout(async () => {
        try { await SP.save(S); status("saved"); } catch (e) { status("error"); }
      }, 700);
      return;
    }
    try { localStorage.setItem(STORE, JSON.stringify(S)); status("local"); } catch (_) {}
  }

  /* ---------- Steuerfälle ---------- */
  const CASE = { id: null, row: null, timer: null };
  const STATUS = {
    offen: { t: "Wartet auf Belege", c: "warn" },
    eingereicht: { t: "Eingereicht", c: "red" },
    pruefung: { t: "In Prüfung", c: "mute" },
    abgeschlossen: { t: "Abgeschlossen", c: "ok" }
  };
  function stateFromRow(row) {
    const S = normalize(row.data && row.data.persons ? row.data : null) || emptyState(row.jahr);
    S.overrides = S.overrides || { persons: [{}, {}], ausbildung: {} };
    S.overrides.year = row.jahr; S.year = row.jahr;
    return S;
  }
  // Lädt den Fall aus ?fall=… und prüft die Anmeldung
  async function loadCase() {
    const user = await SP.requireUser();
    const pruefer = await SP.isPruefer();
    const id = new URLSearchParams(location.search).get("fall") || "";
    if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "nofall", user, pruefer };
    const row = await SP.loadFall(id);
    if (!row) return { error: "notfound", user, pruefer };
    CASE.id = id; CASE.row = row;
    return { state: stateFromRow(row), fall: row, user, pruefer };
  }
  function saveCase(S, onStatus) {
    const status = onStatus || function () {};
    if (!CASE.id) return;
    status("saving");
    clearTimeout(CASE.timer); PENDING.S = S;
    CASE.timer = setTimeout(async () => {
      CASE.timer = null;
      try { const r = await SP.saveFall(CASE.id, { data: S }); if (r) CASE.row.status = r.status; status("saved"); }
      catch (e) { status("error"); }
    }, 700);
  }
  // Speichert sofort, falls noch eine Änderung wartet (z.B. vor dem Wechsel zur Bezahlseite)
  const PENDING = { S: null };
  async function flushCase() {
    if (!CASE.id || !PENDING.S || !CASE.timer) return;
    clearTimeout(CASE.timer); CASE.timer = null;
    const r = await SP.saveFall(CASE.id, { data: PENDING.S }); if (r) CASE.row.status = r.status;
  }
  async function setCaseStatus(status) {
    const r = await SP.saveFall(CASE.id, { status });
    if (r) CASE.row.status = r.status;
    return CASE.row.status;
  }

  /* ---------- Hilfen ---------- */
  const nf = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const chf = v => "CHF " + nf.format(Math.round(v || 0));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const married = S => S.zivil === "verheiratet";
  const nPersons = S => married(S) ? 2 : 1;
  const personName = (S, p) => p === "g" ? "Gemeinsam" : ((S.persons[p] && S.persons[p].name) || "Person " + (p + 1));

  function valueOf(S, key, person) {
    return S.items.filter(i => i.key === key && (person === undefined ? true : i.person === person)).reduce((a, i) => a + (+i.amount || 0), 0);
  }
  // Setzt den Wert einer Position (ersetzt alle bisherigen Einträge dieser Position)
  function setValue(S, key, person, amount, source, docId) {
    S.items = S.items.filter(i => !(i.key === key && i.person === person));
    if (amount) S.items.push({ id: uid(), key, person, amount: +amount, source: source || "manuell", docId: docId || null });
  }

  /* ---------- Belegliste für diesen Haushalt ---------- */
  function checklist(S) {
    const np = nPersons(S), out = [];
    for (const t of DOCTYPES) {
      const people = t.perPerson ? [...Array(np).keys()] : ["g"];
      for (const p of people) {
        const needed = t.optional ? false : (p === "g" ? t.need(S) : t.need(S, p));
        const slot = t.id + ":" + p;
        const docs = S.docs.filter(d => d.type === t.id && d.person === p);
        const hasValues = t.keys.some(k => valueOf(S, k, KEYS[k].p ? (p === "g" ? 0 : p) : "g") > 0);
        let status = "fehlt";
        if (S.na[slot]) status = "na";
        else if (docs.some(d => d.status === "fertig") || (hasValues && docs.length)) status = "fertig";
        else if (docs.length) status = "hochgeladen";
        else if (hasValues) status = "werte";
        out.push({ type: t, person: p, slot, needed, optional: !!t.optional, docs, status, hasValues });
      }
    }
    return out;
  }

  /* ---------- Steuerberechnung ---------- */
  function stufen(inc, table, factor) { let rest = Math.max(0, inc), t = 0; for (const [w, r] of table) { const part = Math.min(rest, w); t += part * r / factor; rest -= part; if (rest <= 0) break; } return t; }
  function bundTarif(inc, verh, year) {
    const B = BUND_TARIF[year] || BUND_TARIF[2026];
    const tab = verh ? B.verh : B.single, flat = verh ? B.verhFlat : B.singleFlat;
    if (inc >= flat) return Math.floor(inc / 100) * 100 * 0.115;
    let t = 0; for (const [thr, base, rate] of tab) { if (inc >= thr) t = base + Math.floor((inc - thr) / 100) * rate; }
    return t;
  }
  function taxes(S, stE, stB, verm) {
    const Z = ZH[S.year], verh = married(S), kids = +S.kinder || 0, fam = verh || kids > 0;
    const einfE = stufen(stE, fam ? Z.verh : Z.grund, 100);
    const einfV = stufen(verm, fam ? Z.vverh : Z.vgrund, 1000);
    const einf = einfE + einfV;
    const kanton = einf * Z.kfuss / 100, gemeinde = einf * (+S.gfuss || 0) / 100, kirche = einf * (+S.kfuss || 0) / 100 * (S.kircheAnteil == null ? 1 : S.kircheAnteil);
    const personal = PERSONALSTEUER * (verh ? 2 : 1);
    let bund = bundTarif(stB, fam, S.year) - (fam ? BUND.eltern * kids : 0);
    bund = Math.max(0, bund); if (bund < 25) bund = 0;
    return { einfE, einfV, einf, kanton, gemeinde, kirche, personal, bund, total: kanton + gemeinde + kirche + personal + bund, fam };
  }

  function calc(S) {
    const y = S.year, Z = ZH[y], np = nPersons(S), verh = married(S), kids = +S.kinder || 0, kidsU14 = Math.min(+S.kinderU14 || 0, kids);
    const persons = [...Array(np).keys()];
    const valid = i => i.person === "g" || i.person < np;
    const tot = k => S.items.filter(i => i.key === k && valid(i)).reduce((a, i) => a + (+i.amount || 0), 0);
    const totP = (k, p) => S.items.filter(i => i.key === k && i.person === p).reduce((a, i) => a + (+i.amount || 0), 0);

    const P = persons.map(p => {
      const pe = S.persons[p];
      const lohn = totP("nettolohn", p), neben = totP("nebenerwerb", p), selbst = totP("selbstaendig", p);
      const fahr = t => {
        if (lohn <= 0 || pe.geschaeftsauto) return 0;
        const km = +pe.km || 0, tage = +pe.tage || 0;
        switch (pe.weg) {
          case "oev": return totP("oev_abo", p);
          case "velo": case "pauschal": return 700;
          case "auto": return km * 2 * tage * (t === "b" ? BUND.kmAuto[y] : Z.kmAuto);
          case "motorrad": return km * 2 * tage * .40;
          default: return 0;
        }
      };
      const verpf = lohn <= 0 ? 0 : pe.verpflegung === "voll" ? Math.min(3200, (+pe.tage || 0) * 15) : pe.verpflegung === "verbilligt" ? Math.min(1600, (+pe.tage || 0) * 7.5) : 0;
      const uebrige = lohn > 0 ? clamp(lohn * .03, 2000, 4000) : 0;
      const nebenP = neben > 0 ? Math.min(neben, clamp(neben * .2, 800, 2400)) : 0;
      const erwerb = lohn + neben + selbst;
      const s3aCap = pe.pk ? S3A_PK : Math.min(S3A_OHNE, erwerb * .2);
      return { p, lohn, neben, selbst, erwerb, verpf, uebrige, nebenP,
        fahrS: Math.min(fahr("s"), Z.fahrMax), fahrB: Math.min(fahr("b"), BUND.fahrMax),
        s3a: Math.min(totP("saeule3a", p), s3aCap), s3aEff: totP("saeule3a", p), s3aCap,
        pkEinkauf: totP("pk_einkauf", p), weiterb: totP("weiterbildung", p),
        hatVorsorge: pe.pk || totP("saeule3a", p) > 0 };
    });

    const rows = [];
    // Zeile: Ziffer, Bezeichnung, Staatssteuer, Bundessteuer, Art (wert | summe | total | info), Abschnitt
    const R = (z, l, s, b, kind, sec, note, p) => { rows.push({ z, l, s, b: b === undefined ? s : b, kind: kind || "wert", sec, note, p }); return { s, b: b === undefined ? s : b }; };
    const nameP = p => np === 2 ? " · " + personName(S, p) : "";

    // Seite 2: Einkünfte
    const sec1 = "Einkünfte (Seite 2)";
    let einS = 0;
    for (const x of P) if (x.lohn) { R("1.1", "Haupterwerb" + nameP(x.p), x.lohn, x.lohn, "wert", sec1, "", x.p); einS += x.lohn; }
    for (const x of P) if (x.neben) { R("1.2", "Nebenerwerb" + nameP(x.p), x.neben, x.neben, "wert", sec1, "", x.p); einS += x.neben; }
    for (const x of P) if (x.selbst) { R("2.1", "Selbständige Erwerbstätigkeit" + nameP(x.p), x.selbst, x.selbst, "wert", sec1, "", x.p); einS += x.selbst; }
    const e31 = tot("ahv_rente"), e32 = tot("pk_rente"), e33 = tot("alv"), e34 = tot("taggelder");
    if (e31) { R("3.1", "AHV-/IV-Renten (100 %)", e31, e31, "wert", sec1); einS += e31; }
    if (e32) { R("3.2", "Renten / Pensionen", e32, e32, "wert", sec1); einS += e32; }
    if (e33) { R("3.3", "Erwerbsausfallentschädigungen Arbeitslosenversicherung", e33, e33, "wert", sec1); einS += e33; }
    if (e34) { R("3.4", "Kinder-/Familienzulagen, Mutterschaft, Taggelder", e34, e34, "wert", sec1); einS += e34; }
    const e41 = tot("wertschriftenertrag");
    if (e41) { R("4.1", "Ertrag aus Wertschriften, Guthaben und Lotterien", e41, e41, "wert", sec1); einS += e41; }
    const e51 = tot("unterhalt_erhalten"), e54 = tot("uebrige_einkuenfte");
    if (e51) { R("5.1", "Unterhaltsbeiträge", e51, e51, "wert", sec1); einS += e51; }
    if (e54) { R("5.4", "Weitere Einkünfte", e54, e54, "wert", sec1); einS += e54; }
    // Liegenschaftsunterhalt: effektive Kosten oder Pauschale. Staat ZH: 20 % (Merkblatt KStA).
    // Bund: 10 % bei Gebäuden bis 10 Jahre alt, sonst 20 % (Liegenschaftskostenverordnung, SR 642.116).
    const liegBrutto = tot("eigenmietwert") + tot("mietertrag");
    const liegEff = tot("liegenschaft_unterhalt") > 0;
    const liegJung = !!(S.overrides && S.overrides.liegJung);
    const liegUnt = liegEff ? tot("liegenschaft_unterhalt") : liegBrutto * 0.2;
    const liegUntB = liegEff ? liegUnt : liegBrutto * (liegJung ? 0.1 : 0.2);
    const e6 = liegBrutto - liegUnt, e6B = liegBrutto - liegUntB;
    let einB = einS;
    if (liegBrutto) { R("6", "Nettoertrag aus Liegenschaften", e6, e6B, "wert", sec1, liegEff ? "" : "Unterhalt pauschal: Staat 20 %, Bund " + (liegJung ? "10 % (Gebäude bis 10 Jahre)" : "20 %")); einS += e6; einB += e6B; }
    const ein = einS;
    R("7", "Total der Einkünfte", einS, einB, "summe", sec1);

    // Seite 3: Abzüge
    const sec2 = "Abzüge (Seite 3)";
    let abS = 0, abB = 0;
    const addA = (z, l, s, b, note) => { if (Math.round(s) || Math.round(b)) { R(z, l, s, b, "wert", sec2, note); abS += s; abB += b; } };
    P.forEach((x, i) => {
      const s = x.fahrS + x.verpf + x.uebrige + x.nebenP, b = x.fahrB + x.verpf + x.uebrige + x.nebenP;
      addA("11." + (i + 1), "Berufsauslagen" + nameP(x.p), s, b, "Fahrkosten, Verpflegung, übrige Berufsauslagen" + (x.nebenP ? ", Nebenerwerb" : ""));
    });
    const schuldz = Math.min(tot("schuldzinsen"), e41 + liegBrutto + 50000);
    addA("12", "Schuldzinsen", schuldz, schuldz);
    addA("13.1", "Unterhaltsbeiträge", tot("unterhalt_bezahlt"), tot("unterhalt_bezahlt"));
    P.forEach((x, i) => addA("14." + (i + 1), "Beiträge Säule 3a" + nameP(x.p), x.s3a, x.s3a, x.s3aEff > x.s3a ? "Begrenzt auf " + nf.format(x.s3aCap) : ""));
    const ohneVorsorge = !P.some(x => x.hatVorsorge);
    const versAkt = tot("krankenkasse_praemien") + tot("versicherung_uebrige");
    const capS = (verh ? Z.vers.verh : Z.vers.single) * (ohneVorsorge ? 1.5 : 1) + Z.vers.kind * kids;
    const capB = (verh ? (ohneVorsorge ? BUND.vers.verhOhne : BUND.vers.verhMit) : (ohneVorsorge ? BUND.vers.ohne : BUND.vers.mit)) + BUND.vers.kind * kids;
    addA("15", "Versicherungsprämien und Zinsen von Sparkapitalien", Math.min(versAkt, capS), Math.min(versAkt, capB), versAkt ? "Höchstbetrag Staat " + nf.format(capS) + ", Bund " + nf.format(capB) : "");
    const pk = P.reduce((a, x) => a + x.pkEinkauf, 0);
    addA("16.1", "Beiträge an AHV, IV und 2. Säule (Einkauf)", pk, pk);
    const wbS = P.reduce((a, x) => a + Math.min(x.weiterb, Z.weiterb), 0), wbB = P.reduce((a, x) => a + Math.min(x.weiterb, BUND.weiterb), 0);
    addA("16.2", "Berufsorientierte Aus- und Weiterbildungskosten", wbS, wbB);
    const betr = tot("kinderbetreuung");
    addA("16.6", "Abzug für fremdbetreute Kinder", Math.min(betr, Z.betreuung * kidsU14), Math.min(betr, BUND.betreuung * kidsU14), betr && !kidsU14 ? "Nur für Kinder unter 14" : "");
    // Zweiverdienerabzug: massgebend ist das Erwerbseinkommen nach Berufsauslagen, Säule 3a und Einkauf 2. Säule
    // (Art. 33 Abs. 2 DBG). Abzug nur, wenn beide ein Erwerbseinkommen erzielen.
    const netErwS = x => Math.max(0, x.erwerb - (x.fahrS + x.verpf + x.uebrige + x.nebenP) - x.s3a - x.pkEinkauf);
    const netErwB = x => Math.max(0, x.erwerb - (x.fahrB + x.verpf + x.uebrige + x.nebenP) - x.s3a - x.pkEinkauf);
    const beide = np === 2 && P[0].erwerb > 0 && P[1].erwerb > 0;
    const lowerS = beide ? Math.min(netErwS(P[0]), netErwS(P[1])) : 0, lowerB = beide ? Math.min(netErwB(P[0]), netErwB(P[1])) : 0;
    const lower = lowerB;
    if (beide && (lowerS > 0 || lowerB > 0)) addA("17", "Sonderabzug bei Erwerbstätigkeit beider Ehegatten", Math.min(Z.zweiverd, lowerS), lowerB < BUND.zwMin ? lowerB : clamp(lowerB * .5, BUND.zwMin, BUND.zwMax));
    R("18", "Total der Abzüge", abS, abB, "summe", sec2);

    // Einkommensberechnung
    const sec3 = "Einkommensberechnung (Seite 3)";
    R("19", "Total der Einkünfte", einS, einB, "wert", sec3);
    R("20", "Total der Abzüge", abS, abB, "wert", sec3);
    const nS = einS - abS, nB = einB - abB;
    R("21", "Nettoeinkommen", nS, nB, "summe", sec3);
    const kk = tot("krankheitskosten");
    const k221S = Math.max(0, kk - Math.max(0, nS) * .05), k221B = Math.max(0, kk - Math.max(0, nB) * .05);
    if (kk) R("22.1", "Krankheits- und Unfallkosten", k221S, k221B, "wert", sec3, "Abzug über 5 % Selbstbehalt");
    const sp = tot("spenden");
    const k222S = sp >= 100 ? Math.min(sp, Math.max(0, nS) * .2) : 0, k222B = sp >= 100 ? Math.min(sp, Math.max(0, nB - k221B) * .2) : 0;
    if (sp) R("22.2", "Gemeinnützige Zuwendungen", k222S, k222B, "wert", sec3, sp < 100 ? "Erst ab CHF 100 abzugsfähig" : "");
    const rS = nS - k221S - k222S, rB = nB - k221B - k222B;
    R("23", "Reineinkommen", rS, rB, "summe", sec3);
    let soS = 0, soB = 0;
    if (kids) { R("24.1", "Abzug für Kinder (" + kids + ")", Z.kinder * kids, BUND.kinder * kids, "wert", sec3); soS += Z.kinder * kids; soB += BUND.kinder * kids; }
    if (verh) { R("24.3", "Abzug für Ehegatten", 0, BUND.verhAbzug, "wert", sec3, "Nur Bundessteuer"); soB += BUND.verhAbzug; }
    const stE = Math.max(0, Math.floor((rS - soS) / 100) * 100), stB = Math.max(0, Math.floor((rB - soB) / 100) * 100);
    R("25", "Steuerbares Einkommen", stE, stB, "total", sec3, "Auf 100 Franken abgerundet");

    // Seite 4: Vermögen (nur Staats- und Gemeindesteuer)
    const sec4 = "Vermögen (Seite 4)";
    const v301 = tot("bankguthaben") + tot("wertschriften_wert"), v302 = tot("bargeld"), v303 = tot("lebensversicherung"), v304 = tot("fahrzeuge"), v306 = tot("uebriges_vermoegen"), v311 = tot("liegenschaft_steuerwert");
    const vm = (z, l, v) => { if (v) R(z, l, v, null, "wert", sec4); };
    vm("30.1", "Wertschriften und Guthaben", v301); vm("30.2", "Bargeld, Gold und andere Edelmetalle", v302); vm("30.3", "Lebens- und Rentenversicherungen", v303);
    vm("30.4", "Motorfahrzeuge", v304); vm("30.6", "Übrige Vermögenswerte", v306); vm("31.1", "Liegenschaften, zum Verkehrswert besteuert", v311);
    const v33 = v301 + v302 + v303 + v304 + v306 + v311, v34 = tot("schulden");
    R("33", "Total der Vermögenswerte", v33, null, "summe", sec4);
    if (v34) R("34", "Schulden", v34, null, "wert", sec4);
    const verm = Math.max(0, Math.floor((v33 - v34) / 1000) * 1000);
    R("35", "Steuerbares Vermögen", verm, null, "total", sec4, "Auf 1000 Franken abgerundet");

    const T = taxes(S, stE, stB, verm);
    const T2 = taxes(S, stE + 1000, stB + 1000, verm);
    const grenz = (T2.total - T.total) / 1000;
    const raw = { e25s: rS - soS, e25b: rB - soB, v33, v34, v35: v33 - v34, liegBrutto, liegUnt, liegUntB, lower, lowerS, lowerB };
    const wert = { bank: tot("bankguthaben"), depot: tot("wertschriften_wert"), ertrag: e41 };
    return { y, Z, P, rows, ein, einB, stE, stB, verm, T, grenz, versAkt, capS, capB, ohneVorsorge, raw, wert, vst: tot("verrechnungssteuer"), np, verh, kids, kidsU14 };
  }

  /* ---------- Haushalt aus den Belegen ableiten ---------- */
  const norm = v => String(v || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const ageAt = (dob, year) => { const m = /^(\d{4})/.exec(dob || ""); return m ? year - +m[1] : null; };
  const ADULT_TYPES = ["lohnausweis", "saeule3a", "rente", "pk_einkauf", "taggeld", "selbst", "weiterbildung", "oev"];
  const typeName = id => (DOCTYPES.find(t => t.id === id) || { name: "Beleg" }).name;

  const PRIOR = ["steuerrechnung", "steuererklaerung"];
  const KIRCHE = ["reformiert", "katholisch", "christkatholisch"];
  /* ---------- Doppelte Belege erkennen und dazulernen ---------- */
  // LEARN: frühere Entscheide der Prüfer (Tabelle «lernregeln»). null = nicht geladen (z.B. beim Kunden oder auf dem Server).
  const LEARN = { rows: null, zu: null };
  const RECHTSFORM = /\b(ag|gmbh|sa|sàrl|sarl|kg|klg|co|cie|und|&|inh|inhaber)\b/g;
  const normName = v => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(RECHTSFORM, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const normNr = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function sameName(a, b) {
    const x = normName(a), y = normName(b);
    if (!x || !y) return null;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    const A = new Set(x.split(" ").filter(w => w.length > 2)), B = y.split(" ").filter(w => w.length > 2);
    if (!A.size || !B.length) return false;
    const hit = B.filter(w => A.has(w)).length;
    return hit / Math.min(A.size, B.length) >= 0.5;
  }
  // Merkmale eines Treffers als kurzer Text, z.B. "betrag+aussteller+datum"
  function sigOf(f) { return ["betrag", f.aussteller && "aussteller", f.datum && "datum", f.nummer && "nummer"].filter(Boolean).join("+"); }
  // Gelernte Regel: gleicher Aussteller und gleiche Merkmale → letzter Entscheid; sonst gleiche Belegtypen und Merkmale mit mindestens 3 einheitlichen Entscheiden
  function learned(tA, tB, sig, name) {
    const rows = LEARN.rows; if (!rows || !rows.length) return null;
    const same = rows.filter(r => r.typ_a === tA && r.typ_b === tB && r.merkmale === sig);
    const n = normName(name);
    const sup = n ? same.filter(r => r.aussteller && r.aussteller === n) : [];
    if (sup.length) return { entscheid: sup[sup.length - 1].entscheid, n: sup.length, art: "Aussteller" };
    if (same.length >= 3 && same.every(r => r.entscheid === same[0].entscheid)) return { entscheid: same[0].entscheid, n: same.length, art: "Belegtyp" };
    return null;
  }
  function findDuplicates(S) {
    const docs = S.docs || [];
    const lists = docs.filter(d => d.result && Array.isArray(d.result.einzelposten) && d.result.einzelposten.length);
    for (const d of docs) {
      const prev = d.dup || null; d.dup = null;
      const r = d.result; if (!r || !lists.length) continue;
      if (Array.isArray(r.einzelposten) && r.einzelposten.length) continue; // Aufstellungen selbst nicht prüfen
      // Betrag der Einzelrechnung: aus «rechnung», sonst die einzige Position
      const pos = (r.positionen || []).filter(p => KEYS[p.key] && +p.betrag > 0);
      const amt = r.rechnung && +r.rechnung.betrag > 0 ? +r.rechnung.betrag : (pos.length === 1 ? +pos[0].betrag : 0);
      if (!amt) continue;
      const tol = Math.max(1, amt * 0.005);
      let best = null;
      for (const L of lists) {
        if (L.id === d.id) continue;
        L.result.einzelposten.forEach((z, i) => {
          if (Math.abs((+z.betrag || 0) - amt) > tol) return;
          const rc = r.rechnung || {};
          const f = { aussteller: sameName(rc.aussteller, z.aussteller) === true, datum: !!(rc.datum && z.datum && rc.datum === z.datum), nummer: !!(normNr(rc.nummer) && normNr(rc.nummer) === normNr(z.nummer)) };
          const score = 1 + (f.aussteller ? 2 : 0) + (f.datum ? 1 : 0) + (f.nummer ? 3 : 0);
          if (!best || score > best.score) best = { L, z, i, f, score };
        });
      }
      if (!best) continue;
      const { L, z, i, f } = best;
      // Welche Position der Einzelrechnung ist betroffen? Gleicher Schlüssel wie die Zeile, sonst der betragsnächste.
      const keys = Object.keys(Object.assign({}, ...pos.map(p => ({ [p.key]: 1 })), d.edits || {}));
      const key = keys.includes(z.key) ? z.key : (pos.slice().sort((a, b) => Math.abs(a.betrag - amt) - Math.abs(b.betrag - amt))[0] || {}).key || keys[0];
      if (!key) continue;
      const sig = sigOf(f);
      const sure = f.nummer || (f.aussteller && (f.datum || !(r.rechnung && r.rechnung.datum && z.datum)));
      const dup = { of: L.id, ofName: L.name, zeile: i, key, betrag: Math.min(amt, +z.betrag || amt), aussteller: (r.rechnung && r.rechnung.aussteller) || z.aussteller || "",
        zeileText: [z.aussteller, z.datum, z.nummer].filter(Boolean).join(" · "), merkmale: sig, typA: d.type, typB: L.type,
        sicher: !!sure, entscheid: null, quelle: null };
      const dec = d.dupDecision && d.dupDecision.of === L.id ? d.dupDecision : null;
      const lr = dec ? null : learned(d.type, L.type, sig, dup.aussteller);
      if (dec) { dup.entscheid = dec.entscheid; dup.quelle = "pruefer"; }
      else if (lr) { dup.entscheid = lr.entscheid; dup.quelle = "gelernt"; dup.gelernt = lr; }
      else if (LEARN.rows === null && prev && prev.of === L.id && prev.quelle === "gelernt") { dup.entscheid = prev.entscheid; dup.quelle = "gelernt"; dup.gelernt = prev.gelernt; }
      else if (sure) { dup.entscheid = "doppelt"; dup.quelle = "auto"; }
      d.dup = dup;
    }
  }
  // Entscheid des Prüfers speichern und für künftige Fälle merken
  async function decideDuplicate(S, docId, entscheid) {
    const d = (S.docs || []).find(x => x.id === docId); if (!d || !d.dup) return;
    d.dupDecision = { of: d.dup.of, entscheid };
    const rec = { typ_a: d.dup.typA, typ_b: d.dup.typB, merkmale: d.dup.merkmale, aussteller: normName(d.dup.aussteller) || null, betrag: Math.round(d.dup.betrag), entscheid };
    if (LEARN.rows) LEARN.rows.push(rec);
    try { if (typeof window !== "undefined" && window.SP && SP.client) await SP.client.from("lernregeln").insert(rec); } catch (_) {}
  }
  function undoDuplicate(S, docId) { const d = (S.docs || []).find(x => x.id === docId); if (d) delete d.dupDecision; }
  async function loadLearn() {
    if (!(typeof window !== "undefined" && window.SP && SP.client)) return;
    try { const { data, error } = await SP.client.from("lernregeln").select("typ_a,typ_b,merkmale,aussteller,entscheid,aktiv").order("created_at");
      LEARN.rows = error ? [] : (data || []).filter(r => r.aktiv !== false); } catch (_) { LEARN.rows = []; }
    try { const { data, error } = await SP.client.from("zuordnungen").select("belegtyp,aussteller,stichwort,key,aktiv,created_at").order("created_at");
      LEARN.zu = error ? [] : (data || []).filter(r => r.aktiv !== false); } catch (_) { LEARN.zu = []; }
  }
  /* ---------- Zuordnungen lernen: Prüfer weist einen Betrag einer Ziffer zu oder ändert den Belegtyp ---------- */
  // Stichwort aus Dateiname oder Zeilentext: ohne Endung, Zahlen und Satzzeichen, z.B. «51_Berufskosten_Berechnung.pdf» → «berufskosten berechnung»
  const stichwort = v => normName(String(v || "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_\-]+/g, " ").replace(/\d+/g, " ")).split(" ").filter(w => w.length > 2).join(" ");
  async function learnZuordnung(rec) {
    const r = { belegtyp: rec.belegtyp || null, aussteller: normName(rec.aussteller) || null, stichwort: stichwort(rec.stichwort) || null, key: rec.key };
    if (!r.key || (!r.aussteller && !r.stichwort)) return;
    if (LEARN.zu) LEARN.zu.push(Object.assign({ created_at: new Date().toISOString() }, r));
    try { if (typeof window !== "undefined" && window.SP && SP.client) await SP.client.from("zuordnungen").insert(r); } catch (_) {}
  }
  // Passende gelernte Ziffer: zuerst gleicher Aussteller, sonst gleiches Stichwort (bei gleichem Belegtyp). Letzter Entscheid zählt.
  function learnedKey(belegtyp, aussteller, text, typOnly) {
    const rows = (LEARN.zu || []).filter(r => typOnly ? /^typ:/.test(r.key) : !/^typ:/.test(r.key));
    const a = normName(aussteller), w = stichwort(text);
    let hit = a ? rows.filter(r => r.aussteller && r.aussteller === a) : [];
    if (!hit.length && w) hit = rows.filter(r => r.stichwort && r.stichwort === w && (typOnly || !r.belegtyp || r.belegtyp === belegtyp));
    if (!hit.length) return null;
    const last = hit[hit.length - 1];
    return { key: last.key, n: hit.filter(r => r.key === last.key).length, via: a && hit[0].aussteller === a ? "Aussteller" : "Stichwort" };
  }
  // Vorschläge für einen Beleg (nur Vorschläge, nichts wird automatisch geändert)
  function suggestions(S, d) {
    if (!LEARN.zu || !LEARN.zu.length || !d.result) return [];
    const out = [], ign = new Set(d.ignoreSugg || []), r = d.result;
    const t = learnedKey(d.type, r.rechnung && r.rechnung.aussteller, d.name, true);
    if (t && t.key !== "typ:" + d.type && !ign.has(t.key)) out.push({ id: t.key, art: "typ", to: t.key.slice(4), n: t.n, via: t.via });
    if (Array.isArray(d.lines)) {
      d.lines.forEach(l => { if (l.learnedOff) return; const k = learnedKey(d.type, l.aussteller, l.text); if (k && KEYS[k.key] && k.key !== l.key && !ign.has(l.id + ">" + k.key)) out.push({ id: l.id + ">" + k.key, art: "zeile", line: l.id, text: l.text, betrag: l.betrag, from: l.key, to: k.key, n: k.n, via: k.via }); });
    } else {
      (r.einzelposten || []).forEach((z, i) => { const k = learnedKey(d.type, z.aussteller, [z.aussteller].join(" ")); if (k && KEYS[k.key] && k.key !== z.key && !ign.has("z" + i + ">" + k.key)) out.push({ id: "z" + i + ">" + k.key, art: "einzelposten", idx: i, text: [z.aussteller, z.datum].filter(Boolean).join(" · "), betrag: z.betrag, from: z.key, to: k.key, n: k.n, via: k.via }); });
      const keys = [...new Set((r.positionen || []).map(p => p.key))];
      if (keys.length <= 1 && !(r.einzelposten || []).length) {
        const k = learnedKey(d.type, r.rechnung && r.rechnung.aussteller, d.name);
        if (k && KEYS[k.key] && k.key !== keys[0] && !ign.has("all>" + k.key)) out.push({ id: "all>" + k.key, art: "beleg", text: d.name, betrag: (r.positionen || []).reduce((a, p) => a + (+p.betrag || 0), 0), from: keys[0] || null, to: k.key, n: k.n, via: k.via });
      }
    }
    return out;
  }
  // Vorschlag übernehmen: Beleg wird auf einzelne Zeilen umgestellt und die betroffene Zeile der gelernten Ziffer zugewiesen
  function applySuggestion(S, d, sg) {
    if (sg.art === "typ") { d.type = sg.to; d.typeLocked = true; return; }
    if (!Array.isArray(d.lines)) d.lines = initLines(d);
    if (sg.art === "zeile") { const l = d.lines.find(x => x.id === sg.line); if (l) l.key = sg.to; }
    else if (sg.art === "einzelposten") { const z = d.result.einzelposten[sg.idx]; const l = d.lines.find(x => x.aussteller === z.aussteller && Math.abs(x.betrag - z.betrag) < 0.01); if (l) l.key = sg.to; }
    else if (sg.art === "beleg") { if (d.lines.length) d.lines.forEach(l => { if (l.key === sg.from || !l.key) l.key = sg.to; }); else if (sg.betrag) d.lines.push({ id: uid(), text: d.name, betrag: sg.betrag, key: sg.to }); }
    d.typeLocked = true;
  }
  const openDuplicates = S => (S.docs || []).filter(d => d.dup && !d.dup.entscheid);

  // Beträge eines Belegs als einzelne Zeilen: Einzelposten der Aufstellung, sonst die ausgelesenen Positionen (Korrekturen eingerechnet).
  // Die Summe pro Ziffer bleibt beim Umschalten gleich; Einzelposten ohne passende Position starten mit «nicht zählen».
  function initLines(d) {
    const r = d.result || {}, by = {};
    for (const p of (r.positionen || [])) if (KEYS[p.key]) by[p.key] = (by[p.key] || 0) + (+p.betrag || 0);
    for (const [k, v] of Object.entries(d.edits || {})) if (KEYS[k]) by[k] = +v || 0;
    const ez = (r.einzelposten || []).filter(z => +z.betrag > 0), used = new Set(), lines = [];
    const txt = z => [z.aussteller, z.datum, z.nummer].filter(Boolean).join(" · ") || "Position";
    for (const [k, v] of Object.entries(by)) {
      const zs = ez.filter(z => z.key === k), zsum = zs.reduce((a, z) => a + (+z.betrag), 0);
      if (zs.length && zsum <= v + 1) {
        zs.forEach(z => { used.add(z); lines.push({ id: uid(), text: txt(z), aussteller: z.aussteller || "", betrag: +z.betrag, key: k }); });
        if (v - zsum > 1) lines.push({ id: uid(), text: "Übriger Betrag " + KEYS[k].l, betrag: Math.round((v - zsum) * 100) / 100, key: k });
      } else if (v) lines.push({ id: uid(), text: KEYS[k].l, aussteller: (r.rechnung && r.rechnung.aussteller) || "", betrag: v, key: k });
    }
    ez.filter(z => !used.has(z)).forEach(z => lines.push({ id: uid(), text: txt(z), aussteller: z.aussteller || "", betrag: +z.betrag, key: null }));
    return lines;
  }

  function rebuild(S) {
    const O = S.overrides = S.overrides || {};
    O.persons = O.persons || [{}, {}];
    O.ausbildung = O.ausbildung || {};
    const docs = S.docs.filter(d => d.result);
    // Steuerperiode: was die meisten Belege sagen, ausser die Person hat sie gewählt
    if (O.year && ZH[O.year]) S.year = O.year;
    else {
      const ys = {}; for (const d of docs) { const j = +d.result.jahr; if (!PRIOR.includes(d.type) && ZH[j]) ys[j] = (ys[j] || 0) + 1; }
      const best = Object.keys(ys).sort((a, b) => ys[b] - ys[a])[0];
      if (best) S.year = +best;
    }
    const y = S.year;

    // 1. Personen über alle Belege zusammenführen
    const people = [];
    const find = p => {
      if (!p) return null;
      const vn = norm(p.vorname).split(" ")[0] || "", nn = norm(p.nachname), dob = /^\d{4}-\d{2}-\d{2}$/.test(p.geburtsdatum || "") ? p.geburtsdatum : "";
      if (!vn && !nn) return null;
      let h = people.find(x => (dob && x.dob === dob && (!vn || !x.vn || x.vn === vn)) || (vn && x.vn === vn && (!nn || !x.nn || x.nn === nn) && (!dob || !x.dob || x.dob === dob)));
      if (!h) { h = { key: "p" + people.length, vn, nn, vorname: p.vorname || "", nachname: p.nachname || "", dob, roles: new Set(), own: 0, ownTypes: new Set(), sources: new Set() }; people.push(h); }
      if (dob && !h.dob) h.dob = dob;
      if (p.vorname && !h.vorname) { h.vorname = p.vorname; h.vn = vn; }
      if (p.nachname && !h.nachname) { h.nachname = p.nachname; h.nn = nn; }
      return h;
    };
    for (const d of docs) {
      const r = d.result; d._owner = null;
      for (const p of (r.personen || [])) { const h = find(p); if (h) { if (p.rolle) h.roles.add(p.rolle); h.sources.add(d.name); } }
      const h = find(r.inhaber);
      if (h) { h.own++; h.ownTypes.add(d.type); h.sources.add(d.name); d._owner = h; }
    }
    const isKid = h => { const a = ageAt(h.dob, y); return h.roles.has("kind") ? (a == null || a < 26) : (a != null && a < 18); };
    const kids = people.filter(isKid);
    const adults = people.filter(h => !isKid(h) && (h.own > 0 || h.roles.has("steuerpflichtig") || h.roles.has("ehepartner") || [...h.ownTypes].some(t => ADULT_TYPES.includes(t))));
    adults.sort((a, b) => (b.roles.has("steuerpflichtig") - a.roles.has("steuerpflichtig")) || (b.own - a.own));

    // 2. Zivilstand
    const zs = docs.map(d => d.result.zivilstand).filter(Boolean);
    const zivSrc = docs.find(d => d.result.zivilstand === "verheiratet") || docs.find(d => (d.result.personen || []).some(p => p.rolle === "ehepartner"));
    let zivilAuto = null;
    if (zs.includes("verheiratet") || adults.some(h => h.roles.has("ehepartner"))) zivilAuto = "verheiratet";
    else if (zs.length) zivilAuto = "ledig";
    else if (adults.length < 2) zivilAuto = "ledig";
    S.zivil = O.zivil || zivilAuto || "ledig";
    const verh = S.zivil === "verheiratet";

    // 3. Personen 1 und 2
    const np = verh ? 2 : 1;
    const lohnInfo = idx => { const d = docs.find(d => d.type === "lohnausweis" && d._owner && adults.indexOf(d._owner) === idx); return d ? (d.result.lohnausweis || {}) : null; };
    for (let i = 0; i < 2; i++) {
      const h = adults[i], o = O.persons[i] || {}, la = lohnInfo(i);
      // Effektive ÖV-Kosten aus irgendeinem Beleg dieser Person (ÖV-Quittung, eigene Berufskosten-Aufstellung, Hilfsblatt) gehen der Pauschale vor
      const oevOf = d => { const e = d.edits && d.edits.oev_abo != null ? +d.edits.oev_abo : ((d.result && d.result.positionen) || []).filter(p => p.key === "oev_abo").reduce((a, p) => a + (+p.betrag || 0), 0); return e > 0; };
      const hasAbo = S.docs.some(d => ownerIdx(d) === i && (d.type === "oev" || oevOf(d)));
      S.persons[i] = {
        name: h ? [h.vorname, h.nachname].filter(Boolean).join(" ") || "Person " + (i + 1) : "Person " + (i + 1),
        dob: h ? h.dob : "",
        pk: o.pk != null ? o.pk : !(la && la.pk_beitraege === 0),
        verpflegung: o.verpflegung || (la && la.kantine ? "verbilligt" : "voll"),
        geschaeftsauto: o.geschaeftsauto != null ? o.geschaeftsauto : !!(la && la.geschaeftsauto),
        // Regel: Lohnausweis ohne Kreuz bei Feld F (keine Gratisbeförderung) und keine ÖV-Quittung → Pauschale 700
        weg: o.weg || (hasAbo ? "oev" : la ? (la.gratis_transport ? "keine" : "pauschal") : "keine"),
        km: o.km || 0, tage: o.tage || 220, arbeitgeber: la && la.arbeitgeber ? String(la.arbeitgeber) : ""
      };
    }
    function ownerIdx(d) {
      if (d.personOverride === 0 || d.personOverride === 1) return d.personOverride;
      const i = d._owner ? adults.indexOf(d._owner) : -1;
      return i >= 0 ? i : 0;
    }

    // 4. Kinder (Ausbildung aus Seite 1 der Steuererklärung, falls vorhanden)
    const persDoc = docs.filter(d => d.type === "steuererklaerung" && d.result.personalien).sort((a, b) => (+b.result.jahr || 0) - (+a.result.jahr || 0))[0];
    const PS = persDoc ? persDoc.result.personalien : null;
    const ausbAuto = {};
    const kidList = kids.map(h => {
      const name = [h.vorname, h.nachname].filter(Boolean).join(" ") || "Kind";
      const pk = PS && (PS.kinder || []).find(k => norm(k.vorname).split(" ")[0] === h.vn && (!k.geburtsdatum || !h.dob || k.geburtsdatum === h.dob));
      if (pk && pk.ausbildung != null) ausbAuto[name] = pk.ausbildung;
      return { key: h.key, name, age: ageAt(h.dob, y) };
    });
    const ausb = name => O.ausbildung[name] != null ? O.ausbildung[name] : ausbAuto[name];
    const kidsCount = kidList.filter(k => k.age == null || k.age < 18 || ausb(k.name)).length;
    S.kinder = O.kinder != null ? O.kinder : kidsCount;
    S.kinderU14 = O.kinderU14 != null ? O.kinderU14 : Math.min(S.kinder, kidList.filter(k => k.age != null && k.age <= 14).length);

    // 5. Gemeinde, Steuerfuss, Kirche
    const st = (docs.filter(d => PRIOR.includes(d.type)).sort((a, b) => (a.type === "steuerrechnung" ? 0 : 1) - (b.type === "steuerrechnung" ? 0 : 1)).map(d => d.result.steuern).filter(Boolean))[0] || {};
    const orte = {};
    for (const d of docs) { const o = d.result.adresse && d.result.adresse.ort; if (o) orte[o] = (orte[o] || 0) + 1; }
    const ortAuto = st.gemeinde || (PS && PS.gemeinde) || Object.keys(orte).sort((a, b) => orte[b] - orte[a])[0] || "";
    S.gemeindeName = O.gemeindeName || ortAuto;
    const gMatch = GEMEINDEN.find(g => g.fuss && norm(g.name).split(" ")[0] === norm(S.gemeindeName).split(" ")[0]);
    let gfussSrc = null;
    if (O.gfuss != null) { S.gfuss = O.gfuss; gfussSrc = "Ihre Angabe"; }
    else if (st.steuerfuss_gemeinde) { S.gfuss = +st.steuerfuss_gemeinde; gfussSrc = "Steuerrechnung"; }
    else if (gMatch) { S.gfuss = gMatch.fuss; gfussSrc = "Gemeinde " + gMatch.name; }
    else { S.gfuss = S.gfuss || 119; gfussSrc = null; }
    // Konfession: Ihre Angabe, sonst pro Person aus Seite 1 der Steuererklärung, sonst aus der Steuerrechnung
    let konfs = null, konfSrc = null;
    if (O.konfession) { konfs = Array(np).fill(O.konfession); konfSrc = "Ihre Angabe"; }
    else if (PS && (PS.personen || []).slice(0, np).some(p => p && p.konfession)) {
      konfs = [...Array(np).keys()].map(i => (PS.personen[i] && PS.personen[i].konfession) || (PS.personen[0] && PS.personen[0].konfession) || null);
      konfSrc = "Steuererklärung " + (persDoc.result.jahr || "Vorjahr");
    } else if (st.konfession) { konfs = Array(np).fill(st.konfession); konfSrc = "Steuerrechnung"; }
    const members = konfs ? konfs.filter(k => KIRCHE.includes(k)).length : null;
    S.konfession = konfs ? (members ? konfs.find(k => KIRCHE.includes(k)) : "keine") : null;
    S.konfessionen = konfs;
    // Gehört nur eine Person einer Landeskirche an, ist die halbe Kirchensteuer geschuldet
    S.kircheAnteil = members == null ? 1 : members / np;
    let kfussSrc = null; S.kfussSchaetzung = false;
    if (O.kfuss != null) { S.kfuss = O.kfuss; kfussSrc = "Ihre Angabe"; }
    else if (members === 0) { S.kfuss = 0; kfussSrc = konfSrc; }
    else if (st.steuerfuss_kirche != null && st.steuerfuss_kirche !== "" && !(+st.steuerfuss_kirche === 0 && members)) { S.kfuss = +st.steuerfuss_kirche || 0; kfussSrc = "Steuerrechnung"; }
    else if (members) { S.kfuss = 0; } // Kirchensteuerfuss noch unbekannt: keine Schätzung, Prüfer trägt den amtlichen Wert ein
    else { S.kfuss = 0; }

    // 6. Situation für die Belegliste
    const has = (type, i) => S.docs.some(d => d.type === type && (i === undefined || ownerIdx(d) === i));
    for (let i = 0; i < 2; i++) {
      S.sit.angestellt[i] = has("lohnausweis", i); S.sit.saeule3a[i] = has("saeule3a", i); S.sit.pkEinkauf[i] = has("pk_einkauf", i);
      S.sit.rente[i] = has("rente", i); S.sit.taggeld[i] = has("taggeld", i); S.sit.selbst[i] = has("selbst", i); S.sit.weiterbildung[i] = has("weiterbildung", i);
    }
    S.sit.kita = has("kita"); S.sit.liegenschaft = has("liegenschaft"); S.sit.kredit = has("hypothek"); S.sit.spenden = has("spenden");
    S.sit.krankheit = has("krankheit"); S.sit.unterhalt = has("unterhalt");

    // 7a. Doppelte Belege: Einzelrechnung, die schon in einer Aufstellung eines anderen Belegs enthalten ist
    findDuplicates(S);

    // 7. Werte aus den Belegen neu aufbauen (Korrekturen pro Beleg gehen vor)
    S.items = [];
    for (const d of S.docs) {
      const vals = {};
      if (Array.isArray(d.lines)) {
        // Vom Prüfer einzeln zugeordnete Beträge: jede Zeile zählt bei ihrer Ziffer, «nicht zählen» (ohne Schlüssel) wird ignoriert
        for (const l of d.lines) if (KEYS[l.key] && +l.betrag > 0) vals[l.key] = (vals[l.key] || 0) + (+l.betrag);
      } else {
      for (const p of ((d.result && d.result.positionen) || [])) { if (KEYS[p.key]) vals[p.key] = (vals[p.key] || 0) + (+p.betrag || 0); }
      for (const [k, v] of Object.entries(d.edits || {})) { if (KEYS[k]) vals[k] = +v || 0; }
      }
      // Doppelt erkannt (oder noch offen): Betrag nur einmal zählen, bis der Prüfer «separat» entscheidet
      if (d.dup && d.dup.entscheid !== "separat" && vals[d.dup.key] != null && !Array.isArray(d.lines) && !(d.edits && d.edits[d.dup.key] != null)) vals[d.dup.key] = Math.max(0, vals[d.dup.key] - d.dup.betrag);
      const i = ownerIdx(d);
      for (const [k, v] of Object.entries(vals)) if (v) S.items.push({ id: d.id + "-" + k, key: k, person: KEYS[k].p ? i : "g", amount: v, source: "dok", docId: d.id });
      d.owner = i;
      const t = DOCTYPES.find(t => t.id === d.type);
      d.person = t && t.perPerson ? i : "g";
    }

    // 8. Offene Fragen und fehlende Belege
    const q = [];
    if (!O.zivil && !zivilAuto) q.push({ id: "zivil", text: `Sind ${adults[0] ? adults[0].vorname : "Sie"} und ${adults[1] ? adults[1].vorname : "die zweite Person"} verheiratet?`, why: "Unverheiratete Paare machen je eine eigene Steuererklärung." });
    if (!gfussSrc) q.push({ id: "gfuss", text: S.gemeindeName ? `Wie hoch ist der Steuerfuss von ${S.gemeindeName}?` : "In welcher Gemeinde wohnen Sie, und wie hoch ist der Steuerfuss?", why: "Steht auf Ihrer letzten Steuerrechnung oder unter zh.ch/steuerfuesse." });
    if (!kfussSrc) q.push({ id: "kirche", konfBekannt: !!konfs, text: S.konfession ? `Wie hoch ist der Kirchensteuerfuss (${S.konfession})?` : "Sind Sie Mitglied einer Landeskirche?", why: "Für die Kirchensteuer. Steht auf der letzten Steuerrechnung oder bei der Gemeinde." });
    for (let i = 0; i < np; i++) if (S.persons[i].weg === "offen") q.push({ id: "weg" + i, person: i, text: `Wie kommt ${S.persons[i].name.split(" ")[0]} zur Arbeit?`, why: "Für den Fahrkostenabzug. Mit ÖV-Abo einfach die Quittung hochladen." });
    if (S.docs.some(d => d.type === "liegenschaft") && O.liegJung == null && !S.items.some(i => i.key === "liegenschaft_unterhalt" && +i.amount > 0)) q.push({ id: "liegalter", text: "Ist das Gebäude Ihrer Liegenschaft jünger als 10 Jahre?", why: "Für die Pauschale der Unterhaltskosten bei der Bundessteuer: 10 % bei neueren, 20 % bei älteren Gebäuden." });
    for (const k of kidList) if (k.age != null && k.age >= 18 && k.age < 26 && ausb(k.name) == null) q.push({ id: "ausb:" + k.name, kid: k.name, text: `Ist ${k.name.split(" ")[0]} (${k.age}) noch in Ausbildung?`, why: "Dann gibt es den Kinderabzug weiterhin." });

    const miss = [];
    const want = (id, name, why) => { if (!S.na[id]) miss.push({ id, name, why }); };
    for (let i = 0; i < np; i++) if (!has("lohnausweis", i) && !has("rente", i) && !has("selbst", i) && !has("taggeld", i)) want("lohn" + i, "Lohnausweis " + S.persons[i].name, "Falls angestellt. Ohne Einkommensbeleg fehlt Ziffer 1.1.");
    if (!has("bank")) want("bank", "Bank- und Depotauszüge oder eSteuerauszug", "Für Vermögen (Ziffer 30.1) und Erträge (Ziffer 4.1).");
    if (!has("krankenkasse")) want("krankenkasse", "Prämienbescheinigung Krankenkasse", "Für den Versicherungsabzug (Ziffer 15).");
    for (let i = 0; i < np; i++) if (has("lohnausweis", i) && !has("saeule3a", i)) want("3a" + i, "Säule 3a " + S.persons[i].name, "Falls einbezahlt. Bis CHF " + nf.format(S3A_PK) + " abzugsfähig (Ziffer 14).");
    if (S.kinderU14 > 0 && !has("kita")) want("kita", "Rechnungen Kita, Hort, Tagesfamilie", "Falls Kinder fremdbetreut werden (Ziffer 16.6).");
    if (!has("steuerrechnung") && !has("steuererklaerung") && (!gfussSrc || !kfussSrc || (!zivilAuto && !O.zivil))) want("steuerrechnung", "Letzte Steuerrechnung oder Veranlagung", "Daraus lesen wir Zivilstand, Gemeinde und Steuerfüsse.");

    S.derived = {
      adults: adults.slice(0, 2).map((h, i) => ({ idx: i, name: S.persons[i].name, dob: h.dob, age: ageAt(h.dob, y), sources: [...h.sources] })),
      others: adults.slice(2).map(h => [h.vorname, h.nachname].filter(Boolean).join(" ")),
      kids: kidList, zivilAuto, zivilSrc: zivSrc ? zivSrc.name : null, gfussSrc, kfussSrc, konfSrc, unterstuetzte: PS ? PS.unterstuetzte_personen || 0 : 0,
      questions: q, missing: miss, separate: !verh && adults.length >= 2 ? S.persons[1].name : null
    };
    return S;
  }

  /* ---------- Formular wie auf Papier ---------- */
  // Feldcodes gemäss Formular «Steuererklärung 2025» des Kantonalen Steueramts Zürich (eine Nummer pro Zeile, für Staat und Bund gemeinsam).
  // Bei Feldern pro Person: [Person 1, Person 2]. Ziffer 16.4 ist in der Vorlage nicht eindeutig lesbar und deshalb leer.
  const FORM_CODES={"1.1":[100,101],"1.2":[102,103],"2.1":[120,121],"2.2":[122,123],"3.1":[130,131],"3.2":[134,136],"3.3":[140,141],"3.4":[142,143],
    "4.1":150,"4.2":151,"5.1":160,"5.2":161,"5.3":162,"5.4":163,"5.5":164,"6":188,"7":199,"11.1":220,"11.2":240,"12":250,"13.1":254,"13.2":255,"13.3":256,
    "14.1":262,"14.2":263,"15":270,"16.1":280,"16.2":292,"16.3":283,"16.5":284,"16.6":376,"17":290,"18":299,"19":199,"20":299,"21":310,"22.1":320,"22.2":324,
    "23":350,"24.1":370,"24.2":374,"24.3":365,"25":390,"26.1":394,"26.2":396,"27":398,"30.1":400,"30.2":404,"30.3":406,"30.4":412,"30.5":414,"30.6":416,
    "31.1":421,"31.2":422,"32":430,"33":460,"34":470,"35":490,"36.1":494,"36.2":496,"37":498};
  function formRows(S, R){
    const rows=R.rows, np=R.np;
    const g=(z,p)=>rows.filter(r=>r.z===z && (p===undefined || r.p===p)).reduce((a,r)=>({s:a.s+(+r.s||0), b:a.b+(r.b==null?0:+r.b||0)}),{s:0,b:0});
    const nm=p=>np===2?" · "+personName(S,p):"";
    const out=[];
    const page=t=>out.push({kind:"page",l:t});
    const head=(z,l)=>out.push({kind:"head",z,l});
    const v=(z,l,val,o)=>out.push(Object.assign({kind:"wert",z,l,s:val.s,b:val.b},o||{}));
    const one=x=>({s:x,b:x});
    const sum=(z,l,s,b,o)=>out.push(Object.assign({kind:"summe",z,l,s,b},o||{}));
    const total=(z,l,s,b,o)=>out.push(Object.assign({kind:"total",z,l,s,b},o||{}));
    const persons=[...Array(np).keys()];

    page("Seite 2 · Einkünfte im In- und Ausland");
    head("1","Einkünfte aus unselbständiger Erwerbstätigkeit");
    persons.forEach(p=>v("1.1","Haupterwerb"+nm(p),g("1.1",p),{sub:1,p}));
    persons.forEach(p=>v("1.2","Nebenerwerb"+nm(p),g("1.2",p),{sub:1,p}));
    head("2","Einkünfte aus selbständiger Erwerbstätigkeit");
    persons.forEach(p=>v("2.1","Haupterwerb"+nm(p),g("2.1",p),{sub:1,p}));
    persons.forEach(p=>v("2.2","Nebenerwerb"+nm(p),one(0),{sub:1,p}));
    head("3","Einkünfte aus Sozial- und anderen Versicherungen, Leibrenten");
    const pv=(key,p)=>one(valueOf(S,key,p));
    persons.forEach(p=>v("3.1","AHV-/IV-Renten (100 %)"+nm(p),pv("ahv_rente",p),{sub:1,p}));
    persons.forEach(p=>v("3.2","Renten/Pensionen"+nm(p),pv("pk_rente",p),{sub:1,p,note:"weitere Rente: Code "+(p?"137":"135")}));
    persons.forEach(p=>v("3.3","Erwerbsausfallentschädigungen aus Arbeitslosenversicherung"+nm(p),pv("alv",p),{sub:1,p}));
    persons.forEach(p=>v("3.4","Kinder- und Familienzulagen, Mutterschaftsentschädigungen, Taggelder"+nm(p),pv("taggelder",p),{sub:1,p}));
    head("4","Wertschriftenertrag");
    v("4.1","Ertrag aus Wertschriften, Guthaben und Lotterien",g("4.1"),{sub:1,note:"gemäss Wertschriftenverzeichnis"});
    v("4.2","Davon aus qualifizierten Beteiligungen",one(0),{sub:1});
    head("5","Übrige Einkünfte und Gewinne");
    v("5.1","Unterhaltsbeiträge vom geschiedenen/getrennten Ehegatten/Partner",g("5.1"),{sub:1});
    v("5.2","Unterhaltsbeiträge für minderjährige Kinder",one(0),{sub:1});
    v("5.3","Ertrag aus Geschäfts- und Korporationsanteilen",one(0),{sub:1});
    v("5.4","Weitere Einkünfte",g("5.4"),{sub:1});
    v("5.5","Kapitalabfindungen für wiederkehrende Leistungen",one(0),{sub:1});
    v("6","Nettoertrag aus Liegenschaften",g("6"),{note: R.raw.liegBrutto ? `Bruttoertrag ${nf.format(R.raw.liegBrutto)} abzüglich Unterhalt ${nf.format(R.raw.liegUnt)}` : ""});
    sum("7","Total der Einkünfte",R.ein,R.einB,{note:"Übertrag auf Seite 3, Ziffer 19"});

    page("Seite 3 · Abzüge");
    head("11","Berufsauslagen bei unselbständiger Erwerbstätigkeit");
    persons.forEach(p=>v("11."+(p+1),"Person "+(p+1)+nm(p),g("11."+(p+1)),{sub:1,note:"siehe Hilfsblatt Berufsauslagen"}));
    v("12","Schuldzinsen",g("12"));
    head("13","Unterhaltsbeiträge und Rentenleistungen");
    v("13.1","Unterhaltsbeiträge an den geschiedenen oder getrennt lebenden Ehegatten/Partner",g("13.1"),{sub:1});
    v("13.2","Unterhaltsbeiträge für minderjährige Kinder",one(0),{sub:1});
    v("13.3","Rentenleistungen, abzugsfähiger Ertragsanteil",one(0),{sub:1});
    head("14","Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (3. Säule a)");
    persons.forEach(p=>v("14."+(p+1),"Person "+(p+1)+nm(p),g("14."+(p+1)),{sub:1,note:"Bescheinigung: Code "+(p?"261":"260")}));
    v("15","Versicherungsprämien und Zinsen von Sparkapitalien",g("15"),{note:"siehe Hilfsblatt Versicherungsprämien"});
    head("16","Weitere Abzüge");
    v("16.1","Beiträge an die AHV, IV und 2. Säule (Einkauf)",g("16.1"),{sub:1});
    v("16.2","Berufsorientierte Aus- und Weiterbildungskosten",g("16.2"),{sub:1});
    v("16.3","Kosten für die Verwaltung des beweglichen Privatvermögens",one(0),{sub:1});
    v("16.4","Behinderungsbedingte Kosten",one(0),{sub:1,note:"Code bitte im Formular prüfen"});
    v("16.5","Weitere Abzüge (z.B. Beiträge an politische Parteien)",one(0),{sub:1});
    v("16.6","Abzug für fremdbetreute Kinder",g("16.6"),{sub:1,note: R.kidsU14 ? `Höchstens ${nf.format(R.Z.betreuung)} (Staat) bzw. ${nf.format(BUND.betreuung)} (Bund) je Kind` : ""});
    v("17","Sonderabzug bei Erwerbstätigkeit beider Ehegatten/Partner",g("17"));
    const t18=g("18");
    sum("18","Total der Abzüge",t18.s,t18.b,{note:"Übertrag in Ziffer 20"});

    page("Seite 3 · Einkommensberechnung");
    v("19","Total der Einkünfte",{s:R.ein,b:R.einB},{note:"Übertrag von Ziffer 7"});
    v("20","Total der Abzüge",t18,{note:"Übertrag von Ziffer 18"});
    const n21=g("21"); sum("21","Nettoeinkommen",n21.s,n21.b);
    head("22","Zusätzliche Abzüge");
    v("22.1","Krankheits- und Unfallkosten",g("22.1"),{sub:1,note:"Anteil über 5 % des Nettoeinkommens"});
    v("22.2","Gemeinnützige Zuwendungen",g("22.2"),{sub:1,note:"ab CHF 100, höchstens 20 % des Nettoeinkommens"});
    const r23=g("23"); sum("23","Reineinkommen",r23.s,r23.b);
    head("24","Steuerfreie Beträge (Sozialabzüge)");
    v("24.1","Abzug für Kinder in Ihrem Haushalt"+(R.kids?` (${R.kids})`:""),g("24.1"),{sub:1,note:"Kinder ausserhalb des Haushalts: Code 372"});
    v("24.2","Abzug für unterstützte Personen",one(0),{sub:1});
    const e243=g("24.3"); v("24.3","Abzug für Ehegatten/Partner",{s:0,b:e243.b},{sub:1});
    sum("25","Steuerbares Einkommen gesamt",Math.max(0,R.raw.e25s),Math.max(0,R.raw.e25b));
    head("26","Vom steuerbaren Einkommen entfallen auf");
    v("26.1","Steuerbare Einkünfte in anderen Kantonen",one(0),{sub:1});
    v("26.2","Steuerbare Einkünfte im Ausland",one(0),{sub:1});
    total("27","Steuerbares Einkommen im Kanton Zürich bzw. in der Schweiz",Math.max(0,R.raw.e25s),Math.max(0,R.raw.e25b));

    page("Seite 4 · Vermögen im In- und Ausland (nur Staats- und Gemeindesteuer)");
    head("30","Bewegliches Vermögen");
    const so={sub:1,staat:1};
    v("30.1","Wertschriften und Guthaben",g("30.1"),Object.assign({note:"gemäss Wertschriftenverzeichnis"},so));
    v("30.2","Bargeld, Gold und andere Edelmetalle",g("30.2"),so);
    v("30.3","Lebens- und Rentenversicherungen (Steuerwert)",g("30.3"),so);
    v("30.4","Motorfahrzeuge",g("30.4"),so);
    v("30.5","Geschäfts-/Korporationsanteile",one(0),so);
    v("30.6","Übrige Vermögenswerte",g("30.6"),so);
    head("31","Liegenschaften");
    v("31.1","Zum Verkehrswert besteuert",g("31.1"),so);
    v("31.2","Zum Ertragswert besteuert (Land- und Forstwirtschaft)",one(0),so);
    v("32","Eigenkapital Selbständigerwerbender",one(0),{staat:1});
    sum("33","Total der Vermögenswerte",R.raw.v33,null,{staat:1});
    v("34","Schulden",one(R.raw.v34),{staat:1});
    sum("35","Steuerbares Vermögen gesamt",Math.max(0,R.raw.v35),null,{staat:1});
    head("36","Vom steuerbaren Vermögen entfallen auf");
    v("36.1","Steuerbare Vermögenswerte in anderen Kantonen",one(0),so);
    v("36.2","Steuerbare Vermögenswerte im Ausland",one(0),so);
    total("37","Steuerbares Vermögen im Kanton Zürich",Math.max(0,R.raw.v35),null,{staat:1});
    for(const r of out){ const c=FORM_CODES[r.z]; if(c!=null) r.code = Array.isArray(c) ? c[r.p||0] : c; }
    return out;
  }

  /* ---------- Fallnummer und Name ---------- */
  // Fallnummer aus der Datenbank (Spalte nr, fallnummer.sql), sonst ein Kürzel aus der ID
  const fallNr = row => row && row.nr ? "TF-" + row.nr : row && row.id ? "TF-" + String(row.id).slice(0, 6).toUpperCase() : "";
  // Name: Angabe bei der Bezahlung, sonst die Personen aus den Belegen
  function fallName(row) {
    if (row.kunde_name && row.kunde_name.trim()) return row.kunde_name.trim();
    try {
      const S = stateFromRow(row); rebuild(S);
      const names = S.persons.slice(0, nPersons(S)).map(p => p.name).filter(n => n && !/^Person \d$/.test(n));
      if (names.length) return names.join(" und ");
    } catch (_) {}
    return "Noch ohne Namen";
  }

  return { fallNr, fallName, bundTarif, formRows, CASE, STATUS, stateFromRow, loadCase, saveCase, flushCase, setCaseStatus, typeName, rebuild, ZH, BUND, S3A_PK, GEMEINDEN, KEYS, DOCTYPES, emptyState, normalize, loadState, saveState, CLOUD,
    nf, nf2, chf, clamp, married, nPersons, personName, valueOf, setValue, checklist, calc, taxes, uid,
    findDuplicates, initLines, decideDuplicate, learnZuordnung, learnedKey, suggestions, applySuggestion, stichwort, undoDuplicate, loadLearn, openDuplicates, LEARN, normName };
})();
