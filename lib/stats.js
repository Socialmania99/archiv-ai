// Dashboard numbers computed from saved chats. Pure functions (unit-testable).
export const DAY = 86400000;

export function chatWords(c) { return c.messages.reduce((n, m) => n + ((m.markdown.match(/\S+/g) || []).length), 0); }
export function chatTokens(c) { return Math.ceil(c.messages.reduce((n, m) => n + m.markdown.length, 0) / 4); }

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** series of {label, value, detail} for the activity chart */
export function activitySeries(chats, period = 'monthly', now = Date.now(), n = 8) {
  const out = [];
  if (period === 'weekly') {
    const end = startOfDay(now) + DAY;
    for (let k = n - 1; k >= 0; k--) {
      const to = end - k * 7 * DAY, from = to - 7 * DAY;
      const inside = chats.filter((c) => c.savedAt >= from && c.savedAt < to);
      const d = new Date(from);
      out.push({ label: MONTHS[d.getMonth()] + ' ' + d.getDate(), value: inside.length, words: inside.reduce((a, c) => a + chatWords(c), 0) });
    }
  } else {
    const nowD = new Date(now);
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(nowD.getFullYear(), nowD.getMonth() - k, 1);
      const from = d.getTime(), to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const inside = chats.filter((c) => c.savedAt >= from && c.savedAt < to);
      out.push({ label: MONTHS[d.getMonth()], value: inside.length, words: inside.reduce((a, c) => a + chatWords(c), 0) });
    }
  }
  return out;
}

export function computeStats(chats, now = Date.now()) {
  const words = chats.map(chatWords);
  const tokens = chats.map(chatTokens);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const today0 = startOfDay(now);
  const daily = (pick) => {
    const arr = [];
    for (let k = 6; k >= 0; k--) {
      const from = today0 - k * DAY, to = from + DAY;
      arr.push(sum(chats.map((c, i) => (c.savedAt >= from && c.savedAt < to ? pick(c, i) : 0))));
    }
    return arr;
  };
  const dailyChats = daily(() => 1);
  const dailyWords = daily((c, i) => words[i]);
  const todayChats = chats.filter((c) => c.savedAt >= today0);
  const maxTokens = Math.max(1, ...tokens);

  const folders = new Map();
  chats.forEach((c, i) => {
    if (!c.folder) return;
    const f = folders.get(c.folder) || { name: c.folder, count: 0, tokens: 0, sites: new Set() };
    f.count++; f.tokens += tokens[i]; f.sites.add(c.site);
    folders.set(c.folder, f);
  });
  const bySite = {};
  chats.forEach((c) => { bySite[c.site] = (bySite[c.site] || 0) + 1; });

  return {
    totals: { chats: chats.length, messages: sum(chats.map((c) => c.messages.length)), words: sum(words), tokens: sum(tokens) },
    week: { chats: sum(dailyChats), words: sum(dailyWords) },
    dailyChats, dailyWords,
    today: { chats: todayChats.length, messages: sum(todayChats.map((c) => c.messages.length)), tokens: sum(todayChats.map(chatTokens)) },
    ringOf: (c) => Math.max(0.03, Math.min(1, chatTokens(c) / maxTokens)),
    folders: [...folders.values()].sort((a, b) => b.count - a.count),
    bySite
  };
}

export function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
