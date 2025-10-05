const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : null;
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  }
}

function authMiddlewareOptional(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
  } catch (e) {}
  next();
}

module.exports = { authMiddleware, authMiddlewareOptional, JWT_SECRET };
// Role guards
function requireRecruiter(req, res, next) {
  if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  if (req.user.role !== 'recruiter') return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  next();
}

function forbidRecruiter(req, res, next) {
  // If a logged-in recruiter tries to access, block; otherwise allow (including anonymous or viewer)
  if (req.user && req.user.role === 'recruiter') return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  next();
}

module.exports.requireRecruiter = requireRecruiter;
module.exports.forbidRecruiter = forbidRecruiter;
