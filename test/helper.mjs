// After a content-script export, the Archiv AI tab shows the Inbox. Click the newest card's Export… and return that page.
export async function toExportPage(ctx, timeout = 20000) {
  const end = Date.now() + timeout;
  let pg = null;
  while (Date.now() < end && !pg) {
    for (const p of ctx.pages()) {
      if (!/chrome-extension:\/\/[^/]+\/dashboard\.html/.test(p.url())) continue;
      if (await p.locator('.ib [data-a=iexport]').first().isVisible().catch(() => false)) { pg = p; break; }
    }
    if (!pg) await new Promise((r) => setTimeout(r, 150));
  }
  if (!pg) throw new Error('Inbox card did not appear');
  await pg.locator('.ib [data-a=iexport]').first().click();
  await pg.waitForSelector('.msg', { timeout });
  return pg;
}
