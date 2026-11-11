# Archiv AI privacy policy

Effective date: 2026-11-10 · Contact: open an issue on the project's GitHub page

Archiv AI is a browser extension that exports AI chat conversations to files. This policy explains what it does with data.

## Short version
Archiv AI works on your device. It has no account system, no server of its own, no analytics and no advertising. We do not collect, sell or share your data.

## What Archiv AI reads
When you export a chat (by clicking Archiv AI, using the shortcut or the right-click menu, or the small Export button), Archiv AI reads the text of the conversation on the page you are viewing. On supported AI sites it also checks, on the page itself, whether a conversation is present so it can show its Export button. This check never leaves your device.

## What Archiv AI stores, and where
- **Inbox copies:** chats you send with "Export this chat" wait in local extension storage on your computer until you Save, Export or Discard them. Duplicate detection and topic tags run locally.
- **Saved chats:** only if you click "Save to vault". They are kept in your browser's local database (IndexedDB) on your computer. You can delete them in Settings.
- **Settings and selector fixes:** kept in browser storage. Selector fixes and the on/off setting for the Export button are CSS selector text and a true/false value; browsers may sync these between your signed-in browsers.
- **Notion connection (optional):** your Notion integration token and page ID are kept in local extension storage and are never synced. Disconnect in Settings to remove them.

## When data leaves your device
Only in one case: you choose "Notion" as the format and click "Send to Notion". Archiv AI then sends that chat's content, directly from your browser to Notion's API (api.notion.com), using your own token, to create a page or database row in your own workspace. Notion's handling of that data is covered by Notion's privacy policy. Archiv AI never sends anything to any other server.

## Support link
The dashboard has an optional "Buy me a coffee" link and links to the project's GitHub page. They are plain links that open in a new tab only when you click them. The extension makes no request to those sites by itself.

## Permissions
Archiv AI asks for the minimum it needs: access to the current tab when you use it, a content script on listed AI chat sites, local storage, a context-menu item, and optional access to api.notion.com if you connect Notion.

## Remote code
Archiv AI does not download or run remote code.

## Children
Archiv AI is not directed at children and collects no personal information.

## Changes
If this policy changes, the new version will be published at this address with a new effective date.
