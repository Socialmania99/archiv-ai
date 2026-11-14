# Archiv AI changelog and notes

Save chats from 15 AI platforms to PDF, Word, PNG, Markdown, HTML, JSON or text. Secrets are redacted before export. A private, searchable vault keeps every chat. Nothing leaves your device.

**Name:** Archiv AI: "Archiv" is German for "archive". It is a private archive of the AI conversations worth keeping. Earlier names: ChatVault (used by several store listings) and Cairn (a studio already ships "Cairn Guard" for AI chats).

## Install (developer mode)
1. Unzip. Open `chrome://extensions`, turn on Developer mode.
2. **Load unpacked**, pick the `archiv-ai` folder.
3. Open a chat on a supported site and **reload that tab once**.
4. Click the Archiv AI icon, then **Export this chat**, or press Alt+Shift+E.
5. Click **Open dashboard** in the popup. Use **Settings → Add sample chats** to see the dashboard filled in.

## What's new in v0.5
- **Notion export.** Connect your own Notion integration (token + page link) in Dashboard > Settings, then pick Notion as the format. Headings, lists, code, tables, quotes and images become native Notion blocks; long chats are sent in batches with retry on rate limits. The token stays in local storage and is never synced. Tested against a mock Notion API only.
- **Obsidian export.** Notes with YAML frontmatter (title, site, source, date, tags) and role callouts or plain headings. "Open in Obsidian" copies the note and opens an `obsidian://new` link (vault and folder configurable); "Download note" saves a .md. Library > "ZIP for Obsidian" exports every saved chat with tags and folders. Tested in Chromium; the `obsidian://` hand-off itself was not tried against a real Obsidian install.
- **Find inside a saved chat.** Library > Preview has a find bar: highlights, "3 of 12" counter, next/previous (Enter / Shift+Enter), case switch, "only matches". The library search term carries over.
- **Web Store kit** in `store/`: listing text, permission justifications, privacy policy (md + html), 6 screenshots, promo tile and marquee. Build the upload with `bash tools/build-store.sh`.
- **Renamed to Archiv AI** (from Cairn, which clashed with an existing AI-chat extension). Saved chats from the old build are copied over automatically on first run. The logo is still the old stacked-stones icon: replace `icons/*.png` with an archive-themed mark before publishing.

## What was new in v0.4
- **239 AI tools listed** (all you asked for) in Dashboard > Supported sites, with search, category and status filters. Only what a browser can read is marked as working; IDE plugins, terminals, desktop and mobile apps are listed as **No web page**, because there is nothing in a tab to export.
- **Works on any page.** Click the icon (or Alt+Shift+E, or right-click > Export this chat with Archiv AI) on any http(s) tab. Archiv AI injects itself on demand through `activeTab`, so there is no "all websites" permission. Self-hosted UIs (Open WebUI, LibreChat, SillyTavern, localhost) work the same way.
- **Light / dark switcher**: small sun/moon button in the popup, dashboard and export page. Remembered everywhere.
- **Popup redesigned** in the dashboard style. Round in-page export button on known AI sites (switch off in Settings).
- Tested: 13 unit groups, and Chromium end-to-end runs (adapters, auto-detect, Teach Archiv AI, in-page button, injection on unknown hosts and localhost, theme sync).

**Honest status:** 3 sites have selectors written from knowledge (ChatGPT, Claude, Gemini), 12 more are guesses (beta), and the remaining ~200 rely on auto-detect + Teach Archiv AI. **None were checked on live accounts.** Mock pages prove the logic, not the real markup.

## What was new in v0.3
- 15 platforms (was 7): ChatGPT, Claude, Gemini, DeepSeek, Grok, Copilot, GitHub Copilot, Google AI Mode, AI Studio, Perplexity, NotebookLM, Kimi, YuanBao, Qwen, Doubao.
- **Auto-detect**: if a site's selectors fail, Archiv AI scans for user/AI turns by attribute names.
- **Teach Archiv AI**: popup button. Click one of your messages, then one AI reply. Archiv AI derives and saves selectors for that site.
- **None of the 12 beta sites are verified on a live account.** Auto-detect and Teach Archiv AI are the safety net.

## What was new in v0.2
| Area | Change |
|---|---|
| Brand | Renamed Archiv AI, new logo, new glass-purple UI |
| Dashboard | Overview with stats, activity chart, recent chats, quick find, folders. Plus Library, Folders, Supported sites, Settings |
| Image export | PNG, rendered locally. Long chats are split into parts and zipped |
| PDF themes | Light, Dark, Sepia, Sakura. Dark and Sakura fill the full page |
| Combine chats | Tick two or more chats in the Library, **Export combined**, one document |
| Platforms | 7 sites. Copilot, Perplexity, DeepSeek are **beta** |
| Brand-safe | 100% on-device badge, no account |

Kept from v0.1: redaction, message picking, full-history loading, Word export, selector fixes, JSON backup and import.

## Supported sites
See Dashboard > Supported sites (239 tools). Built-in selectors: ChatGPT, Claude, Gemini, DeepSeek, Grok, Copilot, GitHub Copilot, Google AI Mode, AI Studio, Perplexity, NotebookLM, Kimi, YuanBao, Qwen, Doubao. Everything else: auto-detect + Teach Archiv AI.

## Known limits
- **Selectors are unverified against live sites.** They are in `content/adapters.js`. Beta sites are written from memory of each site's markup. Test each one. If messages are missing, paste new selectors in the popup under "Fix selectors".
- Images in chats export as links (Word, PDF) or alt text (PNG).
- PDF uses the browser print dialog. Choose "Save as PDF". Dark and Sakura themes need "Background graphics" left on (Archiv AI requests it).
- PNG parts: a very long chat is cut into slices of about 7000 px, so a cut can fall mid-line.
- Not built yet: Google Docs sync, Claude Artifacts export.

## Privacy
Permissions: `storage`, `unlimitedStorage`, `activeTab`, `scripting`, `contextMenus`, and 53 AI-site host patterns for the auto-loaded button. No broad host access. No analytics, no remote code, no network requests. Saved chats stay unredacted in this browser's IndexedDB so you can re-export with other settings. Delete them in Settings.

## Project layout
```
manifest.json            MV3
background.js            opens pages, shortcut
content/registry.js      the 239-tool directory (data)
content/adapters.js      per-site selectors  <- edit when a site changes
lib/inject.js            on-demand injection
lib/notion.js notion-store.js   Notion blocks + API client
lib/obsidian.js          Obsidian notes
lib/find.js              find-in-chat
store/  tools/          Web Store kit and build scripts
theme.js popup.css       light/dark switcher, popup styles
content/md.js            DOM -> Markdown
content/content.js       scan, auto-scroll, payload
popup.*                  toolbar popup
export.*                 export page (preview, formats, themes, privacy)
dashboard.*              dashboard, library, folders, sites, settings
lib/markdown.js          Markdown -> AST
lib/render.js            HTML / MD / TXT / JSON, themes
lib/docx.js  zip.js      Word + ZIP writers
lib/image.js             PNG renderer
lib/redact.js            secret and PII patterns
lib/stats.js sample.js   dashboard numbers, demo chats
lib/db.js                IndexedDB
test/unit.mjs            10 test groups
test/e2e.mjs             loads the extension in Chromium against mock chat pages
```

## Tests
```
node test/unit.mjs
node test/e2e.mjs      # needs Playwright + Chromium
node test/e2e-v04.mjs
node test/e2e-notion.mjs
node test/e2e-find.mjs
node test/e2e-obsidian.mjs
node test/e2e-migrate.mjs
```

## Before publishing
1. Test each site on a real account. Fix selectors.
2. Screenshots 1280x800 (dashboard, export page, dark PDF). Promo tile 440x280.
3. Privacy policy page: "all data stays on your device".
4. Name check: search the Chrome Web Store and trademark databases for "Archiv AI" before committing. A web search found no AI-chat-export extension with that exact name, but "archive"-style names are crowded and a search is not clearance.

## Next
Pro tier (cloud-free): unlimited PDF themes, branded headers. Branded PDF headers. Claude Artifacts export. Notion database mode.

## v0.6
- Website and README: added the 2-minute walkthrough video. On the site it loads from YouTube (privacy-enhanced mode) only after you press play; the README shows a clickable thumbnail.

- **One tab.** "Export this chat" sends the chat to the Archiv AI **Inbox** in the single Archiv AI tab (reused if open). Each entry is a "Recent copy from <tool>" with Save to vault, Export… or Discard.
- **Duplicate detection.** Same chat (site + URL, or title when the URL is a site home) is recognised. Identical: the saved copy is replaced. New messages: the saved chat keeps its messages and the new ones are added, marked **Updated**. Diverged: content replaced, tags and folder kept.
- **Topic tags.** Up to four tags suggested from keywords (coding, travel, data, …); edit them in the Inbox card or on the export page.
- **Export dock.** One-click format icons below the preview, exporting the selected messages (PDF, Word, image, Markdown, JSON, text, HTML, Obsidian, Notion).
- **New sidebar** (icon rail + collapsible tree) on the dashboard and export pages.
- **Brand icons** for 86 of 239 tools (svgl, lobe-icons, simple-icons; logos belong to their owners). The rest show a coloured letter.
- **Claude artifacts**: the open artifact panel is appended to the export. Selectors are unverified on a live account; override from Settings if needed.
- **Notion database mode**: one row per chat with Site, Tags, Date, Messages, URL.
- **Branded PDF**: logo, source, and "Page n of N" via print margin boxes (Chrome 131+; light theme).

### v0.6 latest
- Exports no longer include the site's copy-button text or toast ("Copied to clipboard", "Failed to copy…"). Older saved chats are cleaned when exported.
- New neumorphic sun/moon switch (top-right on every page and the website), shared `theme.js` + `switch.css`.
- "Buy me a coffee" button: black with a hairline white border, local (no remote image), same everywhere.
- Hover a bar in Chats saved / Words archived: real per-day count-up (keyboard focus and tap work too). Activity card line traces itself on hover.
- Website: new "What's new" section and refreshed screenshots (`node tools/make-site-shots.mjs`).

### v0.6 follow-up
- Logos: 225 of 239 tools now have a bundled logo (your pack of 140 imported via `tools/import-logos.py`). Still letter tiles: HKChat, Aider, Kito AI, Anysphere, Sweep AI, MutableAI, Liner, Amuse Wiki AI, Xembly, Play.ht, Lovo.ai, Pandorabots, Gay AI Boyfriend, Writer Corporate Chat (its file was a 1×1 pixel).
- Export dock removed; the format menu in the action bar is the only format picker. The preview scrolls inside its own box.
- Library: Backup, Import, ZIP of Markdown and ZIP for Obsidian live in one "Backup & transfer" menu.
- Settings › Notion has a beginner step-by-step guide.
