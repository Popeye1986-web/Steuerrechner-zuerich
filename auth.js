// Gemeinsame Funktionen für Login, Rollen und Steuerfälle.
window.SP = (function () {
  "use strict";
  const cfg = window.STEUERPILOT_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes("DEIN-PROJEKT") && !cfg.supabaseAnonKey.includes("DEIN-ANON-KEY"));
  const client = configured && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;
  const FAELLE = "faelle";
  const NEXT_OK = /^(faelle|kunde|upload|ergebnis|bezahlen)\.html(\?fall=[0-9a-f-]{36})?$/;

  async function getUser() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return (data && data.session && data.session.user) || null;
  }

  // Leitet zur Login-Seite um, wenn niemand angemeldet ist.
  async function requireUser() {
    if (!client) return null;
    const user = await getUser();
    if (!user) {
      const page = (location.pathname.split("/").pop() || "faelle.html") + location.search;
      location.replace("login.html?next=" + encodeURIComponent(page));
      return new Promise(() => {});
    }
    return user;
  }

  // Besucher ohne Konto: unsichtbare, anonyme Anmeldung, damit die Belege geschützt gespeichert werden.
  const isGuest = u => !!(u && (u.is_anonymous || !u.email));
  async function ensureGuest() {
    const u = await getUser();
    if (u) return u;
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }

  let _pruefer = null;
  async function isPruefer() {
    if (!client) return false;
    if (_pruefer !== null) return _pruefer;
    const { data, error } = await client.rpc("ist_pruefer");
    _pruefer = !error && data === true;
    return _pruefer;
  }
  async function homePage() {
    if (await isPruefer()) return "faelle.html";
    return isGuest(await getUser()) ? "upload.html" : "kunde.html";
  }
  async function afterLogin() {
    const n = new URLSearchParams(location.search).get("next");
    if (n && NEXT_OK.test(n)) return n;
    return homePage();
  }

  async function logout() {
    if (client) await client.auth.signOut();
    location.replace("login.html");
  }

  /* ---------- Steuerfälle ---------- */
  async function listFaelle() {
    const { data, error } = await client.from(FAELLE).select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async function createFall(v) {
    const { data, error } = await client.from(FAELLE).insert({ kunde_name: v.name || "", kunde_email: v.email ? v.email.trim().toLowerCase() : null, jahr: v.jahr }).select().single();
    if (error) throw error;
    return data;
  }
  async function loadFall(id) {
    const { data, error } = await client.from(FAELLE).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function saveFall(id, patch) {
    const { data, error } = await client.from(FAELLE).update(patch).eq("id", id).select("status,updated_at").maybeSingle();
    if (error) throw error;
    return data;
  }
  async function deleteFall(id) {
    const { error } = await client.from(FAELLE).delete().eq("id", id);
    if (error) throw error;
  }

  // Aufruf der Zahlungsfunktion mit dem Login des Kunden
  async function zahlung(payload) {
    const { data } = await client.auth.getSession();
    const t = data && data.session ? data.session.access_token : "";
    const r = await fetch("/api/zahlung", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || "http"); e.status = r.status; throw e; }
    return j;
  }
  async function zahlungInfo() {
    try { const r = await fetch("/api/zahlung"); return r.ok ? await r.json() : { configured: false }; } catch (_) { return { configured: false }; }
  }

  return { zahlung, zahlungInfo, configured, client, getUser, requireUser, isGuest, ensureGuest, isPruefer, homePage, afterLogin, logout,
    listFaelle, createFall, loadFall, saveFall, deleteFall };
})();
