# Chrome Web Store listing: Archiv AI (draft)

> **Name check.** Renamed from Cairn (a studio already ships "Cairn Guard" for AI chats) to Archiv AI. A web search found no AI-chat-export extension called Archiv AI, but "archive" names are crowded and that is not trademark clearance. Search the Web Store and trademark databases yourself, and check for a free domain. Swap the logo (`icons/*.png`) for an archive-themed mark before submitting.

## Basics
| Field | Value |
|---|---|
| Category | Productivity |
| Language | English |
| Version | 0.6.0 |
| Price | Free |

## Short description (max 132 characters)
Save AI chats as PDF, Word, PNG, Markdown, Notion or Obsidian. Private, on-device, no account. Redacts secrets first.

## Detailed description
Archiv AI saves your AI conversations as clean documents you can keep, share and search.

**Export**
- PDF, Word (.docx), PNG image, Markdown, HTML, JSON or plain text
- Send a chat straight into a Notion page (you connect your own Notion integration)
- Save as an Obsidian note with frontmatter and tags, or export your whole library as Obsidian notes
- Pick which messages to include, choose a theme (Light, Dark, Sepia, Sakura), font and size
- Load the full history of long chats before exporting

**Privacy first**
- Everything runs on your device. No account, no server, no analytics
- Redact API keys, tokens, passwords, emails and phone numbers before a file is created

**Library**
- Keep chats in a private, searchable library with tags and folders
- Find any word inside a saved chat, with highlights and next/previous
- Combine several chats into one document
- Back up and restore as a single file

**Works where you chat**
- Built-in support for major AI chat sites, including ChatGPT, Claude, Gemini, DeepSeek, Grok, Copilot and Perplexity
- On other chat pages, Archiv AI tries to detect the messages itself. If it misses, use "Teach Archiv AI": click one of your messages and one reply, and Archiv AI remembers the pattern for that site
- Works on self-hosted chat interfaces too

**How to use it**
Open a chat, click the Archiv AI icon (or press Alt+Shift+E, or right-click the page and choose "Export this chat"), pick a format, done.

**Notes**
- Chat sites change their pages often. If a site stops exporting, use Teach Archiv AI or the selector fix box.
- PDF export uses your browser's print dialog ("Save as PDF").
- Archiv AI is an independent tool and is not affiliated with or endorsed by any AI provider. Product names are used only to describe compatibility.

## Single purpose (dashboard field)
Archiv AI lets a user export the AI chat conversation shown in a browser tab to a document file (PDF, Word, image, Markdown, HTML, JSON, text) or to their own Notion page, and keep exported chats in a local, private library.

## Permission justifications
| Permission | Why |
|---|---|
| `storage` | Saves user settings, per-site selector fixes and the optional Notion connection on the device. |
| `unlimitedStorage` | The local library of saved chats can exceed the default browser quota. |
| `activeTab` | Reads the chat on the tab where the user clicks Archiv AI, a shortcut, or the context menu, on any site, without broad host access. |
| `scripting` | Injects Archiv AI's chat reader into that tab when the user asks to export a page that is not on the built-in list. |
| `contextMenus` | Adds the "Export this chat with Archiv AI" menu item. |
| Host access (content script on listed AI chat sites) | Lets the shortcut work immediately and shows a small Export button only on AI chat pages. Message text is read locally to build the export. Nothing is sent anywhere. |
| Optional host `https://api.notion.com/*` | Requested only when the user connects Notion, so the extension can create a page in the user's own workspace. |
| Remote code | None. All code ships in the package. |

## Privacy tab (Developer Dashboard)
- Data types to declare: **Website content** (chat text read from the page on user action; stays on device unless the user sends it to Notion) and **Authentication information** (the user's own Notion integration token, stored locally, never synced).
- Tick all three certifications: not sold, not used for unrelated purposes, not used for creditworthiness or lending.
- Privacy policy URL: host `store/privacy-policy.html` (for example GitHub Pages) and paste the link.

## Assets (in `store/assets/`)
- Screenshots 1280x800: `01` to `06`
- Small promo tile 440x280, marquee 1400x560
- Store icon: `icons/128.png`

## Before you press submit
1. Rename (see note at the top) and regenerate assets: `node tools/make-store-assets.mjs`.
2. Test each site you plan to name in the description on a real account. Remove any that do not work.
3. Fill the support email and publisher name in the privacy policy.
4. Build the package: `bash tools/build-store.sh` and upload `dist/*.zip`.
5. Expect a longer review: many host patterns plus `scripting`. The justifications above are written for that.
