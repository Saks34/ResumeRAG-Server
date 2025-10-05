require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { connectDB } = require('./src/config/db');
const { authMiddlewareOptional } = require('./src/middleware/auth');
const { errorHandler, notFound } = require('./src/middleware/error');

// Connect DB
connectDB();

const app = express();
// Allow multiple origins via CLIENT_URLS (comma-separated) or single CLIENT_URL
const rawOrigins = process.env.CLIENT_URLS || process.env.CLIENT_URL || '';
const ALLOWED_ORIGINS = rawOrigins
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = ALLOWED_ORIGINS.length
  ? {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true); // allow curl/postman
        const clean = String(origin).replace(/\/$/, '');
        if (ALLOWED_ORIGINS.includes(clean)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }
  : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: 60 req/min/user
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT || 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Prefer user id if authenticated, otherwise IPv6-safe IP key
    if (req.user && req.user.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req);
  },
  handler: (req, res) => {
    return res.status(429).json({ error: { code: 'RATE_LIMIT' } });
  },
});

// Attach optional auth before limiter so keyGenerator can see req.user
app.use(authMiddlewareOptional);
app.use(limiter);

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/resumes', require('./src/routes/resumeRoutes'));
app.use('/api/jobs', require('./src/routes/jobRoutes'));
app.use('/api', require('./src/routes/askRoutes'));
app.use('/api', require('./src/routes/healthRoutes'));
app.use('/api', require('./src/routes/metaRoutes'));

// Static well-known for judging
app.use('/.well-known', express.static(path.join(__dirname, 'public/.well-known')));

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ResumeRAG API listening on port ${PORT}`));
