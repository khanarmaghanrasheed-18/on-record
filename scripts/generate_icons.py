"""Generate On Record install icons with Pillow (run only when assets change)."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public"
ROOT.mkdir(exist_ok=True)


def icon(size: int) -> None:
    scale = size / 512
    image = Image.new("RGB", (size, size), "#23483a")
    draw = ImageDraw.Draw(image)

    def box(values: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        return tuple(round(value * scale) for value in values)

    # A ledger with two pages and the terracotta On Record mark.
    draw.rounded_rectangle(box((115, 112, 397, 400)), radius=round(26 * scale),
                           outline="#f7ebd8", width=max(2, round(18 * scale)))
    draw.line(box((256, 131, 256, 380)), fill="#f7ebd8", width=max(2, round(13 * scale)))
    draw.line(box((145, 165, 226, 165)), fill="#f7ebd8", width=max(2, round(10 * scale)))
    draw.line(box((145, 205, 222, 205)), fill="#f7ebd8", width=max(2, round(10 * scale)))
    draw.line(box((286, 165, 367, 165)), fill="#f7ebd8", width=max(2, round(10 * scale)))
    draw.line(box((290, 205, 367, 205)), fill="#f7ebd8", width=max(2, round(10 * scale)))
    draw.ellipse(box((342, 335, 423, 416)), fill="#cb7954")
    image.save(ROOT / f"icon-{size}.png", optimize=True)


for dimension in (192, 512):
    icon(dimension)
