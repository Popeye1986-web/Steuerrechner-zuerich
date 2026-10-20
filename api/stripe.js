// Vercel-Funktion: Benachrichtigung von Stripe nach einer Zahlung (Webhook).
// Sorgt dafür, dass der Fall auch dann als bezahlt gilt und das Formular verschickt wird,
// wenn der Kunde das Fenster nach der Zahlung sofort schliesst.
// Einrichten in Stripe: Developers → Webhooks → Add endpoint
//   URL:    https://<deine-adresse>/api/stripe
//   Events: checkout.session.completed, checkout.session.async_payment_succeeded
// Sicherheit: Die Nachricht selbst wird nicht vertraut. Die Zahlung wird immer direkt bei Stripe nachgefragt.

const L = require("../lib/server.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!L.configured()) return res.status(503).json({ error: "not_configured" });
  const ev = req.body || {};
  const obj = (ev.data && ev.data.object) || {};
  if (!/^checkout\.session\./.test(String(ev.type || "")) || !/^cs_[A-Za-z0-9_]+$/.test(String(obj.id || ""))) return res.status(200).json({ ignoriert: true });
  try {
    const s = await L.stripe("checkout/sessions/" + obj.id, null, "GET");
    const id = (s.metadata && s.metadata.fall) || s.client_reference_id || "";
    if (!L.ID.test(id)) return res.status(200).json({ ignoriert: true });
    const fall = await L.getFall(id);
    if (!fall) return res.status(200).json({ ignoriert: true });
    const ok = await L.confirm(fall, s.id);
    return res.status(200).json({ bezahlt: ok });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
};
