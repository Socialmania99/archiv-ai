"""Builds every Archiv AI logo/icon from tools/logo-source.png (3D folder + arrow, transparent).
Run: python3 tools/make-icons.py   (needs Pillow, numpy, scipy)"""
import numpy as np, os
from PIL import Image
from scipy import ndimage as ndi
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(R, 'tools/logo-source.png')).convert('RGBA')
a = np.array(im); al = a[..., 3]
# drop the stray speckles around the edge: keep the largest solid blob, then keep original soft edge near it
core = ndi.binary_opening(al > 200, iterations=3)
lab, n = ndi.label(core); sizes = ndi.sum(core, lab, range(1, n + 1)); core = lab == (1 + int(np.argmax(sizes)))
core = ndi.binary_fill_holes(core)
near = ndi.binary_dilation(core, iterations=3)
a[..., 3] = (al * near).astype('uint8')
# kill fringe colours on the soft edge: take colour from the nearest interior pixel
inner = ndi.binary_erosion(core, iterations=4)
idx = ndi.distance_transform_edt(~inner, return_indices=True)[1]
edge = near & ~inner
a[edge, :3] = a[idx[0][edge], idx[1][edge], :3]
logo = Image.fromarray(a, 'RGBA'); logo = logo.crop(logo.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
def square(size, pad=0.04):
    s = int(size * (1 - 2 * pad)); w, h = logo.size; k = s / max(w, h)
    t = logo.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0)); c.alpha_composite(t, ((size - t.width) // 2, (size - t.height) // 2)); return c
def out(p, img, **k):
    p = os.path.join(R, p); os.makedirs(os.path.dirname(p), exist_ok=True); img.save(p, **k)
for s in (16, 48, 128, 512): out(f'icons/{s}.png', square(s, 0.02 if s <= 48 else 0.04))
out('docs/assets/logo.png', square(128)); out('docs/assets/favicon.png', square(64, .02))
out('docs/assets/favicon-32.png', square(32, .02)); out('docs/assets/favicon-16.png', square(16, .02))
out('docs/assets/apple-touch-icon.png', Image.alpha_composite(Image.new('RGBA', (180, 180), (243, 238, 255, 255)), square(180, .1)))
out('docs/assets/favicon.ico', square(64, .02), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# profile picture (GitHub / social): original gradient tile, square
pf = Image.open(os.path.join(R, 'tools/logo-profile-source.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS)
out('docs/assets/profile-icon.jpg', pf, quality=92)
out('store/assets/icon-128.png', square(128))
logo.resize((round(logo.width * 512 / logo.height), 512), Image.LANCZOS).save(os.path.join(R, 'docs/assets/logo-transparent.png'))
print('done', logo.size)
