## Optional Features (Hackathon)
- **Highlight Matched Skills**: Use the new job match payload fields `matchedSkills` and `highlightedSnippet` to visually indicate which job-required skills are present in each resume and to show a small in-context snippet with `<mark>` highlights. Frontend route `#/jobs/:id/match` renders a detailed view; the generic `#/jobs` page also surfaces matched/missing chips.
- **Resume Analytics Dashboard**: The endpoint `/api/resumes/analytics/basic` aggregates total resumes, top 5 skills, and uploads per month. The frontend page `#/analytics` displays these as simple cards and a table. No schema changes required; it leverages the existing `resumes` collection.
- **Query History for Ask**: Each `/api/ask` call stores a lightweight entry in `askHistory` keyed by user (or IP if unauthenticated). Fetch recent items via `GET /api/ask/history`. The `#/ask` page shows a Recent Queries list under the results.
# ResumeRAG API (MERN) – with Gemini Embeddings and Cloudinary Storage

## Setup
- Create `.env` in `Server/` (MongoDB + Gemini + Cloudinary):
```
PORT=5000
CLIENT_URL=http://localhost:3000

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=resumerag

# Auth
JWT_SECRET=change_me

# Gemini (embeddings)
# Use either GOOGLE_API_KEY or GEMINI_API_KEY
GOOGLE_API_KEY=your_gemini_api_key
# GEMINI_API_KEY=your_gemini_api_key

# Cloudinary (for original resume file storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Rate limit (req/min/user)
RATE_LIMIT=60
```
- Install deps (already present in package.json). If needed: `npm i`
- Run dev API: `npm run dev`

### Frontend (Create React App)
- Env (optional) `frontend/.env`:
```
REACT_APP_API_BASE=http://localhost:5000
```
- Run dev UI: `npm start` (from `frontend/`)

## Auth
- POST `/api/auth/register` { email, password, name, role? }
- POST `/api/auth/login` { email, password }
  - returns `{ token, user }`

## Resumes
- POST `/api/resumes` multipart form-data: `file` (single file or .zip)
  - headers: `Idempotency-Key: <uuid>` to ensure idempotent uploads
  - parses PDF/DOCX/TXT, extracts skills, generates embeddings (Gemini `text-embedding-004` or deterministic placeholder when no key)
  - returns `{ count, ids }`
- GET `/api/resumes?limit=&offset=&q=`
  - pagination; `q` full-text search
  - redacts PII (email/phone/name) unless `role === recruiter`
- GET `/api/resumes/:id`
  - returns `{ id, filename, skills, size, createdAt, text, pii? }`
  - `pii` is included only for users with `role === recruiter`
- GET `/api/resumes/:id/download`
  - downloads original uploaded file when available; falls back to a `.txt` export of resume text
  - if Cloudinary is configured, this endpoint issues a 302 redirect to the Cloudinary asset URL
 - GET `/api/resumes/analytics/basic`
   - returns `{ totalResumes, topSkills[], uploadsPerMonth[] }` for simple dashboard stats

## Jobs
- POST `/api/jobs` { title, description, skills[] }
- GET `/api/jobs/:id`
- POST `/api/jobs/:id/match` { top_n }
  - returns top resumes with `{ id, filename, score, snippet, missingSkills, matchedSkills?, highlightedSnippet? }`
- GET `/api/jobs/:id/match?top_n=`
  - same as POST; convenient for client-side navigation

## Ask
- POST `/api/ask` { query, k }
  - cached for 60 seconds per-user/IP
- GET `/api/ask/history`
  - returns recent queries for the current user (or IP when unauthenticated)

Frontend page: `#/ask` provides a simple UI to query and view snippets. It now also shows a Recent Queries list pulled from `/api/ask/history`.

## Misc
- Rate limit: 60 req/min/user → `429 {"error":{"code":"RATE_LIMIT"}}`
- Health: `/api/health`
- Meta: `/api/_meta`
- Well-known: `/.well-known/hackathon.json`

## Features (for demo/submission)
- AI embeddings via Gemini `text-embedding-004` for resumes/jobs
- Resume parsing (PDF/DOCX/TXT) and skills extraction
- Recruiter-only PII exposure on candidate detail
- Cloudinary storage of original resume files; backend download redirect
- Job creation and candidate matching using cosine similarity
- Search and Ask pages for retrieval
- Idempotent uploads via `Idempotency-Key`

## Seed/Test
- Register user:
```
curl -X POST http://localhost:5000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"recruiter@example.com","password":"Password123","name":"Recruiter","role":"recruiter"}'
```
- Login:
```
curl -X POST http://localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"recruiter@example.com","password":"Password123"}'
```
- Upload resume:
```
curl -X POST http://localhost:5000/api/resumes -H 'Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000' \
  -F file=@/path/to/resume.pdf
```
- Create job:
```
curl -X POST http://localhost:5000/api/jobs -H 'Content-Type: application/json' \
  -d '{"title":"Fullstack Engineer","description":"React/Node","skills":["react","node","mongodb"]}'
```
- Match:
```
curl -X POST http://localhost:5000/api/jobs/<jobId>/match -H 'Content-Type: application/json' -d '{"top_n":3}'
```

- Download a resume (requires auth header if route is protected for your setup):
```
curl -L -o resume.bin \
  -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/resumes/<resumeId>/download
```

## Security
- Do not commit `.env`. Rotate any exposed credentials (Mongo, JWT, Cloudinary, Gemini).
- Consider using signed Cloudinary URLs for time-limited access in production.

---

## Architecture Note
This MERN-based ResumeRAG system uses Express + MongoDB for storage and APIs, React for the UI, Gemini for text embeddings, and Cloudinary for original file storage. During upload, PDF/DOCX/TXT (or ZIP of many) are parsed to text, skills and PII are extracted, and embeddings are generated using Gemini `text-embedding-004`. Original files are uploaded to Cloudinary as raw assets and the backend download endpoint redirects to Cloudinary when available. Authentication is JWT-based; user role (e.g., `recruiter`) governs access to sensitive fields—PII (email/phone/name) is redacted by default and only returned to recruiters. Rate limiting (per-user/IP) protects the API. Listing/search endpoints support pagination via `limit` and `offset`. Job matching computes cosine similarity between stored job and resume embeddings. Uploads are idempotent via the `Idempotency-Key` header to avoid duplicate processing.

## API Summary Table
| Endpoint | Method | Auth | Body/Query | Response |
|---|---|---|---|---|
| `/api/resumes` | POST | Optional | multipart `file`; header `Idempotency-Key` | `{ count, ids }` |
| `/api/resumes` | GET | Optional | `limit`, `offset`, `q` | `{ total, limit, offset, items[] }` (PII redacted unless recruiter) |
| `/api/resumes/:id` | GET | Optional | — | `{ id, filename, skills, size, createdAt, text, pii? }` (recruiter only for pii) |
| `/api/resumes/:id/download` | GET | Optional | — | 302 to Cloudinary or file/text download |
| `/api/resumes/analytics/basic` | GET | Optional | — | `{ totalResumes, topSkills[], uploadsPerMonth[] }` |
| `/api/jobs` | POST | Optional | `{ title, description, skills[] }` | `{ id }` |
| `/api/jobs/:id` | GET | Optional | — | `{ id, title, description, skills }` |
| `/api/jobs/:id/match` | POST | Optional | `{ top_n }` | `{ job, matches[] }` with `score`, `snippet`, `missingSkills` |
| `/api/ask` | POST | Optional | `{ query, k }` | `{ query, answers[] }` (cached 60s) |
| `/api/auth/register` | POST | Public | `{ email, password, name, role? }` | `{ id, email }` |
| `/api/auth/login` | POST | Public | `{ email, password }` | `{ token, user }` |
| `/api/health` | GET | Public | — | health status |
| `/api/_meta` | GET | Public | — | build/runtime metadata |
| `/.well-known/hackathon.json` | GET | Public | — | hackathon metadata JSON |

## Optional: Automated Test Examples (jest + supertest)
```javascript
// tests/health.test.js
const request = require('supertest');
const app = require('../index'); // ensure index.js exports the Express app for tests

describe('GET /api/health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
```

```javascript
// tests/resumes.post.test.js
const request = require('supertest');
const app = require('../index');

describe('POST /api/resumes', () => {
  it('uploads a resume and returns ids', async () => {
    const buf = Buffer.from('%PDF-1.4\n%fake', 'utf8');
    const res = await request(app)
      .post('/api/resumes')
      .set('Idempotency-Key', 'test-key-123')
      .attach('file', buf, { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.ids)).toBe(true);
  });
});
```

## Frontend Pages Checklist
- [x] `/upload` – upload single PDF/DOCX/TXT or ZIP; idempotency header supported
- [x] `/search` – search with pagination; PII redacted for non-recruiters
- [x] `/jobs` – create jobs and find matches
- [x] `/candidates/:id` – recruiter-only PII, email/call, download
- [x] `/ask` – query corpus and navigate to candidates

## Highlight .env Variables
- Backend (`Server/.env`)
  - PORT, CLIENT_URL, MONGO_URI, MONGO_DB
  - JWT_SECRET
  - GOOGLE_API_KEY or GEMINI_API_KEY
  - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
  - RATE_LIMIT
- Frontend (`frontend/.env`)
  - REACT_APP_API_BASE
