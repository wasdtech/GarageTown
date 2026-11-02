"""Splits an AI-generated car (painted in one saturated colour) into the game's 3 layers.

shadow  : the ground shadow (non-outline pixels below the car body, made black at ~28% alpha)
body    : paint pixels converted to greyscale (tinted in-game)
details : everything else (outline, windows, wheels, lights)

Usage: python3 -I tools/split_ai_car.py <in.png> <out_dir> [paint_hue_deg=0] [width=256]
"""
import colorsys
import os
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
paint_hue = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
target_w = int(sys.argv[4]) if len(sys.argv) > 4 else 256

im = Image.open(src).convert('RGBA')
bbox = im.getbbox()
im = im.crop(bbox)
w, h = im.size
px = im.load()
body = Image.new('RGBA', im.size)
det = Image.new('RGBA', im.size)
sh = Image.new('RGBA', im.size)
bp, dp, sp = body.load(), det.load(), sh.load()


def hue_dist(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        hue = hh * 360
        if ss > 0.35 and 0.15 < ll < 0.85 and hue_dist(hue, paint_hue) < 25:
            v = int(255 * min(1.0, ll * 1.35))
            bp[x, y] = (v, v, v, a)
        elif ss < 0.45 and 0.35 < ll < 0.75 and 70 < hue < 160:
            # greenish semi-transparent ground shadow picked up from the reference background
            sp[x, y] = (0, 0, 0, 72)
        else:
            dp[x, y] = (r, g, b, a)

os.makedirs(out, exist_ok=True)
scale = target_w / w
size = (target_w, max(1, round(h * scale)))
for name, layer in (('shadow', sh), ('body', body), ('details', det)):
    layer.resize(size, Image.LANCZOS).save(os.path.join(out, f'{name}.png'))
print('ok', size)
