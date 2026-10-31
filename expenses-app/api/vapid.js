const { getVapid, fail } = require('./_lib');
module.exports = async (req, res) => {
  try { const k = await getVapid(); res.setHeader('Cache-Control', 'no-store'); res.json({ publicKey: k.publicKey }); }
  catch (e) { fail(res, e); }
};
