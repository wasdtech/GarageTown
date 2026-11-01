"""Warps an AI-generated isometric floor pad so its top face matches the game's 2:1 diamond.

Detects the pad's top, left and right corners from the alpha channel and applies an affine
transform onto a W x W/2 diamond (the slab edge, if any, stays below it).

Usage: python3 -I tools/fit_iso_pad.py <in.png> <out.png> [width=256]
"""
import sys

from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 256
H = W // 2
im = Image.open(src).convert('RGBA')
im = im.crop(im.getbbox())
a = im.getchannel('A').load()
w, h = im.size
pts = [(x, y) for y in range(h) for x in range(w) if a[x, y] > 128]
top = min(pts, key=lambda p: (p[1], abs(p[0] - w / 2)))
left = min(pts, key=lambda p: (p[0], p[1]))
right = max(pts, key=lambda p: (p[0], -p[1]))
# target: top -> (W/2, 0), left -> (0, H/2), right -> (W, H/2); solve inverse affine (dst -> src)
(x1, y1), (x2, y2), (x3, y3) = (W / 2, 0), (0, H / 2), (W, H / 2)
(u1, v1), (u2, v2), (u3, v3) = top, left, right
det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2)


def solve(t1, t2, t3):
    a_ = (t1 * (y2 - y3) - y1 * (t2 - t3) + (t2 * y3 - t3 * y2)) / det
    b_ = (x1 * (t2 - t3) - t1 * (x2 - x3) + (x2 * t3 - x3 * t2)) / det
    c_ = (x1 * (y2 * t3 - y3 * t2) - y1 * (x2 * t3 - x3 * t2) + t1 * (x2 * y3 - x3 * y2)) / det
    return a_, b_, c_


coeffs = (*solve(u1, u2, u3), *solve(v1, v2, v3))
out_h = int(H * 1.25)  # room for a slab edge below the diamond
out = im.transform((W, out_h), Image.AFFINE, coeffs, resample=Image.BICUBIC)
out = out.crop((0, 0, W, out.getbbox()[3] if out.getbbox() else out_h))
out.save(dst)
print('ok', out.size, 'corners', top, left, right)
