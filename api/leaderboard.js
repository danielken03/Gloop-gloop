// Gloop Gloop global leaderboard.
// GET  /api/leaderboard?mode=easy|normal   -> { entries: [{ name, score }, ...] }  (top 50, highest first)
// POST /api/leaderboard {name, score, mode} -> { ok: true }
// Easy and Normal have separate boards; a missing mode means Normal.
// Scores live in an Upstash Redis sorted set. Connect "Upstash for Redis" to this
// Vercel project and it adds the URL/token environment variables read below.

const KEY = 'gloop:leaderboard';            // Normal (kept as-is so existing scores stay)
const keyFor = mode => (mode === 'easy' ? KEY + ':easy' : KEY);
const KEEP = 500;      // how many scores to keep in total
const SHOW = 50;       // how many to send back

function creds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(c, commands) {
  const r = await fetch(c.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  for (const step of out) if (step && step.error) throw new Error(step.error);
  return out;
}

// Any name is fine, but keep it short, on one line, and free of control characters.
function cleanName(n) {
  if (typeof n !== 'string') return '';
  n = n.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e<>]/g, '');
  n = n.replace(/\s+/g, ' ').trim();
  return [...n].slice(0, 16).join('');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 2000) break; }
  try { return JSON.parse(raw); } catch { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const c = creds();
  if (!c) { res.status(503).json({ error: 'The leaderboard is not set up yet.' }); return; }
  try {
    if (req.method === 'GET') {
      const mode = (req.query && req.query.mode) || new URL(req.url || '/', 'http://x').searchParams.get('mode');
      const [r] = await redis(c, [['ZREVRANGE', keyFor(mode), '0', String(SHOW - 1), 'WITHSCORES']]);
      const a = r.result || [];
      const entries = [];
      for (let i = 0; i < a.length; i += 2) entries.push({ name: a[i], score: Number(a[i + 1]) });
      res.status(200).json({ entries });
      return;
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const name = cleanName(body && body.name);
      const score = Math.floor(Number(body && body.score));
      if (!name) { res.status(400).json({ error: 'Type a name first.' }); return; }
      if (!Number.isFinite(score) || score < 1 || score > 1e12) { res.status(400).json({ error: 'That score is not valid.' }); return; }
      // GT: a name only ever moves up, so a lower score never replaces a higher one
      const key = keyFor(body && body.mode);
      await redis(c, [['ZADD', key, 'GT', String(score), name], ['ZREMRANGEBYRANK', key, '0', String(-KEEP - 1)]]);
      res.status(200).json({ ok: true, name });
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(502).json({ error: 'The leaderboard could not be reached. Try again in a moment.' });
  }
};
