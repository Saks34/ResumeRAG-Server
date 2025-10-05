const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function parseBufferToText(buffer, mime, filename) {
  const lower = (filename || '').toLowerCase();
  try {
    if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return (data.text || '').replace(/\u0000/g, '');
    }
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lower.endsWith('.docx')
    ) {
      const { value } = await mammoth.extractRawText({ buffer });
      return (value || '').replace(/\u0000/g, '');
    }
    // fallback text
    return buffer.toString('utf8').replace(/\u0000/g, '');
  } catch (e) {
    return buffer.toString('utf8').replace(/\u0000/g, '');
  }
}

function extractSkills(text) {
  if (!text) return [];
  const SKILLS = [
    'javascript','typescript','node','express','react','mongodb','sql','python','java','aws','docker','kubernetes','graphql','tailwind','css','html','redis','nginx'
  ];
  const lc = text.toLowerCase();
  const set = new Set();
  SKILLS.forEach((s) => {
    if (lc.includes(s)) set.add(s);
  });
  return Array.from(set);
}

function redactPII(text, pii) {
  if (!text) return '';
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const phoneRegex = /(\+?\d[\d\s-]{7,}\d)/g;
  let out = text.replace(emailRegex, '[REDACTED_EMAIL]').replace(phoneRegex, '[REDACTED_PHONE]');
  if (pii?.name) {
    // Only redact the exact detected name, case-insensitive, whole word boundary
    const escaped = pii.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
    out = out.replace(nameRegex, '[REDACTED_NAME]');
  }
  return out;
}

function extractPII(text) {
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = text.match(/(\+?\d[\d\s-]{7,}\d)/);
  // Heuristic: use the first non-empty header line (ignoring links and labels) as name
  let name;
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const l = lines[i];
    const lower = l.toLowerCase();
    if (lower.includes('@') || lower.includes('linkedin') || lower.includes('github') || lower.includes('email') || lower.includes('phone')) continue;
    if (l.length > 2 && l.length <= 60 && /[a-zA-Z]/.test(l)) {
      name = l;
      break;
    }
  }
  return {
    email: emailMatch ? emailMatch[0] : undefined,
    phone: phoneMatch ? phoneMatch[0] : undefined,
    name,
  };
}

module.exports = { parseBufferToText, extractSkills, redactPII, extractPII };
