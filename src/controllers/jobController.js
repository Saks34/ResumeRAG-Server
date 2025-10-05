const { Jobs, Resumes, ObjectId } = require('../config/db');
const { embedText, cosineSim } = require('../utils/embeddings');

async function createJob(req, res) {
  const { title, description, skills = [] } = req.body;
  if (!title) return res.status(400).json({ error: { message: 'title required' } });
  const text = `${title}\n${description || ''}\n${(skills || []).join(', ')}`;
  const embedding = await embedText(text);
  const doc = {
    title,
    description,
    skills,
    embedding,
    createdBy: req.user?.id ? new ObjectId(req.user.id) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const { insertedId } = await Jobs().insertOne(doc);
  res.status(201).json({ id: String(insertedId) });
}

async function getJob(req, res) {
  let job;
  try {
    job = await Jobs().findOne({ _id: new ObjectId(req.params.id) });
  } catch (e) { return res.status(404).json({ error: { message: 'not found' } }); }
  if (!job) return res.status(404).json({ error: { message: 'not found' } });
  res.json({ id: String(job._id), title: job.title, description: job.description, skills: job.skills });
}

function buildSnippet(text, skill) {
  if (!text || !skill) return '';
  const lc = text.toLowerCase();
  const idx = lc.indexOf(skill.toLowerCase());
  if (idx === -1) return text.slice(0, 160);
  const start = Math.max(0, idx - 60);
  return text.slice(start, start + 160);
}

function highlight(text, terms = []) {
  if (!text || !terms || terms.length === 0) return text || '';
  let out = text;
  // sort longer terms first to avoid nested overlaps
  const uniq = Array.from(new Set(terms.filter(Boolean))).sort((a, b) => b.length - a.length);
  for (const t of uniq) {
    const esc = String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${esc})`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

async function matchJob(req, res) {
  const { id } = req.params;
  let { top_n } = req.body || {};
  top_n = Math.max(1, Math.min(parseInt(top_n || '5'), 20));
  let job;
  try { job = await Jobs().findOne({ _id: new ObjectId(id) }); } catch (e) {}
  if (!job) return res.status(404).json({ error: { message: 'job not found' } });

  // Fetch resumes
  const resumes = await Resumes().find({ embedding: { $exists: true } }).limit(1000).toArray();

  // Score
  const scored = resumes.map((r) => {
    const score = cosineSim(job.embedding, r.embedding);
    const present = new Set((r.skills || []).map((s) => s.toLowerCase()));
    const missingSkills = (job.skills || []).filter((s) => !present.has(String(s).toLowerCase()));
    const matchedSkills = (job.skills || []).filter((s) => present.has(String(s).toLowerCase()));
    const evidenceSkill = (job.skills || []).find((s) => (r.text || '').toLowerCase().includes(String(s).toLowerCase()));
    const rawSnippet = buildSnippet(r.text || '', evidenceSkill || (job.title || '').split(' ')[0]);
    const highlightedSnippet = highlight(rawSnippet, matchedSkills);
    return { resume: r, score, snippet: rawSnippet, highlightedSnippet, missingSkills, matchedSkills };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, top_n).map((s) => ({
    id: String(s.resume._id),
    filename: s.resume.filename,
    score: Number(s.score.toFixed(4)),
    snippet: s.snippet,
    highlightedSnippet: s.highlightedSnippet,
    missingSkills: s.missingSkills,
    matchedSkills: s.matchedSkills,
  }));

  res.json({ job: { id: String(job._id), title: job.title }, matches: top });
}

// Optional GET endpoint for detailed matches without altering core behavior
async function matchJobGet(req, res) {
  // Reuse matchJob logic but accept query param top_n
  req.body = req.body || {};
  if (req.query && req.query.top_n) {
    req.body.top_n = req.query.top_n;
  }
  return matchJob(req, res);
}

module.exports = { createJob, getJob, matchJob, matchJobGet };
