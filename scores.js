/* GET/POST /api/scores : public Roo Arcade leaderboard for groupkangaroo.com/arcade.
   Setting (Azure Static Web App > Environment variables):
     SCORES_CONNECTION  connection string of an Azure Storage account (Table storage). Without it the board shows "opens soon".
   GET  ?game=outback|run|cross            -> { today: [{name, score}], all: [{name, score}] }  (top 10 each, day = Montreal time)
   POST { game, name, score, dur }       -> keeps each name's best score today and all-time */
const { app } = require('@azure/functions');
const logic = require('../scores-logic');

let client = null;
async function table() {
  if (client) return client;
  const conn = process.env.SCORES_CONNECTION; if (!conn) return null;
  const { TableClient } = require('@azure/data-tables');
  const c = TableClient.fromConnectionString(conn, 'arcadescores');
  try { await c.createTable(); } catch (e) { /* already exists */ }
  client = {
    get: async (pk, rk) => { try { return await c.getEntity(pk, rk); } catch (e) { if (e.statusCode === 404) return null; throw e; } },
    put: (ent) => c.upsertEntity(ent, 'Replace'),
    list: async (pk) => { const out = []; const it = c.listEntities({ queryOptions: { filter: `PartitionKey eq '${pk.replace(/'/g, "''")}'` } }); for await (const e of it) { out.push(e); if (out.length > 2000) break; } return out; }
  };
  return client;
}

const recent = new Map(); // per-instance rate limit: 1 score per IP every 8 seconds

app.http('scores', {
  methods: ['GET', 'POST'], authLevel: 'anonymous',
  handler: async (req) => {
    const store = await table().catch(() => null);
    if (!store) return { status: 200, jsonBody: { off: true }, headers: { 'Cache-Control': 'no-store' } };
    if (req.method === 'GET') {
      const game = logic.game(new URL(req.url).searchParams.get('game'));
      if (!game) return { status: 400, jsonBody: { ok: false } };
      return { status: 200, jsonBody: await logic.top(store, game), headers: { 'Cache-Control': 'no-store' } };
    }
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown', now = Date.now();
    if (now - (recent.get(ip) || 0) < 8000) return { status: 429, jsonBody: { ok: false } };
    recent.set(ip, now); if (recent.size > 5000) recent.clear();
    let d; try { d = await req.json(); } catch { return { status: 400, jsonBody: { ok: false } }; }
    const r = await logic.submit(store, d);
    return { status: r.ok ? 200 : 400, jsonBody: r };
  }
});
