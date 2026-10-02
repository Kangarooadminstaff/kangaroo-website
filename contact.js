/* POST /api/contact : quote requests and job applications from groupkangaroo.com, emailed through Microsoft 365 (Graph, app-only).
   Settings (Azure Static Web App > Environment variables):
     KG_TENANT_ID, KG_CLIENT_ID, KG_CLIENT_SECRET  app registration with Microsoft Graph "Mail.Send" (Application) + admin consent
     MAIL_FROM     mailbox the emails are sent from, e.g. reception@groupkangaroo.com
     QUOTE_TO      where quote requests go (default teamcasa@groupkangaroo.com)
     CAREERS_TO    where applications go (default hr@groupkangaroo.com) */
const { app } = require('@azure/functions');

const LIMITS = { field: 2000, notes: 5000, file: 4 * 1024 * 1024 };
const recent = new Map(); // simple per-instance rate limit: 5 sends per IP per 10 minutes

function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function clean(v, max) { return String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max || LIMITS.field).trim(); }
function okEmail(e) { return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e); }

let tokenCache = { value: null, exp: 0 };
async function token() {
  if (tokenCache.value && Date.now() < tokenCache.exp - 60000) return tokenCache.value;
  const body = new URLSearchParams({ client_id: process.env.KG_CLIENT_ID, client_secret: process.env.KG_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
  const r = await fetch(`https://login.microsoftonline.com/${process.env.KG_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', body });
  if (!r.ok) throw new Error('token ' + r.status);
  const j = await r.json(); tokenCache = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 }; return j.access_token;
}

const LABELS = {
  quote: [['name', 'Name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['origin', 'Origin'], ['destination', 'Destination'], ['equipment', 'Equipment'], ['temp', 'Temperature'], ['date', 'Pickup date'], ['load', 'Pallets / weight'], ['notes', 'Details']],
  career: [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['role', 'Position'], ['message', 'Message']]
};

app.http('contact', {
  methods: ['POST'], authLevel: 'anonymous',
  handler: async (req, ctx) => {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const now = Date.now(), hits = (recent.get(ip) || []).filter(t => now - t < 600000);
    if (hits.length >= 5) return { status: 429, jsonBody: { ok: false, error: 'Too many requests' } };

    let d; try { d = await req.json(); } catch { return { status: 400, jsonBody: { ok: false } }; }
    const kind = d && d.kind === 'career' ? 'career' : d && d.kind === 'quote' ? 'quote' : null;
    const f = (d && d.fields) || {};
    // spam guards: hidden field must be empty, form must have been open a few seconds
    if (!kind || clean(f.website) || !(Number(d.t) > 3000)) return { status: 200, jsonBody: { ok: true } };
    const email = clean(f.email, 200), name = clean(f.name, 200);
    if (!name || !okEmail(email)) return { status: 400, jsonBody: { ok: false, error: 'Missing name or email' } };
    if (kind === 'quote' && (!clean(f.company) || !clean(f.origin) || !clean(f.destination))) return { status: 400, jsonBody: { ok: false } };

    const from = process.env.MAIL_FROM;
    const to = kind === 'quote' ? (process.env.QUOTE_TO || 'teamcasa@groupkangaroo.com') : (process.env.CAREERS_TO || 'hr@groupkangaroo.com');
    const rows = LABELS[kind].map(([k, lab]) => { const v = clean(f[k], k === 'notes' || k === 'message' ? LIMITS.notes : LIMITS.field); return v ? `<tr><td style="padding:6px 12px;color:#666;vertical-align:top">${lab}</td><td style="padding:6px 12px;white-space:pre-wrap"><b>${esc(v)}</b></td></tr>` : ''; }).join('');
    const subject = kind === 'quote'
      ? `Quote request: ${clean(f.origin, 80)} → ${clean(f.destination, 80)} (${clean(f.company, 80)})`
      : `Job application: ${clean(f.role, 80)} (${name})`;
    const msg = {
      subject,
      body: { contentType: 'HTML', content: `<div style="font-family:Arial,sans-serif;font-size:14px"><p>New ${kind === 'quote' ? 'quote request' : 'job application'} from groupkangaroo.com (${({fr:'French',en:'English',es:'Spanish',it:'Italian',zh:'Chinese',pa:'Punjabi'})[d.lang] || 'English'} site).</p><table style="border-collapse:collapse">${rows}</table><p style="color:#888;font-size:12px">Reply to this email to answer ${esc(name)} directly.</p></div>` },
      toRecipients: [{ emailAddress: { address: to } }],
      replyTo: [{ emailAddress: { address: email, name } }]
    };
    if (kind === 'career' && d.file && d.file.b64) {
      const size = Math.floor(d.file.b64.length * 3 / 4);
      const okType = /pdf|msword|officedocument/.test(d.file.type || '') || /\.(pdf|docx?)$/i.test(d.file.name || '');
      if (size > LIMITS.file || !okType) return { status: 400, jsonBody: { ok: false, error: 'Résumé must be a PDF or Word file under 4 MB' } };
      msg.attachments = [{ '@odata.type': '#microsoft.graph.fileAttachment', name: clean(d.file.name, 120).replace(/[\\/:*?"<>|]/g, '_') || 'resume.pdf', contentType: d.file.type || 'application/octet-stream', contentBytes: d.file.b64 }];
    }
    try {
      const t = await token();
      const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, saveToSentItems: false }) });
      if (!r.ok) { ctx.error('sendMail failed', r.status, await r.text()); return { status: 502, jsonBody: { ok: false } }; }
      hits.push(now); recent.set(ip, hits);
      return { status: 200, jsonBody: { ok: true } };
    } catch (e) { ctx.error('contact error', e.message); return { status: 502, jsonBody: { ok: false } }; }
  }
});
