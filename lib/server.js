// taxflix: gemeinsame Server-Hilfen (Supabase mit service_role, Stripe, Zahlung bestätigen und Formular senden).

const { sendFormular, mailConfigured } = require("./formular.js");

const env = k => process.env[k] || "";
const SB = () => env("SUPABASE_URL").replace(/\/$/, "");
const preis = () => { const p = Number(String(env("PREIS_CHF")).replace(",", ".")); return isFinite(p) && p > 0 ? Math.round(p * 100) / 100 : null; };
const configured = () => !!(env("STRIPE_SECRET_KEY") && env("SUPABASE_SERVICE_ROLE_KEY") && env("SUPABASE_URL") && env("SUPABASE_ANON_KEY") && preis());
const ID = /^[0-9a-f-]{36}$/;

async function userFromToken(token) {
  if (!token) return null;
  const r = await fetch(SB() + "/auth/v1/user", { headers: { Authorization: "Bearer " + token, apikey: env("SUPABASE_ANON_KEY") } });
  return r.ok ? r.json() : null;
}
async function istPruefer(token) {
  const r = await fetch(SB() + "/rest/v1/rpc/ist_pruefer", {
    method: "POST", headers: { Authorization: "Bearer " + token, apikey: env("SUPABASE_ANON_KEY"), "Content-Type": "application/json" }, body: "{}"
  });
  return r.ok && (await r.json()) === true;
}
function admin(path, opts) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(SB() + "/rest/v1/" + path, Object.assign({}, opts, {
    headers: Object.assign({ apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation" }, (opts && opts.headers) || {})
  }));
}
async function getFall(id) {
  const r = await admin("faelle?id=eq." + encodeURIComponent(id) + "&select=*");
  if (!r.ok) throw new Error("db");
  const j = await r.json();
  return j[0] || null;
}
// Ändert den Fall. Mit "bedingung" (z.B. "&bezahlt=is.false") nur, wenn sie zutrifft. Gibt die geänderte Zeile zurück oder null.
async function patchFall(id, patch, bedingung) {
  const r = await admin("faelle?id=eq." + encodeURIComponent(id) + (bedingung || ""), { method: "PATCH", body: JSON.stringify(patch) });
  if (!r.ok) { console.error("DB", r.status, await r.text().catch(() => "")); throw new Error("db"); }
  const j = await r.json();
  return j[0] || null;
}
async function stripe(path, form, method) {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: method || "POST",
    headers: { Authorization: "Bearer " + env("STRIPE_SECRET_KEY"), "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined
  });
  const j = await r.json();
  if (!r.ok) { console.error("Stripe", r.status, j && j.error && j.error.message); throw new Error("stripe"); }
  return j;
}

// Schickt das Formular und merkt sich den Zeitpunkt. Fehler beim Versand brechen die Zahlung nicht ab.
async function formularSenden(fall, geprueft) {
  if (!mailConfigured() || !fall.kunde_email) return false;
  try {
    await sendFormular(fall, { geprueft: !!geprueft });
    await patchFall(fall.id, { mail_gesendet_am: new Date().toISOString() });
    return true;
  } catch (e) { console.error("Formular senden", e.message); return false; }
}

// Prüft bei Stripe, ob bezahlt wurde. Markiert den Fall genau einmal als bezahlt und schickt dann das Formular.
async function confirm(fall, sessionId) {
  if (fall.bezahlt) return true;
  const sid = sessionId || fall.zahlung_session;
  if (!sid || !/^cs_[A-Za-z0-9_]+$/.test(sid)) return false;
  const s = await stripe("checkout/sessions/" + sid, null, "GET");
  const sameCase = (s.metadata && s.metadata.fall === fall.id) || s.client_reference_id === fall.id;
  if (s.payment_status !== "paid" || !sameCase) return false;
  const email = fall.kunde_email || (s.customer_details && s.customer_details.email) || null;
  const neu = await patchFall(fall.id, {
    bezahlt: true, bezahlt_am: new Date().toISOString(), betrag_chf: (s.amount_total || 0) / 100,
    status: "eingereicht", zahlung_session: s.id, kunde_email: email
  }, "&bezahlt=is.false");
  if (neu) await formularSenden(neu, false);
  return true;
}

module.exports = { env, preis, configured, ID, userFromToken, istPruefer, getFall, patchFall, stripe, confirm, formularSenden, mailConfigured };
