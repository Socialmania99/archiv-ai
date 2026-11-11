// Keyword topic tagging. Offline, deterministic, no model.
const TOPICS = {
  coding: /\b(function|variable|bug|error|compile|api|javascript|typescript|python|react|css|html|sql|git|code|script|class|array|regex|debug|npm|json|docker)\b/gi,
  writing: /\b(essay|draft|rewrite|paragraph|tone|blog|email|proofread|headline|story|article|caption)\b/gi,
  data: /\b(dataset|csv|excel|spreadsheet|chart|statistics|average|regression|pandas|dashboard|metric)\b/gi,
  business: /\b(startup|revenue|marketing|customer|pricing|strategy|sales|roadmap|investor|b2b|market)\b/gi,
  learning: /\b(explain|learn|study|lesson|tutorial|exam|homework|concept|teach|understand)\b/gi,
  travel: /\b(trip|flight|hotel|itinerary|visa|travel|city|airport|booking)\b/gi,
  health: /\b(health|diet|workout|sleep|symptom|nutrition|fitness|exercise|doctor)\b/gi,
  design: /\b(design|logo|figma|layout|typography|colour|color|ui|ux|palette|mockup)\b/gi,
  legal: /\b(contract|legal|law|clause|gdpr|privacy|policy|compliance|license)\b/gi,
  finance: /\b(budget|invest|tax|stock|loan|salary|savings|crypto|finance|mortgage)\b/gi,
  ai: /\b(prompt|llm|gpt|model|embedding|fine-tun\w*|transformer|rag|agent)\b/gi,
  research: /\b(paper|study|citation|literature|hypothesis|survey|abstract|research)\b/gi
};

/** Return up to `max` topic tags, strongest first. A topic needs >= `min` keyword hits. */
export function suggestTags(chat, max = 4, min = 2) {
  const text = (chat.title + ' ' + chat.messages.map((m) => m.markdown).join(' ')).slice(0, 60000);
  const scored = [];
  for (const [tag, re] of Object.entries(TOPICS)) {
    const hits = (text.match(re) || []).length;
    if (hits >= min) scored.push([tag, hits]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, max).map((x) => x[0]);
}

export const mergeTags = (...lists) => [...new Set(lists.flat().map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
