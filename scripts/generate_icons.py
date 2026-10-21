"""Generate On Record install icons with Pillow (run only when assets change)."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public"
ROOT.mkdir(exist_ok=True)
INK, LIME, WHITE, TEAL = "#0f1b1d", "#c6f432", "#ffffff", "#2fd3b5"


def icon(size: int) -> None:
    # Draw the OR monogram from the app's 52-unit logo grid at 4x, then scale
    # down. The mark sits inside the maskable safe zone.
    big = size * 4
    unit = big * 400 / 512 / 52
    offset = (big - 52 * unit) / 2
    stroke = round(7 * unit)

    def at(x: float, y: float) -> tuple[float, float]:
        return offset + x * unit, offset + y * unit

    def dot(draw: ImageDraw.ImageDraw, x: float, y: float) -> None:
        cx, cy = at(x, y)
        draw.ellipse((cx - stroke / 2, cy - stroke / 2, cx + stroke / 2, cy + stroke / 2), fill=255)

    o_mask = Image.new("L", (big, big), 0)
    cx, cy = at(21, 26)
    outer = (12 + 3.5) * unit
    ImageDraw.Draw(o_mask).ellipse((cx - outer, cy - outer, cx + outer, cy + outer), outline=255, width=stroke)

    r_mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(r_mask)
    for start, end in (((28, 39), (28, 14)), ((28, 14), (34, 14)), ((34, 27), (28, 27)), ((33.5, 27), (40.5, 39))):
        draw.line((*at(*start), *at(*end)), fill=255, width=stroke)
        dot(draw, *start)
        dot(draw, *end)
    bx, by = at(34, 20.5)
    bowl = (6.5 + 3.5) * unit
    draw.arc((bx - bowl, by - bowl, bx + bowl, by + bowl), 270, 90, fill=255, width=stroke)

    image = Image.new("RGB", (big, big), INK)
    image.paste(LIME, mask=o_mask)
    image.paste(WHITE, mask=r_mask)
    image.paste(TEAL, mask=ImageChops.multiply(o_mask, r_mask))
    image.resize((size, size), Image.LANCZOS).save(ROOT / f"icon-{size}.png", optimize=True)


for dimension in (192, 512):
    icon(dimension)
