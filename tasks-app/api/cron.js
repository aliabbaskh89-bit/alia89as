// يُستدعى كل 5 دقائق من GitHub Actions (+ مرة يومياً من Vercel Cron كاحتياط).
// يرسل: التذكير الصباحي لما يوصل وقته، وتنبيه لكل مهمة وصل وقتها. التلفون يحسب النص من بياناته.
const { redis, getVapid, webpush, localNow, fail, SUBS } = require('./_lib');
module.exports = async (req, res) => {
  try {
    await getVapid();
    const flat = (await redis(['HGETALL', SUBS])) || [];
    const now = new Date(), nowMs = now.getTime();
    let sent = 0, removed = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const id = flat[i];
      let s; try { s = JSON.parse(flat[i + 1]); } catch (e) { continue; }
      const msgs = [];
      let changed = false;

      // التذكير الصباحي
      if (s.enabled) {
        const local = localNow(s.tz, now);
        if (s.lastSent !== local.date && local.hm >= s.time) {
          const [h, m] = s.time.split(':').map(Number);
          const [lh, lm] = local.hm.split(':').map(Number);
          s.lastSent = local.date; changed = true;
          if ((lh * 60 + lm) - (h * 60 + m) <= 90) msgs.push({ type: 'daily', date: local.date });
        }
      }
      // تنبيهات أوقات المهام
      const alerts = Array.isArray(s.alerts) ? s.alerts : [];
      const due = alerts.filter((t) => t <= nowMs + 60000);
      if (due.length) {
        s.alerts = alerts.filter((t) => t > nowMs + 60000); changed = true;
        due.filter((t) => nowMs - t < 60 * 60000).forEach((t) => msgs.push({ type: 'task', at: t }));
      }
      if (changed) await redis(['HSET', SUBS, id, JSON.stringify(s)]);

      for (const msg of msgs) {
        try {
          await webpush.sendNotification(s.subscription, JSON.stringify(msg), { TTL: 3 * 3600, urgency: 'high' });
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) { await redis(['HDEL', SUBS, id]); removed++; break; }
          console.error('push error', e.statusCode || e.message);
        }
      }
    }
    res.json({ ok: true, total: flat.length / 2, sent, removed });
  } catch (e) { fail(res, e); }
};
