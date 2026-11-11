#!/usr/bin/env python3
"""Regenerate store/privacy-policy.html from store/privacy-policy.md (tiny converter: h1/h2, paragraphs, bullets, **bold**, `code`)."""
import re, html, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = open(os.path.join(root, 'store/privacy-policy.md'), encoding='utf-8').read().split('\n')
inl = lambda t: re.sub(r'`([^`]+)`', r'<code>\1</code>', re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', html.escape(t, quote=False)))
out, ul = [], False
for l in md:
    if l.startswith('- '):
        if not ul: out.append('<ul>'); ul = True
        out.append('<li>' + inl(l[2:]) + '</li>'); continue
    if ul: out.append('</ul>'); ul = False
    if l.startswith('## '): out.append('<h2>' + inl(l[3:]) + '</h2>')
    elif l.startswith('# '): out.append('<h1>' + inl(l[2:]) + '</h1>')
    elif l.strip(): out.append('<p>' + inl(l) + '</p>')
if ul: out.append('</ul>')
page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archiv privacy policy</title>'
 '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1c1b2e}h1{font-size:28px}h2{margin-top:1.6em;font-size:20px}code{background:#f1effe;padding:1px 5px;border-radius:4px}</style></head><body>\n'
 + '\n'.join(out) + '\n</body></html>\n')
open(os.path.join(root, 'store/privacy-policy.html'), 'w', encoding='utf-8').write(page)
print('ok')
