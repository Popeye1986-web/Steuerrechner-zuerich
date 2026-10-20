// taxflix Rechenkern: Tarife, Positionen, Belegliste, Speichern und Steuerberechnung.
// Wird von upload.html und ergebnis.html gemeinsam verwendet.
window.TX = (function () {
  "use strict";
  const INF = Infinity;

  /* ---------- Tarife und Abzüge ---------- */
  // Quellen: ZStB Nr. 48.1 (ab 2024 / ab 2026), Formular Steuererklärung ZH 2025, ESTV-Rundschreiben 2026.
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
  const BUND = {
    single: [[15200,0,.77],[33200,138.60,.88],[43500,229.20,2.64],[58000,612.00,2.97],[76200,1152.50,5.94],[82100,1502.95,6.60],[108900,3271.75,8.80],[141500,6140.55,11.00],[185100,10936.55,13.20]], singleFlat: 794000,
    verh: [[29700,0,1],[53400,237,2],[61300,395,3],[79100,929,4],[94900,1561,5],[108700,2251,6],[120600,2965,7],[130500,3658,8],[138400,4290,9],[144300,4821,10],[148300,5221,11],[150400,5452,12],[152400,5692,13]], verhFlat: 941400,
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
    clearTimeout(CASE.timer);
    CASE.timer = setTimeout(async () => {
      try { const r = await SP.saveFall(CASE.id, { data: S }); if (r) CASE.row.status = r.status; status("saved"); }
      catch (e) { status("error"); }
    }, 700);
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
  function bundTarif(inc, verh) {
    const tab = verh ? BUND.verh : BUND.single, flat = verh ? BUND.verhFlat : BUND.singleFlat;
    if (inc >= flat) return inc * 0.115;
    let t = 0; for (const [thr, base, rate] of tab) { if (inc >= thr) t = base + Math.floor((inc - thr) / 100) * rate; }
    return t;
  }
  function taxes(S, stE, stB, verm) {
    const Z = ZH[S.year], verh = married(S), kids = +S.kinder || 0, fam = verh || kids > 0;
    const einfE = stufen(stE, fam ? Z.verh : Z.grund, 100);
    const einfV = stufen(verm, fam ? Z.vverh : Z.vgrund, 1000);
    const einf = einfE + einfV;
    const kanton = einf * Z.kfuss / 100, gemeinde = einf * (+S.gfuss || 0) / 100, kirche = einf * (+S.kfuss || 0) / 100;
    const personal = PERSONALSTEUER * (verh ? 2 : 1);
    let bund = bundTarif(stB, fam) - (fam ? BUND.eltern * kids : 0);
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
          case "velo": return 700;
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
    const R = (z, l, s, b, kind, sec, note) => { rows.push({ z, l, s, b: b === undefined ? s : b, kind: kind || "wert", sec, note }); return { s, b: b === undefined ? s : b }; };
    const nameP = p => np === 2 ? " · " + personName(S, p) : "";

    // Seite 2: Einkünfte
    const sec1 = "Einkünfte (Seite 2)";
    let ein = 0;
    for (const x of P) if (x.lohn) { R("1.1", "Haupterwerb" + nameP(x.p), x.lohn, x.lohn, "wert", sec1); ein += x.lohn; }
    for (const x of P) if (x.neben) { R("1.2", "Nebenerwerb" + nameP(x.p), x.neben, x.neben, "wert", sec1); ein += x.neben; }
    for (const x of P) if (x.selbst) { R("2.1", "Selbständige Erwerbstätigkeit" + nameP(x.p), x.selbst, x.selbst, "wert", sec1); ein += x.selbst; }
    const e31 = tot("ahv_rente"), e32 = tot("pk_rente"), e33 = tot("alv"), e34 = tot("taggelder");
    if (e31) { R("3.1", "AHV-/IV-Renten (100 %)", e31, e31, "wert", sec1); ein += e31; }
    if (e32) { R("3.2", "Renten / Pensionen", e32, e32, "wert", sec1); ein += e32; }
    if (e33) { R("3.3", "Erwerbsausfallentschädigungen Arbeitslosenversicherung", e33, e33, "wert", sec1); ein += e33; }
    if (e34) { R("3.4", "Kinder-/Familienzulagen, Mutterschaft, Taggelder", e34, e34, "wert", sec1); ein += e34; }
    const e41 = tot("wertschriftenertrag");
    if (e41) { R("4.1", "Ertrag aus Wertschriften, Guthaben und Lotterien", e41, e41, "wert", sec1); ein += e41; }
    const e51 = tot("unterhalt_erhalten"), e54 = tot("uebrige_einkuenfte");
    if (e51) { R("5.1", "Unterhaltsbeiträge", e51, e51, "wert", sec1); ein += e51; }
    if (e54) { R("5.4", "Weitere Einkünfte", e54, e54, "wert", sec1); ein += e54; }
    const liegBrutto = tot("eigenmietwert") + tot("mietertrag");
    const liegUnt = tot("liegenschaft_unterhalt") > 0 ? tot("liegenschaft_unterhalt") : liegBrutto * 0.2;
    const e6 = liegBrutto - liegUnt;
    if (liegBrutto) { R("6", "Nettoertrag aus Liegenschaften", e6, e6, "wert", sec1, tot("liegenschaft_unterhalt") > 0 ? "" : "Unterhalt pauschal 20 %"); ein += e6; }
    R("7", "Total der Einkünfte", ein, ein, "summe", sec1);

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
    const lower = np === 2 ? Math.min(P[0].erwerb, P[1].erwerb) : 0;
    if (np === 2 && lower > 0) addA("17", "Sonderabzug bei Erwerbstätigkeit beider Ehegatten", Math.min(Z.zweiverd, lower), lower < BUND.zwMin ? lower : clamp(lower * .5, BUND.zwMin, BUND.zwMax));
    R("18", "Total der Abzüge", abS, abB, "summe", sec2);

    // Einkommensberechnung
    const sec3 = "Einkommensberechnung (Seite 3)";
    R("19", "Total der Einkünfte", ein, ein, "wert", sec3);
    R("20", "Total der Abzüge", abS, abB, "wert", sec3);
    const nS = ein - abS, nB = ein - abB;
    R("21", "Nettoeinkommen", nS, nB, "summe", sec3);
    const kk = tot("krankheitskosten");
    const k221S = Math.max(0, kk - Math.max(0, nS) * .05), k221B = Math.max(0, kk - Math.max(0, nB) * .05);
    if (kk) R("22.1", "Krankheits- und Unfallkosten", k221S, k221B, "wert", sec3, "Abzug über 5 % Selbstbehalt");
    const sp = tot("spenden");
    const k222S = sp >= 100 ? Math.min(sp, Math.max(0, nS - k221S) * .2) : 0, k222B = sp >= 100 ? Math.min(sp, Math.max(0, nB - k221B) * .2) : 0;
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
    return { y, Z, P, rows, ein, stE, stB, verm, T, grenz, versAkt, capS, vst: tot("verrechnungssteuer"), np, verh, kids };
  }

  /* ---------- Haushalt aus den Belegen ableiten ---------- */
  const norm = v => String(v || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const ageAt = (dob, year) => { const m = /^(\d{4})/.exec(dob || ""); return m ? year - +m[1] : null; };
  const ADULT_TYPES = ["lohnausweis", "saeule3a", "rente", "pk_einkauf", "taggeld", "selbst", "weiterbildung", "oev"];
  const typeName = id => (DOCTYPES.find(t => t.id === id) || { name: "Beleg" }).name;

  function rebuild(S) {
    const O = S.overrides = S.overrides || {};
    O.persons = O.persons || [{}, {}];
    O.ausbildung = O.ausbildung || {};
    const docs = S.docs.filter(d => d.result);
    // Steuerperiode: was die meisten Belege sagen, ausser die Person hat sie gewählt
    if (O.year && ZH[O.year]) S.year = O.year;
    else {
      const ys = {}; for (const d of docs) { const j = +d.result.jahr; if (d.type !== "steuerrechnung" && ZH[j]) ys[j] = (ys[j] || 0) + 1; }
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
      const hasAbo = S.docs.some(d => d.type === "oev" && ownerIdx(d) === i);
      S.persons[i] = {
        name: h ? [h.vorname, h.nachname].filter(Boolean).join(" ") || "Person " + (i + 1) : "Person " + (i + 1),
        dob: h ? h.dob : "",
        pk: o.pk != null ? o.pk : !(la && la.pk_beitraege === 0),
        verpflegung: o.verpflegung || (la && la.kantine ? "verbilligt" : "voll"),
        geschaeftsauto: o.geschaeftsauto != null ? o.geschaeftsauto : !!(la && la.geschaeftsauto),
        weg: o.weg || (hasAbo ? "oev" : la ? (la.gratis_transport ? "keine" : "offen") : "keine"),
        km: o.km || 0, tage: o.tage || 220, arbeitgeber: la && la.arbeitgeber ? String(la.arbeitgeber) : ""
      };
    }
    function ownerIdx(d) {
      if (d.personOverride === 0 || d.personOverride === 1) return d.personOverride;
      const i = d._owner ? adults.indexOf(d._owner) : -1;
      return i >= 0 ? i : 0;
    }

    // 4. Kinder
    const kidList = kids.map(h => ({ key: h.key, name: [h.vorname, h.nachname].filter(Boolean).join(" ") || "Kind", age: ageAt(h.dob, y) }));
    const kidsCount = kidList.filter(k => k.age == null || k.age < 18 || O.ausbildung[k.name]).length;
    S.kinder = O.kinder != null ? O.kinder : kidsCount;
    S.kinderU14 = O.kinderU14 != null ? O.kinderU14 : Math.min(S.kinder, kidList.filter(k => k.age != null && k.age <= 14).length);

    // 5. Gemeinde, Steuerfuss, Kirche
    const st = (docs.filter(d => d.type === "steuerrechnung").map(d => d.result.steuern).filter(Boolean))[0] || {};
    const orte = {};
    for (const d of docs) { const o = d.result.adresse && d.result.adresse.ort; if (o) orte[o] = (orte[o] || 0) + 1; }
    const ortAuto = st.gemeinde || Object.keys(orte).sort((a, b) => orte[b] - orte[a])[0] || "";
    S.gemeindeName = O.gemeindeName || ortAuto;
    const gMatch = GEMEINDEN.find(g => g.fuss && norm(g.name).split(" ")[0] === norm(S.gemeindeName).split(" ")[0]);
    let gfussSrc = null;
    if (O.gfuss != null) { S.gfuss = O.gfuss; gfussSrc = "Ihre Angabe"; }
    else if (st.steuerfuss_gemeinde) { S.gfuss = +st.steuerfuss_gemeinde; gfussSrc = "Steuerrechnung"; }
    else if (gMatch) { S.gfuss = gMatch.fuss; gfussSrc = "Gemeinde " + gMatch.name; }
    else { S.gfuss = S.gfuss || 119; gfussSrc = null; }
    let kfussSrc = null;
    if (O.kfuss != null) { S.kfuss = O.kfuss; kfussSrc = "Ihre Angabe"; }
    else if (st.steuerfuss_kirche != null && st.steuerfuss_kirche !== "") { S.kfuss = +st.steuerfuss_kirche || 0; kfussSrc = "Steuerrechnung"; }
    else if (st.konfession === "keine") { S.kfuss = 0; kfussSrc = "Steuerrechnung"; }
    else if (O.konfession === "keine") { S.kfuss = 0; kfussSrc = "Ihre Angabe"; }
    else { S.kfuss = 0; }

    // 6. Situation für die Belegliste
    const has = (type, i) => S.docs.some(d => d.type === type && (i === undefined || ownerIdx(d) === i));
    for (let i = 0; i < 2; i++) {
      S.sit.angestellt[i] = has("lohnausweis", i); S.sit.saeule3a[i] = has("saeule3a", i); S.sit.pkEinkauf[i] = has("pk_einkauf", i);
      S.sit.rente[i] = has("rente", i); S.sit.taggeld[i] = has("taggeld", i); S.sit.selbst[i] = has("selbst", i); S.sit.weiterbildung[i] = has("weiterbildung", i);
    }
    S.sit.kita = has("kita"); S.sit.liegenschaft = has("liegenschaft"); S.sit.kredit = has("hypothek"); S.sit.spenden = has("spenden");
    S.sit.krankheit = has("krankheit"); S.sit.unterhalt = has("unterhalt");

    // 7. Werte aus den Belegen neu aufbauen (Korrekturen pro Beleg gehen vor)
    S.items = [];
    for (const d of S.docs) {
      const vals = {};
      for (const p of ((d.result && d.result.positionen) || [])) { if (KEYS[p.key]) vals[p.key] = (vals[p.key] || 0) + (+p.betrag || 0); }
      for (const [k, v] of Object.entries(d.edits || {})) { if (KEYS[k]) vals[k] = +v || 0; }
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
    if (!kfussSrc) q.push({ id: "kirche", text: O.konfession ? `Wie hoch ist der Kirchensteuerfuss (${O.konfession})?` : "Sind Sie Mitglied einer Landeskirche?", why: "Für die Kirchensteuer. Steht auf der letzten Steuerrechnung." });
    for (let i = 0; i < np; i++) if (S.persons[i].weg === "offen") q.push({ id: "weg" + i, person: i, text: `Wie kommt ${S.persons[i].name.split(" ")[0]} zur Arbeit?`, why: "Für den Fahrkostenabzug. Mit ÖV-Abo einfach die Quittung hochladen." });
    for (const k of kidList) if (k.age != null && k.age >= 18 && k.age < 26 && O.ausbildung[k.name] == null) q.push({ id: "ausb:" + k.name, kid: k.name, text: `Ist ${k.name.split(" ")[0]} (${k.age}) noch in Ausbildung?`, why: "Dann gibt es den Kinderabzug weiterhin." });

    const miss = [];
    const want = (id, name, why) => { if (!S.na[id]) miss.push({ id, name, why }); };
    for (let i = 0; i < np; i++) if (!has("lohnausweis", i) && !has("rente", i) && !has("selbst", i) && !has("taggeld", i)) want("lohn" + i, "Lohnausweis " + S.persons[i].name, "Falls angestellt. Ohne Einkommensbeleg fehlt Ziffer 1.1.");
    if (!has("bank")) want("bank", "Bank- und Depotauszüge oder eSteuerauszug", "Für Vermögen (Ziffer 30.1) und Erträge (Ziffer 4.1).");
    if (!has("krankenkasse")) want("krankenkasse", "Prämienbescheinigung Krankenkasse", "Für den Versicherungsabzug (Ziffer 15).");
    for (let i = 0; i < np; i++) if (has("lohnausweis", i) && !has("saeule3a", i)) want("3a" + i, "Säule 3a " + S.persons[i].name, "Falls einbezahlt. Bis CHF " + nf.format(S3A_PK) + " abzugsfähig (Ziffer 14).");
    if (S.kinderU14 > 0 && !has("kita")) want("kita", "Rechnungen Kita, Hort, Tagesfamilie", "Falls Kinder fremdbetreut werden (Ziffer 16.6).");
    if (!has("steuerrechnung") && (!gfussSrc || !kfussSrc || (!zivilAuto && !O.zivil))) want("steuerrechnung", "Letzte Steuerrechnung oder Veranlagung", "Daraus lesen wir Zivilstand, Gemeinde und Steuerfüsse.");

    S.derived = {
      adults: adults.slice(0, 2).map((h, i) => ({ idx: i, name: S.persons[i].name, dob: h.dob, age: ageAt(h.dob, y), sources: [...h.sources] })),
      others: adults.slice(2).map(h => [h.vorname, h.nachname].filter(Boolean).join(" ")),
      kids: kidList, zivilAuto, zivilSrc: zivSrc ? zivSrc.name : null, gfussSrc, kfussSrc,
      questions: q, missing: miss, separate: !verh && adults.length >= 2 ? S.persons[1].name : null
    };
    return S;
  }

  return { CASE, STATUS, stateFromRow, loadCase, saveCase, setCaseStatus, typeName, rebuild, ZH, BUND, S3A_PK, GEMEINDEN, KEYS, DOCTYPES, emptyState, normalize, loadState, saveState, CLOUD,
    nf, nf2, chf, clamp, married, nPersons, personName, valueOf, setValue, checklist, calc, taxes, uid };
})();
