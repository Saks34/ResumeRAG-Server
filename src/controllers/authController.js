const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users, ObjectId } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

async function register(req, res) {
  const { email, password, name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: { message: 'email and password required' } });
  const users = Users();
  const exists = await users.findOne({ email });
  if (exists) return res.status(409).json({ error: { message: 'email already exists' } });
  const passwordHash = await bcrypt.hash(password, 10);
  const doc = { email, passwordHash, name, role: role || 'recruiter', createdAt: new Date(), updatedAt: new Date() };
  const result = await users.insertOne(doc);
  return res.status(201).json({ id: result.insertedId, email });
}

async function login(req, res) {
  const { email, password } = req.body;
  const users = Users();
  const user = await users.findOne({ email });
  if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  const token = jwt.sign({ id: String(user._id), role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: String(user._id), email: user.email, role: user.role, name: user.name } });
}

module.exports = { register, login };
