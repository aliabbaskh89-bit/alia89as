const { redis, idOf, fail, SUBS } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const ep = req.body && req.body.endpoint;
    if (typeof ep === 'string') await redis(['HDEL', SUBS, idOf(ep)]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
};
