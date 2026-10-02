/* Roo Arcade leaderboard rules, kept apart from storage so they can be tested.
   store: { get(pk, rk), put(entity), list(pk) } */
const GAMES = { outback: 1, run: 1, cross: 1 };
// a generous ceiling on points per second played, per game, plus a small start allowance (blocks obvious fakes)
const RATE = { outback: 170, run: 140, cross: 70 }, BASE = { outback: 15000, run: 600, cross: 1500 };
// names that never go on the board (EN/FR basics; anything matching becomes "Roo Fan")
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'pussy', 'nigg', 'faggot', 'whore', 'slut', 'rapist', 'nazi', 'hitler', 'porn', 'asshole', 'retard', 'motherf',
  'merde', 'putain', 'salope', 'connard', 'encul', 'tabarn', 'ostie', 'calisse', 'calice', 'ciboire', 'negre', 'kkk'];

function game(g) { return GAMES[g] ? g : null; }
function montrealDay(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
function cleanName(s) { return String(s || '').normalize('NFKC').replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16); }
function key(name) { return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\p{L}]/gu, '').slice(0, 40) || 'x'; }
function safeName(name) {
  const flat = key(name).replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/\$/g, 's');
  return BAD.some(w => flat.includes(w)) ? 'Roo Fan' : name;
}

async function submit(store, d) {
  const g = game(d && d.game); if (!g) return { ok: false, error: 'game' };
  let name = cleanName(d.name); if (name.length < 2) return { ok: false, error: 'name' };
  name = safeName(name);
  const score = Math.floor(Number(d.score)), dur = Math.floor(Number(d.dur));
  if (!(score > 0) || !(dur >= 1) || dur > 7200) return { ok: false, error: 'score' };
  if (score > BASE[g] + RATE[g] * dur) return { ok: false, error: 'score' };
  const rk = key(name) + (name === 'Roo Fan' ? '-' + Math.random().toString(36).slice(2, 6) : ''), at = new Date().toISOString();
  for (const pk of [g + '-all', g + '-' + montrealDay()]) {
    const cur = await store.get(pk, rk);
    if (!cur || Number(cur.score) < score) await store.put({ partitionKey: pk, rowKey: rk, name, score, at });
  }
  return { ok: true };
}
async function top(store, g) {
  const pick = (rows) => rows.map(r => ({ name: r.name, score: Number(r.score) || 0 })).sort((a, b) => b.score - a.score).slice(0, 10);
  const [all, today] = await Promise.all([store.list(g + '-all'), store.list(g + '-' + montrealDay())]);
  return { today: pick(today), all: pick(all) };
}
module.exports = { game, submit, top, cleanName, safeName, montrealDay, RATE, BASE };
