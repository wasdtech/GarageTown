"""Turn a SpriteCook animation spritesheet of the mechanic into the game's two-layer sheets.

usage: python3 tools/split_worker.py SHEET.png FRAMES OUT_DIR NAME
  FRAMES   source frame indices to keep, e.g. 3,4,5,6,7 (the source has N square frames side by side)

Writes OUT_DIR/NAME.png (everything) and OUT_DIR/NAME_cloth.png (only the neutral-gray overalls/cap
pixels, to be tinted in the game and drawn on top), both as horizontal strips of equal frames,
cropped to the union of the kept frames and scaled to TARGET_H px tall (2x art, drawn at 0.5).
"""

import sys

from PIL import Image, ImageChops, ImageFilter

TARGET_H = 150


def is_cloth(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    # light neutral grays only (tiny spread between channels): keeps the dark outline, skin, hair,
    # the yellow sponge and the coloured effects out
    return max(r, g, b) - min(r, g, b) < 12 and (r + g + b) / 3 > 150 and b >= r - 3


def main() -> None:
    src, frames_arg, out_dir, name = sys.argv[1:5]
    sheet = Image.open(src).convert("RGBA")
    fh = sheet.height
    n = sheet.width // fh
    keep = [int(i) for i in frames_arg.split(",")]
    assert all(0 <= i < n for i in keep), f"sheet has {n} frames"
    frames = [sheet.crop((i * fh, 0, (i + 1) * fh, fh)) for i in keep]

    boxes = [f.getbbox() for f in frames]
    box = (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )
    scale = TARGET_H / (box[3] - box[1])
    w = round((box[2] - box[0]) * scale)
    full = Image.new("RGBA", (w * len(frames), TARGET_H))
    cloth = Image.new("RGBA", full.size)
    for k, f in enumerate(frames):
        big = f.crop(box)
        # mask at full resolution, grown by a pixel and downscaled smoothly, so outline edges don't speckle
        mask = Image.new("L", big.size)
        bp, mp = big.load(), mask.load()
        for y in range(big.height):
            for x in range(big.width):
                if is_cloth(*bp[x, y]):
                    mp[x, y] = 255
        mask = mask.filter(ImageFilter.MaxFilter(3)).resize((w, TARGET_H), Image.LANCZOS)
        small = big.resize((w, TARGET_H), Image.LANCZOS)
        full.paste(small, (k * w, 0))
        layer = small.copy()
        layer.putalpha(ImageChops.multiply(small.getchannel("A"), mask))
        cloth.paste(layer, (k * w, 0))
    # a 256-colour palette keeps these strips ~5x smaller with no visible change at game size
    for img, suffix in ((full, ""), (cloth, "_cloth")):
        img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
            f"{out_dir}/{name}{suffix}.png", optimize=True
        )
    print(f"{name}: {len(frames)} frames of {w}x{TARGET_H}")


if __name__ == "__main__":
    main()
