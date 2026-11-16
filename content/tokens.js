// Token and context-window math. No DOM access here, so it also runs in the popup.
// Counts are ESTIMATES (about +/-15%): the real tokenizer of each AI is private to that AI.
// Window sizes are the model's published limit; chat apps sometimes cap lower, so every
// size can be changed by the user (per site) and the meter always says where a size came from.
(function () {
  const CV = (globalThis.CV = globalThis.CV || {});
  if (CV.estimateTokens) return;

  const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g;
  const PIECE = /[\p{L}]+|[\p{N}]+|[^\s\p{L}\p{N}]/gu;

  CV.estimateTokens = function (text) {
    if (!text) return 0;
    let n = 0;
    const cjk = text.match(CJK);
    if (cjk) { n += Math.round(cjk.length * 0.9); text = text.replace(CJK, ' '); }
    const parts = text.match(PIECE);
    if (parts) for (const p of parts) {
      const c = p.charCodeAt(0);
      if (c >= 48 && c <= 57) n += Math.ceil(p.length / 3);          // digits
      else if (p.length === 1) n += 1;                               // punctuation / short word
      else n += p.length <= 7 ? 1 : Math.ceil(p.length / 4.5);       // common words = 1 token, long words split
    }
    return n;
  };
  /** Cost added by each message by the chat format itself (role markers, separators). */
  CV.MSG_OVERHEAD = 4;

  // Ordered: first match wins. [regex on lower-cased text, window in tokens, label]
  CV.MODEL_WINDOWS = [
    [/llama[ -]?4[ -]?scout/, 10000000, 'Llama 4 Scout'],
    [/gpt[ -]?5\.[3-9]|gpt[ -]?5[ -]?\.?[3-9]|gpt[ -]?5\.5/, 1000000, 'GPT-5.x'],
    [/gpt[ -]?5[ -]?(mini|nano)/, 400000, 'GPT-5 mini'],
    [/gpt[ -]?5/, 400000, 'GPT-5'],
    [/gpt[ -]?4\.1/, 1000000, 'GPT-4.1'],
    [/gpt[ -]?4o|gpt[ -]?4[ -]?turbo|chatgpt[ -]?4/, 128000, 'GPT-4o'],
    [/\bo[134][ -]?(mini|pro)?\b/, 200000, 'o-series'],
    [/(fable|mythos)/, 1000000, 'Claude'],
    [/(opus|sonnet)[ -]?4[ .-]?[6-9]|(opus|sonnet)[ -]?[5-9]/, 1000000, 'Claude 4.6+'],
    [/\bclaude\b|\bopus\b|\bsonnet\b|\bhaiku\b/, 200000, 'Claude'],
    [/\bgemini\b|\bgemma\b/, 1048576, 'Gemini'],
    [/deepseek[ -]?v?4/, 1000000, 'DeepSeek V4'],
    [/\bdeepseek\b/, 128000, 'DeepSeek'],
    [/qwen[ -]?3\.5|qwen[ -]?[4-9]/, 1000000, 'Qwen 3.5+'],
    [/\bqwen|\bqwq\b/, 128000, 'Qwen'],
    [/\bkimi\b|\bmoonshot\b/, 262144, 'Kimi'],
    [/\bminimax\b/, 1000000, 'MiniMax'],
    [/\bgrok\b/, 256000, 'Grok'],
    [/\bllama\b/, 128000, 'Llama'],
    [/\bmistral\b|\bmixtral\b|\bcodestral\b|\ble chat\b|\bmagistral\b/, 128000, 'Mistral'],
    [/\bglm\b|\bchatglm\b|\bzhipu\b/, 128000, 'GLM'],
    [/\bsonar\b/, 128000, 'Sonar'],
    [/\bcommand[ -]?r\b/, 128000, 'Command R'],
    [/phi[ -]?[34]/, 128000, 'Phi'],
    [/\bernie\b|\bwenxin\b/, 128000, 'ERNIE'],
    [/\bhunyuan\b|\bdoubao\b|\byuanbao\b|\bspark (lite|pro|max|ultra|4)/, 128000, 'Chinese LLM']
  ];
  // Site fallbacks used only when no model name is found on the page.
  CV.SITE_WINDOWS = { chatgpt: 128000, claude: 200000, gemini: 1048576, deepseek: 128000, grok: 256000, kimi: 262144, qwen: 128000, mistral: 128000, perplexity: 128000, copilot: 128000, metaai: 128000, poe: 128000 };
  CV.DEFAULT_WINDOW = 128000;
  CV.WINDOW_CHOICES = [[0, 'Auto'], [8000, '8K'], [16000, '16K'], [32000, '32K'], [64000, '64K'], [128000, '128K'], [200000, '200K'], [262144, '256K'], [400000, '400K'], [1000000, '1M'], [2000000, '2M']];

  CV.matchModel = function (text) {
    const t = String(text || '').toLowerCase();
    for (const [re, win, label] of CV.MODEL_WINDOWS) if (re.test(t)) return { window: win, label };
    return null;
  };

  /** Resolve the window: user choice > model named on the page > site default > 128K. */
  CV.resolveWindow = function ({ siteId, modelText, userSite, userDefault }) {
    if (userSite) return { window: userSite, source: 'You set this', label: '' };
    if (userDefault) return { window: userDefault, source: 'Your default', label: '' };
    const m = CV.matchModel(modelText);
    if (m) return { window: m.window, source: 'Detected from the page', label: m.label };
    const s = siteId && CV.SITE_WINDOWS[siteId];
    if (s) return { window: s, source: 'Typical for this site', label: '' };
    return { window: CV.DEFAULT_WINDOW, source: 'Default guess', label: '' };
  };

  CV.compactNum = function (n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  };

  /** msgs: [{role, text}] -> numbers for the meter. */
  CV.meterStats = function (msgs, win) {
    let you = 0, ai = 0;
    msgs.forEach((m) => { const t = CV.estimateTokens(m.text) + CV.MSG_OVERHEAD; if (m.role === 'user') you += t; else ai += t; });
    const total = you + ai;
    const pct = win ? Math.min(999, (total / win) * 100) : 0;
    const turns = Math.max(1, Math.round(msgs.length / 2));
    const avgTurn = total / turns;
    return { total, you, ai, count: msgs.length, window: win, pct, left: Math.max(0, win - total), turnsLeft: avgTurn ? Math.floor(Math.max(0, win - total) / avgTurn) : 0,
      level: pct >= 90 ? 'red' : pct >= 70 ? 'amber' : 'green' };
  };
})();
