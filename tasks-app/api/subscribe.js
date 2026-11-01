const { redis, idOf, validTz, fail, SUBS } = require('./_lib');
// يحفظ اشتراك التلفون: وقت التذكير الصباحي + أوقات المهام القادمة (أرقام فقط، بدون أي نص من بياناتك)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { subscription: s, time, tz, enabled, alerts } = req.body || {};
    if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000
      || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') {
      return res.status(400).json({ error: 'bad subscription' });
    }
    const id = idOf(s.endpoint);
    const prevRaw = await redis(['HGET', SUBS, id]);
    if (!prevRaw && (await redis(['HLEN', SUBS])) > 2000) return res.status(429).json({ error: 'full' });
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    const now = Date.now();
    const rec = {
      subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh.slice(0, 200), auth: s.keys.auth.slice(0, 100) } },
      time: /^\d{2}:\d{2}$/.test(time) ? time : '09:00',
      tz: validTz(tz) ? tz : 'Asia/Baghdad',
      enabled: enabled !== false,
      alerts: (Array.isArray(alerts) ? alerts : []).map(Number)
        .filter((t) => Number.isFinite(t) && t > now - 5 * 60000 && t < now + 32 * 86400000).sort((a, b) => a - b).slice(0, 80),
      lastSent: prev.lastSent || null,
      updated: now
    };
    await redis(['HSET', SUBS, id, JSON.stringify(rec)]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
};
