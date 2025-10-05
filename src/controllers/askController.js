const { Resumes, getDb } = require('../config/db');
const { setCache, getCache } = require('../utils/cache');

async function ask(req, res) {
  const { query, k = 5 } = req.body || {};
  if (!query) return res.status(400).json({ error: { message: 'query required' } });
  const cacheKey = `ask:${(req.user && req.user.id) || req.ip}:${query}:${k}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  // naive retrieval: text search + simple evidence
  const limit = Math.min(parseInt(k), 20);
  const docs = await Resumes().find(query ? { $text: { $search: query } } : {}).limit(limit).toArray();
  const answers = docs.map((d) => ({
    id: String(d._id),
    filename: d.filename,
    evidence: (d.text || '').slice(0, 200),
  }));
  const payload = { query, answers };
  setCache(cacheKey, payload, 60 * 1000); // 60 seconds
  // store history (best-effort)
  try {
    const userId = (req.user && req.user.id) || null;
    await getDb().collection('askHistory').insertOne({
      user: userId,
      ip: req.ip,
      query,
      answers,
      createdAt: new Date(),
    });
  } catch (e) {
    // ignore storage errors
  }
  res.json(payload);
}

async function history(req, res) {
  try {
    const userId = (req.user && req.user.id) || null;
    const filter = userId ? { user: userId } : { ip: req.ip };
    const items = await getDb()
      .collection('askHistory')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    const mapped = items.map((it) => ({
      id: String(it._id),
      query: it.query,
      answers: (it.answers || []).slice(0, 3),
      createdAt: it.createdAt,
    }));
    res.json({ items: mapped });
  } catch (e) {
    res.json({ items: [] });
  }
}

module.exports = { ask, history };
