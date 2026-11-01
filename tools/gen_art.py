"""Generates the M0 isometric SVG art (original designs) into art/src.

Cars are built from 3D boxes projected with 2:1 isometry, facing south-east.
Layers per car: shadow.svg (under), body.svg (grayscale, tinted in-game), details.svg (on top).
Run: python3 tools/gen_art.py
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'art', 'src')
INK = '#1d1d2b'
W, H = 128, 80


def proj(x, y, z, ox, oy):
    return (ox + (x - y), oy + (x + y) / 2 - z)


def poly(points, fill, stroke=True, sw=3):
    pts = ' '.join(f'{px:.1f},{py:.1f}' for px, py in points)
    s = f' stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ''
    return f'<polygon points="{pts}" fill="{fill}"{s}/>'


def box_faces(b, ox, oy, shades):
    x0, y0, z0, x1, y1, z1 = b
    P = lambda x, y, z: proj(x, y, z, ox, oy)
    top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]
    front = [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)]  # faces +x (down-right)
    side = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)]  # faces +y (down-left)
    return [poly(side, shades[2]), poly(front, shades[1]), poly(top, shades[0])]


def inset_quad(face, t=0.18):
    cx = sum(p[0] for p in face) / 4
    cy = sum(p[1] for p in face) / 4
    return [(p[0] + (cx - p[0]) * t, p[1] + (cy - p[1]) * t) for p in face]


def svg(body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        + body
        + '</svg>\n'
    )


BODY = ('#e0e0e0', '#b0b0b0', '#808080')
CABIN = ('#d4d4d4', '#a4a4a4', '#8a8a8a')
GLASS = '#5fa8d3'
LIGHT = '#ffe066'
TAIL = '#e63946'

CARS = {
    # length, width, chassis h, cabin (x0, x1, h), extras
    'vespa_gt': dict(L=56, Wd=30, h=11, cab=(8, 46, 14), wheel=6, extras=[]),
    'brutus_v8': dict(L=78, Wd=32, h=12, cab=(10, 46, 10), wheel=7, extras=[('scoop', (52, 11, 11, 64, 21, 14))]),
    'kumo_86': dict(L=72, Wd=30, h=9, cab=(16, 54, 9), wheel=6, extras=[('spoiler', (0, 2, 13, 6, 28, 15))]),
}


def car(key, L, Wd, h, cab, wheel, extras):
    # centre the footprint in the canvas
    ox = W / 2 - (L - Wd) / 2
    oy = H / 2 + 14 - (L + Wd) / 4
    P = lambda x, y, z: proj(x, y, z, ox, oy)
    lift = 3  # chassis floats above ground on wheels

    # shadow
    sh = [P(-2, -2, 0), P(L + 2, -2, 0), P(L + 2, Wd + 2, 0), P(-2, Wd + 2, 0)]
    shadow = poly(sh, 'rgba(0,0,0,0.28)', stroke=False)

    chassis = (0, 0, lift, L, Wd, lift + h)
    cx0, cx1, ch = cab
    zb, zt = lift + h, lift + h + ch
    tx0, tx1 = cx0 + ch * 0.6, cx1 - ch * 0.9  # rear and front glass slopes
    y0, y1, ty0, ty1 = 2, Wd - 2, 4, Wd - 4
    cab_side = [P(cx0, y1, zb), P(cx1, y1, zb), P(tx1, ty1, zt), P(tx0, ty1, zt)]
    cab_front = [P(cx1, y0, zb), P(cx1, y1, zb), P(tx1, ty1, zt), P(tx1, ty0, zt)]
    cab_top = [P(tx0, ty0, zt), P(tx1, ty0, zt), P(tx1, ty1, zt), P(tx0, ty1, zt)]
    body = box_faces(chassis, ox, oy, BODY)
    body += [poly(cab_side, CABIN[2]), poly(cab_front, CABIN[1]), poly(cab_top, CABIN[0])]
    for _, b in extras:
        body += box_faces(b, ox, oy, CABIN)

    det = []
    # wheels on the visible (+y) side, drawn as projected circles
    for wx in (L * 0.2, L * 0.78):
        pts = [P(wx + wheel * math.cos(t), Wd + 0.5, wheel * 0.9 + wheel * math.sin(t))
               for t in [i * math.pi / 8 for i in range(16)]]
        det.append(poly(pts, '#2b2b36'))
        hub = [P(wx + wheel * 0.45 * math.cos(t), Wd + 0.6, wheel * 0.9 + wheel * 0.45 * math.sin(t))
               for t in [i * math.pi / 6 for i in range(12)]]
        det.append(poly(hub, '#c9ccd6', stroke=False))
    # windows: side and windshield
    det.append(poly(inset_quad(cab_side, 0.22), GLASS, sw=2))
    det.append(poly(inset_quad(cab_front, 0.2), GLASS, sw=2))
    # dark bumper strip along the bottom of the front and side
    det.append(poly([P(L, 0, lift), P(L, Wd, lift), P(L, Wd, lift + 2.5), P(L, 0, lift + 2.5)], '#3d405b', sw=1.5))
    # headlights on the front (+x) face, tail light on the rear corner of the side
    for yy in (Wd * 0.18, Wd * 0.82 - 5):
        q = [P(L, yy, lift + h - 5), P(L, yy + 5, lift + h - 5), P(L, yy + 5, lift + h - 2), P(L, yy, lift + h - 2)]
        det.append(poly(q, LIGHT, sw=1.5))
    t = [P(0.5, Wd, lift + h - 5), P(4, Wd, lift + h - 5), P(4, Wd, lift + h - 2), P(0.5, Wd, lift + h - 2)]
    det.append(poly(t, TAIL, sw=1.5))

    d = os.path.join(OUT, 'cars', key)
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'shadow.svg'), 'w').write(svg(shadow))
    open(os.path.join(d, 'body.svg'), 'w').write(svg(''.join(body)))
    open(os.path.join(d, 'details.svg'), 'w').write(svg(''.join(det)))


def diamond(w, h, fill, stroke, extra=''):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<polygon points="{w/2},1 {w-1},{h/2} {w/2},{h-1} 1,{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>'
        f'{extra}</svg>\n'
    )


def tiles():
    open(os.path.join(OUT, 'tiles', 'floor.svg'), 'w').write(diamond(64, 32, '#c7cbd1', '#a9aeb6'))
    dash = '<line x1="22" y1="11" x2="42" y2="21" stroke="#f1c40f" stroke-width="2" stroke-dasharray="5 4"/>'
    open(os.path.join(OUT, 'tiles', 'street.svg'), 'w').write(diamond(64, 32, '#4a4e5a', '#3b3e48', dash))


def bays():
    # 2x2-tile pad (128x64) with a coloured border and an icon
    drops = (
        '<circle cx="56" cy="30" r="4" fill="#4cc9f0"/><circle cx="66" cy="26" r="3" fill="#4cc9f0"/>'
        '<circle cx="72" cy="34" r="4" fill="#4cc9f0"/>'
    )
    wrench = (
        '<rect x="58" y="22" width="12" height="20" rx="3" fill="#f4a261" stroke="#1d1d2b" stroke-width="2"'
        ' transform="rotate(60 64 32)"/>'
    )
    for name, fill, border, icon in (
        ('bay_wash', '#d7eef7', '#3a86ff', drops),
        ('bay_mechanic', '#f5e6d8', '#f77f00', wrench),
    ):
        inner = '<polygon points="64,8 116,32 64,56 12,32" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="6 5"/>'
        open(os.path.join(OUT, 'objects', f'{name}.svg'), 'w').write(
            diamond(128, 64, fill, border, inner + icon).replace('stroke-width="1.5"', 'stroke-width="4"', 1)
        )


if __name__ == '__main__':
    for k, v in CARS.items():
        car(k, **v)
    tiles()
    bays()
    print('ok')
