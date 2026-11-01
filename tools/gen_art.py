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
    'pitoco': dict(L=56, Wd=30, h=11, cab=(8, 46, 14), wheel=6, extras=[]),
    'brutus_v8': dict(L=78, Wd=32, h=12, cab=(10, 46, 10), wheel=7, extras=[('scoop', (52, 11, 11, 64, 21, 14))]),
    'corisco_rs': dict(L=72, Wd=30, h=9, cab=(16, 54, 9), wheel=6, extras=[('spoiler', (0, 2, 13, 6, 28, 15))]),
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


ICONS = {
    # 48x48 job icons, thick ink outline, readable at small sizes
    'wash': '<path d="M24 6 C24 6 12 21 12 29 a12 12 0 0 0 24 0 C36 21 24 6 24 6Z" fill="#4cc9f0"/>'
            '<circle cx="19" cy="29" r="3.5" fill="#ffffff" stroke="none"/>',
    'oil': '<path d="M10 20 h20 l6 6 v14 h-26Z" fill="#f4a261"/><rect x="16" y="13" width="8" height="7" fill="#e76f51"/>'
           '<path d="M36 26 l7 -5 v4" fill="none"/><path d="M42 31 c0 3 -3 3 -3 0 c0 -2 1.5 -4 1.5 -4 c0 0 1.5 2 1.5 4Z" fill="#1d1d2b"/>',
    'polish': '<path d="M24 5 L28.5 19.5 L43 24 L28.5 28.5 L24 43 L19.5 28.5 L5 24 L19.5 19.5Z" fill="#ffd166"/>'
              '<path d="M38 6 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2Z" fill="#ffffff"/>',
    'tires': '<circle cx="24" cy="24" r="18" fill="#3d405b"/><circle cx="24" cy="24" r="9" fill="#c9ccd6"/>'
             '<circle cx="24" cy="24" r="3" fill="#1d1d2b" stroke="none"/>',
    'engine': '<rect x="9" y="17" width="26" height="20" rx="3" fill="#8d99ae"/><rect x="15" y="10" width="14" height="7" fill="#adb5bd"/>'
              '<path d="M35 22 h6 v10 h-6" fill="#8d99ae"/><path d="M4 23 v8 h5" fill="none"/>'
              '<circle cx="22" cy="27" r="5" fill="#ef476f"/>',
}


def icons():
    d = os.path.join(OUT, 'icons')
    os.makedirs(d, exist_ok=True)
    for key, body in ICONS.items():
        open(os.path.join(d, f'{key}.svg'), 'w').write(
            '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
            f'<g stroke="{INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n'
        )


def iso_box(x0, y0, x1, y1, h, ox, oy, top, right, left, unit=32):
    # footprint in tiles, h in px; returns svg polygons (left face, right face, top)
    P = lambda x, y, z: (ox + (x - y) * unit, oy + (x + y) * unit / 2 - z)
    lf = [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)]
    rf = [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)]
    tp = [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)]
    return poly(lf, left) + poly(rf, right) + poly(tp, top), P


def world():
    t = os.path.join(OUT, 'tiles')
    o = os.path.join(OUT, 'objects')
    # warm garage floor and a light concrete sidewalk with a curb line
    open(os.path.join(t, 'floor.svg'), 'w').write(diamond(64, 32, '#f1ebe0', '#ddd3c2'))
    curb = '<polyline points="1,16 32,31 63,16" fill="none" stroke="#9aa1ab" stroke-width="2"/>'
    open(os.path.join(t, 'sidewalk.svg'), 'w').write(diamond(64, 32, '#d9dde3', '#c3c8d0', curb))
    tufts = (
        '<path d="M20 14 l2 -5 l2 5 M38 20 l2 -5 l2 5 M30 9 l1.5 -4 l1.5 4" stroke="#5a9e44" stroke-width="2" fill="none"/>'
    )
    open(os.path.join(t, 'grass.svg'), 'w').write(diamond(64, 32, '#86c96b', '#86c96b', tufts))
    # hazard-striped empty bay slot (2x2 tiles)
    stripes = ''.join(
        f'<line x1="{x}" y1="0" x2="{x - 40}" y2="64" stroke="#1d1d2b" stroke-width="7"/>' for x in range(0, 200, 16)
    )
    slot = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64">'
        '<defs><clipPath id="d"><polygon points="64,2 126,32 64,62 2,32"/></clipPath></defs>'
        '<g clip-path="url(#d)"><rect width="128" height="64" fill="#ffd166"/>' + stripes + '</g>'
        '<polygon points="64,12 106,32 64,52 22,32" fill="#9aa1ab" stroke="#1d1d2b" stroke-width="2"/>'
        '<path d="M64 24 v16 M56 32 h16" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>'
        '</svg>\n'
    )
    open(os.path.join(o, 'build_slot.svg'), 'w').write(slot)
    # round-canopy tree (canvas 64x96, base at bottom centre)
    tree = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96" viewBox="0 0 64 96">'
        '<ellipse cx="32" cy="86" rx="20" ry="7" fill="rgba(0,0,0,0.25)"/>'
        '<rect x="27" y="58" width="10" height="28" rx="3" fill="#8d5a3b" stroke="#1d1d2b" stroke-width="3"/>'
        '<circle cx="32" cy="38" r="26" fill="#4f9d3a" stroke="#1d1d2b" stroke-width="3"/>'
        '<circle cx="22" cy="30" r="9" fill="#6cbf4f"/><circle cx="40" cy="44" r="6" fill="#3f8a2c"/>'
        '</svg>\n'
    )
    _ = tree  # superseded by art/src/objects/tree.png
    # neighbour parts shop: 3x2 tiles, flat roof, striped awning, sign band
    W2, H2 = 200, 170
    ox, oy = 100 - (3 - 2) * 16, 40
    body, P = iso_box(0, 0, 3, 2, 70, ox, oy, '#e9edf1', '#cfd6de', '#b7c0ca')
    sign = poly([P(0, 2, 52), P(3, 2, 52), P(3, 2, 68), P(0, 2, 68)], '#f77f00', sw=2.5)
    door = poly([P(1.1, 2, 0), P(1.9, 2, 0), P(1.9, 2, 34), P(1.1, 2, 34)], '#5fa8d3', sw=2.5)
    win = poly([P(2.2, 2, 14), P(2.8, 2, 14), P(2.8, 2, 40), P(2.2, 2, 40)], '#5fa8d3', sw=2.5)
    awning = ''.join(
        poly([P(i * 0.5, 2, 46), P(i * 0.5 + 0.5, 2, 46), P(i * 0.5 + 0.5, 2.35, 38), P(i * 0.5, 2.35, 38)],
             '#e63946' if i % 2 == 0 else '#ffffff', sw=2)
        for i in range(6)
    )
    shop = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W2}" height="{H2}" viewBox="0 0 {W2} {H2}">'
        + body + sign + door + win + awning + '</svg>\n'
    )
    _ = shop  # superseded by art/src/objects/shop.png
    # billboard frame on two posts (text drawn in-game); 140x110, base at bottom centre
    board = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="110" viewBox="0 0 140 110">'
        '<rect x="34" y="60" width="8" height="48" fill="#6c757d" stroke="#1d1d2b" stroke-width="3"/>'
        '<rect x="98" y="60" width="8" height="48" fill="#6c757d" stroke="#1d1d2b" stroke-width="3"/>'
        '<polygon points="6,8 134,22 134,72 6,58" fill="#3a86ff" stroke="#1d1d2b" stroke-width="4" stroke-linejoin="round"/>'
        '<polygon points="14,16 126,28 126,64 14,52" fill="#ffffff" opacity="0.15"/>'
        '</svg>\n'
    )
    open(os.path.join(o, 'billboard.svg'), 'w').write(board)


if __name__ == '__main__':
    # Cars are now AI-generated (tools/split_ai_car.py); car() is kept for regenerating placeholders.
    tiles()  # street (floor is replaced by world())
    bays()
    # icons(), tree and shop are now AI-generated PNGs (see art/spritecook-assets.json)
    world()
    print('ok')
