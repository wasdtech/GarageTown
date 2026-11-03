"""Fit a generated UI icon into a square, transparent, palette-compressed PNG for the HUD and menus.

usage: python3 tools/fit_ui_icon.py SRC.png OUT.png [SIZE]   (SIZE defaults to 96: 2x art shown at 48px or less)
"""

import sys

from PIL import Image


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 96
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())
    # 4% margin so outlines never touch the edge; downscale with premultiplied alpha (no dark fringe)
    inner = round(size * 0.92)
    scale = inner / max(im.size)
    small = im.convert("RGBa").resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    small = small.convert("RGBA")
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(small, ((size - small.width) // 2, (size - small.height) // 2))
    canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out, optimize=True)


if __name__ == "__main__":
    main()
