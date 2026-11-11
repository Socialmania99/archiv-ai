// Optional demo chats so the dashboard is not empty on day one.
// Every record has sample:true so they can be removed in one click.
const DAY = 86400000;
const code = (lang, body) => '```' + lang + '\n' + body + '\n```';

const T = [
  ['Plan a 3-day Kyoto trip', 'chatgpt', 'Travel', ['travel'], 0, 'I have 3 days in Kyoto in April. Plan it around temples and food.', '## Day 1\n- Fushimi Inari at sunrise\n- Nishiki Market lunch\n- Gion evening walk\n\n## Day 2\n- Arashiyama bamboo grove\n- Tenryu-ji garden\n\n| Day | Focus |\n| --- | --- |\n| 1 | Shrines and food |\n| 2 | Gardens |\n| 3 | Kinkaku-ji and tea |', 3],
  ['Fix React useEffect infinite loop', 'claude', 'Code', ['react', 'bug'], 0, 'My useEffect keeps re-running and the page freezes.', 'The effect lists an object created on every render in its dependency array.\n\n' + code('jsx', 'const opts = useMemo(() => ({ id }), [id]);\nuseEffect(() => { load(opts); }, [opts]);') + '\n\nMemoise the object or depend on primitives.', 4],
  ['Cold email for a design agency', 'chatgpt', 'Writing', ['email'], 1, 'Write a short cold email to a SaaS founder offering a landing page redesign.', 'Subject: A faster path to more demo requests\n\nHi {{name}},\n\nI looked at your pricing page and noticed three quick wins that could lift conversions.\n\n- Clearer headline\n- Social proof above the fold\n- One primary call to action\n\nOpen to a 15-minute call this week?', 2],
  ['Kubernetes networking explained', 'gemini', 'Learning', ['devops'], 3, 'Explain how a request reaches a pod in Kubernetes.', 'A request usually travels **Ingress → Service → Pod**.\n\n1. The Ingress controller receives traffic\n2. kube-proxy routes the Service IP to a healthy pod\n3. The CNI plugin delivers packets to the pod network\n\n' + 'Services give pods a stable address even when pods are replaced. '.repeat(6), 4],
  ['SQL window functions cheat sheet', 'claude', 'Code', ['sql'], 5, 'Show me the most useful SQL window functions with examples.', code('sql', 'SELECT name, dept,\n  RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rnk,\n  LAG(salary) OVER (ORDER BY hired_on) AS prev_salary\nFROM staff;') + '\n\nUse `ROW_NUMBER` for unique ordering and `RANK` when ties should share a position.', 3],
  ['Half-marathon training plan', 'gemini', 'Health', ['running'], 9, 'Build a 10 week half marathon plan for a beginner.', '**Weeks 1–4:** three easy runs, one long run building from 5 to 8 km.\n\n**Weeks 5–8:** add tempo intervals, long run to 15 km.\n\n**Weeks 9–10:** taper volume by 30 percent.\n\n' + 'Rest days matter as much as the runs. '.repeat(8), 4],
  ['Pricing page copy ideas', 'claude', 'Writing', ['copy', 'saas'], 16, 'Give me 5 headlines for a SaaS pricing page.', '1. Simple pricing that grows with you\n2. Pay for what you use\n3. Start free, upgrade when it clicks\n4. One plan, no surprises\n5. Pricing built for small teams', 2],
  ['Rust vs Go for a CLI tool', 'deepseek', 'Code', ['rust', 'go'], 25, 'Rust or Go for a small CLI tool?', 'Go compiles faster and has a simpler learning curve. Rust gives tighter control and smaller binaries.\n\n| | Go | Rust |\n| --- | --- | --- |\n| Build time | fast | slower |\n| Binary size | larger | smaller |\n| Learning curve | gentle | steep |', 3],
  ['Summarise the GDPR basics', 'perplexity', 'Learning', ['law'], 38, 'Summarise the GDPR in plain English.', 'The GDPR gives people rights over their personal data: access, correction, deletion and portability.\n\n' + 'Organisations need a lawful basis and must report breaches within 72 hours. '.repeat(7), 3],
  ['Weekly meal prep list', 'chatgpt', 'Health', ['food'], 52, 'Make a vegetarian meal prep list for 5 days.', '- Chickpea curry\n- Roasted veg bowls\n- Overnight oats\n- Lentil soup\n- Quinoa salad', 2],
  ['Python decorators in 5 minutes', 'claude', 'Learning', ['python'], 70, 'Explain Python decorators simply.', 'A decorator wraps a function to add behaviour.\n\n' + code('python', 'def timed(fn):\n    def wrap(*a, **k):\n        import time; t = time.time()\n        r = fn(*a, **k)\n        print(time.time() - t)\n        return r\n    return wrap') + '\n\nApply it with `@timed`.', 3],
  ['Negotiating a salary offer', 'gemini', 'Writing', ['career'], 98, 'How do I negotiate a job offer politely?', 'Thank them, express enthusiasm, then anchor with market data.\n\n' + 'Ask for the full package before reacting. '.repeat(6), 3],
  ['Home espresso grinder comparison', 'perplexity', '', ['buying'], 130, 'Compare entry-level espresso grinders.', 'Look for stepless adjustment, burr size above 40 mm and low retention.', 2],
  ['Learn Spanish in 30 days', 'chatgpt', 'Learning', ['language'], 160, 'Give me a 30 day Spanish plan.', 'Week 1: greetings and numbers. Week 2: present tense. Week 3: travel phrases. Week 4: conversation practice.', 2]
];

export function makeSamples(now = Date.now()) {
  const names = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', perplexity: 'Perplexity', deepseek: 'DeepSeek' };
  return T.map(([title, site, folder, tags, ago, user, ai, extra], n) => {
    const messages = [{ i: 0, role: 'user', markdown: user }, { i: 1, role: 'assistant', markdown: ai }];
    for (let k = 1; k < extra - 1; k++) {
      messages.push({ i: messages.length, role: 'user', markdown: 'Can you go deeper on part ' + k + '?' });
      messages.push({ i: messages.length, role: 'assistant', markdown: 'Sure. ' + ai.split('\n')[0] });
    }
    return {
      id: 'sample-' + n, sample: true, title, site, siteName: names[site], url: '', exportedAt: new Date(now - ago * DAY).toISOString(),
      messages, tags, folder, savedAt: now - ago * DAY - n * 600000
    };
  });
}
