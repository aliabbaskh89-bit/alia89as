// أدوات مشتركة لدوال Vercel: تخزين Upstash Redis (REST) + Web Push
const crypto = require('crypto');
const webpush = require('web-push');

const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SUBS = 'mahami:subs';
const VAPID = 'mahami:vapid';

async function redis(cmd) {
  if (!R_URL || !R_TOKEN) { const e = new Error('no-storage'); e.code = 'NO_STORAGE'; throw e; }
  const r = await fetch(R_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + R_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error('redis: ' + j.error);
  return j.result;
}

// مفاتيح VAPID: من المتغيرات، أو تتولّد مرة وحدة وتنحفظ بـ Redis
let vapidCache = null;
async function getVapid() {
  if (vapidCache) return vapidCache;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidCache = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const saved = await redis(['GET', VAPID]);
    if (saved) vapidCache = JSON.parse(saved);
    else {
      const k = webpush.generateVAPIDKeys();
      await redis(['SET', VAPID, JSON.stringify(k), 'NX']);
      vapidCache = JSON.parse(await redis(['GET', VAPID])); // لو انولّدت بنفس اللحظة من طلب ثاني
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:mahami@example.com', vapidCache.publicKey, vapidCache.privateKey);
  return vapidCache;
}

const idOf = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
}
function localNow(tz, now) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).forEach((x) => { p[x.type] = x.value; });
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

function fail(res, e) {
  console.error(e);
  if (e && e.code === 'NO_STORAGE') return res.status(503).json({ error: 'storage-not-connected' });
  return res.status(500).json({ error: 'server-error' });
}

module.exports = { redis, getVapid, webpush, idOf, validTz, localNow, fail, SUBS };
