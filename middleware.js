// taxflix: Vorläufiger Zugangsschutz für die ganze Website (Vercel Routing Middleware).
// Aktiv nur, wenn in Vercel die Umgebungsvariable SITE_PASSWORD gesetzt ist.
// Zum Freischalten der Website: SITE_PASSWORD in Vercel löschen und neu veröffentlichen (Redeploy).
// Die Server-Funktionen unter /api sind ausgenommen (eigener Schutz, Stripe muss sie erreichen).

export const config = { matcher: ["/((?!api/).*)"] };

const COOKIE = "taxflix_zugang";

async function token(pw) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("taxflix-zugang:" + pw));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const safeNext = n => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/__zugang")) ? n : "/";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function page(next, wrong) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>taxflix · Zugang</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:linear-gradient(170deg,#0b1f38 0%,#13304f 100%);font-family:"Instrument Sans","Helvetica Neue",Arial,sans-serif;color:#0e1a2b}
.card{width:100%;max-width:400px;background:#fff;border-radius:12px;padding:32px;display:flex;flex-direction:column;gap:20px;box-shadow:0 24px 48px rgba(0,0,0,.28)}
.wm{display:inline-flex;align-items:center;font-weight:700;font-size:24px;letter-spacing:-.035em}
.wm::before{content:"";width:26px;height:26px;margin-right:9px;background:#14406e;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}
.wm b{color:#14406e}
:root{--m:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1.5 3.5 4.8v6.4c0 5.3 3.6 9.9 8.5 11.3 4.9-1.4 8.5-6 8.5-11.3V4.8L12 1.5Zm-1.3 14.6-3.9-3.9 1.5-1.5 2.4 2.4 5.2-5.2 1.5 1.5-6.7 6.7Z'/%3E%3C/svg%3E")}
h1{margin:0;font-size:26px;letter-spacing:-.02em}
p{margin:0;color:#5b6778}
form{display:flex;flex-direction:column;gap:14px}
label{font-weight:500;font-size:14px;color:#3a4656}
input{min-height:46px;padding:10px 12px;border:1px solid #d9e0e8;border-radius:8px;font:inherit;width:100%}
input:focus{outline:none;border-color:#14406e;box-shadow:0 0 0 3px rgba(20,64,110,.12)}
button{min-height:48px;border:0;border-radius:8px;background:#14406e;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#0e3157}
.bad{background:#fdecea;color:#b42318;border-radius:8px;padding:10px 12px;font-size:15px}
small{color:#5b6778;font-size:13px}
</style></head><body>
<main class="card">
<span class="wm">tax<b>flix</b></span>
<div style="display:flex;flex-direction:column;gap:6px"><h1>Bald verfügbar</h1><p>Diese Seite ist noch nicht öffentlich. Bitte geben Sie das Passwort ein.</p></div>
<form method="post" action="/__zugang">
<input type="hidden" name="next" value="${esc(next)}">
<div style="display:flex;flex-direction:column;gap:6px"><label for="pw">Passwort</label><input id="pw" name="pw" type="password" autocomplete="current-password" required autofocus></div>
${wrong ? '<div class="bad" role="alert">Das Passwort stimmt nicht.</div>' : ""}
<button type="submit">Weiter</button>
</form>
<small>taxflix · Clarity A&amp;A GmbH</small>
</main></body></html>`;
  return new Response(html, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export default async function middleware(request) {
  const pw = process.env.SITE_PASSWORD;
  if (!pw) return; // kein Passwort gesetzt: Website ist offen
  const url = new URL(request.url);
  const t = await token(pw);
  const cookies = (request.headers.get("cookie") || "").split(/;\s*/);
  if (cookies.includes(COOKIE + "=" + t)) return; // Zugang vorhanden: Seite normal ausliefern

  if (url.pathname === "/__zugang" && request.method === "POST") {
    let form; try { form = await request.formData(); } catch (_) { form = new FormData(); }
    const next = safeNext(form.get("next"));
    if (form.get("pw") === pw) {
      return new Response(null, { status: 303, headers: {
        Location: next, "Cache-Control": "no-store",
        "Set-Cookie": `${COOKIE}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
      } });
    }
    return page(next, true);
  }
  return page(safeNext(url.pathname + url.search), false);
}
