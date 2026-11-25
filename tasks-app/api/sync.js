const { redis, fail } = require('./_lib');
// مزامنة بين أجهزتك: السيرفر يخزن صندوق مشفّر فقط (التشفير والدمج يصير على الجهاز بالرمز اللي عندك).
// get: يرجّع {v, d}.  put: يحفظ d بس إذا النسخة ما تغيّرت من آخر قراءة (v)، وإلا يرجّع conflict.
const CAS = "local v = tonumber(redis.call('HGET', KEYS[1], 'v') or '0') " +
  "if v ~= tonumber(ARGV[1]) then return {0, v} end " +
  "redis.call('HSET', KEYS[1], 'v', v + 1, 'd', ARGV[2], 't', ARGV[3]) " +
  "return {1, v + 1}";
const MAX = 3 * 1024 * 1024;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { id, op, v, d } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    const key = 'mahami:sync:' + id;
    if (op === 'get') {
      const r = await redis(['HMGET', key, 'v', 'd']);
      return res.json({ v: Number(r && r[0]) || 0, d: (r && r[1]) || null });
    }
    if (op === 'put') {
      if (typeof d !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(d)) return res.status(400).json({ error: 'bad data' });
      if (d.length > MAX) return res.status(413).json({ error: 'too big' });
      if (!Number.isInteger(v) || v < 0) return res.status(400).json({ error: 'bad version' });
      const r = await redis(['EVAL', CAS, '1', key, String(v), d, String(Date.now())]);
      if (Number(r[0]) !== 1) return res.status(409).json({ error: 'conflict', v: Number(r[1]) || 0 });
      return res.json({ ok: true, v: Number(r[1]) });
    }
    res.status(400).json({ error: 'bad op' });
  } catch (e) { fail(res, e); }
};
