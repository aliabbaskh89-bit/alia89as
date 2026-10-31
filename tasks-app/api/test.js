const { redis, getVapid, webpush, idOf, fail, SUBS } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const ep = req.body && req.body.endpoint;
    const raw = typeof ep === 'string' ? await redis(['HGET', SUBS, idOf(ep)]) : null;
    if (!raw) return res.status(404).json({ error: 'not subscribed' });
    await getVapid();
    try {
      await webpush.sendNotification(JSON.parse(raw).subscription, JSON.stringify({ type: 'test' }), { TTL: 600, urgency: 'high' });
      res.json({ ok: true });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await redis(['HDEL', SUBS, idOf(ep)]);
      res.status(502).json({ error: 'push failed', status: e.statusCode || null });
    }
  } catch (e) { fail(res, e); }
};
