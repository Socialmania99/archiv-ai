// Local secret/PII redaction. Runs before any export so keys pasted into a chat
// do not leak into a PDF you share.
const RULES = [
  { id: 'private-key', label: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, group: 'secrets' },
  { id: 'anthropic-key', label: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, group: 'secrets' },
  { id: 'openai-key', label: 'OpenAI-style key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, group: 'secrets' },
  { id: 'aws-key', label: 'AWS access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, group: 'secrets' },
  { id: 'github-token', label: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, group: 'secrets' },
  { id: 'slack-token', label: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, group: 'secrets' },
  { id: 'google-key', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, group: 'secrets' },
  { id: 'jwt', label: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, group: 'secrets' },
  { id: 'bearer', label: 'Bearer token', re: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/g, group: 'secrets', keep: 1 },
  { id: 'password-assign', label: 'Password value', re: /\b((?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*)(["']?)[^\s"']{6,}\2/gi, group: 'secrets', keep: 1 },
  { id: 'email', label: 'Email address', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, group: 'emails' },
  { id: 'phone', label: 'Phone number', re: /(?<![\w.])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]?\d{3,4}(?![\w.])/g, group: 'phones' }
];

/**
 * @param {string} text
 * @param {{secrets?:boolean, emails?:boolean, phones?:boolean}} opts
 * @returns {{text:string, hits:Record<string,number>, total:number}}
 */
export function redact(text, opts = {}) {
  const hits = {};
  let out = text;
  for (const r of RULES) {
    if (!opts[r.group]) continue;
    out = out.replace(r.re, (...args) => {
      hits[r.label] = (hits[r.label] || 0) + 1;
      const keep = r.keep ? args[r.keep] : '';
      return keep + '[REDACTED:' + r.id + ']';
    });
  }
  return { text: out, hits, total: Object.values(hits).reduce((a, b) => a + b, 0) };
}
