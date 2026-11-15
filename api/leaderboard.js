// Global leaderboard API — Upstash Redis (provisioned via Vercel Marketplace)
// GET  /api/leaderboard        → { easy:[], hard:[], early:[] }  (top 10 each)
// POST /api/leaderboard        → { ok:true }  body: one score row
// Rows are validated and clamped: a kids' game should not trust the client.

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const K = { easy: 'mo:board:easy', hard: 'mo:board:hard', early: 'mo:board:early' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const num = (v, lo, hi, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v, max) => String(v ?? '').slice(0, max);

// Crew call-signs: 3 letters (ZAP) or a generated "Rover Fox" pair
const NAME_OK = /^([A-Z]{3}|(Rover|Comet|Dusty|Rocket|Crater|Orbit|Nova|Lunar) (Fox|Owl|Lynx|Otter|Hawk|Panda|Gecko|Wolf))$/;

function sanitize(body) {
  const name = str(body.name, 12).toUpperCase();
  const hard = !!body.hard;
  const won = !!body.won;
  const sci = num(body.sci, 0, 99999);
  const sols = num(body.sols, 0, 100);
  const total = num(body.total, 0, 99999);
  const code = str(body.code, 24) || '???';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : new Date().toISOString().slice(0, 10);
  const id = num(body.id, 0, 9e15) || Date.now();
  if (!NAME_OK.test(name)) return null;
  return { id, name, hard, won, total, sci, sols, code, date };
}

const parse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

async function top(key, n = 10) {
  const rows = await redis.zrange(key, 0, n - 1, { rev: true, withScores: true });
  const out = [];
  for (let i = 0; i < rows.length; i += 2) {
    const raw = rows[i];
    // The client auto-deserializes JSON members, so handle both strings and objects
    const row = typeof raw === 'string' ? parse(raw) : raw;
    if (!row || typeof row !== 'object') continue;
    row.total = num(rows[i + 1], 0, 99999);
    out.push(row);
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', CORS['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', CORS['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', CORS['Access-Control-Allow-Headers']);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const [easy, hard, early] = await Promise.all([top(K.easy), top(K.hard), top(K.early)]);
      return res.status(200).json({ global: true, easy, hard, early });
    }

    if (req.method === 'POST') {
      const row = sanitize(req.body || {});
      if (!row) return res.status(400).json({ ok: false, error: 'bad row' });
      const score = row.won ? row.total : row.sols;
      const key = row.won ? (row.hard ? K.hard : K.easy) : K.early;
      await redis.zadd(key, { score, member: JSON.stringify({ ...row, total: undefined }) });
      await redis.zremrangebyrank(key, 0, -101); // keep only the best 100
      return res.status(200).json({ ok: true, global: true });
    }

    return res.status(405).json({ ok: false, error: 'method' });
  } catch (err) {
    console.error('leaderboard error:', err.message);
    return res.status(503).json({ ok: false, error: 'board unavailable' });
  }
}
