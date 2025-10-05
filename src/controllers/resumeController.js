const multer = require('multer');
const AdmZip = require('adm-zip');
const { Resumes, IdempotencyKeys, ObjectId } = require('../config/db');
const { parseBufferToText, extractSkills, redactPII, extractPII } = require('../utils/parser');
const { embedText } = require('../utils/embeddings');
const { uploadBuffer } = require('../utils/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

function uploadMiddleware() {
  return upload.single('file');
}

async function handleIdempotency(req, userId) {
  const key = req.header('Idempotency-Key');
  if (!key) return { status: 'none' };
  const col = IdempotencyKeys();
  let entry = await col.findOne({ key, user: userId || null });
  if (entry && entry.status === 'completed') {
    return { status: 'completed', result: entry.result };
  }
  if (!entry) {
    const doc = { key, user: userId || null, status: 'started', createdAt: new Date(), updatedAt: new Date() };
    const { insertedId } = await col.insertOne(doc);
    entry = { _id: insertedId, ...doc };
  }
  return { status: 'started', entry };
}

async function finalizeIdempotency(entry, result, failed = false) {
  if (!entry) return;
  await IdempotencyKeys().updateOne(
    { _id: entry._id },
    { $set: { status: failed ? 'failed' : 'completed', result, updatedAt: new Date() } }
  );
}

async function createResumes(req, res) {
  const userId = req.user?.id;
  const idem = await handleIdempotency(req, userId);
  if (idem.status === 'completed') return res.json(idem.result);

  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: { message: 'file required' } });

    const processed = [];
    const isZip = file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip');

    if (isZip) {
      const zip = new AdmZip(file.buffer);
      const entries = zip.getEntries();
      for (const e of entries) {
        if (e.isDirectory) continue;
        const buf = e.getData();
        const text = await parseBufferToText(buf, undefined, e.entryName);
        const skills = extractSkills(text);
        const pii = extractPII(text);
        const embedding = await embedText(text);
        // Upload to Cloudinary (raw)
        let cloud = null;
        try {
          cloud = await uploadBuffer(buf, e.entryName, { folder: 'resumes', resource_type: 'raw' });
        } catch (err) {
          // proceed without cloud if misconfigured
        }
        const doc = {
          owner: userId ? new ObjectId(userId) : null,
          filename: e.entryName,
          contentType: 'text/plain',
          text,
          skills,
          embedding,
          size: buf.length,
          pii,
          // Prefer Cloudinary; keep local buffer as fallback only if cloud not available
          original: cloud ? undefined : buf,
          originalContentType: cloud ? undefined : 'application/octet-stream',
          cloudinaryUrl: cloud?.secure_url || cloud?.url || null,
          cloudinaryPublicId: cloud?.public_id || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const { insertedId } = await Resumes().insertOne(doc);
        processed.push({ _id: insertedId });
      }
    } else {
      const text = await parseBufferToText(file.buffer, file.mimetype, file.originalname);
      const skills = extractSkills(text);
      const pii = extractPII(text);
      const embedding = await embedText(text);
      // Upload to Cloudinary (raw)
      let cloud = null;
      try {
        cloud = await uploadBuffer(file.buffer, file.originalname, { folder: 'resumes', resource_type: 'raw' });
      } catch (err) {
        // proceed without cloud if misconfigured
      }
      const doc = {
        owner: userId ? new ObjectId(userId) : null,
        filename: file.originalname,
        contentType: file.mimetype,
        text,
        skills,
        embedding,
        size: file.size,
        pii,
        // Prefer Cloudinary; keep local buffer as fallback only if cloud not available
        original: cloud ? undefined : file.buffer,
        originalContentType: cloud ? undefined : (file.mimetype || 'application/octet-stream'),
        cloudinaryUrl: cloud?.secure_url || cloud?.url || null,
        cloudinaryPublicId: cloud?.public_id || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { insertedId } = await Resumes().insertOne(doc);
      processed.push({ _id: insertedId });
    }

    const payload = { count: processed.length, ids: processed.map((d) => String(d._id)) };
    if (idem.entry) await finalizeIdempotency(idem.entry, payload, false);
    return res.status(201).json(payload);
  } catch (e) {
    if (idem.entry) await finalizeIdempotency(idem.entry, { error: e.message }, true);
    return res.status(500).json({ error: { message: 'upload failed' } });
  }
}

async function listResumes(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '10'), 100);
  const offset = parseInt(req.query.offset || '0');
  const q = (req.query.q || '').trim();
  const filter = {};
  if (q) {
    filter.$text = { $search: q };
  }
  const [items, total] = await Promise.all([
    Resumes().find(filter).skip(offset).limit(limit).sort({ createdAt: -1 }).toArray(),
    Resumes().countDocuments(filter),
  ]);
  const isRecruiter = req.user?.role === 'recruiter';
  const mapped = items.map((r) => ({
    id: String(r._id),
    filename: r.filename,
    skills: r.skills,
    size: r.size,
    createdAt: r.createdAt,
    text: isRecruiter ? r.text : (r.text ? redactPII(r.text) : ''),
  }));
  res.json({ total, limit, offset, items: mapped });
}

async function getResume(req, res) {
  let r = null;
  try {
    r = await Resumes().findOne({ _id: new ObjectId(req.params.id) });
  } catch (e) {
    return res.status(404).json({ error: { message: 'not found' } });
  }
  if (!r) return res.status(404).json({ error: { message: 'not found' } });
  const isRecruiter = req.user?.role === 'recruiter';
  return res.json({
    id: String(r._id),
    filename: r.filename,
    skills: r.skills,
    size: r.size,
    createdAt: r.createdAt,
    text: isRecruiter ? r.text : (r.text ? redactPII(r.text) : ''),
    // Only recruiters can view extracted PII
    pii: isRecruiter ? (r.pii || null) : null,
  });
}

async function downloadResume(req, res) {
  let r = null;
  try {
    r = await Resumes().findOne({ _id: new ObjectId(req.params.id) });
  } catch (e) {
    return res.status(404).json({ error: { message: 'not found' } });
  }
  if (!r) return res.status(404).json({ error: { message: 'not found' } });

  const filename = r.filename || 'resume.txt';
  // If Cloudinary available, redirect to it
  if (r.cloudinaryUrl) {
    return res.redirect(302, r.cloudinaryUrl);
  }
  if (r.original && r.original.length !== 0) {
    res.set('Content-Type', r.originalContentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(r.original);
  }
  // Fallback to text export
  const text = r.text || '';
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${(filename || 'resume').replace(/"/g, '')}.txt"`);
  return res.send(text);
}

async function analytics(req, res) {
  try {
    const total = await Resumes().countDocuments({});
    const topSkillsAgg = await Resumes().aggregate([
      { $unwind: { path: "$skills", preserveNullAndEmptyArrays: false } },
      { $group: { _id: { $toLower: "$skills" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).toArray();
    const topSkills = topSkillsAgg.map((s) => ({ skill: s._id, count: s.count }));

    const perMonthAgg = await Resumes().aggregate([
      { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]).toArray();
    const uploadsPerMonth = perMonthAgg.map((d) => ({
      month: `${d._id.y}-${String(d._id.m).padStart(2, '0')}`,
      count: d.count,
    }));

    res.json({ totalResumes: total, topSkills, uploadsPerMonth });
  } catch (e) {
    res.json({ totalResumes: 0, topSkills: [], uploadsPerMonth: [] });
  }
}

module.exports = { uploadMiddleware, createResumes, listResumes, getResume, downloadResume, analytics };
