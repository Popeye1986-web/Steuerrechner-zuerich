// Vercel-Funktion: Online-Zahlung mit Stripe Checkout (Karte, TWINT, Apple Pay, Google Pay).
// Nötige Umgebungsvariablen in Vercel (Settings → Environment Variables):
//   STRIPE_SECRET_KEY          Geheimer Schlüssel aus dashboard.stripe.com (sk_test_… zum Testen, sk_live_… echt)
//   PREIS_CHF                  Preis pro Steuererklärung in Franken, z.B. 89
//   SUPABASE_SERVICE_ROLE_KEY  Supabase → Project Settings → API Keys → service_role / secret (geheim!)
//   SUPABASE_URL, SUPABASE_ANON_KEY  wie bereits eingerichtet
// Welche Zahlungsarten erscheinen, stellst du im Stripe-Dashboard ein (Settings → Payment methods).

const env = k => process.env[k] || "";
const SB = () => env("SUPABASE_URL").replace(/\/$/, "");
const preis = () => { const p = Number(String(env("PREIS_CHF")).replace(",", ".")); return isFinite(p) && p > 0 ? Math.round(p * 100) / 100 : null; };
const configured = () => !!(env("STRIPE_SECRET_KEY") && env("SUPABASE_SERVICE_ROLE_KEY") && env("SUPABASE_URL") && env("SUPABASE_ANON_KEY") && preis());

async function userFromToken(token) {
  if (!token) return null;
  const r = await fetch(SB() + "/auth/v1/user", { headers: { Authorization: "Bearer " + token, apikey: env("SUPABASE_ANON_KEY") } });
  return r.ok ? r.json() : null;
}
function admin(path, opts) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(SB() + "/rest/v1/" + path, Object.assign({}, opts, {
    headers: Object.assign({ apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation" }, (opts && opts.headers) || {})
  }));
}
async function getFall(id) {
  const r = await admin("faelle?id=eq." + encodeURIComponent(id) + "&select=id,kunde_name,kunde_email,jahr,status,bezahlt,zahlung_session");
  if (!r.ok) throw new Error("db");
  const j = await r.json();
  return j[0] || null;
}
async function patchFall(id, patch) {
  const r = await admin("faelle?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(patch) });
  if (!r.ok) throw new Error("db");
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

// Prüft bei Stripe, ob bezahlt wurde, und markiert den Fall
async function confirm(fall, sessionId) {
  if (fall.bezahlt) return true;
  const sid = sessionId || fall.zahlung_session;
  if (!sid || !/^cs_[A-Za-z0-9_]+$/.test(sid)) return false;
  const s = await stripe("checkout/sessions/" + sid, null, "GET");
  const sameCase = (s.metadata && s.metadata.fall === fall.id) || s.client_reference_id === fall.id;
  if (s.payment_status !== "paid" || !sameCase) return false;
  await patchFall(fall.id, { bezahlt: true, bezahlt_am: new Date().toISOString(), betrag_chf: (s.amount_total || 0) / 100, status: "eingereicht", zahlung_session: s.id });
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ configured: configured(), preis: preis() });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!configured()) return res.status(503).json({ error: "not_configured" });

  const user = await userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!user || !user.email) return res.status(401).json({ error: "unauthorized" });

  const body = req.body || {};
  const id = String(body.fall || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: "bad_request" });

  try {
    const fall = await getFall(id);
    if (!fall || String(fall.kunde_email).toLowerCase() !== String(user.email).toLowerCase()) return res.status(404).json({ error: "not_found" });

    if (body.action === "pruefen") {
      const ok = await confirm(fall, body.session);
      return res.status(200).json({ bezahlt: ok });
    }

    if (body.action === "start") {
      if (fall.bezahlt) return res.status(200).json({ bezahlt: true });
      const origin = "https://" + (req.headers["x-forwarded-host"] || req.headers.host);
      const amount = Math.round(preis() * 100);
      const s = await stripe("checkout/sessions", {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "chf",
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][product_data][name]": `Steuererklärung ${fall.jahr} · Kanton Zürich`,
        "line_items[0][price_data][product_data][description]": "Prüfung der Belege und Vorbereitung der Steuererklärung durch taxflix",
        success_url: `${origin}/kunde.html?fall=${fall.id}&bezahlt={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/bezahlen.html?fall=${fall.id}&abbruch=1`,
        customer_email: user.email,
        client_reference_id: fall.id,
        "metadata[fall]": fall.id,
        locale: "de"
      });
      await patchFall(fall.id, { zahlung_session: s.id });
      return res.status(200).json({ url: s.url });
    }

    return res.status(400).json({ error: "bad_request" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "server" });
  }
};
