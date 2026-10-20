// Gemeinsame Login- und Speicherfunktionen für alle Seiten.
window.SP = (function () {
  "use strict";
  const cfg = window.STEUERPILOT_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes("DEIN-PROJEKT") && !cfg.supabaseAnonKey.includes("DEIN-ANON-KEY"));
  const client = configured && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;
  const TABLE = "steuerdaten";
  const ALLOWED_NEXT = ["upload.html", "ergebnis.html"];

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
      const page = location.pathname.split("/").pop() || "upload.html";
      location.replace("login.html?next=" + encodeURIComponent(page));
      return new Promise(() => {});
    }
    return user;
  }

  function nextPage() {
    const n = new URLSearchParams(location.search).get("next");
    return ALLOWED_NEXT.includes(n) ? n : "upload.html";
  }

  async function logout() {
    if (client) await client.auth.signOut();
    location.replace("login.html");
  }

  async function load() {
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await client.from(TABLE).select("data").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }

  async function save(state) {
    const user = await getUser();
    if (!user) throw new Error("Nicht angemeldet");
    const { error } = await client.from(TABLE).upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  async function remove() {
    const user = await getUser();
    if (!user) return;
    const { error } = await client.from(TABLE).delete().eq("user_id", user.id);
    if (error) throw error;
  }

  return { configured, client, getUser, requireUser, nextPage, logout, load, save, remove };
})();
