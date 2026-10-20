// Vercel-Funktion: Online-Zahlung mit Stripe Checkout (Karte, TWINT, Apple Pay, Google Pay)
// und Versand des ausgefüllten Formulars per E-Mail.
// Nötige Umgebungsvariablen in Vercel (Settings → Environment Variables):
//   STRIPE_SECRET_KEY          Geheimer Schlüssel aus dashboard.stripe.com (sk_test_… zum Testen, sk_live_… echt)
//   PREIS_CHF                  Preis pro Steuererklärung in Franken, z.B. 89
//   SUPABASE_SERVICE_ROLE_KEY  Supabase → Project Settings → API Keys → service_role / secret (geheim!)
//   SUPABASE_URL, SUPABASE_ANON_KEY  wie bereits eingerichtet
//   RESEND_API_KEY, MAIL_FROM  für den E-Mail-Versand (siehe lib/formular.js), MAIL_KOPIE optional
// Welche Zahlungsarten erscheinen, stellst du im Stripe-Dashboard ein (Settings → Payment methods).

const L = require("../lib/server.js");

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const owns = (fall, user) => !!fall && (
  (fall.kunde_id && fall.kunde_id === user.id) ||
  (user.email && fall.kunde_email && String(fall.kunde_email).toLowerCase() === String(user.email).toLowerCase()));

module.exports = async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ configured: L.configured(), preis: L.preis(), mail: L.mailConfigured() });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!L.configured()) return res.status(503).json({ error: "not_configured" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await L.userFromToken(token);
  if (!user || !user.id) return res.status(401).json({ error: "unauthorized" });

  const body = req.body || {};
  const id = String(body.fall || "");
  if (!L.ID.test(id)) return res.status(400).json({ error: "bad_request" });

  try {
    const fall = await L.getFall(id);

    // Prüfer: Formular (erneut) an den Kunden senden
    if (body.action === "senden") {
      if (!(await L.istPruefer(token))) return res.status(403).json({ error: "forbidden" });
      if (!fall) return res.status(404).json({ error: "not_found" });
      if (!L.mailConfigured()) return res.status(503).json({ error: "mail_not_configured" });
      if (!fall.kunde_email) return res.status(400).json({ error: "no_email" });
      const ok = await L.formularSenden(fall, body.geprueft !== false);
      return ok ? res.status(200).json({ gesendet: true, an: fall.kunde_email }) : res.status(502).json({ error: "mail" });
    }

    if (!owns(fall, user)) return res.status(404).json({ error: "not_found" });

    if (body.action === "pruefen") {
      const ok = await L.confirm(fall, body.session);
      const neu = ok ? await L.getFall(id) : fall;
      return res.status(200).json({ bezahlt: ok, email: neu.kunde_email || null, gesendet: !!neu.mail_gesendet_am });
    }

    if (body.action === "start") {
      if (fall.bezahlt) return res.status(200).json({ bezahlt: true });
      if (fall.status !== "offen") return res.status(409).json({ error: "locked" });
      const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
      if (name.length < 2) return res.status(400).json({ error: "name" });
      if (!EMAIL.test(email)) return res.status(400).json({ error: "email" });
      const docs = (fall.data && fall.data.docs) || [];
      if (!docs.length) return res.status(400).json({ error: "no_docs" });

      const origin = "https://" + (req.headers["x-forwarded-host"] || req.headers.host);
      const amount = Math.round(L.preis() * 100);
      const s = await L.stripe("checkout/sessions", {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "chf",
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][product_data][name]": `Steuererklärung ${fall.jahr} · Kanton Zürich`,
        "line_items[0][price_data][product_data][description]": "Prüfung der Belege und ausgefüllte Steuererklärung per E-Mail",
        success_url: `${origin}/bezahlen.html?fall=${fall.id}&bezahlt={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/bezahlen.html?fall=${fall.id}&abbruch=1`,
        customer_email: email,
        client_reference_id: fall.id,
        "metadata[fall]": fall.id,
        locale: "de"
      });
      await L.patchFall(fall.id, { zahlung_session: s.id, kunde_name: name, kunde_email: email });
      return res.status(200).json({ url: s.url });
    }

    return res.status(400).json({ error: "bad_request" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "server" });
  }
};
