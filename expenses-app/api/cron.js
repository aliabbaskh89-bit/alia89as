// يُستدعى كل ربع ساعة من GitHub Actions (+ مرة يومياً من Vercel Cron كاحتياط).
// يرسل تنبيه لكل اشتراك وصل وقته اليوم وما انرسله، والتلفون يحسب التقرير ويعرضه.
const { redis, getVapid, webpush, localNow, fail, SUBS } = require('./_lib');
module.exports = async (req, res) => {
  try {
    await getVapid();
    const flat = (await redis(['HGETALL', SUBS])) || [];
    const now = new Date();
    let sent = 0, removed = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const id = flat[i];
      let s; try { s = JSON.parse(flat[i + 1]); } catch (e) { continue; }
      if (!s.enabled) continue;
      const local = localNow(s.tz, now);
      if (s.lastSent === local.date || local.hm < s.time) continue;
      const [h, m] = s.time.split(':').map(Number);
      const [lh, lm] = local.hm.split(':').map(Number);
      const late = (lh * 60 + lm) - (h * 60 + m);
      s.lastSent = local.date;
      await redis(['HSET', SUBS, id, JSON.stringify(s)]);
      if (late > 90) continue; // فات الوقت بوايد، نخليها لباچر
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify({ type: 'daily', date: local.date }), { TTL: 3 * 3600, urgency: 'high' });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { await redis(['HDEL', SUBS, id]); removed++; }
        else console.error('push error', e.statusCode || e.message);
      }
    }
    res.json({ ok: true, total: flat.length / 2, sent, removed });
  } catch (e) { fail(res, e); }
};
