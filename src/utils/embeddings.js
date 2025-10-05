const { GoogleGenerativeAI } = require('@google/generative-ai');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const MODEL = 'text-embedding-004';
let client = null;
if (GOOGLE_API_KEY) {
  client = new GoogleGenerativeAI(GOOGLE_API_KEY);
}

async function embedText(text) {
  if (!text || text.trim().length === 0) return [];
  if (!client) {
    // Placeholder deterministic pseudo-embedding
    const dims = 64;
    const vec = new Array(dims).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dims] = (vec[i % dims] + text.charCodeAt(i)) % 100;
    }
    return vec.map((v) => v / 100);
  }
  const model = client.getGenerativeModel({ model: MODEL });
  const result = await model.embedContent(text);
  const values = result?.embedding?.values || [];
  return values;
}

function cosineSim(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

module.exports = { embedText, cosineSim };
